alter table public.subscription_records add column if not exists provider_checkout_id text;
alter table public.subscription_records add constraint subscription_one_per_business unique(business_id);

create table public.asaas_webhook_events(
  event_id text primary key,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
alter table public.asaas_webhook_events enable row level security;

revoke all on public.asaas_webhook_events from anon,authenticated;
