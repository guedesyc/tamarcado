-- Per-service parallel capacity and public booking window.
alter table public.services
  add column if not exists simultaneous_capacity smallint not null default 1
    check (simultaneous_capacity between 1 and 50);

alter table public.businesses
  add column if not exists booking_window text not null default 'month'
    check (booking_window in ('month','year'));

alter table public.appointments
  add column if not exists capacity_unit smallint;

update public.appointments set capacity_unit=1 where status='confirmed' and capacity_unit is null;

alter table public.appointments drop constraint if exists appointments_confirmed_no_overlap;
alter table public.appointments drop constraint if exists appointments_confirmed_capacity_no_overlap;
alter table public.appointments add constraint appointments_confirmed_capacity_no_overlap
  exclude using gist (
    business_id with =,
    (coalesce(service_id,'00000000-0000-0000-0000-000000000000'::uuid)) with =,
    capacity_unit with =,
    tstzrange(start_at,end_at,'[)') with &&
  ) where (status='confirmed' and capacity_unit is not null);

create or replace function public.public_booking_date_allowed(p_business_id uuid,p_date date)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  with settings as (
    select timezone,booking_window,(now() at time zone timezone)::date as today
    from public.businesses where id=p_business_id
  )
  select coalesce(
    p_date >= today and p_date <= case booking_window
      when 'year' then (date_trunc('year',today::timestamp)+interval '1 year - 1 day')::date
      else (date_trunc('month',today::timestamp)+interval '1 month - 1 day')::date
    end,
    false
  ) from settings
$$;

create or replace function public.get_public_booking_window(p_slug text)
returns table(min_date date,max_date date,booking_window text)
language sql stable security definer set search_path=public,pg_temp as $$
  select today,
    case b.booking_window when 'year' then (date_trunc('year',today::timestamp)+interval '1 year - 1 day')::date
      else (date_trunc('month',today::timestamp)+interval '1 month - 1 day')::date end,
    b.booking_window
  from public.businesses b
  cross join lateral (select (now() at time zone b.timezone)::date as today) d
  where b.slug=lower(p_slug) and b.published_at is not null and not b.booking_paused
$$;
revoke all on function public.get_public_booking_window(text) from public,anon,authenticated;
grant execute on function public.get_public_booking_window(text) to anon,authenticated;

create or replace function public.assign_appointment_capacity_unit()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare capacity smallint; candidate smallint; service_business uuid;
begin
  if new.status<>'confirmed' then new.capacity_unit:=null; return new; end if;

  -- Expired signal holds must not consume a lane.
  perform public.expire_unpaid_signals(new.business_id);

  if new.service_id is null then
    new.capacity_unit:=1;
    return new;
  end if;

  select s.simultaneous_capacity,s.business_id into capacity,service_business
    from public.services s where s.id=new.service_id and s.business_id=new.business_id for update;
  if service_business is null then raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;

  for candidate in 1..capacity loop
    if not exists(
      select 1 from public.appointments a
      where a.business_id=new.business_id and a.service_id=new.service_id
        and a.status='confirmed' and a.capacity_unit=candidate
        and a.id is distinct from new.id
        and (a.payment_status<>'signal_requested' or a.signal_deadline>now())
        and tstzrange(a.start_at,a.end_at,'[)') && tstzrange(new.start_at,new.end_at,'[)')
    ) then
      new.capacity_unit:=candidate;
      return new;
    end if;
  end loop;
  raise exception using message='SLOT_UNAVAILABLE',errcode='P0001';
end $$;

drop trigger if exists zz_appointment_capacity_guard on public.appointments;
create trigger zz_appointment_capacity_guard
before insert or update of status,start_at,end_at,service_id on public.appointments
for each row execute function public.assign_appointment_capacity_unit();

