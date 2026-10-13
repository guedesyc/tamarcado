-- Confirmed public appointments reserve a free slot. Completed public appointments
-- permanently consume it. Manual appointments remain outside the quota.
-- Existing confirmed rows get a one-time 48h grace period on rollout.
alter table public.appointments
  add column if not exists trial_auto_complete_not_before timestamptz;

update public.appointments
set trial_auto_complete_not_before = greatest(end_at + interval '48 hours', now() + interval '48 hours')
where source = 'public' and status = 'confirmed'
  and trial_auto_complete_not_before is null;

create or replace function public.free_booking_quota_used(p_business_id uuid)
returns integer language sql stable security definer set search_path=public,pg_temp as $$
  select least(5,
    coalesce((select eligible_completed_count from public.trial_usage where business_id=p_business_id),0)
    + (select count(*)::integer from public.appointments where business_id=p_business_id and source='public' and status='confirmed')
  )
$$;
revoke all on function public.free_booking_quota_used(uuid) from public,anon,authenticated;

create or replace function public.reserve_public_trial_slot()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.source='public' and new.status='confirmed' then
    if tg_op='UPDATE' then
      if old.status='confirmed' then return new; end if;
    end if;
    -- Serialize confirmations for this business. The count below excludes NEW
    -- because a BEFORE trigger has not yet written it.
    perform 1 from public.businesses where id=new.business_id for update;
    if not public.has_active_subscription(new.business_id)
      and public.free_booking_quota_used(new.business_id)>=5 then
      raise exception using message='TM_TRIAL_PAUSED',errcode='P0001';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.reserve_public_trial_slot() from public,anon,authenticated;
drop trigger if exists appointments_public_trial_reservation on public.appointments;
create trigger appointments_public_trial_reservation
before insert or update of status on public.appointments
for each row execute function public.reserve_public_trial_slot();

create or replace function public.get_public_slots(p_slug text,p_service_id uuid,p_date date,p_answers jsonb default '[]'::jsonb)
returns table(slot_time time) language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.businesses%rowtype; s public.services%rowtype; rule public.availability_rules%rowtype;
declare total_minutes integer; quote jsonb; slot_start timestamptz; slot_end timestamptz; local_slot time;
begin
  select * into b from public.businesses where slug=lower(p_slug) and published_at is not null and not booking_paused;
  if b.id is null or not public.public_booking_date_allowed(b.id,p_date) then return; end if;
  if jsonb_typeof(coalesce(p_answers,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_answers,'[]'::jsonb))>30 then return; end if;
  if public.free_booking_quota_used(b.id)>=5 and not public.has_active_subscription(b.id) then return; end if;
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
  if b.booking_paused or (public.free_booking_quota_used(b.id)>=5 and not public.has_active_subscription(b.id)) then raise exception using message='TM_TRIAL_PAUSED',errcode='P0001'; end if;
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
  if public.free_booking_quota_used(b.id)>=5 and not public.has_active_subscription(b.id) then return; end if;
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

-- The batch locks each appointment, so manual completion and the job cannot
-- both finalize and count the same appointment.
create or replace function public.auto_complete_due_public_appointments(p_batch_size integer default 100)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.appointments%rowtype; completed_count integer:=0;
begin
  if p_batch_size<1 or p_batch_size>500 then raise exception 'Invalid batch size'; end if;
  for a in
    select * from public.appointments
    where source='public' and status='confirmed'
      and end_at + interval '48 hours'<=now()
      and (trial_auto_complete_not_before is null or trial_auto_complete_not_before<=now())
    order by end_at,id
    for update skip locked limit p_batch_size
  loop
    update public.appointments set status='completed',updated_at=now() where id=a.id and status='confirmed';
    insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type,changes)
      values(a.business_id,a.id,'confirmed','completed','system',jsonb_build_object('reason','automatic_after_48_hours'));
    insert into public.trial_usage(business_id,eligible_completed_count)
      values(a.business_id,1)
      on conflict(business_id) do update
      set eligible_completed_count=least(5,public.trial_usage.eligible_completed_count+1),updated_at=now();
    completed_count:=completed_count+1;
  end loop;
  return completed_count;
end $$;
revoke all on function public.auto_complete_due_public_appointments(integer) from public,anon,authenticated;

create extension if not exists pg_cron;
select cron.schedule('ta-marcado-auto-complete-public-48h','*/5 * * * *',
  'select public.auto_complete_due_public_appointments()');
