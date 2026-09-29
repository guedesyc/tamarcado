-- Atomic owner operation for editing existing client questions and their price/time modifiers.
-- Historical answers remain snapshots in appointment_answers.
create or replace function public.save_service_questions(p_service_id uuid,p_questions jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b_id uuid; q jsonb; o jsonb; q_id uuid; o_id uuid; position_value integer; option_ids uuid[]; question_ids uuid[]:='{}'; kind_value text;
begin
  select business_id into b_id from public.services where id=p_service_id;
  if b_id is null or not public.is_business_member(b_id) then raise exception 'Service not found'; end if;
  if jsonb_typeof(coalesce(p_questions,'[]'::jsonb)) is distinct from 'array' then raise exception 'INVALID_QUESTIONS'; end if;
  if jsonb_array_length(coalesce(p_questions,'[]'::jsonb))>20 then raise exception 'INVALID_QUESTIONS'; end if;
  for q,position_value in select value,(ordinality-1)::integer from jsonb_array_elements(coalesce(p_questions,'[]'::jsonb)) with ordinality loop
    kind_value:=q->>'field_type';
    if coalesce(length(trim(q->>'label')),0)<1 or length(q->>'label')>200 or kind_value not in ('single_choice','multiple_choice','text','number','boolean','note') then raise exception 'INVALID_QUESTION'; end if;
    if jsonb_typeof(coalesce(q->'options','[]'::jsonb)) is distinct from 'array' then raise exception 'INVALID_OPTIONS'; end if;
    if jsonb_array_length(coalesce(q->'options','[]'::jsonb))>20 then raise exception 'INVALID_OPTIONS'; end if;
    if kind_value in ('single_choice','multiple_choice') and jsonb_array_length(coalesce(q->'options','[]'::jsonb))=0 then raise exception 'QUESTION_NEEDS_OPTION'; end if;
    if nullif(q->>'id','') is null then
      insert into public.service_questions(business_id,service_id,label,field_type,required,position,active)
      values(b_id,p_service_id,trim(q->>'label'),kind_value,coalesce((q->>'required')::boolean,false),position_value,true) returning id into q_id;
    else
      q_id:=(q->>'id')::uuid;
      update public.service_questions set label=trim(q->>'label'),field_type=kind_value,required=coalesce((q->>'required')::boolean,false),position=position_value,active=true
      where id=q_id and business_id=b_id and service_id=p_service_id;
      if not found then raise exception 'INVALID_QUESTION_ID'; end if;
    end if;
    question_ids:=array_append(question_ids,q_id);
    option_ids:='{}';
    if kind_value in ('single_choice','multiple_choice') then
      for o,position_value in select value,(ordinality-1)::integer from jsonb_array_elements(coalesce(q->'options','[]'::jsonb)) with ordinality loop
        if coalesce(length(trim(o->>'label')),0)<1 or length(o->>'label')>120 then raise exception 'INVALID_OPTION'; end if;
        if nullif(o->>'id','') is null then
          insert into public.service_question_options(business_id,question_id,label,position) values(b_id,q_id,trim(o->>'label'),position_value) returning id into o_id;
        else
          o_id:=(o->>'id')::uuid;
          update public.service_question_options set label=trim(o->>'label'),position=position_value where id=o_id and business_id=b_id and question_id=q_id;
          if not found then raise exception 'INVALID_OPTION_ID'; end if;
        end if;
        option_ids:=array_append(option_ids,o_id);
        if coalesce((o->>'price_delta_cents')::integer,0)<>0 or coalesce((o->>'duration_delta_minutes')::integer,0)<>0 then
          insert into public.service_modifiers(business_id,service_id,option_id,price_delta_cents,duration_delta_minutes)
          values(b_id,p_service_id,o_id,coalesce((o->>'price_delta_cents')::integer,0),coalesce((o->>'duration_delta_minutes')::integer,0))
          on conflict(business_id,service_id,option_id) do update set price_delta_cents=excluded.price_delta_cents,duration_delta_minutes=excluded.duration_delta_minutes,active=true;
        else
          delete from public.service_modifiers where business_id=b_id and service_id=p_service_id and option_id=o_id;
        end if;
      end loop;
      delete from public.service_question_options where business_id=b_id and question_id=q_id and not(id=any(option_ids));
    else
      delete from public.service_question_options where business_id=b_id and question_id=q_id;
    end if;
  end loop;
  update public.service_questions set active=false where business_id=b_id and service_id=p_service_id and not(id=any(question_ids));
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.save_service_questions(uuid,jsonb) from public,anon;
grant execute on function public.save_service_questions(uuid,jsonb) to authenticated;
