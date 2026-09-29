create index if not exists portfolio_items_business_service_position_idx
  on public.portfolio_items(business_id, service_id, position)
  where is_public;

create or replace function public.get_public_profile(p_slug text)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'id',b.id,'slug',b.slug,'name',p.display_name,'business_name',b.name,'description',p.bio,
    'neighborhood',b.public_neighborhood,'city',b.public_city,'state',b.public_state,
    'timezone',b.timezone,'avatar_path',p.avatar_path,'cover_path',p.cover_path,
    'categories',coalesce((select jsonb_agg(c.name order by c.name) from public.business_categories bc join public.categories c on c.id=bc.category_id where bc.business_id=b.id),'[]'::jsonb),
    'services',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',s.id,'name',s.name,'description',s.description,'price',s.base_price_cents,
        'price_from',s.price_from,'duration',s.base_duration_minutes,'mode',s.booking_mode,
        'questions',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',q.id,'label',q.label,'type',q.field_type,'required',q.required,
            'options',coalesce((
              select jsonb_agg(jsonb_build_object(
                'id',o.id,'label',o.label,'price_delta_cents',coalesce(m.price_delta_cents,0),
                'duration_delta_minutes',coalesce(m.duration_delta_minutes,0)
              ) order by o.position)
              from public.service_question_options o
              left join public.service_modifiers m on m.business_id=o.business_id and m.option_id=o.id and m.service_id=s.id
              where o.business_id=s.business_id and o.question_id=q.id
            ),'[]'::jsonb)
          ) order by q.position)
          from public.service_questions q where q.business_id=s.business_id and q.service_id=s.id and q.active
        ),'[]'::jsonb),
        'portfolio',coalesce((
          select jsonb_agg(jsonb_build_object('path',i.storage_path,'alt',i.alt_text) order by i.position,i.created_at)
          from public.portfolio_items i where i.business_id=s.business_id and i.service_id=s.id and i.is_public
        ),'[]'::jsonb)
      ) order by s.created_at)
      from public.services s where s.business_id=b.id and s.active
    ),'[]'::jsonb),
    'portfolio',coalesce((
      select jsonb_agg(jsonb_build_object('path',i.storage_path,'alt',i.alt_text) order by i.position,i.created_at)
      from public.portfolio_items i where i.business_id=b.id and i.service_id is null and i.is_public
    ),'[]'::jsonb)
  )
  from public.businesses b join public.professional_profiles p on p.business_id=b.id
  where b.slug=lower(p_slug) and b.published_at is not null
$$;

revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;
