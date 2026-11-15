-- Tabibi: storage bucket for advertisement images.
--
-- The bucket is public so published images are served from the CDN without a
-- session. Object names are random UUIDs, so an image is only discoverable
-- through an advertisement row the visitor is allowed to read. Listing,
-- uploading, replacing and deleting objects is restricted to admins.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ad-images',
  'ad-images',
  true,
  2097152, -- 2 MB
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "ad-images: admin lists"
on storage.objects for select to authenticated
using (bucket_id = 'ad-images' and (select public.is_admin()));

create policy "ad-images: admin uploads"
on storage.objects for insert to authenticated
with check (bucket_id = 'ad-images' and (select public.is_admin()));

create policy "ad-images: admin replaces"
on storage.objects for update to authenticated
using (bucket_id = 'ad-images' and (select public.is_admin()))
with check (bucket_id = 'ad-images' and (select public.is_admin()));

create policy "ad-images: admin deletes"
on storage.objects for delete to authenticated
using (bucket_id = 'ad-images' and (select public.is_admin()));
