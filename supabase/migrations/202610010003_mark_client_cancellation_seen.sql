alter table public.appointments
  add column if not exists cancellation_seen_at timestamptz;

create or replace function public.mark_client_cancellation_seen(p_appointment_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare changed integer;
begin
  update public.appointments
  set cancellation_seen_at=coalesce(cancellation_seen_at,now()),updated_at=now()
  where id=p_appointment_id
    and status='cancelled_by_client'
    and public.is_business_member(business_id);
  get diagnostics changed = row_count;
  if changed=0 then raise exception 'Cancelled appointment not found'; end if;
end $$;

revoke all on function public.mark_client_cancellation_seen(uuid) from public,anon;
grant execute on function public.mark_client_cancellation_seen(uuid) to authenticated;
