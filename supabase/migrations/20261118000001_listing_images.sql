-- Tabibi: optional image for doctors and facilities.
--
-- Images live in a dedicated public bucket with a hard 1 MB limit. Only
-- admins can upload, replace or delete them. Object names are random UUIDs,
-- so an image is only discoverable through a record the visitor can read.

alter table public.doctors
  add column image_path text check (image_path is null or length(btrim(image_path)) > 0);
alter table public.facilities
  add column image_path text check (image_path is null or length(btrim(image_path)) > 0);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-images',
  'listing-images',
  true,
  1048576, -- 1 MB
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "listing-images: admin lists"
on storage.objects for select to authenticated
using (bucket_id = 'listing-images' and (select public.is_admin()));

create policy "listing-images: admin uploads"
on storage.objects for insert to authenticated
with check (bucket_id = 'listing-images' and (select public.is_admin()));

create policy "listing-images: admin replaces"
on storage.objects for update to authenticated
using (bucket_id = 'listing-images' and (select public.is_admin()))
with check (bucket_id = 'listing-images' and (select public.is_admin()));

create policy "listing-images: admin deletes"
on storage.objects for delete to authenticated
using (bucket_id = 'listing-images' and (select public.is_admin()));
