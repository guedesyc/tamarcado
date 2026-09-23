create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create type public.appointment_status as enum (
  'requested', 'under_review', 'proposed', 'confirmed', 'cancelled_by_client',
  'cancelled_by_professional', 'expired', 'completed', 'no_show'
);
create type public.booking_mode as enum ('instant', 'approval', 'evaluation');

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40 and slug not in ('admin','app','api','login','logout','cadastro','entrar','esqueci-senha','senha','auth','precos','ajuda','suporte','termos','privacidade','configuracoes','financeiro','agenda','r')),
  description text not null default '',
  timezone text not null default 'America/Sao_Paulo',
  public_neighborhood text,
  public_city text,
  public_state text,
  contact_phone text,
  address_private jsonb,
  booking_paused boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','manager','staff')),
  created_at timestamptz not null default now(),
  primary key (business_id,user_id),
  unique(business_id,user_id)
);

create table public.professional_profiles (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  display_name text not null,
  bio text not null default '',
  avatar_path text,
  cover_path text,
  public_color text not null default 'forest',
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  active boolean not null default true
);
insert into public.categories(name,slug) values
  ('Tranças','trancas'),('Unhas','unhas'),('Cílios','cilios'),('Sobrancelhas','sobrancelhas'),
  ('Depilação','depilacao'),('Maquiagem','maquiagem'),('Cabelo','cabelo'),('Estética','estetica');

create table public.business_categories (
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid not null references public.categories(id), primary key(business_id,category_id)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid references public.categories(id),
  name text not null check (char_length(name) between 2 and 120),
  description text not null default '',
  base_price_cents integer check (base_price_cents is null or base_price_cents >= 0),
  price_from boolean not null default false,
  base_duration_minutes integer check (base_duration_minutes is null or base_duration_minutes between 1 and 1440),
  buffer_minutes integer not null default 0 check (buffer_minutes between 0 and 1440),
  booking_mode public.booking_mode not null default 'approval',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id,id)
);
create index services_public_idx on public.services(business_id,active);

create table public.service_questions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid not null,
  label text not null check (char_length(label) between 1 and 200),
  field_type text not null check (field_type in ('single_choice','multiple_choice','text','number','boolean','image','note')),
  required boolean not null default false,
  position integer not null default 0,
  active boolean not null default true,
  unique(business_id,id),
  foreign key(business_id,service_id) references public.services(business_id,id) on delete cascade
);
create table public.service_question_options (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  question_id uuid not null references public.service_questions(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  position integer not null default 0,
  unique(business_id,id),
  foreign key(business_id,question_id) references public.service_questions(business_id,id) on delete cascade
);
create table public.service_modifiers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid not null,
  option_id uuid not null references public.service_question_options(id) on delete cascade,
  price_delta_cents integer not null default 0,
  duration_delta_minutes integer not null default 0,
  active boolean not null default true,
  unique(business_id,service_id,option_id),
  foreign key(business_id,service_id) references public.services(business_id,id) on delete cascade,
  foreign key(business_id,option_id) references public.service_question_options(business_id,id) on delete cascade
);

