-- Hold a requested slot temporarily, add exact time preferences to the waitlist,
-- and expire unanswered requests after 24 hours so availability is released.
alter table public.appointments
  add column request_expires_at timestamptz;

create or replace function public.refresh_appointment_request_expiry()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.status is distinct from old.status then
    if new.status in ('requested','under_review','proposed') then
      new.request_expires_at:=now()+interval '24 hours';
    else
      new.request_expires_at:=null;
    end if;
  end if;
  return new;
end $$;

create trigger appointments_refresh_request_expiry
before update of status on public.appointments
for each row execute function public.refresh_appointment_request_expiry();

update public.appointments
set request_expires_at=now()+interval '24 hours'
where status in ('requested','under_review','proposed')
  and request_expires_at is null;

alter table public.waitlist_entries
  add column preferred_time time;

create or replace function public.expire_stale_public_bookings(p_business_id uuid default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare a record;
begin
  if auth.uid() is not null and (p_business_id is null or not public.is_business_member(p_business_id)) then
    raise exception 'Business not found';
  end if;
  for a in
    select id,business_id,status
    from public.appointments
    where status in ('requested','under_review','proposed')
      and request_expires_at is not null
      and request_expires_at<=now()
      and (p_business_id is null or business_id=p_business_id)
    for update
  loop
    update public.appointments set status='expired',updated_at=now() where id=a.id;
    insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type,changes)
      values(a.business_id,a.id,a.status,'expired','system',jsonb_build_object('reason','no_response_within_24_hours'));
  end loop;
end $$;
revoke all on function public.expire_stale_public_bookings(uuid) from public,anon,authenticated;
grant execute on function public.expire_stale_public_bookings(uuid) to authenticated;

create or replace function public.service_has_request_capacity(
  p_business_id uuid,p_service_id uuid,p_start timestamptz,p_end timestamptz,p_exclude uuid default null
) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce((
    select count(a.id)<s.simultaneous_capacity
    from public.services s
    left join public.appointments a on a.business_id=s.business_id and a.service_id=s.id
      and a.id is distinct from p_exclude
      and tstzrange(a.start_at,a.end_at,'[)') && tstzrange(p_start,p_end,'[)')
      and (
        (a.status in ('requested','under_review','proposed') and coalesce(a.request_expires_at,'infinity'::timestamptz)>now())
        or (a.status='confirmed' and (coalesce(a.payment_status,'')<>'signal_requested' or a.signal_deadline>now()))
      )
    where s.business_id=p_business_id and s.id=p_service_id and s.active
    group by s.simultaneous_capacity
  ),false)
$$;
revoke all on function public.service_has_request_capacity(uuid,uuid,timestamptz,timestamptz,uuid) from public,anon,authenticated;

create or replace function public.get_public_slots(p_slug text,p_service_id uuid,p_date date,p_answers jsonb default '[]'::jsonb)
returns table(slot_time time) language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.businesses%rowtype; s public.services%rowtype; rule public.availability_rules%rowtype;
declare total_minutes integer; quote jsonb; slot_start timestamptz; slot_end timestamptz; local_slot time;
begin
  select * into b from public.businesses where slug=lower(p_slug) and published_at is not null and not booking_paused;
  if b.id is null or not public.public_booking_date_allowed(b.id,p_date) then return; end if;
  if jsonb_typeof(coalesce(p_answers,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_answers,'[]'::jsonb))>30 then return; end if;
  if (select coalesce(sum(eligible_completed_count),0) from public.trial_usage where business_id=b.id)>=10 and not exists(select 1 from public.subscription_records where business_id=b.id and status='active') then return; end if;
  select * into s from public.services where business_id=b.id and id=p_service_id and active limit 1;
  if s.id is null or s.base_duration_minutes is null then return; end if;
  quote:=public.calculate_service_quote(b.slug,s.id,coalesce(p_answers,'[]'::jsonb));total_minutes:=nullif(quote->>'duration_minutes','')::integer;
  if total_minutes is null then return; end if;
  for rule in select * from public.availability_rules r where r.business_id=b.id and r.weekday=extract(dow from p_date)::int loop
    local_slot:=rule.start_time;
    while local_slot+make_interval(mins=>total_minutes)<=rule.end_time loop
      slot_start:=(p_date::text||' '||local_slot::text)::timestamp at time zone b.timezone;slot_end:=slot_start+make_interval(mins=>total_minutes);
      if slot_start>now()+interval '2 hours'
        and public.service_has_request_capacity(b.id,s.id,slot_start,slot_end)
        and not exists(select 1 from public.availability_exceptions e where e.business_id=b.id and e.kind='blocked' and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(slot_start,slot_end,'[)')) then
        slot_time:=local_slot;return next;
      end if;
      local_slot:=local_slot+interval '15 minutes';
    end loop;
  end loop;
end $$;
revoke all on function public.get_public_slots(text,uuid,date,jsonb) from public,anon,authenticated;
grant execute on function public.get_public_slots(text,uuid,date,jsonb) to anon,authenticated;

