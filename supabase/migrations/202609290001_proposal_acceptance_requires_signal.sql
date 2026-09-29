-- Accepting a proposed time is not payment confirmation. Return the request to
-- the professional so she can ask for the Pix signal and reserve the slot.
-- Preserves all tables, bookings and tokens.
create or replace function public.respond_public_booking(
  p_token_hash text,p_action text,p_requested_date date default null,p_requested_time time default null
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.appointments%rowtype; b public.businesses%rowtype; new_end timestamptz; new_start timestamptz; minutes integer;
begin
  select * into a from public.appointments x where (x.token_hash=p_token_hash or x.id=(select t.appointment_id from public.appointment_tracking_tokens t where t.token_hash=p_token_hash and t.expires_at>now())) and x.token_expires_at>now() for update;
  if a.id is null then raise exception 'Booking link is invalid or expired'; end if;
  select * into b from public.businesses where id=a.business_id;
  if p_action='cancel' and a.status in ('requested','under_review','proposed','confirmed') then
    update public.appointments set status='cancelled_by_client',payment_status=case when payment_status='signal_requested' then 'signal_expired' else payment_status end,updated_at=now() where id=a.id;
    insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type) values(a.business_id,a.id,a.status,'cancelled_by_client','client');
  elsif p_action='accept' and a.status='proposed' then
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
    insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type,changes) values(a.business_id,a.id,a.status,'requested','client',jsonb_build_object('requested_start',new_start));
  else raise exception 'Invalid response for current booking status'; end if;
end $$;
revoke all on function public.respond_public_booking(text,text,date,time) from public,anon,authenticated;
grant execute on function public.respond_public_booking(text,text,date,time) to anon,authenticated;

-- The tracking page needs the service UUID to request valid alternative slots.
create or replace function public.get_public_booking(p_token_hash text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb; booking_business uuid;
begin
  select a.business_id into booking_business from public.appointments a where (a.token_hash=p_token_hash or exists(select 1 from public.appointment_tracking_tokens t where t.appointment_id=a.id and t.token_hash=p_token_hash and t.expires_at>now())) and a.token_expires_at>now();
  if booking_business is null then return null; end if;
  perform public.expire_unpaid_signals(booking_business);
  select jsonb_build_object(
    'service_id',a.service_id,'service_name',a.service_name_snapshot,'requested_at',a.start_at,'status',a.status,
    'business_name',b.name,'slug',b.slug,'timezone',b.timezone,'note',nullif(a.customer_note,''),
    'payment_status',case when a.status<>'confirmed' and a.payment_status='signal_requested' then 'signal_expired' else a.payment_status end,
    'signal_amount_cents',a.signal_amount_cents,'signal_deadline',a.signal_deadline,'signal_reported_at',a.signal_reported_at,
    'pix_key',case when a.status='confirmed' and a.payment_status in ('signal_requested','signal_reported') then b.pix_key else null end,
    'pix_holder',case when a.status='confirmed' and a.payment_status in ('signal_requested','signal_reported') then b.pix_holder else null end,
    'client_name',c.name,'professional_phone',b.contact_phone,'price_cents',coalesce(a.agreed_price_cents,a.price_estimate_cents)
  ) into result
  from public.appointments a join public.businesses b on b.id=a.business_id join public.clients c on c.id=a.client_id
  where (a.token_hash=p_token_hash or exists(select 1 from public.appointment_tracking_tokens t where t.appointment_id=a.id and t.token_hash=p_token_hash and t.expires_at>now())) and a.token_expires_at>now();
  return result;
end $$;
revoke all on function public.get_public_booking(text) from public,anon,authenticated;
grant execute on function public.get_public_booking(text) to anon,authenticated;

-- Alternative times for an existing proposal must preserve the exact duration
-- already agreed on the request, including service-answer modifiers. The token
-- is hashed by the API and is never exposed as a database credential.
create or replace function public.get_public_booking_slots(p_token_hash text,p_date date)
returns table(slot_time time) language plpgsql stable security definer set search_path=public,pg_temp as $$
declare a public.appointments%rowtype; b public.businesses%rowtype; s public.services%rowtype; rule public.availability_rules%rowtype;
declare total_minutes integer; slot_start timestamptz; slot_end timestamptz; local_slot time; occupied integer;
begin
  select x.* into a from public.appointments x
  where (x.token_hash=p_token_hash or exists(select 1 from public.appointment_tracking_tokens t where t.appointment_id=x.id and t.token_hash=p_token_hash and t.expires_at>now()))
    and x.token_expires_at>now() and x.status='proposed';
  if a.id is null then return; end if;
  select * into b from public.businesses where id=a.business_id and published_at is not null and not booking_paused;
  if b.id is null or not public.public_booking_date_allowed(b.id,p_date) then return; end if;
  if (select coalesce(sum(eligible_completed_count),0) from public.trial_usage where business_id=b.id)>=10
    and not exists(select 1 from public.subscription_records where business_id=b.id and status='active') then return; end if;
  select * into s from public.services where business_id=b.id and id=a.service_id and active;
  if s.id is null then return; end if;
  total_minutes:=ceil(extract(epoch from(a.end_at-a.start_at))/60.0)::integer;
  if total_minutes<1 or total_minutes>1440 then return; end if;
  for rule in select * from public.availability_rules r where r.business_id=b.id and r.weekday=extract(dow from p_date)::int loop
    local_slot:=rule.start_time;
    while local_slot+make_interval(mins=>total_minutes)<=rule.end_time loop
      slot_start:=(p_date::text||' '||local_slot::text)::timestamp at time zone b.timezone;
      slot_end:=slot_start+make_interval(mins=>total_minutes);
      select count(*) into occupied from public.appointments x
      where x.business_id=b.id and x.service_id=s.id and x.status='confirmed' and x.id<>a.id
        and (x.payment_status<>'signal_requested' or x.signal_deadline>now())
        and tstzrange(x.start_at,x.end_at,'[)') && tstzrange(slot_start,slot_end,'[)');
      if slot_start>now()+interval '2 hours' and occupied<s.simultaneous_capacity
        and not exists(select 1 from public.availability_exceptions e where e.business_id=b.id and e.kind='blocked'
          and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(slot_start,slot_end,'[)')) then
        slot_time:=local_slot; return next;
      end if;
      local_slot:=local_slot+interval '15 minutes';
    end loop;
  end loop;
end $$;
revoke all on function public.get_public_booking_slots(text,date) from public,anon,authenticated;
grant execute on function public.get_public_booking_slots(text,date) to anon,authenticated;