create or replace function public.create_service_setup(p_service jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare b_id uuid; s_id uuid; question_json jsonb; option_json jsonb; q_id uuid; o_id uuid; field_value text;
begin
  select business_id into b_id from public.business_members where user_id=auth.uid() order by created_at limit 1;
  if b_id is null then raise exception 'Business not found'; end if;
  insert into public.services(business_id,name,description,base_price_cents,base_duration_minutes,buffer_minutes,booking_mode)
  values(b_id,left(trim(p_service->>'name'),120),coalesce(left(p_service->>'description',1000),''),nullif(p_service->>'base_price_cents','')::integer,
    nullif(p_service->>'base_duration_minutes','')::integer,coalesce((p_service->>'buffer_minutes')::integer,0),coalesce((p_service->>'booking_mode')::public.booking_mode,'approval')) returning id into s_id;
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

create or replace function public.calculate_service_quote(p_slug text,p_service_id uuid,p_answers jsonb default '[]'::jsonb)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare b public.businesses%rowtype; s public.services%rowtype; q public.service_questions%rowtype; ans jsonb; option_id_text text; option_id uuid;
declare price_value integer; duration_value integer; price_delta integer:=0; duration_delta integer:=0; option_price integer; option_duration integer; option_label text; snapshot jsonb:='[]'::jsonb;
begin
  select * into b from public.businesses where slug=lower(p_slug) and published_at is not null;
  if b.id is null then raise exception using message='PROFILE_NOT_FOUND',errcode='P0001'; end if;
  select * into s from public.services where id=p_service_id and business_id=b.id and active;
  if s.id is null then raise exception using message='SERVICE_NOT_FOUND',errcode='P0001'; end if;
  if jsonb_typeof(coalesce(p_answers,'[]'::jsonb))<>'array' then raise exception using message='INVALID_ANSWERS',errcode='P0001'; end if;
  if jsonb_array_length(coalesce(p_answers,'[]'::jsonb))>20 then raise exception using message='INVALID_ANSWERS',errcode='P0001'; end if;
  price_value:=s.base_price_cents;duration_value:=s.base_duration_minutes+s.buffer_minutes;
  for q in select * from public.service_questions where business_id=b.id and service_id=s.id and active order by position,id loop
    select value into ans from jsonb_array_elements(coalesce(p_answers,'[]'::jsonb)) where value->>'question_id'=q.id::text limit 1;
    if ans is null then
      if q.required then raise exception using message='REQUIRED_ANSWER',errcode='P0001'; end if;
      continue;
    end if;
    if q.field_type in ('single_choice','multiple_choice') then
      if jsonb_typeof(coalesce(ans->'option_ids','[]'::jsonb))<>'array' then raise exception using message='INVALID_ANSWERS',errcode='P0001'; end if;
      if q.field_type='single_choice' and jsonb_array_length(coalesce(ans->'option_ids','[]'::jsonb))<>1 then raise exception using message='INVALID_ANSWERS',errcode='P0001'; end if;
      if q.required and jsonb_array_length(coalesce(ans->'option_ids','[]'::jsonb))=0 then raise exception using message='REQUIRED_ANSWER',errcode='P0001'; end if;
      for option_id_text in select jsonb_array_elements_text(coalesce(ans->'option_ids','[]'::jsonb)) loop
        if option_id_text !~ '^[0-9a-f-]{36}$' then raise exception using message='INVALID_ANSWERS',errcode='P0001'; end if;
        option_id:=option_id_text::uuid;
        select o.label,coalesce(m.price_delta_cents,0),coalesce(m.duration_delta_minutes,0) into option_label,option_price,option_duration
          from public.service_question_options o left join public.service_modifiers m on m.business_id=o.business_id and m.option_id=o.id and m.service_id=s.id
          where o.id=option_id and o.business_id=b.id and o.question_id=q.id;
        if not found then raise exception using message='INVALID_ANSWERS',errcode='P0001'; end if;
        price_delta:=price_delta+option_price;duration_delta:=duration_delta+option_duration;
        snapshot:=snapshot||jsonb_build_array(jsonb_build_object('question_label',q.label,'answer',option_label,'price_delta_cents',option_price,'duration_delta_minutes',option_duration));
      end loop;
    else
      if q.field_type in ('text','note') and (jsonb_typeof(ans->'value') is distinct from 'string' or char_length(ans->>'value')>1000) then raise exception using message='INVALID_ANSWERS',errcode='P0001'; end if;
      if q.field_type='number' and (jsonb_typeof(ans->'value') is distinct from 'number' or abs((ans->>'value')::numeric)>1000000000) then raise exception using message='INVALID_ANSWERS',errcode='P0001'; end if;
      if q.field_type='boolean' and jsonb_typeof(ans->'value') is distinct from 'boolean' then raise exception using message='INVALID_ANSWERS',errcode='P0001'; end if;
      snapshot:=snapshot||jsonb_build_array(jsonb_build_object('question_label',q.label,'answer',ans->'value','price_delta_cents',0,'duration_delta_minutes',0));
    end if;
  end loop;
  if price_value is not null then price_value:=price_value+price_delta;if price_value<0 then raise exception using message='INVALID_ANSWERS',errcode='P0001'; end if;end if;
  if duration_value is not null then duration_value:=duration_value+duration_delta;if duration_value<1 or duration_value>1440 then raise exception using message='INVALID_ANSWERS',errcode='P0001'; end if;end if;
  return jsonb_build_object('price_cents',price_value,'duration_minutes',duration_value,'answers',snapshot);
end $$;

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  weekday smallint not null check(weekday between 0 and 6), start_time time not null, end_time time not null,
  check(end_time > start_time)
);
create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  starts_at timestamptz not null, ends_at timestamptz not null, kind text not null check(kind in ('blocked','available')),
  label text, check(ends_at > starts_at)
);
create index availability_exceptions_range_idx on public.availability_exceptions using gist(tstzrange(starts_at,ends_at,'[)'));

