create or replace function public.get_agenda_reschedule_slots(p_appointment_id uuid,p_date date)
returns table(slot_time time)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  appointment_value public.appointments%rowtype;
  business_value public.businesses%rowtype;
  rule_value public.availability_rules%rowtype;
  duration_minutes integer;
  slot_start timestamptz;
  slot_end timestamptz;
  local_slot time;
  slot_capacity_ok boolean;
begin
  select * into appointment_value from public.appointments where id=p_appointment_id;
  if appointment_value.id is null or not public.is_business_member(appointment_value.business_id) then
    raise exception 'Appointment not found';
  end if;
  if appointment_value.start_at<now() or appointment_value.status in ('cancelled_by_client','cancelled_by_professional','expired') then
    raise exception 'Appointment is not eligible to reschedule';
  end if;
  select * into business_value from public.businesses where id=appointment_value.business_id;
  if p_date is null or not public.public_booking_date_allowed(appointment_value.business_id,p_date) then return; end if;
  duration_minutes:=ceil(extract(epoch from(appointment_value.end_at-appointment_value.start_at))/60.0)::integer;
  if duration_minutes<1 or duration_minutes>1440 then return; end if;

  for rule_value in
    select * from public.availability_rules r
    where r.business_id=appointment_value.business_id and r.weekday=extract(dow from p_date)::int
  loop
    local_slot:=rule_value.start_time;
    while local_slot+make_interval(mins=>duration_minutes)<=rule_value.end_time loop
      slot_start:=(p_date::text||' '||local_slot::text)::timestamp at time zone business_value.timezone;
      slot_end:=slot_start+make_interval(mins=>duration_minutes);
      if appointment_value.service_id is null then
        select not exists(
          select 1 from public.appointments other
          where other.business_id=appointment_value.business_id and other.id<>appointment_value.id and other.status='confirmed'
            and (other.payment_status<>'signal_requested' or other.signal_deadline>now())
            and tstzrange(other.start_at,other.end_at,'[)') && tstzrange(slot_start,slot_end,'[)')
        ) into slot_capacity_ok;
      else
        slot_capacity_ok:=public.service_has_capacity(appointment_value.business_id,appointment_value.service_id,slot_start,slot_end,appointment_value.id);
      end if;
      if slot_start>now()+interval '2 hours'
        and (slot_end at time zone business_value.timezone)::time<=rule_value.end_time
        and not exists(select 1 from public.availability_exceptions e
          where e.business_id=appointment_value.business_id and e.kind='blocked'
            and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(slot_start,slot_end,'[)'))
        and slot_capacity_ok then
        slot_time:=local_slot; return next;
      end if;
      local_slot:=local_slot+interval '15 minutes';
    end loop;
  end loop;
end;
$$;

create or replace function public.reschedule_agenda_appointment(p_appointment_id uuid,p_date date,p_time time)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  appointment_value public.appointments%rowtype;
  business_value public.businesses%rowtype;
  start_value timestamptz;
  end_value timestamptz;
  duration_minutes integer;
  next_status public.appointment_status;
  slot_capacity_ok boolean;
begin
  if auth.uid() is null then raise exception using message='AUTH_REQUIRED',errcode='P0001'; end if;
  select * into appointment_value from public.appointments where id=p_appointment_id for update;
  if appointment_value.id is null or not public.is_business_member(appointment_value.business_id) then raise exception 'Appointment not found'; end if;
  if appointment_value.start_at<now() or appointment_value.status in ('cancelled_by_client','cancelled_by_professional','expired') then
    raise exception using message='APPOINTMENT_NOT_RESCHEDULABLE',errcode='P0001';
  end if;
  select * into business_value from public.businesses where id=appointment_value.business_id;
  if p_date is null or p_time is null or not public.public_booking_date_allowed(appointment_value.business_id,p_date) then
    raise exception using message='SLOT_UNAVAILABLE',errcode='P0001';
  end if;

  duration_minutes:=ceil(extract(epoch from(appointment_value.end_at-appointment_value.start_at))/60.0)::integer;
  if duration_minutes<1 or duration_minutes>1440 then raise exception using message='SLOT_UNAVAILABLE',errcode='P0001'; end if;
  start_value:=(p_date::text||' '||p_time::text)::timestamp at time zone business_value.timezone;
  end_value:=start_value+make_interval(mins=>duration_minutes);
  if appointment_value.service_id is null then
    select not exists(
      select 1 from public.appointments other
      where other.business_id=appointment_value.business_id and other.id<>appointment_value.id and other.status='confirmed'
        and (other.payment_status<>'signal_requested' or other.signal_deadline>now())
        and tstzrange(other.start_at,other.end_at,'[)') && tstzrange(start_value,end_value,'[)')
    ) into slot_capacity_ok;
  else
    slot_capacity_ok:=public.service_has_capacity(appointment_value.business_id,appointment_value.service_id,start_value,end_value,appointment_value.id);
  end if;

  if start_value<=now()+interval '2 hours'
    or not exists(select 1 from public.availability_rules r where r.business_id=appointment_value.business_id
      and r.weekday=extract(dow from p_date)::int and p_time>=r.start_time
      and (end_value at time zone business_value.timezone)::time<=r.end_time)
    or exists(select 1 from public.availability_exceptions e where e.business_id=appointment_value.business_id
      and e.kind='blocked' and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(start_value,end_value,'[)'))
     or not slot_capacity_ok then
    raise exception using message='SLOT_UNAVAILABLE',errcode='P0001';
  end if;

  next_status:=case when appointment_value.status in ('completed','no_show') then 'confirmed'::public.appointment_status else appointment_value.status end;
  if appointment_value.status='completed' and appointment_value.source='public' then
    update public.trial_usage set eligible_completed_count=greatest(0,eligible_completed_count-1),updated_at=now()
    where business_id=appointment_value.business_id;
  end if;

  update public.appointments set status=next_status,start_at=start_value,end_at=end_value,
    cancellation_reason=null,trial_auto_complete_not_before=null,updated_at=now()
  where id=appointment_value.id;
  insert into public.appointment_events(business_id,appointment_id,from_status,to_status,actor_type,actor_id,changes)
  values (appointment_value.business_id,appointment_value.id,appointment_value.status,next_status,'professional',auth.uid(),
    jsonb_build_object('reason','agenda_block_reschedule','previous_start_at',appointment_value.start_at,'new_start_at',start_value));
  return jsonb_build_object('ok',true,'start_at',start_value,'end_at',end_value,'status',next_status);
end;
$$;

revoke all on function public.get_agenda_reschedule_slots(uuid,date) from public,anon,authenticated;
grant execute on function public.get_agenda_reschedule_slots(uuid,date) to authenticated;
revoke all on function public.reschedule_agenda_appointment(uuid,date,time) from public,anon,authenticated;
grant execute on function public.reschedule_agenda_appointment(uuid,date,time) to authenticated;
