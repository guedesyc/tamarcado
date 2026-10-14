-- When a professional blocks over existing appointments, require an explicit
-- choice to cancel them or send the appointments to the rescheduling flow.
drop function if exists public.create_agenda_block(date,time,time,boolean,text);

create function public.create_agenda_block(
  p_date date,
  p_start time,
  p_end time,
  p_acknowledge_conflicts boolean default false,
  p_label text default null,
  p_resolution text default 'keep'
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  business_value public.businesses%rowtype;
  appointment_value public.appointments%rowtype;
  start_value timestamptz;
  end_value timestamptz;
  conflicts jsonb;
  block_id uuid;
  completed_public_count integer := 0;
  cancelled_count integer := 0;
begin
  if auth.uid() is null then raise exception using message='AUTH_REQUIRED',errcode='P0001'; end if;
  if p_resolution not in ('keep','cancel','reschedule') then raise exception using message='INVALID_BLOCK_RESOLUTION',errcode='P0001'; end if;

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
  start_value := (p_date + p_start) at time zone business_value.timezone;
  end_value := (p_date + p_end) at time zone business_value.timezone;
  if start_value <= now() then
    raise exception using message='BLOCK_MUST_BE_FUTURE',errcode='P0001';
  end if;

  if exists (
    select 1 from public.availability_exceptions e
    where e.business_id=business_value.id and e.kind='blocked'
      and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(start_value,end_value,'[)')
  ) then return jsonb_build_object('already_blocked',true,'appointments','[]'::jsonb); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,'client_name',coalesce(a.client_name_snapshot,c.name,'Cliente'),'client_phone',c.phone,
    'service_name',a.service_name_snapshot,'starts_at',a.start_at,'ends_at',a.end_at,'status',a.status
  ) order by a.start_at),'[]'::jsonb)
  into conflicts
  from public.appointments a
  left join public.clients c on c.business_id=a.business_id and c.id=a.client_id
  where a.business_id=business_value.id and a.start_at>=now()
    and a.status not in ('cancelled_by_client','cancelled_by_professional','expired')
    and tstzrange(a.start_at,a.end_at,'[)') && tstzrange(start_value,end_value,'[)');

  if jsonb_array_length(conflicts)>0 and not p_acknowledge_conflicts then
    return jsonb_build_object('requires_confirmation',true,'appointments',conflicts);
  end if;

  if jsonb_array_length(conflicts)=0 and p_resolution<>'keep' then
    raise exception using message='NO_APPOINTMENTS_TO_RESOLVE',errcode='P0001';
  end if;

  if jsonb_array_length(conflicts)>0 and p_resolution='keep' then
    raise exception using message='RESOLUTION_REQUIRED',errcode='P0001';
  end if;

  insert into public.availability_exceptions(business_id,starts_at,ends_at,kind,label)
  values (business_value.id,start_value,end_value,'blocked',nullif(left(trim(coalesce(p_label,'')),120),''))
  returning id into block_id;

  if p_resolution='cancel' and jsonb_array_length(conflicts)>0 then
    select count(*) into completed_public_count
    from public.appointments a
    where a.business_id=business_value.id and a.source='public' and a.status='completed' and a.start_at>=now()
      and tstzrange(a.start_at,a.end_at,'[)') && tstzrange(start_value,end_value,'[)');

    if completed_public_count>0 then
      update public.trial_usage
      set eligible_completed_count=greatest(0,eligible_completed_count-completed_public_count),updated_at=now()
      where business_id=business_value.id;
    end if;

    for appointment_value in
      select * from public.appointments a
      where a.business_id=business_value.id and a.start_at>=now()
        and a.status not in ('cancelled_by_client','cancelled_by_professional','expired')
        and tstzrange(a.start_at,a.end_at,'[)') && tstzrange(start_value,end_value,'[)')
      for update
    loop
      update public.appointments
      set status='cancelled_by_professional',cancellation_reason='Cancelado pela profissional ao bloquear este horário.',updated_at=now()
      where id=appointment_value.id;
      insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type,actor_id,changes)
      values (business_value.id,appointment_value.id,appointment_value.status,'cancelled_by_professional','professional',auth.uid(),
        jsonb_build_object('reason','agenda_block_cancelled','block_id',block_id));
      cancelled_count:=cancelled_count+1;
    end loop;
  end if;

  return jsonb_build_object('blocked',true,'block_id',block_id,'resolution',p_resolution,
    'cancelled_count',cancelled_count,'appointments',conflicts);
end;
$$;

revoke all on function public.create_agenda_block(date,time,time,boolean,text,text) from public,anon,authenticated;
grant execute on function public.create_agenda_block(date,time,time,boolean,text,text) to authenticated;
