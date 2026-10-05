-- Customer identity is global. Business client records remain tenant scoped and are
-- deliberately not used to infer ownership of past appointments.
create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text check (name is null or char_length(trim(name)) between 2 and 120),
  phone text check (phone is null or char_length(trim(phone)) between 10 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_appointment_links (
  appointment_id uuid primary key references public.appointments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  linked_at timestamptz not null default now()
);
create index if not exists customer_appointment_links_user_idx on public.customer_appointment_links(user_id,linked_at desc);

alter table public.customer_profiles enable row level security;
alter table public.customer_appointment_links enable row level security;
grant select,insert,update on public.customer_profiles to authenticated;
grant select on public.customer_appointment_links to authenticated;
drop policy if exists customer_profile_self_select on public.customer_profiles;
drop policy if exists customer_profile_self_insert on public.customer_profiles;
drop policy if exists customer_profile_self_update on public.customer_profiles;
drop policy if exists customer_appointment_self_select on public.customer_appointment_links;
create policy customer_profile_self_select on public.customer_profiles for select to authenticated using (user_id=auth.uid());
create policy customer_profile_self_insert on public.customer_profiles for insert to authenticated with check (user_id=auth.uid());
create policy customer_profile_self_update on public.customer_profiles for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy customer_appointment_self_select on public.customer_appointment_links for select to authenticated using (user_id=auth.uid());

-- Possession of an unexpired tracking link proves ownership of exactly one appointment.
-- A name, phone number, business client ID or appointment ID alone never does.
create or replace function public.claim_customer_appointment(p_token_hash text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_owner uuid;
begin
  if auth.uid() is null then raise exception using message='AUTH_REQUIRED',errcode='P0001'; end if;
  if p_token_hash !~ '^[a-f0-9]{64}$' then return false; end if;
  select a.id into v_id from public.appointments a
    where a.token_expires_at>now()
      and (a.token_hash=p_token_hash or a.proposal_token_hash=p_token_hash or exists (
        select 1 from public.appointment_tracking_tokens t
        where t.appointment_id=a.id and t.token_hash=p_token_hash and t.expires_at>now()))
    limit 1;
  if v_id is null then return false; end if;
  select user_id into v_owner from public.customer_appointment_links where appointment_id=v_id;
  if v_owner is not null then return v_owner=auth.uid(); end if;
  insert into public.customer_appointment_links(appointment_id,user_id) values(v_id,auth.uid())
    on conflict (appointment_id) do nothing;
  if exists(select 1 from public.customer_appointment_links where appointment_id=v_id and user_id=auth.uid()) then
    insert into public.customer_profiles(user_id,name,phone)
      select auth.uid(),coalesce(nullif(trim(a.client_name_snapshot),''),c.name),c.phone
      from public.appointments a join public.clients c on c.id=a.client_id and c.business_id=a.business_id
      where a.id=v_id
      on conflict (user_id) do nothing;
  end if;
  return exists(select 1 from public.customer_appointment_links where appointment_id=v_id and user_id=auth.uid());
end $$;
revoke all on function public.claim_customer_appointment(text) from public,anon,authenticated;
grant execute on function public.claim_customer_appointment(text) to authenticated;

create or replace function public.get_my_customer_appointments()
returns table (
  id uuid, business_name text, business_slug text, business_timezone text, service_name text,
  start_at timestamptz, end_at timestamptz, status text, payment_status text,
  price_estimate_cents integer, agreed_price_cents integer,
  signal_amount_cents integer, signal_deadline timestamptz, customer_note text, proposal_reason text,
  created_at timestamptz, is_past boolean
) language sql stable security definer set search_path=public,pg_temp as $$
  select a.id,b.name,b.slug,b.timezone,a.service_name_snapshot,a.start_at,a.end_at,
    a.status::text,a.payment_status,a.price_estimate_cents,a.agreed_price_cents,
    a.signal_amount_cents,a.signal_deadline,a.customer_note,a.proposal_reason,a.created_at,a.end_at<now()
  from public.customer_appointment_links l
  join public.appointments a on a.id=l.appointment_id
  join public.businesses b on b.id=a.business_id
  where l.user_id=auth.uid()
  order by a.start_at desc,a.created_at desc;
$$;
revoke all on function public.get_my_customer_appointments() from public,anon,authenticated;
grant execute on function public.get_my_customer_appointments() to authenticated;
