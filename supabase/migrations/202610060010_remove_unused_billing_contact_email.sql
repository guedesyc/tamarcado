-- The app no longer offers a separate billing-contact email. Stripe billing
-- uses the professional's authenticated account email instead. Clear values
-- previously stored for this unused setting while keeping the nullable legacy
-- column in place to avoid a destructive schema change in production.
update public.businesses
set billing_email = null
where billing_email is not null;