-- The monthly availability RPC delegates to get_public_slots without writing data.
create or replace function public.get_public_booking_calendar(
  p_slug text,p_service_id uuid,p_month date,p_answers jsonb default '[]'::jsonb
) returns table(booking_date date,has_availability boolean)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare first_day date; last_day date; allowed_min date; allowed_max date; day_value date;
begin
  if p_month is null or p_month<>date_trunc('month',p_month::timestamp)::date
    or jsonb_typeof(coalesce(p_answers,'[]'::jsonb))<>'array'
    or jsonb_array_length(coalesce(p_answers,'[]'::jsonb))>30 then return; end if;
  select min_date,max_date into allowed_min,allowed_max from public.get_public_booking_window(lower(p_slug));
  if allowed_min is null then return; end if;
  first_day:=greatest(p_month,allowed_min);
  last_day:=least((p_month+interval '1 month - 1 day')::date,allowed_max);
  if first_day>last_day then return; end if;
  for day_value in select generate_series(first_day,last_day,interval '1 day')::date loop
    booking_date:=day_value;
    select exists(select 1 from public.get_public_slots(lower(p_slug),p_service_id,day_value,coalesce(p_answers,'[]'::jsonb))) into has_availability;
    return next;
  end loop;
end $$;
revoke all on function public.get_public_booking_calendar(text,uuid,date,jsonb) from public,anon,authenticated;
grant execute on function public.get_public_booking_calendar(text,uuid,date,jsonb) to anon,authenticated;

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
    or not public.service_has_request_capacity(b.id,s.id,requested_start,requested_end) then raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
  insert into public.clients(business_id,name,phone) values(b.id,left(trim(p_name),120),left(trim(p_phone),40))
    on conflict (business_id,phone) do update set name=excluded.name returning * into c;
  insert into public.appointments(business_id,client_id,service_id,source,status,service_name_snapshot,client_name_snapshot,start_at,end_at,price_estimate_cents,customer_note,token_hash,token_expires_at,request_expires_at)
    values(b.id,c.id,s.id,'public','requested',s.name,left(trim(p_name),120),requested_start,requested_end,price,left(p_note,500),p_token_hash,now()+interval '45 days',now()+interval '24 hours') returning * into a;
  insert into public.appointment_answers(business_id,appointment_id,question_label,answer,price_delta_cents,duration_delta_minutes)
    select b.id,a.id,value->>'question_label',value->'answer',coalesce((value->>'price_delta_cents')::integer,0),coalesce((value->>'duration_delta_minutes')::integer,0)
    from jsonb_array_elements(coalesce(quote->'answers','[]'::jsonb)) value;
  insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type) values(b.id,a.id,null,'requested','client');
  return jsonb_build_object('id',a.id,'status',a.status,'requested_at',a.start_at,'service_name',a.service_name_snapshot,'business_name',b.name);
end $$;
revoke all on function public.request_public_booking(text,text,text,uuid,date,time,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.request_public_booking(text,text,text,uuid,date,time,jsonb,text,text) to anon,authenticated;

-- Extend the existing opt-in list to retain the specific time a client wants.
drop function public.join_public_waitlist(text,uuid,text,text,date,text);
create or replace function public.join_public_waitlist(
  p_slug text,p_service_id uuid,p_name text,p_phone text,p_preferred_date date default null,
  p_note text default null,p_preferred_time time default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.businesses%rowtype; service_exists boolean; normalized_phone text;
begin
  if p_slug !~ '^[a-z0-9-]{3,40}$'
    or char_length(trim(coalesce(p_name,''))) not between 2 and 100
    or char_length(coalesce(p_note,''))>500 then raise exception 'INVALID_WAITLIST_REQUEST'; end if;
  normalized_phone:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
  if char_length(normalized_phone) not between 10 and 15 then raise exception 'INVALID_WAITLIST_REQUEST'; end if;
  select * into b from public.businesses where slug=p_slug and published_at is not null and not booking_paused;
  if b.id is null then raise exception 'WAITLIST_UNAVAILABLE'; end if;
  if p_preferred_date is not null and (p_preferred_date < (now() at time zone b.timezone)::date or p_preferred_date > (now() at time zone b.timezone)::date+365) then
    raise exception 'INVALID_WAITLIST_DATE';
  end if;
  select exists(select 1 from public.services where id=p_service_id and business_id=b.id and active) into service_exists;
  if not service_exists then raise exception 'WAITLIST_SERVICE_UNAVAILABLE'; end if;
  insert into public.waitlist_entries(business_id,service_id,customer_name,customer_phone,preferred_date,preferred_time,note)
  values(b.id,p_service_id,trim(p_name),trim(p_phone),p_preferred_date,p_preferred_time,nullif(trim(coalesce(p_note,'')),''))
  on conflict do nothing;
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.join_public_waitlist(text,uuid,text,text,date,text,time) from public;
grant execute on function public.join_public_waitlist(text,uuid,text,text,date,text,time) to anon,authenticated;
