alter table public.subscription_records
  add column if not exists provider_livemode boolean not null default false;
