-- Proposal links remain valid after the professional requests the signal, so
-- clients can cancel from the same link they received on WhatsApp.
create or replace function public.cancel_public_booking(p_token_hash text,p_reason text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.appointments%rowtype; b public.businesses%rowtype; reason_value text; eligible boolean; client_name_value text;
begin
  reason_value:=left(trim(coalesce(p_reason,'')),500);
  if char_length(reason_value)<3 then raise exception 'CANCELLATION_REASON_REQUIRED'; end if;
  select * into a from public.appointments x
  where (x.token_hash=p_token_hash or x.proposal_token_hash=p_token_hash or exists(
    select 1 from public.appointment_tracking_tokens t
    where t.appointment_id=x.id and t.token_hash=p_token_hash and t.expires_at>now()
  )) and x.token_expires_at>now() for update;
  if a.id is null then raise exception 'BOOKING_LINK_INVALID'; end if;
  if a.status not in ('requested','under_review','proposed','confirmed') then raise exception 'BOOKING_NOT_CANCELLABLE'; end if;
  select * into b from public.businesses where id=a.business_id;
  select c.name into client_name_value from public.clients c where c.id=a.client_id;
  eligible:=coalesce(a.signal_amount_cents,0)>0 and a.payment_status in ('partial','paid')
    and b.cancellation_refund_policy='before_hours'
    and a.start_at >= now()+make_interval(hours=>b.cancellation_refund_hours);
  update public.appointments set status='cancelled_by_client',
    payment_status=case when payment_status='signal_requested' then 'signal_expired' else payment_status end,
    client_cancellation_reason=reason_value,updated_at=now() where id=a.id;
  insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type,changes)
  values(a.business_id,a.id,a.status,'cancelled_by_client','client',jsonb_build_object(
    'cancellation_reason',reason_value,'refund_eligible',eligible,
    'refund_policy',b.cancellation_refund_policy,'refund_hours',b.cancellation_refund_hours
  ));
  return jsonb_build_object(
    'professional_phone',b.contact_phone,'business_name',b.name,'client_name',client_name_value,
    'service_name',a.service_name_snapshot,'requested_at',a.start_at,
    'signal_amount_cents',a.signal_amount_cents,'refund_eligible',eligible,
    'refund_policy',b.cancellation_refund_policy,'refund_hours',b.cancellation_refund_hours
  );
end $$;
revoke all on function public.cancel_public_booking(text,text) from public;
grant execute on function public.cancel_public_booking(text,text) to anon,authenticated;