create table public.clients (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check(char_length(name) between 2 and 120), phone text not null,
  internal_notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(business_id,id), unique(business_id,phone)
);
create index clients_tenant_phone_idx on public.clients(business_id,phone);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null,
  service_id uuid references public.services(id) on delete set null,
  source text not null check(source in ('public','manual')),
  status public.appointment_status not null default 'requested',
  service_name_snapshot text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  price_estimate_cents integer check(price_estimate_cents is null or price_estimate_cents >= 0),
  agreed_price_cents integer check(agreed_price_cents is null or agreed_price_cents >= 0),
  final_price_cents integer check(final_price_cents is null or final_price_cents >= 0),
  payment_status text not null default 'unpaid' check(payment_status in ('unpaid','partial','paid','refunded','not_applicable')),
  payment_method text,
  customer_note text,
  token_hash text unique,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(business_id,client_id) references public.clients(business_id,id) on delete restrict,
  foreign key(business_id,service_id) references public.services(business_id,id) on delete restrict,
  check(end_at > start_at),
  unique(business_id,id)
);
create index appointments_tenant_start_idx on public.appointments(business_id,start_at);
create index appointments_status_idx on public.appointments(business_id,status,start_at);
alter table public.appointments add constraint appointments_confirmed_no_overlap
  exclude using gist (business_id with =, tstzrange(start_at,end_at,'[)') with &&)
  where (status = 'confirmed');

create table public.appointment_answers (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade, question_label text not null,
  answer jsonb not null, price_delta_cents integer not null default 0, duration_delta_minutes integer not null default 0,
  foreign key(business_id,appointment_id) references public.appointments(business_id,id) on delete cascade
);
create table public.appointment_events (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  from_status public.appointment_status, to_status public.appointment_status not null,
  actor_type text not null check(actor_type in ('professional','client','system')),
  actor_id uuid, changes jsonb not null default '{}', created_at timestamptz not null default now(),
  foreign key(business_id,appointment_id) references public.appointments(business_id,id) on delete cascade
);
create index appointment_events_history_idx on public.appointment_events(business_id,appointment_id,created_at);
create table public.appointment_messages (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  sender_type text not null check(sender_type in ('professional','client','system')),
  body text not null check(char_length(body) between 1 and 2000), created_at timestamptz not null default now(),
  foreign key(business_id,appointment_id) references public.appointments(business_id,id) on delete cascade
);