create or replace function public.create_service_setup(p_service jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare b_id uuid; s_id uuid; question_json jsonb; option_json jsonb; q_id uuid; o_id uuid; field_value text; capacity smallint;
begin
  select business_id into b_id from public.business_members where user_id=auth.uid() order by created_at limit 1;
  if b_id is null then raise exception 'Business not found'; end if;
  capacity:=coalesce(nullif(p_service->>'simultaneous_capacity','')::smallint,1);
  if capacity<1 or capacity>50 then raise exception 'Invalid simultaneous service capacity'; end if;
  insert into public.services(business_id,name,description,base_price_cents,base_duration_minutes,buffer_minutes,booking_mode,simultaneous_capacity)
  values(b_id,left(trim(p_service->>'name'),120),coalesce(left(p_service->>'description',1000),''),nullif(p_service->>'base_price_cents','')::integer,
    nullif(p_service->>'base_duration_minutes','')::integer,coalesce((p_service->>'buffer_minutes')::integer,0),coalesce((p_service->>'booking_mode')::public.booking_mode,'approval'),capacity) returning id into s_id;
  for question_json in select value from jsonb_array_elements(coalesce(p_service->'questions','[]'::jsonb)) loop
    field_value:=question_json->>'type';
    if field_value not in ('single_choice','multiple_choice','text','number','boolean','note') then raise exception 'Invalid question type'; end if;
    insert into public.service_questions(business_id,service_id,label,field_type,required,position)
      values(b_id,s_id,left(trim(question_json->>'label'),200),field_value,coalesce((question_json->>'required')::boolean,false),0) returning id into q_id;
    for option_json in select value from jsonb_array_elements(coalesce(question_json->'options','[]'::jsonb)) loop
      if field_value not in ('single_choice','multiple_choice') then raise exception 'Options are only supported for choice questions'; end if;
      insert into public.service_question_options(business_id,question_id,label,position)
        values(b_id,q_id,left(trim(option_json->>'label'),120),0) returning id into o_id;
      if coalesce((option_json->>'price_delta_cents')::integer,0)<>0 or coalesce((option_json->>'duration_delta_minutes')::integer,0)<>0 then
        insert into public.service_modifiers(business_id,service_id,option_id,price_delta_cents,duration_delta_minutes)
        values(b_id,s_id,o_id,coalesce((option_json->>'price_delta_cents')::integer,0),coalesce((option_json->>'duration_delta_minutes')::integer,0));
      end if;
    end loop;
  end loop;
  return s_id;
end $$;

create or replace function public.get_public_slots(p_slug text,p_service_id uuid,p_date date,p_answers jsonb default '[]'::jsonb)
returns table(slot_time time) language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.businesses%rowtype; s public.services%rowtype; rule public.availability_rules%rowtype;
declare total_minutes integer; quote jsonb; slot_start timestamptz; slot_end timestamptz; local_slot time; occupied integer;
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
      select count(*) into occupied from public.appointments a
        where a.business_id=b.id and a.service_id=s.id and a.status='confirmed'
          and (a.payment_status<>'signal_requested' or a.signal_deadline>now())
          and tstzrange(a.start_at,a.end_at,'[)') && tstzrange(slot_start,slot_end,'[)');
      if slot_start>now()+interval '2 hours' and occupied<s.simultaneous_capacity
        and not exists(select 1 from public.availability_exceptions e where e.business_id=b.id and e.kind='blocked' and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(slot_start,slot_end,'[)')) then
        slot_time:=local_slot;return next;
      end if;
      local_slot:=local_slot+interval '15 minutes';
    end loop;
  end loop;
end $$;
revoke all on function public.get_public_slots(text,uuid,date,jsonb) from public,anon,authenticated;
grant execute on function public.get_public_slots(text,uuid,date,jsonb) to anon,authenticated;

create or replace function public.service_has_capacity(p_business_id uuid,p_service_id uuid,p_start timestamptz,p_end timestamptz,p_exclude uuid default null)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce((
    select count(a.id) < s.simultaneous_capacity
    from public.services s
    left join public.appointments a on a.business_id=s.business_id and a.service_id=s.id
      and a.status='confirmed' and a.id is distinct from p_exclude
      and (a.payment_status<>'signal_requested' or a.signal_deadline>now())
      and tstzrange(a.start_at,a.end_at,'[)') && tstzrange(p_start,p_end,'[)')
    where s.business_id=p_business_id and s.id=p_service_id and s.active
    group by s.simultaneous_capacity
  ),false)
$$;

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
  insert into public.appointments(business_id,client_id,service_id,source,status,service_name_snapshot,start_at,end_at,price_estimate_cents,customer_note,token_hash,token_expires_at)
    values(b.id,c.id,s.id,'public','requested',s.name,requested_start,requested_end,price,left(p_note,500),p_token_hash,now()+interval '45 days') returning * into a;
  insert into public.appointment_answers(business_id,appointment_id,question_label,answer,price_delta_cents,duration_delta_minutes)
    select b.id,a.id,value->>'question_label',value->'answer',coalesce((value->>'price_delta_cents')::integer,0),coalesce((value->>'duration_delta_minutes')::integer,0)
    from jsonb_array_elements(coalesce(quote->'answers','[]'::jsonb)) value;
  insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type) values(b.id,a.id,null,'requested','client');
  return jsonb_build_object('id',a.id,'status',a.status,'requested_at',a.start_at,'service_name',a.service_name_snapshot,'business_name',b.name);
