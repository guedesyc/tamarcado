-- Capture when an appointment reaches a terminal outcome so viewed cancellations
-- keep their original position in the cancellations list.
alter table public.appointments add column closed_at timestamptz;

update public.appointments a
set closed_at=coalesce(
  (select max(e.created_at)
   from public.appointment_events e
   where e.business_id=a.business_id
     and e.appointment_id=a.id
     and e.to_status=a.status),
  a.updated_at
)
where a.status in ('cancelled_by_client','cancelled_by_professional','expired','completed','no_show');

create or replace function public.set_appointment_closed_at()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.status is distinct from old.status
     and new.status in ('cancelled_by_client','cancelled_by_professional','expired','completed','no_show') then
    new.closed_at:=coalesce(new.closed_at,now());
  end if;
  return new;
end $$;

create trigger appointments_set_closed_at
before update of status on public.appointments
for each row execute function public.set_appointment_closed_at();

-- Seeing a cancellation must not rewrite the appointment's updated_at timestamp.
create or replace function public.mark_client_cancellation_seen(p_appointment_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare changed integer;
begin
  update public.appointments
  set cancellation_seen_at=coalesce(cancellation_seen_at,now())
  where id=p_appointment_id
    and status='cancelled_by_client'
    and public.is_business_member(business_id);
  get diagnostics changed = row_count;
  if changed=0 then raise exception 'Cancelled appointment not found'; end if;
end $$;
revoke all on function public.mark_client_cancellation_seen(uuid) from public,anon;
grant execute on function public.mark_client_cancellation_seen(uuid) to authenticated;
