-- The Supabase pgcrypto extension is installed in extensions, outside the
-- restricted search_path used by security-definer booking functions.
-- Keep the search_path explicit and preserve all existing tables and data.
create or replace function public.request_appointment_signal(p_appointment_id uuid)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare a public.appointments%rowtype; b public.businesses%rowtype; amount integer; tracking_token text;
begin
  select * into a from public.appointments where id=p_appointment_id for update;
  if a.id is null or not public.is_business_member(a.business_id) then raise exception 'Appointment not found'; end if;
  if a.status not in ('requested','under_review','proposed') then raise exception 'Invalid appointment status'; end if;
  select * into b from public.businesses where id=a.business_id;
  if nullif(trim(b.pix_key),'') is null or nullif(trim(b.pix_holder),'') is null or b.signal_amount<=0 then raise exception 'PIX_NOT_CONFIGURED'; end if;
  amount:=case when b.signal_type='percent' then round(coalesce(a.agreed_price_cents,a.price_estimate_cents,0)*b.signal_amount/100)::integer else round(b.signal_amount*100)::integer end;
  if amount<1 then raise exception 'INVALID_SIGNAL_AMOUNT'; end if;
  -- Capacity is scoped to the selected service. The update trigger locks the
  -- service and assigns an available capacity unit atomically.
  if not public.service_has_capacity(a.business_id,a.service_id,a.start_at,a.end_at,a.id) then
    raise exception using message='SLOT_UNAVAILABLE',errcode='P0001';
  end if;
  update public.appointments set status='confirmed',payment_status='signal_requested',signal_amount_cents=amount,signal_deadline=now()+interval '1 hour',signal_reported_at=null,updated_at=now() where id=a.id;
  insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type,actor_id,changes)
    values(a.business_id,a.id,a.status,'confirmed','professional',auth.uid(),jsonb_build_object('payment_status','signal_requested','signal_amount_cents',amount,'signal_deadline',now()+interval '1 hour'));
  tracking_token:=translate(rtrim(encode(extensions.gen_random_bytes(32),'base64'),'='),'+/','-_');
  insert into public.appointment_tracking_tokens(token_hash,appointment_id,expires_at)
    values(encode(extensions.digest(tracking_token,'sha256'),'hex'),a.id,a.token_expires_at);
  return jsonb_build_object('signal_amount_cents',amount,'signal_deadline',now()+interval '1 hour','pix_key',b.pix_key,'pix_holder',b.pix_holder,'tracking_token',tracking_token);
end $$;

alter function public.verify_appointment_signal(uuid) set search_path=public,extensions,pg_temp;
revoke all on function public.request_appointment_signal(uuid) from public,anon;
grant execute on function public.request_appointment_signal(uuid) to authenticated;