end $$;
revoke all on function public.request_public_booking(text,text,text,uuid,date,time,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.request_public_booking(text,text,text,uuid,date,time,jsonb,text,text) to anon,authenticated;

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
    update public.appointments set status='confirmed',updated_at=now() where id=a.id;
    insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type) values(a.business_id,a.id,a.status,'confirmed','client');
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

create or replace function public.transition_appointment(
  p_appointment_id uuid,p_next public.appointment_status,p_changes jsonb default '{}'
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.appointments%rowtype; b public.businesses%rowtype; allowed boolean:=false; new_start timestamptz; new_end timestamptz; proposed_minutes integer;
begin
  select * into a from public.appointments where id=p_appointment_id for update;
  if a.id is null or not public.is_business_member(a.business_id) then raise exception 'Appointment not found'; end if;
  select * into b from public.businesses where id=a.business_id;
  allowed:=case a.status
    when 'requested' then p_next in ('under_review','proposed','confirmed','cancelled_by_professional','expired')
    when 'under_review' then p_next in ('proposed','confirmed','cancelled_by_professional','expired')
    when 'proposed' then p_next in ('proposed','confirmed','requested','cancelled_by_professional','expired')
    when 'confirmed' then p_next in ('completed','no_show','cancelled_by_professional') else false end;
  if not allowed then raise exception 'Invalid appointment status transition'; end if;
  if p_next='proposed' then
    if nullif(p_changes->>'requested_date','') is not null and nullif(p_changes->>'requested_time','') is not null then
      if not public.public_booking_date_allowed(a.business_id,(p_changes->>'requested_date')::date) then raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
      new_start:=(p_changes->>'requested_date'||' '||p_changes->>'requested_time')::timestamp at time zone b.timezone;
      proposed_minutes:=coalesce(nullif(p_changes->>'duration_minutes','')::integer,ceil(extract(epoch from(a.end_at-a.start_at))/60.0)::integer);
      if proposed_minutes<1 or proposed_minutes>1440 then raise exception 'Invalid proposed duration'; end if;
      new_end:=new_start+make_interval(mins=>proposed_minutes);
    else new_start:=nullif(p_changes->>'start_at','')::timestamptz;new_end:=nullif(p_changes->>'end_at','')::timestamptz; end if;
    if new_start is null or new_end is null or new_end<=new_start or new_start<=now()+interval '2 hours'
      or not exists(select 1 from public.availability_rules r where r.business_id=a.business_id and r.weekday=extract(dow from new_start at time zone b.timezone)::int and (new_start at time zone b.timezone)::time>=r.start_time and (new_end at time zone b.timezone)::time<=r.end_time)
      or exists(select 1 from public.availability_exceptions e where e.business_id=a.business_id and e.kind='blocked' and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(new_start,new_end,'[)'))
      or not public.service_has_capacity(a.business_id,a.service_id,new_start,new_end,a.id) then raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
  elsif p_next='confirmed' and a.status in ('requested','under_review','proposed') then
    new_start:=coalesce(nullif(p_changes->>'start_at','')::timestamptz,a.start_at);
    new_end:=coalesce(nullif(p_changes->>'end_at','')::timestamptz,a.end_at);
  end if;
  update public.appointments set status=p_next,start_at=coalesce(new_start,start_at),end_at=coalesce(new_end,end_at),
    agreed_price_cents=coalesce(nullif(p_changes->>'price_cents','')::integer,agreed_price_cents),updated_at=now() where id=a.id;
  insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type,actor_id,changes)
    values(a.business_id,a.id,a.status,p_next,'professional',auth.uid(),coalesce(p_changes,'{}'::jsonb));
  if p_next='completed' and a.source='public' then
    insert into public.trial_usage(business_id,eligible_completed_count) values(a.business_id,1)
      on conflict(business_id) do update set eligible_completed_count=least(10,trial_usage.eligible_completed_count+1),updated_at=now();
  end if;
end $$;
revoke all on function public.transition_appointment(uuid,public.appointment_status,jsonb) from public,anon,authenticated;
grant execute on function public.transition_appointment(uuid,public.appointment_status,jsonb) to authenticated;

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
  insert into public.appointments(business_id,client_id,service_id,source,status,service_name_snapshot,start_at,end_at,price_estimate_cents,agreed_price_cents,customer_note)
    values(b_id,c.id,s.id,'manual','confirmed',s.name,start_value,end_value,coalesce(p_price_cents,s.base_price_cents),coalesce(p_price_cents,s.base_price_cents),left(p_note,500)) returning * into a;
  insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type,actor_id) values(b_id,a.id,null,'confirmed','professional',auth.uid());
  return a.id;
