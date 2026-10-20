-- Read-only overview of professional accounts for the platform admin panel.
-- Returns one row per professional (customer accounts are excluded) with only
-- aggregate numbers about their activity: no client names, phones or messages.
-- Executable only by the service role (server side).
create or replace function public.admin_platform_professionals()
returns table(
  user_id uuid,
  email text,
  full_name text,
  signed_up_at timestamptz,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  last_seen_at timestamptz,
  business_id uuid,
  business_name text,
  slug text,
  published_at timestamptz,
  active_services_count integer,
  availability_rules_count integer,
  public_requests_count integer,
  last_request_at timestamptz,
  free_quota_used integer,
  subscription_provider text,
  subscription_status text,
  subscription_livemode boolean
)
language sql stable security definer set search_path=public,pg_temp as $$
  select
    u.id,
    u.email::text,
    coalesce(nullif(pp.display_name,''), nullif(u.raw_user_meta_data->>'full_name','')),
    u.created_at,
    u.email_confirmed_at,
    u.last_sign_in_at,
    a.last_seen_at,
    b.id,
    b.name,
    b.slug,
    b.published_at,
    coalesce((select count(*) from public.services s where s.business_id=b.id and s.active),0)::integer,
    coalesce((select count(*) from public.availability_rules r where r.business_id=b.id),0)::integer,
    coalesce((select count(*) from public.appointments ap where ap.business_id=b.id and ap.source='public'),0)::integer,
    (select max(ap.created_at) from public.appointments ap where ap.business_id=b.id and ap.source='public'),
    case when b.id is null then 0 else public.free_booking_quota_used(b.id) end,
    sr.provider,
    sr.status,
    sr.provider_livemode
  from auth.users u
  left join public.platform_user_activity a on a.user_id=u.id
  left join lateral (
    select bb.* from public.businesses bb
    where bb.owner_id=u.id
    order by (bb.published_at is null), bb.created_at desc
    limit 1
  ) b on true
  left join public.professional_profiles pp on pp.business_id=b.id
  left join lateral (
    select s.provider, s.status, s.provider_livemode from public.subscription_records s
    where s.business_id=b.id
    order by s.updated_at desc
    limit 1
  ) sr on true
  where u.deleted_at is null
    and coalesce(u.is_anonymous,false)=false
    and coalesce(u.raw_user_meta_data->>'account_type','')<>'customer'
    and not exists(select 1 from public.customer_profiles c where c.user_id=u.id)
  order by u.created_at desc
$$;
revoke all on function public.admin_platform_professionals() from public,anon,authenticated;
grant execute on function public.admin_platform_professionals() to service_role;
