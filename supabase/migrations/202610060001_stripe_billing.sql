alter table public.subscription_records
  add column if not exists provider_price_id text;

alter table public.subscription_records
  alter column price_cents set default 4999;

alter table public.subscription_records
  drop constraint if exists subscription_records_price_cents_check;

alter table public.subscription_records
  add constraint subscription_records_price_cents_check check(price_cents>=0);

create table if not exists public.stripe_webhook_events(
  event_id text primary key,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.stripe_webhook_events enable row level security;
revoke all on public.stripe_webhook_events from anon,authenticated;