create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null, storage_path text not null,
  alt_text text not null default '', is_public boolean not null default true, position integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key(business_id,service_id) references public.services(business_id,id) on delete restrict
);
create table public.financial_entries (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  kind text not null check(kind in ('income','expense')), amount_cents integer not null check(amount_cents >= 0),
  status text not null check(status in ('expected','received','cancelled')), method text, note text,
  occurred_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table public.trial_usage (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  eligible_completed_count integer not null default 0 check(eligible_completed_count between 0 and 10),
  updated_at timestamptz not null default now()
);
create table public.subscription_records (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  provider text, provider_customer_id text, provider_subscription_id text,
  status text not null default 'trial' check(status in ('trial','active','past_due','cancelled','incomplete')),
  price_cents integer not null default 2990 check(price_cents=2990), current_period_end timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.notification_events (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade, channel text not null,
  event_type text not null, payload jsonb not null default '{}', status text not null default 'queued', created_at timestamptz not null default now(),
  foreign key(business_id,appointment_id) references public.appointments(business_id,id) on delete cascade
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(), business_id uuid references public.businesses(id) on delete set null,
  actor_id uuid, action text not null, entity_type text not null, entity_id uuid,
  metadata jsonb not null default '{}', created_at timestamptz not null default now()
);

create or replace function public.is_business_member(target uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.business_members m where m.business_id=target and m.user_id=auth.uid())
$$;

create or replace function public.initialize_business()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.business_members(business_id,user_id,role) values(new.id,new.owner_id,'owner');
  insert into public.trial_usage(business_id) values(new.id);
  return new;
end $$;
create trigger businesses_initialize after insert on public.businesses
for each row execute function public.initialize_business();

create or replace function public.create_business_setup(
  p_business_name text,p_slug text,p_display_name text,p_category_slugs text[]
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare new_id uuid; forbidden text[]:=array['admin','app','api','login','logout','cadastro','entrar','precos','ajuda','suporte','termos','privacidade','configuracoes','financeiro','agenda','r'];
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  forbidden:=array_append(array_append(array_append(forbidden,'esqueci-senha'),'senha'),'auth');
  if p_slug=any(forbidden) or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_slug)<3 or length(p_slug)>40 then raise exception 'Invalid public page address'; end if;
  insert into public.businesses(owner_id,name,slug) values(auth.uid(),left(trim(p_business_name),120),p_slug) returning id into new_id;
  insert into public.professional_profiles(business_id,display_name) values(new_id,left(trim(p_display_name),120));
  insert into public.business_categories(business_id,category_id)
    select new_id,id from public.categories where slug=any(coalesce(p_category_slugs,'{}')) and active;
  return new_id;
end $$;

create or replace function public.request_public_booking(
  p_slug text,p_name text,p_phone text,p_service_id uuid,p_requested_date date,p_requested_time time,
  p_answers jsonb,p_note text,p_token_hash text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.businesses%rowtype; s public.services%rowtype; c public.clients%rowtype; a public.appointments%rowtype;
declare requested_start timestamptz; requested_end timestamptz; quote jsonb; duration integer; price integer;
begin
  if char_length(trim(coalesce(p_name,'')))<2 or char_length(trim(coalesce(p_phone,'')))<10 then raise exception using message='INVALID_BOOKING',errcode='P0001'; end if;
  if jsonb_typeof(coalesce(p_answers,'[]'::jsonb))<>'array' then raise exception using message='INVALID_BOOKING',errcode='P0001'; end if;
  if jsonb_array_length(coalesce(p_answers,'[]'::jsonb))>30 then raise exception using message='INVALID_BOOKING',errcode='P0001'; end if;
  select * into b from public.businesses where slug=lower(p_slug) and published_at is not null;
  if b.id is null then raise exception using message='PROFILE_NOT_FOUND',errcode='P0001'; end if;
  if b.booking_paused or ((select coalesce(sum(eligible_completed_count),0) from public.trial_usage where business_id=b.id)>=10 and not exists(select 1 from public.subscription_records where business_id=b.id and status='active')) then
    raise exception using message='TM_TRIAL_PAUSED',errcode='P0001'; end if;
  select * into s from public.services where business_id=b.id and id=p_service_id and active limit 1;
  if s.id is null then raise exception using message='SERVICE_NOT_FOUND',errcode='P0001'; end if;
  quote:=public.calculate_service_quote(b.slug,s.id,coalesce(p_answers,'[]'::jsonb));duration:=nullif(quote->>'duration_minutes','')::integer;price:=nullif(quote->>'price_cents','')::integer;
  if duration is null then raise exception using message='SERVICE_NEEDS_REVIEW',errcode='P0001'; end if;
  requested_start:=((p_requested_date::text||' '||p_requested_time::text)::timestamp at time zone b.timezone);
  requested_end:=requested_start+make_interval(mins=>duration);
  if requested_start<=now()+interval '2 hours' or requested_start>now()+interval '90 days' then raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
  if not exists(select 1 from public.availability_rules r where r.business_id=b.id and r.weekday=extract(dow from p_requested_date)::int and (requested_start at time zone b.timezone)::time>=r.start_time and (requested_end at time zone b.timezone)::time<=r.end_time) then
    raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
  if exists(select 1 from public.availability_exceptions e where e.business_id=b.id and e.kind='blocked' and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(requested_start,requested_end,'[)')) then
    raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
  if exists(select 1 from public.appointments x where x.business_id=b.id and x.status='confirmed' and tstzrange(x.start_at,x.end_at,'[)') && tstzrange(requested_start,requested_end,'[)')) then
    raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
  insert into public.clients(business_id,name,phone) values(b.id,left(trim(p_name),120),left(trim(p_phone),40))
    on conflict (business_id,phone) do update set name=excluded.name returning * into c;
  insert into public.appointments(business_id,client_id,service_id,source,status,service_name_snapshot,start_at,end_at,price_estimate_cents,customer_note,token_hash,token_expires_at)
    values(b.id,c.id,s.id,'public','requested',s.name,requested_start,requested_end,price,left(p_note,500),p_token_hash,now()+interval '45 days') returning * into a;
  insert into public.appointment_answers(business_id,appointment_id,question_label,answer,price_delta_cents,duration_delta_minutes)
    select b.id,a.id,value->>'question_label',value->'answer',coalesce((value->>'price_delta_cents')::integer,0),coalesce((value->>'duration_delta_minutes')::integer,0)
    from jsonb_array_elements(coalesce(quote->'answers','[]'::jsonb)) value;
  insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type)
    values(b.id,a.id,null,'requested','client');
  return jsonb_build_object('id',a.id,'status',a.status,'requested_at',a.start_at,'service_name',a.service_name_snapshot,'business_name',b.name);
end $$;

create or replace function public.get_public_booking(p_token_hash text)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('service_name',a.service_name_snapshot,'requested_at',a.start_at,'status',a.status,
    'business_name',b.name,'slug',b.slug,'timezone',b.timezone,'note',nullif(a.customer_note,''))
  from public.appointments a join public.businesses b on b.id=a.business_id
  where a.token_hash=p_token_hash and a.token_expires_at>now()
$$;

create or replace function public.respond_public_booking(
  p_token_hash text,p_action text,p_requested_date date default null,p_requested_time time default null
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.appointments%rowtype; b public.businesses%rowtype; new_end timestamptz; new_start timestamptz; minutes integer;
begin
  select * into a from public.appointments where token_hash=p_token_hash and token_expires_at>now() for update;
  if a.id is null then raise exception 'Booking link is invalid or expired'; end if;
  select * into b from public.businesses where id=a.business_id;
  if p_action='cancel' and a.status in ('requested','under_review','proposed','confirmed') then
    update public.appointments set status='cancelled_by_client',updated_at=now() where id=a.id;
    insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type) values(a.business_id,a.id,a.status,'cancelled_by_client','client');
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

create or replace function public.get_public_profile(p_slug text)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'id',b.id,'slug',b.slug,'name',p.display_name,'business_name',b.name,'description',p.bio,
    'neighborhood',b.public_neighborhood,'city',b.public_city,'state',b.public_state,
    'timezone',b.timezone,'avatar_path',p.avatar_path,'cover_path',p.cover_path,
    'categories',coalesce((select jsonb_agg(c.name order by c.name) from public.business_categories bc join public.categories c on c.id=bc.category_id where bc.business_id=b.id),'[]'::jsonb),
    'services',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'description',s.description,'price',s.base_price_cents,'price_from',s.price_from,'duration',s.base_duration_minutes,'mode',s.booking_mode,'questions',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'label',q.label,'type',q.field_type,'required',q.required,'options',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'label',o.label,'price_delta_cents',coalesce(m.price_delta_cents,0),'duration_delta_minutes',coalesce(m.duration_delta_minutes,0)) order by o.position) from public.service_question_options o left join public.service_modifiers m on m.business_id=o.business_id and m.option_id=o.id and m.service_id=s.id where o.business_id=s.business_id and o.question_id=q.id),'[]'::jsonb)) order by q.position) from public.service_questions q where q.business_id=s.business_id and q.service_id=s.id and q.active),'[]'::jsonb)) order by s.created_at) from public.services s where s.business_id=b.id and s.active),'[]'::jsonb),
    'portfolio',coalesce((select jsonb_agg(jsonb_build_object('path',i.storage_path,'alt',i.alt_text) order by i.position) from public.portfolio_items i where i.business_id=b.id and i.is_public),'[]'::jsonb)
  )
  from public.businesses b join public.professional_profiles p on p.business_id=b.id
  where b.slug=lower(p_slug) and b.published_at is not null
