-- Preserve the name entered for each request while keeping one client record per phone.
alter table public.appointments add column client_name_snapshot text;

create or replace function public.request_public_booking(
  p_slug text,p_name text,p_phone text,p_service_id uuid,p_requested_date date,p_requested_time time,
  p_answers jsonb,p_note text,p_token_hash text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.businesses%rowtype; s public.services%rowtype; c public.clients%rowtype; a public.appointments%rowtype;
declare requested_start timestamptz; requested_end timestamptz; quote jsonb; duration integer; price integer;
begin
  if char_length(trim(coalesce(p_name,'')))<2 or char_length(trim(coalesce(p_phone,'')))<10 then raise exception using message='INVALID_BOOKING',errcode='P0001'; end if;
  if jsonb_typeof(coalesce(p_answers,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_answers,'[]'::jsonb))>30 then raise exception using message='INVALID_BOOKING',errcode='P0001'; end if;
  select * into b from public.businesses where slug=lower(p_slug) and published_at is not null;
  if b.id is null then raise exception using message='PROFILE_NOT_FOUND',errcode='P0001'; end if;
  if b.booking_paused or ((select coalesce(sum(eligible_completed_count),0) from public.trial_usage where business_id=b.id)>=10 and not exists(select 1 from public.subscription_records where business_id=b.id and status='active')) then raise exception using message='TM_TRIAL_PAUSED',errcode='P0001'; end if;
  if not public.public_booking_date_allowed(b.id,p_requested_date) then raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
  select * into s from public.services where business_id=b.id and id=p_service_id and active for update;
  if s.id is null then raise exception using message='SERVICE_NOT_FOUND',errcode='P0001'; end if;
  quote:=public.calculate_service_quote(b.slug,s.id,coalesce(p_answers,'[]'::jsonb));duration:=nullif(quote->>'duration_minutes','')::integer;price:=nullif(quote->>'price_cents','')::integer;
  if duration is null then raise exception using message='SERVICE_NEEDS_REVIEW',errcode='P0001'; end if;
  requested_start:=((p_requested_date::text||' '||p_requested_time::text)::timestamp at time zone b.timezone);
  requested_end:=requested_start+make_interval(mins=>duration);
  if requested_start<=now()+interval '2 hours' or not exists(select 1 from public.availability_rules r where r.business_id=b.id and r.weekday=extract(dow from p_requested_date)::int and (requested_start at time zone b.timezone)::time>=r.start_time and (requested_end at time zone b.timezone)::time<=r.end_time)
    or exists(select 1 from public.availability_exceptions e where e.business_id=b.id and e.kind='blocked' and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(requested_start,requested_end,'[)'))
    or not public.service_has_capacity(b.id,s.id,requested_start,requested_end) then raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
  insert into public.clients(business_id,name,phone) values(b.id,left(trim(p_name),120),left(trim(p_phone),40))
    on conflict (business_id,phone) do update set name=excluded.name returning * into c;
  insert into public.appointments(business_id,client_id,service_id,source,status,service_name_snapshot,client_name_snapshot,start_at,end_at,price_estimate_cents,customer_note,token_hash,token_expires_at)
    values(b.id,c.id,s.id,'public','requested',s.name,left(trim(p_name),120),requested_start,requested_end,price,left(p_note,500),p_token_hash,now()+interval '45 days') returning * into a;
  insert into public.appointment_answers(business_id,appointment_id,question_label,answer,price_delta_cents,duration_delta_minutes)
    select b.id,a.id,value->>'question_label',value->'answer',coalesce((value->>'price_delta_cents')::integer,0),coalesce((value->>'duration_delta_minutes')::integer,0)
    from jsonb_array_elements(coalesce(quote->'answers','[]'::jsonb)) value;
  insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type) values(b.id,a.id,null,'requested','client');
  return jsonb_build_object('id',a.id,'status',a.status,'requested_at',a.start_at,'service_name',a.service_name_snapshot,'business_name',b.name);
