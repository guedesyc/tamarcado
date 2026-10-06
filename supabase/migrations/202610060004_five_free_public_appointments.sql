-- Five public completed appointments are free. An active subscription keeps
-- public booking availability unlimited.
update public.trial_usage
set eligible_completed_count = least(eligible_completed_count, 5), updated_at = now()
where eligible_completed_count > 5;

alter table public.trial_usage
  drop constraint if exists trial_usage_eligible_completed_count_check;
alter table public.trial_usage
  add constraint trial_usage_eligible_completed_count_check
  check (eligible_completed_count between 0 and 5);

create or replace function public.has_active_subscription(p_business_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(
    select 1 from public.subscription_records
    where business_id=p_business_id and status='active'
  )
$$;
revoke all on function public.has_active_subscription(uuid) from public,anon,authenticated;

create or replace function public.get_public_slots(p_slug text,p_service_id uuid,p_date date,p_answers jsonb default '[]'::jsonb)
returns table(slot_time time) language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.businesses%rowtype; s public.services%rowtype; rule public.availability_rules%rowtype;
declare total_minutes integer; quote jsonb; slot_start timestamptz; slot_end timestamptz; local_slot time;
begin
  select * into b from public.businesses where slug=lower(p_slug) and published_at is not null and not booking_paused;
  if b.id is null or not public.public_booking_date_allowed(b.id,p_date) then return; end if;
  if jsonb_typeof(coalesce(p_answers,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_answers,'[]'::jsonb))>30 then return; end if;
  if (select coalesce(sum(eligible_completed_count),0) from public.trial_usage where business_id=b.id)>=5 and not public.has_active_subscription(b.id) then return; end if;
  select * into s from public.services where business_id=b.id and id=p_service_id and active limit 1;
  if s.id is null or s.base_duration_minutes is null then return; end if;
  quote:=public.calculate_service_quote(b.slug,s.id,coalesce(p_answers,'[]'::jsonb)); total_minutes:=nullif(quote->>'duration_minutes','')::integer;
  if total_minutes is null then return; end if;
  for rule in select * from public.availability_rules r where r.business_id=b.id and r.weekday=extract(dow from p_date)::int loop
    local_slot:=rule.start_time;
    while local_slot+make_interval(mins=>total_minutes)<=rule.end_time loop
      slot_start:=(p_date::text||' '||local_slot::text)::timestamp at time zone b.timezone; slot_end:=slot_start+make_interval(mins=>total_minutes);
      if slot_start>now()+interval '2 hours' and public.service_has_capacity(b.id,s.id,slot_start,slot_end)
        and not exists(select 1 from public.availability_exceptions e where e.business_id=b.id and e.kind='blocked' and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(slot_start,slot_end,'[)')) then
        slot_time:=local_slot; return next;
      end if;
      local_slot:=local_slot+interval '15 minutes';
    end loop;
  end loop;
end $$;
revoke all on function public.get_public_slots(text,uuid,date,jsonb) from public,anon,authenticated;
grant execute on function public.get_public_slots(text,uuid,date,jsonb) to anon,authenticated;

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
  if b.booking_paused or ((select coalesce(sum(eligible_completed_count),0) from public.trial_usage where business_id=b.id)>=5 and not public.has_active_subscription(b.id)) then raise exception using message='TM_TRIAL_PAUSED',errcode='P0001'; end if;
  if not public.public_booking_date_allowed(b.id,p_requested_date) then raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
  select * into s from public.services where business_id=b.id and id=p_service_id and active for update;
  if s.id is null then raise exception using message='SERVICE_NOT_FOUND',errcode='P0001'; end if;
  quote:=public.calculate_service_quote(b.slug,s.id,coalesce(p_answers,'[]'::jsonb)); duration:=nullif(quote->>'duration_minutes','')::integer; price:=nullif(quote->>'price_cents','')::integer;
  if duration is null then raise exception using message='SERVICE_NEEDS_REVIEW',errcode='P0001'; end if;
  requested_start:=((p_requested_date::text||' '||p_requested_time::text)::timestamp at time zone b.timezone); requested_end:=requested_start+make_interval(mins=>duration);
  if requested_start<=now()+interval '2 hours' or not exists(select 1 from public.availability_rules r where r.business_id=b.id and r.weekday=extract(dow from p_requested_date)::int and (requested_start at time zone b.timezone)::time>=r.start_time and (requested_end at time zone b.timezone)::time<=r.end_time)
    or exists(select 1 from public.availability_exceptions e where e.business_id=b.id and e.kind='blocked' and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(requested_start,requested_end,'[)')) then raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
  if not public.service_has_capacity(b.id,s.id,requested_start,requested_end) then raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
  if not public.service_has_request_capacity(b.id,s.id,requested_start,requested_end) then raise exception using message='WAITLIST_CHOICE',errcode='P0001'; end if;
  insert into public.clients(business_id,name,phone) values(b.id,left(trim(p_name),120),left(trim(p_phone),40)) on conflict (business_id,phone) do update set name=excluded.name returning * into c;
  insert into public.appointments(business_id,client_id,service_id,source,status,service_name_snapshot,client_name_snapshot,start_at,end_at,price_estimate_cents,customer_note,token_hash,token_expires_at,request_expires_at)
    values(b.id,c.id,s.id,'public','requested',s.name,left(trim(p_name),120),requested_start,requested_end,price,left(p_note,500),p_token_hash,now()+interval '45 days',now()+interval '24 hours') returning * into a;
  insert into public.appointment_answers(business_id,appointment_id,question_label,answer,price_delta_cents,duration_delta_minutes)
    select b.id,a.id,value->>'question_label',value->'answer',coalesce((value->>'price_delta_cents')::integer,0),coalesce((value->>'duration_delta_minutes')::integer,0) from jsonb_array_elements(coalesce(quote->'answers','[]'::jsonb)) value;
  insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type) values(b.id,a.id,null,'requested','client');
  return jsonb_build_object('id',a.id,'status',a.status,'requested_at',a.start_at,'service_name',a.service_name_snapshot,'business_name',b.name);
