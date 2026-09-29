-- Allows a signed-in business member to preview their own portfolio before publication.
-- The existing public read policy remains unchanged for published profiles.
create policy portfolio_member_read on storage.objects for select to authenticated
using (
  bucket_id='portfolio'
  and public.is_business_member((storage.foldername(name))[1]::uuid)
);
