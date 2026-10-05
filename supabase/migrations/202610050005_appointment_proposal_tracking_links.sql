create or replace function public.set_appointment_proposal_tracking_token(
  p_appointment_id uuid,
  p_token_hash text
) returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid proposal tracking token';
  end if;

  update public.appointments a
  set proposal_token_hash=p_token_hash
  where a.id=p_appointment_id
    and a.status='proposed'
    and public.is_business_member(a.business_id);

  if not found then
    raise exception 'Appointment not found or proposal is no longer active';
  end if;
end
$$;

revoke all on function public.set_appointment_proposal_tracking_token(uuid,text) from public,anon;
grant execute on function public.set_appointment_proposal_tracking_token(uuid,text) to authenticated;