end $$;
revoke all on function public.request_public_booking(text,text,text,uuid,date,time,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.request_public_booking(text,text,text,uuid,date,time,jsonb,text,text) to anon,authenticated;

create or replace function public.get_public_booking_slots(p_token_hash text,p_date date)
returns table(slot_time time) language plpgsql stable security definer set search_path=public,pg_temp as $$
declare a public.appointments%rowtype; b public.businesses%rowtype; s public.services%rowtype; rule public.availability_rules%rowtype;
declare total_minutes integer; slot_start timestamptz; slot_end timestamptz; local_slot time; occupied integer;
begin
  select x.* into a from public.appointments x where (x.token_hash=p_token_hash or x.proposal_token_hash=p_token_hash or exists(select 1 from public.appointment_tracking_tokens t where t.appointment_id=x.id and t.token_hash=p_token_hash and t.expires_at>now())) and x.token_expires_at>now() and x.status='proposed';
  if a.id is null then return; end if;
  select * into b from public.businesses where id=a.business_id and published_at is not null and not booking_paused;
  if b.id is null or not public.public_booking_date_allowed(b.id,p_date) then return; end if;
  if (select coalesce(sum(eligible_completed_count),0) from public.trial_usage where business_id=b.id)>=5 and not public.has_active_subscription(b.id) then return; end if;
  select * into s from public.services where business_id=b.id and id=a.service_id and active;
  if s.id is null then return; end if;
  total_minutes:=ceil(extract(epoch from(a.end_at-a.start_at))/60.0)::integer; if total_minutes<1 or total_minutes>1440 then return; end if;
  for rule in select * from public.availability_rules r where r.business_id=b.id and r.weekday=extract(dow from p_date)::int loop
    local_slot:=rule.start_time;
    while local_slot+make_interval(mins=>total_minutes)<=rule.end_time loop
      slot_start:=(p_date::text||' '||local_slot::text)::timestamp at time zone b.timezone; slot_end:=slot_start+make_interval(mins=>total_minutes);
      select count(*) into occupied from public.appointments x where x.business_id=b.id and x.service_id=s.id and x.status='confirmed' and x.id<>a.id and (x.payment_status<>'signal_requested' or x.signal_deadline>now()) and tstzrange(x.start_at,x.end_at,'[)') && tstzrange(slot_start,slot_end,'[)');
      if slot_start>now()+interval '2 hours' and occupied<s.simultaneous_capacity and not exists(select 1 from public.availability_exceptions e where e.business_id=b.id and e.kind='blocked' and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(slot_start,slot_end,'[)')) then slot_time:=local_slot; return next; end if;
      local_slot:=local_slot+interval '15 minutes';
    end loop;
  end loop;
end $$;
revoke all on function public.get_public_booking_slots(text,date) from public,anon,authenticated;
grant execute on function public.get_public_booking_slots(text,date) to anon,authenticated;

create or replace function public.transition_appointment(p_appointment_id uuid,p_next public.appointment_status,p_changes jsonb default '{}')
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.appointments%rowtype; b public.businesses%rowtype; allowed boolean:=false; new_start timestamptz; new_end timestamptz; proposed_minutes integer; target_date date; target_time time; schedule_change boolean:=false;
begin
  select * into a from public.appointments where id=p_appointment_id for update;
  if a.id is null or not public.is_business_member(a.business_id) then raise exception 'Appointment not found'; end if;
  select * into b from public.businesses where id=a.business_id;
  allowed:=case a.status when 'requested' then p_next in ('under_review','proposed','confirmed','cancelled_by_professional','expired') when 'under_review' then p_next in ('proposed','confirmed','cancelled_by_professional','expired') when 'proposed' then p_next in ('proposed','confirmed','requested','cancelled_by_professional','expired') when 'confirmed' then p_next in ('completed','no_show','cancelled_by_professional') else false end;
  if not allowed then raise exception 'Invalid appointment status transition'; end if;
  if p_next='proposed' then
    schedule_change:=nullif(p_changes->>'requested_date','') is not null or nullif(p_changes->>'requested_time','') is not null or nullif(p_changes->>'duration_minutes','') is not null;
    if schedule_change then
      target_date:=coalesce(nullif(p_changes->>'requested_date','')::date,(a.start_at at time zone b.timezone)::date); target_time:=coalesce(nullif(p_changes->>'requested_time','')::time,(a.start_at at time zone b.timezone)::time); new_start:=(target_date::text||' '||target_time::text)::timestamp at time zone b.timezone; proposed_minutes:=coalesce(nullif(p_changes->>'duration_minutes','')::integer,ceil(extract(epoch from(a.end_at-a.start_at))/60.0)::integer);
      if proposed_minutes<1 or proposed_minutes>1440 then raise exception 'Invalid proposed duration'; end if; new_end:=new_start+make_interval(mins=>proposed_minutes);
      if not public.public_booking_date_allowed(a.business_id,target_date) or new_start<=now()+interval '2 hours' or not exists(select 1 from public.availability_rules r where r.business_id=a.business_id and r.weekday=extract(dow from target_date)::int and target_time>=r.start_time and (new_end at time zone b.timezone)::time<=r.end_time) or exists(select 1 from public.availability_exceptions e where e.business_id=a.business_id and e.kind='blocked' and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(new_start,new_end,'[)')) or not public.service_has_capacity(a.business_id,a.service_id,new_start,new_end,a.id) then raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
    end if;
  elsif p_next='confirmed' and a.status in ('requested','under_review','proposed') then
    if b.signal_enabled then raise exception using message='SIGNAL_REQUIRED',errcode='P0001'; end if;
    if not public.service_has_capacity(a.business_id,a.service_id,a.start_at,a.end_at,a.id) then raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
    new_start:=a.start_at; new_end:=a.end_at;
  end if;
  update public.appointments set status=p_next,start_at=coalesce(new_start,start_at),end_at=coalesce(new_end,end_at),agreed_price_cents=coalesce(nullif(p_changes->>'price_cents','')::integer,agreed_price_cents),proposal_reason=case when p_next='proposed' then nullif(left(trim(coalesce(p_changes->>'proposal_reason','')),500),'') else proposal_reason end,payment_status=case when p_next='confirmed' and not b.signal_enabled then 'not_applicable' else payment_status end,updated_at=now() where id=a.id;
  insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type,actor_id,changes) values(a.business_id,a.id,a.status,p_next,'professional',auth.uid(),coalesce(p_changes,'{}'::jsonb));
  if p_next='completed' and a.source='public' then insert into public.trial_usage(business_id,eligible_completed_count) values(a.business_id,1) on conflict(business_id) do update set eligible_completed_count=least(5,trial_usage.eligible_completed_count+1),updated_at=now(); end if;
end $$;
revoke all on function public.transition_appointment(uuid,public.appointment_status,jsonb) from public,anon,authenticated;
grant execute on function public.transition_appointment(uuid,public.appointment_status,jsonb) to authenticated;
