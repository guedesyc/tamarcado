alter table public.businesses
  add column if not exists pix_key text,
  add column if not exists pix_holder text,
  add column if not exists signal_type text not null default 'fixed' check(signal_type in ('fixed','percent')),
  add column if not exists signal_amount numeric(10,2) not null default 0 check(signal_amount>=0 and (signal_type='fixed' or signal_amount<=100));

alter table public.appointments
  add column if not exists signal_amount_cents integer check(signal_amount_cents is null or signal_amount_cents>=0),
  add column if not exists signal_deadline timestamptz,
  add column if not exists signal_reported_at timestamptz;
alter table public.appointments drop constraint if exists appointments_payment_status_check;
alter table public.appointments add constraint appointments_payment_status_check
  check(payment_status in ('unpaid','partial','paid','refunded','not_applicable','signal_requested','signal_reported','signal_expired'));

create table if not exists public.appointment_tracking_tokens(
  token_hash text primary key,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists appointment_tracking_tokens_appointment_idx on public.appointment_tracking_tokens(appointment_id);
alter table public.appointment_tracking_tokens enable row level security;

create or replace function public.expire_unpaid_signals(p_business_id uuid default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  with expired as (
    update public.appointments set status='expired',payment_status='signal_expired',updated_at=now()
    where status='confirmed' and payment_status='signal_requested' and signal_deadline<=now()
      and (p_business_id is null or business_id=p_business_id)
    returning business_id,id
  )
  insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type,changes)
    select business_id,id,'confirmed','expired','system',jsonb_build_object('payment_status','signal_expired') from expired;
end $$;
revoke all on function public.expire_unpaid_signals(uuid) from public,anon,authenticated;

create or replace function public.expire_signals_before_booking()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.expire_unpaid_signals(new.business_id);
  return new;
end $$;
drop trigger if exists appointments_expire_signals_before_insert on public.appointments;
create trigger appointments_expire_signals_before_insert before insert on public.appointments
for each row execute function public.expire_signals_before_booking();

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
  if exists(select 1 from public.appointments x where x.business_id=a.business_id and x.id<>a.id and x.status='confirmed' and tstzrange(x.start_at,x.end_at,'[)') && tstzrange(a.start_at,a.end_at,'[)')) then raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
  update public.appointments set status='confirmed',payment_status='signal_requested',signal_amount_cents=amount,signal_deadline=now()+interval '1 hour',signal_reported_at=null,updated_at=now() where id=a.id;
  insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type,actor_id,changes)
    values(a.business_id,a.id,a.status,'confirmed','professional',auth.uid(),jsonb_build_object('payment_status','signal_requested','signal_amount_cents',amount,'signal_deadline',now()+interval '1 hour'));
  tracking_token:=translate(rtrim(encode(gen_random_bytes(32),'base64'),'='),'+/','-_');
  insert into public.appointment_tracking_tokens(token_hash,appointment_id,expires_at)
    values(encode(digest(tracking_token,'sha256'),'hex'),a.id,a.token_expires_at);
  return jsonb_build_object('signal_amount_cents',amount,'signal_deadline',now()+interval '1 hour','pix_key',b.pix_key,'pix_holder',b.pix_holder,'tracking_token',tracking_token);
end $$;

create or replace function public.report_public_booking_signal(p_token_hash text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.appointments%rowtype;
begin
  select * into a from public.appointments where (token_hash=p_token_hash or id=(select appointment_id from public.appointment_tracking_tokens where token_hash=p_token_hash and expires_at>now())) and token_expires_at>now() for update;
  if a.id is null then raise exception 'Booking link is invalid or expired'; end if;
  if a.status='expired' and a.payment_status='signal_expired' then return jsonb_build_object('status','signal_expired'); end if;
  if a.status<>'confirmed' or a.payment_status<>'signal_requested' then raise exception 'Signal is not awaiting payment'; end if;
  if a.signal_deadline<=now() then
    update public.appointments set status='expired',payment_status='signal_expired',updated_at=now() where id=a.id;
    insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type,changes)
      values(a.business_id,a.id,'confirmed','expired','system',jsonb_build_object('payment_status','signal_expired'));
    return jsonb_build_object('status','signal_expired');
  end if;
  update public.appointments set payment_status='signal_reported',signal_reported_at=now(),updated_at=now() where id=a.id;
  insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type,changes)
    values(a.business_id,a.id,'confirmed','confirmed','client',jsonb_build_object('payment_status','signal_reported'));
  return jsonb_build_object('status','signal_reported');
end $$;

create or replace function public.verify_appointment_signal(p_appointment_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.appointments%rowtype; tracking_token text;
begin
  select * into a from public.appointments where id=p_appointment_id for update;
  if a.id is null or not public.is_business_member(a.business_id) then raise exception 'Appointment not found'; end if;
  if a.status<>'confirmed' or a.payment_status<>'signal_reported' then raise exception 'Signal is not reported'; end if;
  update public.appointments set payment_status='partial',updated_at=now() where id=a.id;
  insert into public.financial_entries(business_id,appointment_id,kind,amount_cents,status,method,note)
    values(a.business_id,a.id,'income',coalesce(a.signal_amount_cents,0),'received','pix','Sinal do atendimento');
  insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type,actor_id,changes)
    values(a.business_id,a.id,'confirmed','confirmed','professional',auth.uid(),jsonb_build_object('payment_status','partial','verified_signal_cents',a.signal_amount_cents));
  tracking_token:=translate(rtrim(encode(gen_random_bytes(32),'base64'),'='),'+/','-_');
  insert into public.appointment_tracking_tokens(token_hash,appointment_id,expires_at)
    values(encode(digest(tracking_token,'sha256'),'hex'),a.id,a.token_expires_at);
  return jsonb_build_object('tracking_token',tracking_token);
