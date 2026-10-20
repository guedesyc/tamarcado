-- Platform admin allowlist and professional "last seen" tracking.
-- Additive only: no existing table, policy or row is changed.

-- Platform admins. RLS is enabled with no policies on purpose: the table is
-- unreachable from the browser (anon/authenticated) and is read only by the
-- server through the service role.
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon,authenticated;

-- Per-user activity, kept outside auth.users. Same pattern: RLS on, no policies;
-- written only through touch_last_seen() and read only by the service role.
create table if not exists public.platform_user_activity (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);
alter table public.platform_user_activity enable row level security;
revoke all on public.platform_user_activity from anon,authenticated;

-- Called when a professional opens /app. Writes at most once per hour per user.
create or replace function public.touch_last_seen()
returns void language sql security definer set search_path=public,pg_temp as $$
  insert into public.platform_user_activity(user_id,last_seen_at)
  select auth.uid(), now() where auth.uid() is not null
  on conflict (user_id) do update set last_seen_at=excluded.last_seen_at
  where public.platform_user_activity.last_seen_at < now() - interval '1 hour';
$$;
revoke all on function public.touch_last_seen() from public,anon,authenticated;
grant execute on function public.touch_last_seen() to authenticated;