$$;

create or replace function public.get_public_slots(p_slug text,p_service_id uuid,p_date date,p_answers jsonb default '[]'::jsonb)
returns table(slot_time time) language plpgsql stable security definer set search_path=public,pg_temp as $$
declare b public.businesses%rowtype; s public.services%rowtype; rule public.availability_rules%rowtype;
declare total_minutes integer; quote jsonb; slot_start timestamptz; slot_end timestamptz; local_slot time;
begin
  select * into b from public.businesses where slug=lower(p_slug) and published_at is not null and not booking_paused;
  if b.id is null or p_date < (now() at time zone coalesce(b.timezone,'America/Sao_Paulo'))::date or p_date > (now() at time zone coalesce(b.timezone,'America/Sao_Paulo'))::date+90 then return; end if;
  if jsonb_typeof(coalesce(p_answers,'[]'::jsonb))<>'array' then return; end if;
  if jsonb_array_length(coalesce(p_answers,'[]'::jsonb))>30 then return; end if;
  if (select coalesce(sum(eligible_completed_count),0) from public.trial_usage where business_id=b.id)>=10 and not exists(select 1 from public.subscription_records where business_id=b.id and status='active') then return; end if;
  select * into s from public.services where business_id=b.id and id=p_service_id and active limit 1;
  if s.id is null or s.base_duration_minutes is null then return; end if;
  quote:=public.calculate_service_quote(b.slug,s.id,coalesce(p_answers,'[]'::jsonb));total_minutes:=nullif(quote->>'duration_minutes','')::integer;
  if total_minutes is null then return; end if;
  for rule in select * from public.availability_rules r where r.business_id=b.id and r.weekday=extract(dow from p_date)::int loop
    local_slot:=rule.start_time;
    while local_slot+make_interval(mins=>total_minutes)<=rule.end_time loop
      slot_start:=(p_date::text||' '||local_slot::text)::timestamp at time zone b.timezone;
      slot_end:=slot_start+make_interval(mins=>total_minutes);
      if slot_start>now()+interval '2 hours'
        and not exists(select 1 from public.availability_exceptions e where e.business_id=b.id and e.kind='blocked' and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(slot_start,slot_end,'[)'))
        and not exists(select 1 from public.appointments a where a.business_id=b.id and a.status='confirmed' and tstzrange(a.start_at,a.end_at,'[)') && tstzrange(slot_start,slot_end,'[)')) then
        slot_time:=local_slot;return next;
      end if;
      local_slot:=local_slot+interval '15 minutes';
    end loop;
  end loop;
