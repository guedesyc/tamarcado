-- Include every non-cancelled booking that intersects an agenda block,
-- including completed and no-show records, so the professional can review it.
create or replace function public.create_agenda_block(
  p_date date,
  p_start time,
  p_end time,
  p_acknowledge_conflicts boolean default false,
  p_label text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  business_value public.businesses%rowtype;
  start_value timestamptz;
  end_value timestamptz;
  conflicts jsonb;
  block_id uuid;
begin
  if auth.uid() is null then raise exception using message='AUTH_REQUIRED',errcode='P0001'; end if;

  select b.* into business_value
  from public.businesses b
  join public.business_members m on m.business_id=b.id
  where m.user_id=auth.uid() and m.role='owner'
  order by b.created_at desc
  limit 1;
  if not found then raise exception using message='BUSINESS_NOT_FOUND',errcode='P0001'; end if;

  if p_date is null or p_start is null or p_end is null or p_end <= p_start then
    raise exception using message='INVALID_BLOCK_RANGE',errcode='P0001';
  end if;

  if p_date + p_start <= now() at time zone business_value.timezone then
    raise exception using message='BLOCK_MUST_BE_FUTURE',errcode='P0001';
  end if;

  start_value := (p_date + p_start) at time zone business_value.timezone;
  end_value := (p_date + p_end) at time zone business_value.timezone;

  if exists (
    select 1 from public.availability_exceptions e
    where e.business_id=business_value.id and e.kind='blocked'
      and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(start_value,end_value,'[)')
  ) then
    return jsonb_build_object('already_blocked',true,'appointments','[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,
    'client_name',coalesce(a.client_name_snapshot,c.name,'Cliente'),
    'client_phone',c.phone,
    'service_name',a.service_name_snapshot,
    'starts_at',a.start_at,
    'ends_at',a.end_at,
    'status',a.status
  ) order by a.start_at),'[]'::jsonb)
  into conflicts
  from public.appointments a
  left join public.clients c on c.business_id=a.business_id and c.id=a.client_id
  where a.business_id=business_value.id
    and a.status not in ('cancelled_by_client','cancelled_by_professional','expired')
    and tstzrange(a.start_at,a.end_at,'[)') && tstzrange(start_value,end_value,'[)');

  if jsonb_array_length(conflicts)>0 and not p_acknowledge_conflicts then
    return jsonb_build_object('requires_confirmation',true,'appointments',conflicts);
  end if;

  insert into public.availability_exceptions(business_id,starts_at,ends_at,kind,label)
  values (business_value.id,start_value,end_value,'blocked',nullif(left(trim(coalesce(p_label,'')),120),''))
  returning id into block_id;

  return jsonb_build_object('blocked',true,'block_id',block_id,'appointments',conflicts);
end;
$$;
