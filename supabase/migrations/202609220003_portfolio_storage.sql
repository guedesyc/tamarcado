insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('portfolio','portfolio',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

create policy portfolio_public_read on storage.objects for select to anon,authenticated
using(bucket_id='portfolio' and exists(
  select 1 from public.portfolio_items i join public.businesses b on b.id=i.business_id
  where i.storage_path=name and i.is_public and b.published_at is not null
));
create policy portfolio_member_upload on storage.objects for insert to authenticated
with check(bucket_id='portfolio' and public.is_business_member((storage.foldername(name))[1]::uuid));
create policy portfolio_member_delete on storage.objects for delete to authenticated
using(bucket_id='portfolio' and public.is_business_member((storage.foldername(name))[1]::uuid));
