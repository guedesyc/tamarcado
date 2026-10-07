-- Stripe event IDs/types and processing timestamps are sufficient for
-- idempotency. Clear only already-processed event bodies, which can include
-- customer data. Keep unresolved bodies for operational investigation/retry.
-- No rows, event IDs, subscriptions, invoices, or payment data are deleted.
update public.stripe_webhook_events
set payload = '{}'::jsonb
where processed_at is not null
  and payload <> '{}'::jsonb;