end $$;
revoke all on function public.request_appointment_signal(uuid) from public,anon;
grant execute on function public.request_appointment_signal(uuid) to authenticated;
revoke all on function public.verify_appointment_signal(uuid) from public,anon;
grant execute on function public.verify_appointment_signal(uuid) to authenticated;
revoke all on function public.report_public_booking_signal(text) from public,authenticated;
grant execute on function public.report_public_booking_signal(text) to anon,authenticated;

create or replace function public.get_public_booking(p_token_hash text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb; booking_business uuid;
begin
  select a.business_id into booking_business from public.appointments a where (a.token_hash=p_token_hash or exists(select 1 from public.appointment_tracking_tokens t where t.appointment_id=a.id and t.token_hash=p_token_hash and t.expires_at>now())) and a.token_expires_at>now();
  if booking_business is null then return null; end if;
  perform public.expire_unpaid_signals(booking_business);
  select jsonb_build_object(
    'service_name',a.service_name_snapshot,'requested_at',a.start_at,'status',a.status,
    'business_name',b.name,'slug',b.slug,'timezone',b.timezone,'note',nullif(a.customer_note,''),
    'payment_status',case when a.status<>'confirmed' and a.payment_status='signal_requested' then 'signal_expired' else a.payment_status end,'signal_amount_cents',a.signal_amount_cents,
    'signal_deadline',a.signal_deadline,'signal_reported_at',a.signal_reported_at,
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
    if exists(select 1 from public.appointments x where x.business_id=a.business_id and x.id<>a.id and x.status='confirmed' and tstzrange(x.start_at,x.end_at,'[)') && tstzrange(a.start_at,a.end_at,'[)')) then raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
    update public.appointments set status='confirmed',updated_at=now() where id=a.id;
    insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type) values(a.business_id,a.id,a.status,'confirmed','client');
  elsif p_action='request_another_time' and a.status='proposed' and p_requested_date is not null and p_requested_time is not null then
    new_start:=(p_requested_date::text||' '||p_requested_time::text)::timestamp at time zone b.timezone;
    minutes:=ceil(extract(epoch from(a.end_at-a.start_at))/60.0)::integer;new_end:=new_start+make_interval(mins=>minutes);
    if new_start<=now()+interval '2 hours' or new_start>now()+interval '90 days'
      or not exists(select 1 from public.availability_rules r where r.business_id=a.business_id and r.weekday=extract(dow from p_requested_date)::int and (new_start at time zone b.timezone)::time>=r.start_time and (new_end at time zone b.timezone)::time<=r.end_time)
      or exists(select 1 from public.availability_exceptions e where e.business_id=a.business_id and e.kind='blocked' and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(new_start,new_end,'[)'))
      or exists(select 1 from public.appointments x where x.business_id=a.business_id and x.id<>a.id and x.status='confirmed' and tstzrange(x.start_at,x.end_at,'[)') && tstzrange(new_start,new_end,'[)')) then raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
    update public.appointments set status='requested',start_at=new_start,end_at=new_end,updated_at=now() where id=a.id;
    insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type,changes) values(a.business_id,a.id,a.status,'requested','client',jsonb_build_object('requested_start',new_start));
  else raise exception 'Invalid response for current booking status'; end if;
end $$;
revoke all on function public.respond_public_booking(text,text,date,time) from public,anon,authenticated;
grant execute on function public.respond_public_booking(text,text,date,time) to anon,authenticated;

create or replace function public.get_public_slots(p_slug text,p_service_id uuid,p_date date,p_answers jsonb default '[]'::jsonb)
returns table(slot_time time) language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.businesses%rowtype; s public.services%rowtype; rule public.availability_rules%rowtype;
declare total_minutes integer; quote jsonb; slot_start timestamptz; slot_end timestamptz; local_slot time;
begin
  select * into b from public.businesses where slug=lower(p_slug) and published_at is not null and not booking_paused;
  if b.id is null or p_date < (now() at time zone coalesce(b.timezone,'America/Sao_Paulo'))::date or p_date > (now() at time zone coalesce(b.timezone,'America/Sao_Paulo'))::date+90 then return; end if;
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
        and not exists(select 1 from public.availability_exceptions e where e.business_id=b.id and e.kind='blocked' and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(slot_start,slot_end,'[)'))
        and not exists(select 1 from public.appointments a where a.business_id=b.id and a.status='confirmed' and (a.payment_status<>'signal_requested' or a.signal_deadline>now()) and tstzrange(a.start_at,a.end_at,'[)') && tstzrange(slot_start,slot_end,'[)')) then slot_time:=local_slot;return next;end if;
      local_slot:=local_slot+interval '15 minutes';
    end loop;
  end loop;
end $$;
revoke all on function public.get_public_slots(text,uuid,date,jsonb) from public,anon,authenticated;
grant execute on function public.get_public_slots(text,uuid,date,jsonb) to anon,authenticated;