end $$;

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
    when 'confirmed' then p_next in ('completed','no_show','cancelled_by_professional')
    else false end;
  if not allowed then raise exception 'Invalid appointment status transition'; end if;
  if p_next='proposed' then
    if nullif(p_changes->>'requested_date','') is not null and nullif(p_changes->>'requested_time','') is not null then
      new_start:=(p_changes->>'requested_date'||' '||p_changes->>'requested_time')::timestamp at time zone b.timezone;
      proposed_minutes:=coalesce(nullif(p_changes->>'duration_minutes','')::integer,ceil(extract(epoch from(a.end_at-a.start_at))/60.0)::integer);
      if proposed_minutes<1 or proposed_minutes>1440 then raise exception 'Invalid proposed duration'; end if;
      new_end:=new_start+make_interval(mins=>proposed_minutes);
    else
      new_start:=nullif(p_changes->>'start_at','')::timestamptz;
      new_end:=nullif(p_changes->>'end_at','')::timestamptz;
    end if;
    if new_start is null or new_end is null or new_end<=new_start then raise exception 'Proposal needs a valid time range'; end if;
    if new_start<=now()+interval '2 hours' or new_start>now()+interval '90 days'
      or not exists(select 1 from public.availability_rules r where r.business_id=a.business_id and r.weekday=extract(dow from new_start at time zone b.timezone)::int and (new_start at time zone b.timezone)::time>=r.start_time and (new_end at time zone b.timezone)::time<=r.end_time)
      or exists(select 1 from public.availability_exceptions e where e.business_id=a.business_id and e.kind='blocked' and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(new_start,new_end,'[)')) then raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
    if exists(select 1 from public.appointments x where x.business_id=a.business_id and x.id<>a.id and x.status='confirmed' and tstzrange(x.start_at,x.end_at,'[)') && tstzrange(new_start,new_end,'[)')) then raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
  elsif p_next='confirmed' and a.status in ('requested','under_review','proposed') then
    new_start:=coalesce(nullif(p_changes->>'start_at','')::timestamptz,a.start_at);
    new_end:=coalesce(nullif(p_changes->>'end_at','')::timestamptz,a.end_at);
  end if;
  update public.appointments set status=p_next,start_at=coalesce(new_start,start_at),end_at=coalesce(new_end,end_at),
    agreed_price_cents=coalesce(nullif(p_changes->>'price_cents','')::integer,agreed_price_cents),updated_at=now()
  where id=a.id;
  insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type,actor_id,changes)
    values(a.business_id,a.id,a.status,p_next,'professional',auth.uid(),coalesce(p_changes,'{}'::jsonb));
  if p_next='completed' and a.source='public' then
    insert into public.trial_usage(business_id,eligible_completed_count) values(a.business_id,1)
      on conflict(business_id) do update set eligible_completed_count=least(10,trial_usage.eligible_completed_count+1),updated_at=now();
  end if;
