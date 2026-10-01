alter table public.appointments
  add column if not exists cancellation_reason text,
  add column if not exists proposal_token_hash text;

create unique index if not exists appointments_proposal_token_hash_idx
  on public.appointments(proposal_token_hash) where proposal_token_hash is not null;

create or replace function public.get_public_booking(p_token_hash text)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'service_name',a.service_name_snapshot,
    'requested_at',a.start_at,
    'ends_at',a.end_at,
    'status',a.status,
    'business_name',b.name,
    'slug',b.slug,
    'timezone',b.timezone,
    'note',nullif(a.customer_note,''),
    'cancellation_reason',nullif(a.cancellation_reason,''),
    'agreed_price_cents',a.agreed_price_cents,
    'price_estimate_cents',a.price_estimate_cents,
    'duration_minutes',ceil(extract(epoch from(a.end_at-a.start_at))/60.0)::integer,
    'proposal_justification',(select nullif(e.changes->>'justification','') from public.appointment_events e where e.business_id=a.business_id and e.appointment_id=a.id and e.to_status='proposed' and coalesce(e.changes->>'justification','')<>'' order by e.created_at desc limit 1)
  )
  from public.appointments a join public.businesses b on b.id=a.business_id
  where (a.token_hash=p_token_hash or a.proposal_token_hash=p_token_hash) and a.token_expires_at>now()
  order by (a.proposal_token_hash=p_token_hash) desc
  limit 1
$$;

drop function if exists public.respond_public_booking(text,text,date,time);
create or replace function public.respond_public_booking(
  p_token_hash text,p_action text,p_requested_date date default null,p_requested_time time default null,p_reason text default null
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.appointments%rowtype; b public.businesses%rowtype; new_end timestamptz; new_start timestamptz; minutes integer; reason_text text;
begin
  select * into a from public.appointments where (token_hash=p_token_hash or proposal_token_hash=p_token_hash) and token_expires_at>now() for update;
  if a.id is null then raise exception 'Booking link is invalid or expired'; end if;
  select * into b from public.businesses where id=a.business_id;
  reason_text:=nullif(left(trim(coalesce(p_reason,'')),500),'');
  if p_action='cancel' and a.status in ('requested','under_review','proposed','confirmed') then
    update public.appointments set status='cancelled_by_client',cancellation_reason=reason_text,updated_at=now() where id=a.id;
    insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type,changes)
      values(a.business_id,a.id,a.status,'cancelled_by_client','client',case when reason_text is null then '{}'::jsonb else jsonb_build_object('cancellation_reason',reason_text) end);
  elsif p_action='accept' and a.status='proposed' then
    if exists(select 1 from public.appointments x where x.business_id=a.business_id and x.id<>a.id and x.status='confirmed' and tstzrange(x.start_at,x.end_at,'[)') && tstzrange(a.start_at,a.end_at,'[)')) then raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
    update public.appointments set status='confirmed',updated_at=now() where id=a.id;
    insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type) values(a.business_id,a.id,a.status,'confirmed','client');
  elsif p_action='request_another_time' and a.status='proposed' and p_requested_date is not null and p_requested_time is not null then
    new_start:=(p_requested_date::text||' '||p_requested_time::text)::timestamp at time zone b.timezone;
    minutes:=ceil(extract(epoch from (a.end_at-a.start_at))/60.0)::integer;new_end:=new_start+make_interval(mins=>minutes);
    if new_start<=now()+interval '2 hours' or new_start>now()+interval '90 days'
      or not exists(select 1 from public.availability_rules r where r.business_id=a.business_id and r.weekday=extract(dow from p_requested_date)::int and (new_start at time zone b.timezone)::time>=r.start_time and (new_end at time zone b.timezone)::time<=r.end_time)
      or exists(select 1 from public.availability_exceptions e where e.business_id=a.business_id and e.kind='blocked' and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(new_start,new_end,'[)'))
      or exists(select 1 from public.appointments x where x.business_id=a.business_id and x.id<>a.id and x.status='confirmed' and tstzrange(x.start_at,x.end_at,'[)') && tstzrange(new_start,new_end,'[)')) then
      raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
    update public.appointments set status='requested',start_at=new_start,end_at=new_end,updated_at=now() where id=a.id;
    insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type,changes) values(a.business_id,a.id,a.status,'requested','client',jsonb_build_object('requested_start',new_start));
  else raise exception 'Invalid response for current booking status'; end if;