end $$;
revoke all on function public.request_public_booking(text,text,text,uuid,date,time,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.request_public_booking(text,text,text,uuid,date,time,jsonb,text,text) to anon,authenticated;

create or replace function public.create_manual_appointment(
  p_client_name text,p_client_phone text,p_service_id uuid,p_date date,p_time time,
  p_price_cents integer default null,p_duration_minutes integer default null,p_note text default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare b_id uuid; s public.services%rowtype; c public.clients%rowtype; a public.appointments%rowtype;
declare start_value timestamptz; end_value timestamptz; duration_value integer;
begin
  select business_id into b_id from public.business_members where user_id=auth.uid() order by created_at limit 1;
  if b_id is null then raise exception 'Business not found'; end if;
  select * into s from public.services where id=p_service_id and business_id=b_id and active for update;
  if s.id is null then raise exception 'Service not found'; end if;
  duration_value:=coalesce(p_duration_minutes,s.base_duration_minutes,60)+s.buffer_minutes;
  if duration_value<1 or duration_value>1440 then raise exception 'Invalid duration'; end if;
  start_value:=(p_date::text||' '||p_time::text)::timestamp at time zone (select timezone from public.businesses where id=b_id);
  end_value:=start_value+make_interval(mins=>duration_value);
  if start_value<=now() or exists(select 1 from public.availability_exceptions e where e.business_id=b_id and e.kind='blocked' and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(start_value,end_value,'[)')) then raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
  insert into public.clients(business_id,name,phone) values(b_id,left(trim(p_client_name),120),left(trim(p_client_phone),40))
    on conflict(business_id,phone) do update set name=excluded.name returning * into c;
  insert into public.appointments(business_id,client_id,service_id,source,status,service_name_snapshot,client_name_snapshot,start_at,end_at,price_estimate_cents,agreed_price_cents,customer_note)
    values(b_id,c.id,s.id,'manual','confirmed',s.name,left(trim(p_client_name),120),start_value,end_value,coalesce(p_price_cents,s.base_price_cents),coalesce(p_price_cents,s.base_price_cents),left(p_note,500)) returning * into a;
  insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type,actor_id) values(b_id,a.id,null,'confirmed','professional',auth.uid());
  return a.id;
end $$;
revoke all on function public.create_manual_appointment(text,text,uuid,date,time,integer,integer,text) from public,anon,authenticated;
grant execute on function public.create_manual_appointment(text,text,uuid,date,time,integer,integer,text) to authenticated;

-- The public tracking page is tied to a specific appointment, so show its saved name too.
create or replace function public.get_public_booking(p_token_hash text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb; booking_business uuid;
begin
  select a.business_id into booking_business from public.appointments a
  where (a.token_hash=p_token_hash or a.proposal_token_hash=p_token_hash or exists(
    select 1 from public.appointment_tracking_tokens t where t.appointment_id=a.id and t.token_hash=p_token_hash and t.expires_at>now()
  )) and a.token_expires_at>now();
  if booking_business is null then return null; end if;
  perform public.expire_unpaid_signals(booking_business);
  select jsonb_build_object(
    'service_id',a.service_id,'service_name',a.service_name_snapshot,'requested_at',a.start_at,'ends_at',a.end_at,'status',a.status,
    'business_name',b.name,'slug',b.slug,'timezone',b.timezone,'note',nullif(a.customer_note,''),
    'proposal_reason',a.proposal_reason,
    'proposal_justification',coalesce(a.proposal_reason,(select nullif(e.changes->>'justification','') from public.appointment_events e where e.business_id=a.business_id and e.appointment_id=a.id and e.to_status='proposed' order by e.created_at desc limit 1)),
    'payment_status',case when a.status<>'confirmed' and a.payment_status='signal_requested' then 'signal_expired' else a.payment_status end,
    'signal_amount_cents',a.signal_amount_cents,'signal_deadline',a.signal_deadline,'signal_reported_at',a.signal_reported_at,
    'pix_key',case when a.status='confirmed' and a.payment_status in ('signal_requested','signal_reported') then b.pix_key else null end,
    'pix_holder',case when a.status='confirmed' and a.payment_status in ('signal_requested','signal_reported') then b.pix_holder else null end,
    'client_name',coalesce(a.client_name_snapshot,c.name),'professional_phone',b.contact_phone,'price_cents',coalesce(a.agreed_price_cents,a.price_estimate_cents),
    'cancellation_reason',coalesce(nullif(a.cancellation_reason,''),nullif(a.client_cancellation_reason,'')),
    'client_cancellation_reason',nullif(a.client_cancellation_reason,'')
  ) into result
  from public.appointments a join public.businesses b on b.id=a.business_id join public.clients c on c.id=a.client_id
  where (a.token_hash=p_token_hash or a.proposal_token_hash=p_token_hash or exists(
    select 1 from public.appointment_tracking_tokens t where t.appointment_id=a.id and t.token_hash=p_token_hash and t.expires_at>now()
  )) and a.token_expires_at>now()
  order by (a.proposal_token_hash=p_token_hash) desc
  limit 1;
  return result;
end $$;
revoke all on function public.get_public_booking(text) from public,anon,authenticated;
grant execute on function public.get_public_booking(text) to anon,authenticated;