end $$;

create or replace function public.create_manual_appointment(
  p_client_name text,p_client_phone text,p_service_id uuid,p_date date,p_time time,
  p_price_cents integer default null,p_duration_minutes integer default null,p_note text default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare b_id uuid; s public.services%rowtype; c public.clients%rowtype; a public.appointments%rowtype;
declare start_value timestamptz; end_value timestamptz; duration_value integer;
begin
  select business_id into b_id from public.business_members where user_id=auth.uid() order by created_at limit 1;
  if b_id is null then raise exception 'Business not found'; end if;
  select * into s from public.services where id=p_service_id and business_id=b_id and active;
  if s.id is null then raise exception 'Service not found'; end if;
  duration_value:=coalesce(p_duration_minutes,s.base_duration_minutes,60)+s.buffer_minutes;
  if duration_value<1 or duration_value>1440 then raise exception 'Invalid duration'; end if;
  start_value:=(p_date::text||' '||p_time::text)::timestamp at time zone (select timezone from public.businesses where id=b_id);
  end_value:=start_value+make_interval(mins=>duration_value);
  if start_value<=now() then raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
  if exists(select 1 from public.appointments x where x.business_id=b_id and x.status='confirmed' and tstzrange(x.start_at,x.end_at,'[)') && tstzrange(start_value,end_value,'[)')) then raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
  if exists(select 1 from public.availability_exceptions e where e.business_id=b_id and e.kind='blocked' and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(start_value,end_value,'[)')) then raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
  insert into public.clients(business_id,name,phone) values(b_id,left(trim(p_client_name),120),left(trim(p_client_phone),40))
    on conflict(business_id,phone) do update set name=excluded.name returning * into c;
  insert into public.appointments(business_id,client_id,service_id,source,status,service_name_snapshot,start_at,end_at,price_estimate_cents,agreed_price_cents,customer_note)
    values(b_id,c.id,s.id,'manual','confirmed',s.name,start_value,end_value,coalesce(p_price_cents,s.base_price_cents),coalesce(p_price_cents,s.base_price_cents),left(p_note,500)) returning * into a;
  insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type,actor_id)
    values(b_id,a.id,null,'confirmed','professional',auth.uid());
  return a.id;
end $$;

