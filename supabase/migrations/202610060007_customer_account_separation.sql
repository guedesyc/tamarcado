-- Customer accounts are intentionally separate from professional workspaces.
-- Create the customer profile as soon as an e-mail/password customer verifies or signs in.
create or replace function public.initialize_customer_profile()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_name text; v_phone text;
begin
  if coalesce(new.raw_user_meta_data->>'account_type','') <> 'customer' then return new; end if;
  v_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name','')), '');
  v_phone := nullif(trim(coalesce(new.raw_user_meta_data->>'phone','')), '');
  insert into public.customer_profiles(user_id,name,phone)
  values (new.id, v_name, v_phone)
  on conflict (user_id) do update set
    name = coalesce(excluded.name, public.customer_profiles.name),
    phone = coalesce(excluded.phone, public.customer_profiles.phone),
    updated_at = now();
  return new;
end $$;

drop trigger if exists on_customer_auth_user_created on auth.users;
create trigger on_customer_auth_user_created
  after insert on auth.users for each row execute function public.initialize_customer_profile();

-- Existing customer accounts created through the optional agenda flow also become
-- explicit customer accounts, without touching professional memberships.
insert into public.customer_profiles(user_id,name,phone)
select u.id,
  nullif(trim(coalesce(u.raw_user_meta_data->>'full_name','')), ''),
  nullif(trim(coalesce(u.raw_user_meta_data->>'phone','')), '')
from auth.users u
where coalesce(u.raw_user_meta_data->>'account_type','') = 'customer'
on conflict (user_id) do nothing;
