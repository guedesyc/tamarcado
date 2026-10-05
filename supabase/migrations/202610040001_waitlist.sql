-- Public opt-in waitlist with tenant-scoped professional management.
-- Additive only: no existing tables or rows are removed.
create table if not exists public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  customer_name text not null check (char_length(trim(customer_name)) between 2 and 100),
  customer_phone text not null check (char_length(regexp_replace(customer_phone, '[^0-9]', '', 'g')) between 10 and 15),
  preferred_date date,
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'waiting' check (status in ('waiting','contacted','booked','withdrawn')),
  contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists waitlist_business_status_created_idx
  on public.waitlist_entries(business_id,status,created_at);
create unique index if not exists waitlist_active_contact_unique
  on public.waitlist_entries(business_id,service_id,(regexp_replace(customer_phone, '[^0-9]', '', 'g')))
  where status in ('waiting','contacted');

alter table public.waitlist_entries enable row level security;
drop policy if exists waitlist_member_select on public.waitlist_entries;
create policy waitlist_member_select on public.waitlist_entries
  for select to authenticated using (public.is_business_member(business_id));
revoke all on public.waitlist_entries from anon, authenticated;
grant select on public.waitlist_entries to authenticated;

create or replace function public.join_public_waitlist(
  p_slug text,p_service_id uuid,p_name text,p_phone text,p_preferred_date date default null,p_note text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.businesses%rowtype; service_exists boolean; normalized_phone text;
begin
  if p_slug !~ '^[a-z0-9-]{3,40}$'
    or char_length(trim(coalesce(p_name,''))) not between 2 and 100
    or char_length(coalesce(p_note,''))>500 then raise exception 'INVALID_WAITLIST_REQUEST'; end if;
  normalized_phone:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
  if char_length(normalized_phone) not between 10 and 15 then raise exception 'INVALID_WAITLIST_REQUEST'; end if;
  select * into b from public.businesses where slug=p_slug and published_at is not null and not booking_paused;
  if b.id is null then raise exception 'WAITLIST_UNAVAILABLE'; end if;
  if p_preferred_date is not null and (p_preferred_date < (now() at time zone b.timezone)::date or p_preferred_date > (now() at time zone b.timezone)::date+365) then
    raise exception 'INVALID_WAITLIST_DATE';
  end if;
  select exists(select 1 from public.services where id=p_service_id and business_id=b.id and active) into service_exists;
  if not service_exists then raise exception 'WAITLIST_SERVICE_UNAVAILABLE'; end if;
  insert into public.waitlist_entries(business_id,service_id,customer_name,customer_phone,preferred_date,note)
  values(b.id,p_service_id,trim(p_name),trim(p_phone),p_preferred_date,nullif(trim(coalesce(p_note,'')),''))
  on conflict do nothing;
  -- Deliberately return the same response for new and duplicate entries.
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.join_public_waitlist(text,uuid,text,text,date,text) from public;
grant execute on function public.join_public_waitlist(text,uuid,text,text,date,text) to anon,authenticated;

create or replace function public.update_waitlist_status(p_entry_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare entry_business uuid;
begin
  if p_status not in ('contacted','booked','withdrawn') then raise exception 'INVALID_WAITLIST_STATUS'; end if;
  select business_id into entry_business from public.waitlist_entries where id=p_entry_id for update;
  if entry_business is null or not public.is_business_member(entry_business) then raise exception 'WAITLIST_ENTRY_NOT_FOUND'; end if;
  if not exists(select 1 from public.waitlist_entries where id=p_entry_id and status in ('waiting','contacted')) then raise exception 'WAITLIST_ENTRY_NOT_ACTIVE'; end if;
  update public.waitlist_entries set status=p_status,contacted_at=case when p_status='contacted' then coalesce(contacted_at,now()) else contacted_at end,updated_at=now() where id=p_entry_id;
end $$;
revoke all on function public.update_waitlist_status(uuid,text) from public,anon;
grant execute on function public.update_waitlist_status(uuid,text) to authenticated;

create or replace function public.erase_waitlist_entry(p_entry_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare entry_business uuid;
begin
  select business_id into entry_business from public.waitlist_entries where id=p_entry_id for update;
  if entry_business is null or not public.is_business_member(entry_business) then raise exception 'WAITLIST_ENTRY_NOT_FOUND'; end if;
  delete from public.waitlist_entries where id=p_entry_id;
end $$;
revoke all on function public.erase_waitlist_entry(uuid) from public,anon;
grant execute on function public.erase_waitlist_entry(uuid) to authenticated;

create or replace function public.prevent_premature_no_show()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.status='no_show' and old.status is distinct from 'no_show' and now()<old.end_at then
    raise exception 'NO_SHOW_TOO_EARLY';
  end if;
  return new;
end $$;
drop trigger if exists appointments_no_show_after_end on public.appointments;
create trigger appointments_no_show_after_end before update of status on public.appointments
for each row execute function public.prevent_premature_no_show();
