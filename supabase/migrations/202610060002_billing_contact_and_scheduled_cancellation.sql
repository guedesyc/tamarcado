alter table public.businesses
  add column if not exists billing_email text;

alter table public.businesses
  drop constraint if exists businesses_billing_email_check;

alter table public.businesses
  add constraint businesses_billing_email_check
  check (billing_email is null or billing_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');

alter table public.subscription_records
  add column if not exists cancel_at timestamptz;
