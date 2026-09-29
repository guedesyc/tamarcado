-- Registers money received against a service, preserving deposit-as-part-of-total semantics.
-- This migration only adds a function; it does not remove or recreate tables.
create or replace function public.record_appointment_payment(
  p_appointment_id uuid,
  p_total_cents integer,
  p_received_cents integer,
  p_method text default 'pix',
  p_note text default null
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  a public.appointments%rowtype;
  received_before bigint;
  remaining bigint;
begin
  select * into a from public.appointments where id=p_appointment_id for update;
  if a.id is null or not exists (
    select 1 from public.business_members
    where business_id=a.business_id and user_id=auth.uid() and role='owner'
  ) then raise exception 'APPOINTMENT_NOT_FOUND'; end if;
  if a.status not in ('confirmed','completed') then raise exception 'APPOINTMENT_NOT_CONFIRMED'; end if;
  if a.payment_status in ('signal_requested','signal_reported') then raise exception 'SIGNAL_NOT_VERIFIED'; end if;
  if p_total_cents is null or p_total_cents<0 or p_total_cents>100000000 then raise exception 'INVALID_TOTAL'; end if;
  if p_received_cents is null or p_received_cents<=0 or p_received_cents>100000000 then raise exception 'INVALID_PAYMENT'; end if;
  if coalesce(p_method,'') not in ('pix','cash','card','transfer','other') then raise exception 'INVALID_METHOD'; end if;

  select coalesce(sum(amount_cents),0)::bigint into received_before
  from public.financial_entries
  where business_id=a.business_id and appointment_id=a.id and kind='income' and status='received';
  if received_before>=p_total_cents then raise exception 'ALREADY_PAID'; end if;
  if received_before+p_received_cents>p_total_cents then raise exception 'OVERPAYMENT'; end if;

  remaining:=p_total_cents-received_before-p_received_cents;
  insert into public.financial_entries(business_id,appointment_id,kind,amount_cents,status,method,note)
  values(a.business_id,a.id,'income',p_received_cents,'received',p_method,coalesce(nullif(trim(p_note),''),'Complemento do atendimento'));
  update public.appointments set final_price_cents=p_total_cents,
    payment_status=case when remaining=0 then 'paid' else 'partial' end,
    payment_method=p_method,updated_at=now()
  where id=a.id;
  return jsonb_build_object('received_cents',received_before+p_received_cents,'remaining_cents',remaining,'payment_status',case when remaining=0 then 'paid' else 'partial' end);
end $$;
revoke all on function public.record_appointment_payment(uuid,integer,integer,text,text) from public,anon;
grant execute on function public.record_appointment_payment(uuid,integer,integer,text,text) to authenticated;
