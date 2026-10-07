-- Tracking URLs remain usable through the locally agreed appointment date,
-- then expire at midnight at the start of the following business-local day.
-- This is additive: it preserves appointments and all token rows.

create or replace function public.appointment_link_expiry(
  p_business_id uuid,
  p_start_at timestamptz
) returns timestamptz
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select ((p_start_at at time zone coalesce(nullif(b.timezone,''),'America/Sao_Paulo'))::date + 1)::timestamp
         at time zone coalesce(nullif(b.timezone,''),'America/Sao_Paulo')
  from public.businesses b
  where b.id=p_business_id
$$;

revoke all on function public.appointment_link_expiry(uuid,timestamptz) from public,anon,authenticated;

create or replace function public.set_appointment_link_expiry()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if new.start_at is not null then
    new.token_expires_at:=public.appointment_link_expiry(new.business_id,new.start_at);
  end if;
  return new;
end
$$;

drop trigger if exists appointments_set_link_expiry on public.appointments;
create trigger appointments_set_link_expiry
before insert or update of business_id,start_at on public.appointments
for each row execute function public.set_appointment_link_expiry();

create or replace function public.sync_appointment_tracking_link_expiry()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if new.token_expires_at is distinct from old.token_expires_at then
    update public.appointment_tracking_tokens
    set expires_at=new.token_expires_at
    where appointment_id=new.id
      and expires_at is distinct from new.token_expires_at;
  end if;
  return new;
end
$$;

drop trigger if exists appointments_sync_tracking_link_expiry on public.appointments;
create trigger appointments_sync_tracking_link_expiry
after update of start_at,business_id on public.appointments
for each row execute function public.sync_appointment_tracking_link_expiry();

-- Bring existing appointments and their issued links into line without
-- deleting any appointment, token, payment, or financial record.
update public.appointments a
set token_expires_at=public.appointment_link_expiry(a.business_id,a.start_at)
where a.start_at is not null
  and a.token_expires_at is distinct from public.appointment_link_expiry(a.business_id,a.start_at);

update public.appointment_tracking_tokens t
set expires_at=a.token_expires_at
from public.appointments a
where a.id=t.appointment_id
  and t.expires_at is distinct from a.token_expires_at;

create or replace function public.issue_appointment_tracking_link(
  p_appointment_id uuid,
  p_token_hash text
) returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  appointment_expiry timestamptz;
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid tracking token';
  end if;

  update public.appointments a
  set token_expires_at=public.appointment_link_expiry(a.business_id,a.start_at)
  where a.id=p_appointment_id
    and public.is_business_member(a.business_id)
  returning a.token_expires_at into appointment_expiry;

  if not found or appointment_expiry is null or appointment_expiry<=now() then
    raise exception 'Appointment not found or unavailable';
  end if;

  insert into public.appointment_tracking_tokens(token_hash,appointment_id,expires_at)
  values(p_token_hash,p_appointment_id,appointment_expiry);
end
$$;

revoke all on function public.issue_appointment_tracking_link(uuid,text) from public,anon;
grant execute on function public.issue_appointment_tracking_link(uuid,text) to authenticated;
