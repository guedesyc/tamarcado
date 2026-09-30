create or replace function public.reopen_appointment_signal(p_appointment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  a public.appointments%rowtype;
  b public.businesses%rowtype;
  tracking_token text;
  new_deadline timestamptz := now() + interval '1 hour';
begin
  select * into a from public.appointments where id=p_appointment_id for update;
  if a.id is null or not public.is_business_member(a.business_id) then
    raise exception 'Appointment not found';
  end if;
  if a.status<>'confirmed' or a.payment_status<>'signal_reported' then
    raise exception 'Signal is not reported';
  end if;
  select * into b from public.businesses where id=a.business_id;
  if not b.signal_enabled or nullif(trim(b.pix_key),'') is null or nullif(trim(b.pix_holder),'') is null then
    raise exception 'PIX_NOT_CONFIGURED';
  end if;
  if coalesce(a.signal_amount_cents,0)<1 then
    raise exception 'INVALID_SIGNAL_AMOUNT';
  end if;

  update public.appointments
  set payment_status='signal_requested', signal_deadline=new_deadline, signal_reported_at=null, updated_at=now()
  where id=a.id;
  insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type,actor_id,changes)
  values(a.business_id,a.id,'confirmed','confirmed','professional',auth.uid(),jsonb_build_object(
    'payment_status','signal_requested','signal_reported_at',null,'signal_deadline',new_deadline,
    'note','Profissional informou que não identificou o pagamento do sinal.'
  ));

  tracking_token:=translate(rtrim(encode(extensions.gen_random_bytes(32),'base64'),'='),'+/','-_');
  insert into public.appointment_tracking_tokens(token_hash,appointment_id,expires_at)
  values(encode(extensions.digest(tracking_token,'sha256'),'hex'),a.id,a.token_expires_at);

  return jsonb_build_object(
    'tracking_token',tracking_token,'signal_deadline',new_deadline,
    'signal_amount_cents',a.signal_amount_cents,'pix_key',b.pix_key,'pix_holder',b.pix_holder
  );
end;
$$;

revoke all on function public.reopen_appointment_signal(uuid) from public,anon;
grant execute on function public.reopen_appointment_signal(uuid) to authenticated;
