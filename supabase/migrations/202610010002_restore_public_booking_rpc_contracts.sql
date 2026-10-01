-- Restore the Supabase RPC contracts used by the current GitHub application.
-- Migration 202610010001 replaced these with an older demo-oriented version.
-- Keep both the current cancellation reason and the extra legacy column exposed.

drop function if exists public.respond_public_booking(text,text,date,time,text);

create or replace function public.respond_public_booking(
  p_token_hash text,p_action text,p_requested_date date default null,p_requested_time time default null
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.appointments%rowtype; b public.businesses%rowtype; new_end timestamptz; new_start timestamptz; minutes integer;
begin
  select * into a from public.appointments x where (x.token_hash=p_token_hash or x.proposal_token_hash=p_token_hash or x.id=(select t.appointment_id from public.appointment_tracking_tokens t where t.token_hash=p_token_hash and t.expires_at>now())) and x.token_expires_at>now() for update;
  if a.id is null then raise exception 'Booking link is invalid or expired'; end if;
  select * into b from public.businesses where id=a.business_id;
  if p_action='accept' and a.status='proposed' then
    update public.appointments set status='under_review',updated_at=now() where id=a.id;
    insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type,changes)
      values(a.business_id,a.id,a.status,'under_review','client',jsonb_build_object('proposal_accepted',true));
  elsif p_action='request_another_time' and a.status='proposed' and p_requested_date is not null and p_requested_time is not null then
    if not public.public_booking_date_allowed(a.business_id,p_requested_date) then raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
    new_start:=(p_requested_date::text||' '||p_requested_time::text)::timestamp at time zone b.timezone;
    minutes:=ceil(extract(epoch from(a.end_at-a.start_at))/60.0)::integer;new_end:=new_start+make_interval(mins=>minutes);
    if new_start<=now()+interval '2 hours'
      or not exists(select 1 from public.availability_rules r where r.business_id=a.business_id and r.weekday=extract(dow from p_requested_date)::int and (new_start at time zone b.timezone)::time>=r.start_time and (new_end at time zone b.timezone)::time<=r.end_time)
      or exists(select 1 from public.availability_exceptions e where e.business_id=a.business_id and e.kind='blocked' and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(new_start,new_end,'[)'))
      or not public.service_has_capacity(a.business_id,a.service_id,new_start,new_end,a.id) then raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
    update public.appointments set status='requested',start_at=new_start,end_at=new_end,updated_at=now() where id=a.id;
    insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type,changes)
      values(a.business_id,a.id,a.status,'requested','client',jsonb_build_object('requested_start',new_start));
  else raise exception 'Invalid response for current booking status'; end if;
end $$;
revoke all on function public.respond_public_booking(text,text,date,time) from public,anon,authenticated;
grant execute on function public.respond_public_booking(text,text,date,time) to anon,authenticated;

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
    'client_name',c.name,'professional_phone',b.contact_phone,'price_cents',coalesce(a.agreed_price_cents,a.price_estimate_cents),
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

create or replace function public.transition_appointment(
  p_appointment_id uuid,p_next public.appointment_status,p_changes jsonb default '{}'
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare
  a public.appointments%rowtype;
  b public.businesses%rowtype;
  allowed boolean:=false;
  new_start timestamptz;
  new_end timestamptz;
  proposed_minutes integer;
  target_date date;
  target_time time;
  schedule_change boolean:=false;
begin
  select * into a from public.appointments where id=p_appointment_id for update;
  if a.id is null or not public.is_business_member(a.business_id) then raise exception 'Appointment not found'; end if;
  select * into b from public.businesses where id=a.business_id;
  allowed:=case a.status
    when 'requested' then p_next in ('under_review','proposed','confirmed','cancelled_by_professional','expired')
    when 'under_review' then p_next in ('proposed','confirmed','cancelled_by_professional','expired')
    when 'proposed' then p_next in ('proposed','confirmed','requested','cancelled_by_professional','expired')
    when 'confirmed' then p_next in ('completed','no_show','cancelled_by_professional')
    else false end;
  if not allowed then raise exception 'Invalid appointment status transition'; end if;

  if p_next='proposed' then
    schedule_change:=nullif(p_changes->>'requested_date','') is not null
      or nullif(p_changes->>'requested_time','') is not null
      or nullif(p_changes->>'duration_minutes','') is not null;
    if schedule_change then
      target_date:=coalesce(nullif(p_changes->>'requested_date','')::date,(a.start_at at time zone b.timezone)::date);
      target_time:=coalesce(nullif(p_changes->>'requested_time','')::time,(a.start_at at time zone b.timezone)::time);
      new_start:=(target_date::text||' '||target_time::text)::timestamp at time zone b.timezone;
      proposed_minutes:=coalesce(nullif(p_changes->>'duration_minutes','')::integer,ceil(extract(epoch from(a.end_at-a.start_at))/60.0)::integer);
      if proposed_minutes<1 or proposed_minutes>1440 then raise exception 'Invalid proposed duration'; end if;
      new_end:=new_start+make_interval(mins=>proposed_minutes);
      if not public.public_booking_date_allowed(a.business_id,target_date)
        or new_start<=now()+interval '2 hours'
        or not exists(select 1 from public.availability_rules r where r.business_id=a.business_id and r.weekday=extract(dow from target_date)::int and target_time>=r.start_time and (new_end at time zone b.timezone)::time<=r.end_time)
        or exists(select 1 from public.availability_exceptions e where e.business_id=a.business_id and e.kind='blocked' and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(new_start,new_end,'[)'))
        or not public.service_has_capacity(a.business_id,a.service_id,new_start,new_end,a.id) then
        raise exception using message='SLOT_UNAVAILABLE',errcode='P0001';
      end if;
    end if;
  elsif p_next='confirmed' and a.status in ('requested','under_review','proposed') then
    if b.signal_enabled then raise exception using message='SIGNAL_REQUIRED',errcode='P0001'; end if;
    if not public.service_has_capacity(a.business_id,a.service_id,a.start_at,a.end_at,a.id) then raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
    new_start:=a.start_at;new_end:=a.end_at;
  end if;

  update public.appointments set
    status=p_next,
    start_at=coalesce(new_start,start_at),
    end_at=coalesce(new_end,end_at),
    agreed_price_cents=coalesce(nullif(p_changes->>'price_cents','')::integer,agreed_price_cents),
    proposal_reason=case when p_next='proposed' then nullif(left(trim(coalesce(p_changes->>'proposal_reason','')),500),'') else proposal_reason end,
    payment_status=case when p_next='confirmed' and not b.signal_enabled then 'not_applicable' else payment_status end,
    updated_at=now()
  where id=a.id;
  insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type,actor_id,changes)
    values(a.business_id,a.id,a.status,p_next,'professional',auth.uid(),coalesce(p_changes,'{}'::jsonb));
  if p_next='completed' and a.source='public' then
    insert into public.trial_usage(business_id,eligible_completed_count) values(a.business_id,1)
      on conflict(business_id) do update set eligible_completed_count=least(10,trial_usage.eligible_completed_count+1),updated_at=now();
  end if;
end $$;
revoke all on function public.transition_appointment(uuid,public.appointment_status,jsonb) from public,anon,authenticated;
grant execute on function public.transition_appointment(uuid,public.appointment_status,jsonb) to authenticated;