create or replace function public.complete_public_booking(p_appointment_id uuid,p_business_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.is_business_member(p_business_id) then raise exception 'Appointment not found'; end if;
  update public.appointments set status='completed',updated_at=now()
  where id=p_appointment_id and business_id=p_business_id and source='public' and status='confirmed';
  if not found then raise exception 'Appointment is not eligible to complete'; end if;
  insert into public.trial_usage(business_id,eligible_completed_count) values(p_business_id,1)
    on conflict(business_id) do update set eligible_completed_count=least(10,trial_usage.eligible_completed_count+1),updated_at=now();
  insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type)
    values(p_business_id,p_appointment_id,'confirmed','completed','professional');
end $$;

do $$ declare t text; begin
  foreach t in array array['businesses','business_members','professional_profiles','business_categories','services','service_questions','service_question_options','service_modifiers','availability_rules','availability_exceptions','clients','appointments','appointment_answers','appointment_events','appointment_messages','portfolio_items','financial_entries','trial_usage','subscription_records','notification_events','audit_logs'] loop
    execute format('alter table public.%I enable row level security',t);
    if t='business_members' then
      execute 'create policy member_self_select on public.business_members for select using (user_id=auth.uid())';
    elsif t='businesses' then
      execute 'create policy tenant_select on public.businesses for select using (public.is_business_member(id))';
      execute 'create policy owner_update on public.businesses for update using (owner_id=auth.uid()) with check (owner_id=auth.uid())';
    elsif t='appointments' then
      execute 'create policy tenant_select on public.appointments for select using (public.is_business_member(business_id))';
    elsif t in ('trial_usage','subscription_records','appointment_events','audit_logs','notification_events','appointment_answers') then
      execute format('create policy tenant_select on public.%I for select using (public.is_business_member(business_id))',t);
    else
      execute format('create policy tenant_select on public.%I for select using (public.is_business_member(business_id))',t);
      execute format('create policy tenant_insert on public.%I for insert with check (public.is_business_member(business_id))',t);
      execute format('create policy tenant_update on public.%I for update using (public.is_business_member(business_id)) with check (public.is_business_member(business_id))',t);
      execute format('create policy tenant_delete on public.%I for delete using (public.is_business_member(business_id))',t);
    end if;
  end loop;
end $$;
alter table public.categories enable row level security;
create policy categories_public_read on public.categories for select using (active);

revoke all on function public.request_public_booking(text,text,text,uuid,date,time,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.request_public_booking(text,text,text,uuid,date,time,jsonb,text,text) to anon,authenticated;
revoke all on function public.get_public_booking(text) from public,anon,authenticated;
grant execute on function public.get_public_booking(text) to anon,authenticated;
revoke all on function public.respond_public_booking(text,text,date,time) from public,anon,authenticated;
grant execute on function public.respond_public_booking(text,text,date,time) to anon,authenticated;
revoke all on function public.get_public_profile(text) from public,anon,authenticated;
grant execute on function public.get_public_profile(text) to anon,authenticated;
revoke all on function public.get_public_slots(text,uuid,date,jsonb) from public,anon,authenticated;
grant execute on function public.get_public_slots(text,uuid,date,jsonb) to anon,authenticated;
revoke all on function public.transition_appointment(uuid,public.appointment_status,jsonb) from public,anon,authenticated;
grant execute on function public.transition_appointment(uuid,public.appointment_status,jsonb) to authenticated;
revoke all on function public.create_manual_appointment(text,text,uuid,date,time,integer,integer,text) from public,anon,authenticated;
grant execute on function public.create_manual_appointment(text,text,uuid,date,time,integer,integer,text) to authenticated;
revoke all on function public.complete_public_booking(uuid,uuid) from public,anon,authenticated;
grant execute on function public.complete_public_booking(uuid,uuid) to authenticated;
revoke all on function public.create_business_setup(text,text,text,text[]) from public,anon,authenticated;
grant execute on function public.create_business_setup(text,text,text,text[]) to authenticated;
revoke all on function public.create_service_setup(jsonb) from public,anon,authenticated;
grant execute on function public.create_service_setup(jsonb) to authenticated;
revoke all on function public.calculate_service_quote(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.calculate_service_quote(text,uuid,jsonb) to anon,authenticated;
revoke all on function public.is_business_member(uuid) from public,anon,authenticated;
grant execute on function public.is_business_member(uuid) to authenticated;
revoke all on function public.initialize_business() from public,anon,authenticated;
