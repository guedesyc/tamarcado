-- The proposal page uses a dedicated token. Accept it when loading alternate
-- times, while keeping support for the original booking and signal links.
create or replace function public.get_public_booking_slots(p_token_hash text,p_date date)
returns table(slot_time time) language plpgsql stable security definer set search_path=public,pg_temp as $$
declare a public.appointments%rowtype; b public.businesses%rowtype; s public.services%rowtype; rule public.availability_rules%rowtype;
declare total_minutes integer; slot_start timestamptz; slot_end timestamptz; local_slot time; occupied integer;
begin
  select x.* into a from public.appointments x
  where (x.token_hash=p_token_hash or x.proposal_token_hash=p_token_hash or exists(
    select 1 from public.appointment_tracking_tokens t
    where t.appointment_id=x.id and t.token_hash=p_token_hash and t.expires_at>now()
  ))
    and x.token_expires_at>now() and x.status='proposed';
  if a.id is null then return; end if;
  select * into b from public.businesses where id=a.business_id and published_at is not null and not booking_paused;
  if b.id is null or not public.public_booking_date_allowed(b.id,p_date) then return; end if;
  if (select coalesce(sum(eligible_completed_count),0) from public.trial_usage where business_id=b.id)>=10
    and not exists(select 1 from public.subscription_records where business_id=b.id and status='active') then return; end if;
  select * into s from public.services where business_id=b.id and id=a.service_id and active;
  if s.id is null then return; end if;
  total_minutes:=ceil(extract(epoch from(a.end_at-a.start_at))/60.0)::integer;
  if total_minutes<1 or total_minutes>1440 then return; end if;
  for rule in select * from public.availability_rules r where r.business_id=b.id and r.weekday=extract(dow from p_date)::int loop
    local_slot:=rule.start_time;
    while local_slot+make_interval(mins=>total_minutes)<=rule.end_time loop
      slot_start:=(p_date::text||' '||local_slot::text)::timestamp at time zone b.timezone;
      slot_end:=slot_start+make_interval(mins=>total_minutes);
      select count(*) into occupied from public.appointments x
      where x.business_id=b.id and x.service_id=s.id and x.status='confirmed' and x.id<>a.id
        and (x.payment_status<>'signal_requested' or x.signal_deadline>now())
        and tstzrange(x.start_at,x.end_at,'[)') && tstzrange(slot_start,slot_end,'[)');
      if slot_start>now()+interval '2 hours' and occupied<s.simultaneous_capacity
        and not exists(select 1 from public.availability_exceptions e where e.business_id=b.id and e.kind='blocked'
          and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(slot_start,slot_end,'[)')) then
        slot_time:=local_slot; return next;
      end if;
      local_slot:=local_slot+interval '15 minutes';
    end loop;
  end loop;
end $$;

revoke all on function public.get_public_booking_slots(text,date) from public,anon,authenticated;
grant execute on function public.get_public_booking_slots(text,date) to anon,authenticated;
