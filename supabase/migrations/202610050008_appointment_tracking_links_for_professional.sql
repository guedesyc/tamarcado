create or replace function public.issue_appointment_tracking_link(
  p_appointment_id uuid,
  p_token_hash text
) returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  expires_at timestamptz := now() + interval '45 days';
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid tracking token';
  end if;

  update public.appointments a
  set token_expires_at=greatest(coalesce(a.token_expires_at,expires_at),expires_at)
  where a.id=p_appointment_id
    and public.is_business_member(a.business_id);

  if not found then
    raise exception 'Appointment not found or unavailable';
  end if;

  insert into public.appointment_tracking_tokens(token_hash,appointment_id,expires_at)
  values(p_token_hash,p_appointment_id,expires_at);
end
$$;

revoke all on function public.issue_appointment_tracking_link(uuid,text) from public,anon;
grant execute on function public.issue_appointment_tracking_link(uuid,text) to authenticated;
