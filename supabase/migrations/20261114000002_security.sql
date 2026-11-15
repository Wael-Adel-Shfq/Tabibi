-- Tabibi: grants, row level security and admin RPCs.
--
-- Model:
--   anon / authenticated  -> read published rows only
--   admin (profiles.role) -> full management, enforced by RLS + RPC checks
--   service_role          -> used only by the submit-doctor Edge Function

-- ---------------------------------------------------------------------------
-- Admin check
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Grants: start from nothing, then add exactly what each role needs.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Public directory data: read only.
grant select on
  public.governorates,
  public.areas,
  public.specialties,
  public.doctors,
  public.facilities,
  public.advertisements
to anon, authenticated;

-- Management: table privileges go to `authenticated`; RLS narrows them to admins.
grant insert, update, delete on
  public.governorates,
  public.areas,
  public.specialties,
  public.doctors,
  public.facilities,
  public.advertisements
to authenticated;

-- Submissions: no INSERT for any client role. Rows are created by the Edge Function.
grant select, update, delete on public.doctor_submissions to authenticated;

-- Profiles: read only. No client role can insert, update or delete a profile,
-- so nobody can grant themself the admin role through the API.
grant select on public.profiles to authenticated;

-- submission_rate_limits: no client grants at all.

grant execute on function public.is_admin() to authenticated;
grant execute on function public.normalize_arabic(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.governorates enable row level security;
alter table public.areas enable row level security;
alter table public.specialties enable row level security;
alter table public.doctors enable row level security;
alter table public.doctor_submissions enable row level security;
alter table public.facilities enable row level security;
alter table public.advertisements enable row level security;
alter table public.submission_rate_limits enable row level security;

-- profiles
create policy "profiles: read own or admin reads all"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_admin()));

-- governorates
create policy "governorates: public reads active"
on public.governorates for select to anon, authenticated
using (is_active);

create policy "governorates: admin manages"
on public.governorates for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- areas
create policy "areas: public reads active"
on public.areas for select to anon, authenticated
using (is_active);

create policy "areas: admin manages"
on public.areas for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- specialties
create policy "specialties: public reads active"
on public.specialties for select to anon, authenticated
using (is_active);

create policy "specialties: admin manages"
on public.specialties for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- doctors (every row is an approved doctor; is_active controls visibility)
create policy "doctors: public reads active"
on public.doctors for select to anon, authenticated
using (is_active);

create policy "doctors: admin manages"
on public.doctors for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- facilities
create policy "facilities: public reads active"
on public.facilities for select to anon, authenticated
using (is_active);

create policy "facilities: admin manages"
on public.facilities for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- advertisements
create policy "advertisements: public reads active in period"
on public.advertisements for select to anon, authenticated
using (
  is_active
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at > now())
);

create policy "advertisements: admin manages"
on public.advertisements for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- doctor_submissions: admins only. There is deliberately no INSERT policy.
create policy "doctor_submissions: admin reads"
on public.doctor_submissions for select to authenticated
using ((select public.is_admin()));

create policy "doctor_submissions: admin updates"
on public.doctor_submissions for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "doctor_submissions: admin deletes"
on public.doctor_submissions for delete to authenticated
using ((select public.is_admin()));

-- submission_rate_limits: RLS on, no policies => only service_role can touch it.

-- ---------------------------------------------------------------------------
-- Duplicate detection
-- ---------------------------------------------------------------------------

-- Internal helper (not granted to any client role).
create or replace function public.duplicate_doctors_for(
  p_full_name text,
  p_phone text,
  p_governorate_id uuid
)
returns table (doctor_id uuid, name_similarity real, phone_match boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    d.id,
    extensions.similarity(public.normalize_arabic(d.full_name), public.normalize_arabic(p_full_name)),
    (
      nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '') is not null
      and regexp_replace(coalesce(d.clinic_phone, ''), '\D', '', 'g')
        = regexp_replace(p_phone, '\D', '', 'g')
    )
  from public.doctors d
  where
    (
      nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '') is not null
      and regexp_replace(coalesce(d.clinic_phone, ''), '\D', '', 'g')
        = regexp_replace(p_phone, '\D', '', 'g')
    )
    or (
      d.governorate_id = p_governorate_id
      and extensions.similarity(
        public.normalize_arabic(d.full_name), public.normalize_arabic(p_full_name)
      ) >= 0.5
    );
$$;

