-- Fixes availability/quote failures when a service has choice questions.
-- The prior PL/pgSQL variable name `option_id` collided with
-- service_modifiers.option_id in the joined quote query.
-- This migration only replaces a function; it does not alter or delete data.
create or replace function public.calculate_service_quote(p_slug text,p_service_id uuid,p_answers jsonb default '[]'::jsonb)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  b public.businesses%rowtype;
  s public.services%rowtype;
  q public.service_questions%rowtype;
  ans jsonb;
  option_id_text text;
  v_selected_option_id uuid;
  price_value integer;
  duration_value integer;
  price_delta integer:=0;
  duration_delta integer:=0;
  option_price integer;
  option_duration integer;
  option_label text;
  snapshot jsonb:='[]'::jsonb;
begin
  select * into b from public.businesses where slug=lower(p_slug) and published_at is not null;
  if b.id is null then raise exception using message='PROFILE_NOT_FOUND',errcode='P0001'; end if;
  select * into s from public.services where id=p_service_id and business_id=b.id and active;
  if s.id is null then raise exception using message='SERVICE_NOT_FOUND',errcode='P0001'; end if;
  if jsonb_typeof(coalesce(p_answers,'[]'::jsonb))<>'array' then raise exception using message='INVALID_ANSWERS',errcode='P0001'; end if;
  if jsonb_array_length(coalesce(p_answers,'[]'::jsonb))>20 then raise exception using message='INVALID_ANSWERS',errcode='P0001'; end if;

  price_value:=s.base_price_cents;
  duration_value:=s.base_duration_minutes+s.buffer_minutes;
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
        v_selected_option_id:=option_id_text::uuid;
        select o.label,coalesce(m.price_delta_cents,0),coalesce(m.duration_delta_minutes,0)
          into option_label,option_price,option_duration
          from public.service_question_options o
          left join public.service_modifiers m on m.business_id=o.business_id and m.option_id=o.id and m.service_id=s.id
          where o.id=v_selected_option_id and o.business_id=b.id and o.question_id=q.id;
        if not found then raise exception using message='INVALID_ANSWERS',errcode='P0001'; end if;
        price_delta:=price_delta+option_price;
        duration_delta:=duration_delta+option_duration;
        snapshot:=snapshot||jsonb_build_array(jsonb_build_object('question_label',q.label,'answer',option_label,'price_delta_cents',option_price,'duration_delta_minutes',option_duration));
      end loop;
    else
      if q.field_type in ('text','note') and (jsonb_typeof(ans->'value') is distinct from 'string' or char_length(ans->>'value')>1000) then raise exception using message='INVALID_ANSWERS',errcode='P0001'; end if;
      if q.field_type='number' and (jsonb_typeof(ans->'value') is distinct from 'number' or abs((ans->>'value')::numeric)>1000000000) then raise exception using message='INVALID_ANSWERS',errcode='P0001'; end if;
      if q.field_type='boolean' and jsonb_typeof(ans->'value') is distinct from 'boolean' then raise exception using message='INVALID_ANSWERS',errcode='P0001'; end if;
      snapshot:=snapshot||jsonb_build_array(jsonb_build_object('question_label',q.label,'answer',ans->'value','price_delta_cents',0,'duration_delta_minutes',0));
    end if;
  end loop;

  if price_value is not null then
    price_value:=price_value+price_delta;
    if price_value<0 then raise exception using message='INVALID_ANSWERS',errcode='P0001'; end if;
  end if;
  if duration_value is not null then
    duration_value:=duration_value+duration_delta;
    if duration_value<1 or duration_value>1440 then raise exception using message='INVALID_ANSWERS',errcode='P0001'; end if;
  end if;
  return jsonb_build_object('price_cents',price_value,'duration_minutes',duration_value,'answers',snapshot);
end $$;

revoke all on function public.calculate_service_quote(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.calculate_service_quote(text,uuid,jsonb) to anon,authenticated;
