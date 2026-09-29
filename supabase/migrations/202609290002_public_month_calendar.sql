-- Monthly calendar availability for the public booking form.
-- Reuses the authoritative slot calculation; does not alter or delete data.
create or replace function public.get_public_booking_calendar(
  p_slug text,p_service_id uuid,p_month date,p_answers jsonb default '[]'::jsonb
) returns table(booking_date date,has_availability boolean)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare first_day date; last_day date; allowed_min date; allowed_max date; day_value date;
begin
  if p_month is null or p_month<>date_trunc('month',p_month::timestamp)::date
    or jsonb_typeof(coalesce(p_answers,'[]'::jsonb))<>'array'
    or jsonb_array_length(coalesce(p_answers,'[]'::jsonb))>30 then return; end if;
  select min_date,max_date into allowed_min,allowed_max from public.get_public_booking_window(lower(p_slug));
  if allowed_min is null then return; end if;
  first_day:=greatest(p_month,allowed_min);
  last_day:=least((p_month+interval '1 month - 1 day')::date,allowed_max);
  if first_day>last_day then return; end if;
  for day_value in select generate_series(first_day,last_day,interval '1 day')::date loop
    booking_date:=day_value;
    select exists(select 1 from public.get_public_slots(lower(p_slug),p_service_id,day_value,coalesce(p_answers,'[]'::jsonb))) into has_availability;
    return next;
  end loop;
end $$;
revoke all on function public.get_public_booking_calendar(text,uuid,date,jsonb) from public,anon,authenticated;
grant execute on function public.get_public_booking_calendar(text,uuid,date,jsonb) to anon,authenticated;