create or replace function public.find_duplicate_doctors(p_submission_id uuid)
returns table (
  id uuid,
  full_name text,
  specialty_name_ar text,
  specialty_name_en text,
  clinic_phone text,
  address text,
  area_name_ar text,
  is_active boolean,
  name_similarity real,
  phone_match boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return query
  select
    d.id, d.full_name, sp.name_ar, sp.name_en, d.clinic_phone, d.address, a.name_ar,
    d.is_active, dup.name_similarity, dup.phone_match
  from public.doctor_submissions s
  cross join lateral public.duplicate_doctors_for(s.full_name, s.clinic_phone, s.governorate_id) dup
  join public.doctors d on d.id = dup.doctor_id
  join public.specialties sp on sp.id = d.specialty_id
  join public.areas a on a.id = d.area_id
  where s.id = p_submission_id
  order by dup.phone_match desc, dup.name_similarity desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Review workflow
-- ---------------------------------------------------------------------------

-- Approves a pending submission atomically: creates the doctor and stamps the
-- reviewer. Raises:
--   not_authorized          caller is not an admin
--   submission_not_pending  missing or already reviewed
--   specialty_required      submission used "other" and no specialty was chosen
--   possible_duplicate      similar doctor exists and p_allow_duplicate is false
create or replace function public.approve_submission(
  p_submission_id uuid,
  p_specialty_id uuid default null,
  p_allow_duplicate boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.doctor_submissions%rowtype;
  v_specialty_id uuid;
  v_doctor_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into s
  from public.doctor_submissions
  where id = p_submission_id and status = 'pending'
  for update;

  if not found then
    raise exception 'submission_not_pending' using errcode = 'P0001';
  end if;

  v_specialty_id := coalesce(p_specialty_id, s.specialty_id);
  if v_specialty_id is null then
    raise exception 'specialty_required' using errcode = 'P0001';
  end if;

  if not p_allow_duplicate and exists (
    select 1 from public.duplicate_doctors_for(s.full_name, s.clinic_phone, s.governorate_id)
  ) then
    raise exception 'possible_duplicate' using errcode = 'P0001';
  end if;

  insert into public.doctors (
    full_name, specialty_id, clinic_phone, governorate_id, area_id,
    address, map_url, latitude, longitude, is_active
  )
  values (
    s.full_name, v_specialty_id, s.clinic_phone, s.governorate_id, s.area_id,
    s.address, s.map_url, s.latitude, s.longitude, true
  )
  returning id into v_doctor_id;

  perform set_config('tabibi.reviewing', 'on', true);
  update public.doctor_submissions
  set status = 'approved',
      specialty_id = v_specialty_id,
      reviewed_by = (select auth.uid()),
      reviewed_at = now(),
      approved_doctor_id = v_doctor_id
  where id = p_submission_id;
  perform set_config('tabibi.reviewing', 'off', true);

  return v_doctor_id;
end;
$$;

create or replace function public.reject_submission(
  p_submission_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  perform set_config('tabibi.reviewing', 'on', true);
  update public.doctor_submissions
  set status = 'rejected',
      reviewed_by = (select auth.uid()),
      reviewed_at = now(),
      admin_note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_submission_id and status = 'pending';

  if not found then
    raise exception 'submission_not_pending' using errcode = 'P0001';
  end if;

  perform set_config('tabibi.reviewing', 'off', true);
end;
$$;

-- Submissions may only change state through the two functions above. This
-- trigger blocks direct UPDATEs of the review columns, even by an admin
-- session, so reviewed_by / reviewed_at can never be forged from the client.
create or replace function public.doctor_submissions_guard_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('tabibi.reviewing', true) = 'on' then
    return new;
  end if;

  if new.status is distinct from old.status
     or new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at
     or new.approved_doctor_id is distinct from old.approved_doctor_id then
    raise exception 'review_columns_are_managed_by_rpc' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger doctor_submissions_guard_review
before update on public.doctor_submissions
for each row execute function public.doctor_submissions_guard_review();

-- ---------------------------------------------------------------------------
-- Dashboard
-- ---------------------------------------------------------------------------

create or replace function public.admin_dashboard_stats()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return json_build_object(
    'doctors', (select count(*) from public.doctors where is_active),
    'labs', (select count(*) from public.facilities where type = 'lab' and is_active),
    'pharmacies', (select count(*) from public.facilities where type = 'pharmacy' and is_active),
    'medical_centers',
      (select count(*) from public.facilities where type = 'medical_center' and is_active),
    'pending_submissions', (select count(*) from public.doctor_submissions where status = 'pending'),
    'active_advertisements', (
      select count(*) from public.advertisements
      where is_active
        and (starts_at is null or starts_at <= now())
        and (ends_at is null or ends_at > now())
    )
  );
end;
$$;

-- Function privileges: admin RPCs are callable by signed-in users only and
-- verify the admin role themselves. Nothing here is callable by anon.
revoke all on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.normalize_arabic(text) to anon, authenticated, service_role;
grant execute on function public.find_duplicate_doctors(uuid) to authenticated;
grant execute on function public.approve_submission(uuid, uuid, boolean) to authenticated;
grant execute on function public.reject_submission(uuid, text) to authenticated;
grant execute on function public.admin_dashboard_stats() to authenticated;