end $$;

create or replace function public.transition_appointment(
  p_appointment_id uuid,p_next public.appointment_status,p_changes jsonb default '{}'
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.appointments%rowtype; b public.businesses%rowtype; allowed boolean:=false; new_start timestamptz; new_end timestamptz; proposed_minutes integer; requested_date_text text; requested_time_text text; schedule_changed boolean:=false;
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
    requested_date_text:=nullif(p_changes->>'requested_date','');
    requested_time_text:=nullif(p_changes->>'requested_time','');
    if requested_date_text is not null or requested_time_text is not null then
      schedule_changed:=true;
      new_start:=(coalesce(requested_date_text,(a.start_at at time zone b.timezone)::date::text)||' '||coalesce(requested_time_text,(a.start_at at time zone b.timezone)::time(0)::text))::timestamp at time zone b.timezone;
    else
      new_start:=a.start_at;
    end if;
    if nullif(p_changes->>'duration_minutes','') is not null then schedule_changed:=true; end if;
    proposed_minutes:=coalesce(nullif(p_changes->>'duration_minutes','')::integer,ceil(extract(epoch from(a.end_at-a.start_at))/60.0)::integer);
    if proposed_minutes<1 or proposed_minutes>1440 then raise exception 'Invalid proposed duration'; end if;
    new_end:=new_start+make_interval(mins=>proposed_minutes);
    if schedule_changed and (new_start<=now()+interval '2 hours' or new_start>now()+interval '90 days'
      or not exists(select 1 from public.availability_rules r where r.business_id=a.business_id and r.weekday=extract(dow from new_start at time zone b.timezone)::int and (new_start at time zone b.timezone)::time>=r.start_time and (new_end at time zone b.timezone)::time<=r.end_time)
      or exists(select 1 from public.availability_exceptions e where e.business_id=a.business_id and e.kind='blocked' and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(new_start,new_end,'[)'))
      or exists(select 1 from public.appointments x where x.business_id=a.business_id and x.id<>a.id and x.status='confirmed' and tstzrange(x.start_at,x.end_at,'[)') && tstzrange(new_start,new_end,'[)'))) then raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
  elsif p_next='confirmed' and a.status in ('requested','under_review','proposed') then
    new_start:=coalesce(nullif(p_changes->>'start_at','')::timestamptz,a.start_at);
    new_end:=coalesce(nullif(p_changes->>'end_at','')::timestamptz,a.end_at);
  end if;
  update public.appointments set status=p_next,start_at=coalesce(new_start,start_at),end_at=coalesce(new_end,end_at),
    agreed_price_cents=coalesce(nullif(p_changes->>'price_cents','')::integer,agreed_price_cents),
    cancellation_reason=case when p_next='cancelled_by_professional' then nullif(left(trim(coalesce(p_changes->>'cancellation_reason','')),500),'') else cancellation_reason end,
    proposal_token_hash=case when p_next='proposed' and nullif(p_changes->>'proposal_token_hash','') is not null then p_changes->>'proposal_token_hash' else proposal_token_hash end,
    updated_at=now()
  where id=a.id;
  insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type,actor_id,changes)
    values(a.business_id,a.id,a.status,p_next,'professional',auth.uid(),coalesce(p_changes,'{}'::jsonb)-'proposal_token_hash');
  if p_next='completed' and a.source='public' then
    insert into public.trial_usage(business_id,eligible_completed_count) values(a.business_id,1)
      on conflict(business_id) do update set eligible_completed_count=least(10,trial_usage.eligible_completed_count+1),updated_at=now();
  end if;
end $$;

revoke all on function public.get_public_booking(text) from public,anon,authenticated;
grant execute on function public.get_public_booking(text) to anon,authenticated;
revoke all on function public.respond_public_booking(text,text,date,time,text) from public,anon,authenticated;
grant execute on function public.respond_public_booking(text,text,date,time,text) to anon,authenticated;
revoke all on function public.transition_appointment(uuid,public.appointment_status,jsonb) from public,anon,authenticated;
grant execute on function public.transition_appointment(uuid,public.appointment_status,jsonb) to authenticated;