end $$;
revoke all on function public.create_manual_appointment(text,text,uuid,date,time,integer,integer,text) from public,anon,authenticated;
grant execute on function public.create_manual_appointment(text,text,uuid,date,time,integer,integer,text) to authenticated;

create or replace function public.request_appointment_signal(p_appointment_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.appointments%rowtype; b public.businesses%rowtype; amount integer; tracking_token text;
begin
  select * into a from public.appointments where id=p_appointment_id for update;
  if a.id is null or not public.is_business_member(a.business_id) then raise exception 'Appointment not found'; end if;
  if a.status not in ('requested','under_review','proposed') then raise exception 'Invalid appointment status'; end if;
  select * into b from public.businesses where id=a.business_id;
  if nullif(trim(b.pix_key),'') is null or nullif(trim(b.pix_holder),'') is null or b.signal_amount<=0 then raise exception 'PIX_NOT_CONFIGURED'; end if;
  amount:=case when b.signal_type='percent' then round(coalesce(a.agreed_price_cents,a.price_estimate_cents,0)*b.signal_amount/100)::integer else round(b.signal_amount*100)::integer end;
  if amount<1 then raise exception 'INVALID_SIGNAL_AMOUNT'; end if;
  update public.appointments set status='confirmed',payment_status='signal_requested',signal_amount_cents=amount,signal_deadline=now()+interval '1 hour',signal_reported_at=null,updated_at=now() where id=a.id;
  insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type,actor_id,changes)
    values(a.business_id,a.id,a.status,'confirmed','professional',auth.uid(),jsonb_build_object('payment_status','signal_requested','signal_amount_cents',amount,'signal_deadline',now()+interval '1 hour'));
  tracking_token:=translate(rtrim(encode(gen_random_bytes(32),'base64'),'='),'+/','-_');
  insert into public.appointment_tracking_tokens(token_hash,appointment_id,expires_at) values(encode(digest(tracking_token,'sha256'),'hex'),a.id,a.token_expires_at);
  return jsonb_build_object('signal_amount_cents',amount,'signal_deadline',now()+interval '1 hour','pix_key',b.pix_key,'pix_holder',b.pix_holder,'tracking_token',tracking_token);
end $$;
revoke all on function public.request_appointment_signal(uuid) from public,anon;
grant execute on function public.request_appointment_signal(uuid) to authenticated;

create or replace function public.update_service_capacity(p_service_id uuid,p_capacity smallint)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare b_id uuid; existing_capacity smallint; max_overlap bigint; appointment_row public.appointments%rowtype; candidate smallint; assigned boolean;
begin
  if p_capacity<1 or p_capacity>50 then raise exception 'Invalid simultaneous service capacity'; end if;
  select business_id,simultaneous_capacity into b_id,existing_capacity from public.services where id=p_service_id for update;
  if b_id is null or not public.is_business_member(b_id) then raise exception 'Service not found'; end if;
  perform public.expire_unpaid_signals(b_id);

  select coalesce(max((select count(*) from public.appointments active
    where active.business_id=b_id and active.service_id=p_service_id and active.status='confirmed'
      and (active.payment_status<>'signal_requested' or active.signal_deadline>now())
      and active.start_at<=point.start_at and active.end_at>point.start_at)),0)
    into max_overlap
    from (select start_at from public.appointments where business_id=b_id and service_id=p_service_id and status='confirmed') point;
  if max_overlap>p_capacity then raise exception using message='CAPACITY_BELOW_CURRENT',errcode='P0001'; end if;

  update public.services set simultaneous_capacity=p_capacity,updated_at=now() where id=p_service_id and business_id=b_id;
  update public.appointments set capacity_unit=null where business_id=b_id and service_id=p_service_id and status='confirmed';
  for appointment_row in select * from public.appointments where business_id=b_id and service_id=p_service_id and status='confirmed' order by start_at,end_at,id loop
    assigned:=false;
    for candidate in 1..p_capacity loop
      if not exists(select 1 from public.appointments other where other.business_id=b_id and other.service_id=p_service_id
        and other.status='confirmed' and other.capacity_unit=candidate and other.id<>appointment_row.id
        and tstzrange(other.start_at,other.end_at,'[)') && tstzrange(appointment_row.start_at,appointment_row.end_at,'[)')) then
        update public.appointments set capacity_unit=candidate where id=appointment_row.id;
        assigned:=true;exit;
      end if;
    end loop;
    if not assigned then raise exception using message='CAPACITY_BELOW_CURRENT',errcode='P0001'; end if;
  end loop;
end $$;
revoke all on function public.update_service_capacity(uuid,smallint) from public,anon,authenticated;
grant execute on function public.update_service_capacity(uuid,smallint) to authenticated;
