-- Tabibi: tables, constraints, indexes and maintenance triggers.
-- Access control (grants, RLS, RPCs) lives in the next migration.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Folds Arabic spelling variants so that search and duplicate detection are
-- insensitive to hamza forms, taa marbuta, alef maqsura, diacritics and case.
create or replace function public.normalize_arabic(input text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      lower(
        translate(
          regexp_replace(coalesce(input, ''), '[ً-ٰٟـ]', '', 'g'),
          'أإآٱةى',
          'ااااهي'
        )
      ),
      '\s+', ' ', 'g'
    )
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

-- Every new auth user gets a plain 'user' profile. The role can only be
-- changed by a privileged database role (see README, "Create the first admin").
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role) values (new.id, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Lookup tables
-- ---------------------------------------------------------------------------

create table public.governorates (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null check (length(btrim(name_ar)) between 2 and 80),
  name_en text not null check (length(btrim(name_en)) between 2 and 80),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint governorates_name_ar_key unique (name_ar)
);

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  governorate_id uuid not null references public.governorates (id) on delete restrict,
  name_ar text not null check (length(btrim(name_ar)) between 2 and 80),
  name_en text check (name_en is null or length(btrim(name_en)) between 2 and 80),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint areas_governorate_name_key unique (governorate_id, name_ar),
  -- Target of the composite foreign keys that keep area and governorate consistent.
  constraint areas_id_governorate_key unique (id, governorate_id)
);

create index areas_governorate_idx on public.areas (governorate_id, sort_order);

create table public.specialties (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null check (length(btrim(name_ar)) between 2 and 80),
  name_en text not null check (length(btrim(name_en)) between 2 and 80),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint specialties_name_ar_key unique (name_ar)
);

-- ---------------------------------------------------------------------------
-- Doctors
-- ---------------------------------------------------------------------------

create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(btrim(full_name)) between 2 and 150),
  specialty_id uuid not null references public.specialties (id) on delete restrict,
  clinic_phone text check (clinic_phone is null or clinic_phone ~ '^[0-9+ ()-]{5,20}$'),
  governorate_id uuid not null references public.governorates (id) on delete restrict,
  area_id uuid not null,
  address text not null check (length(btrim(address)) between 3 and 300),
  map_url text check (map_url is null or map_url ~* '^https?://'),
  latitude numeric(9, 6) check (latitude is null or latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude is null or longitude between -180 and 180),
  is_active boolean not null default true,
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint doctors_area_fkey foreign key (area_id, governorate_id)
    references public.areas (id, governorate_id) on delete restrict,
  constraint doctors_coordinates_pair check ((latitude is null) = (longitude is null))
);

create index doctors_location_idx on public.doctors (governorate_id, area_id) where is_active;
create index doctors_specialty_idx on public.doctors (specialty_id) where is_active;
create index doctors_created_idx on public.doctors (created_at desc);
create index doctors_search_idx on public.doctors using gin (search_text extensions.gin_trgm_ops);

create or replace function public.doctors_set_search_text()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  specialty_names text;
begin
  select s.name_ar || ' ' || s.name_en into specialty_names
  from public.specialties s
  where s.id = new.specialty_id;

  new.search_text := public.normalize_arabic(new.full_name || ' ' || coalesce(specialty_names, ''));
  return new;
end;
$$;

create trigger doctors_search_text
before insert or update of full_name, specialty_id on public.doctors
for each row execute function public.doctors_set_search_text();

create trigger doctors_updated_at
before update on public.doctors
for each row execute function public.set_updated_at();

-- Renaming a specialty must refresh the search text of its doctors.
create or replace function public.specialties_refresh_doctors()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.doctors d
  set search_text = public.normalize_arabic(d.full_name || ' ' || new.name_ar || ' ' || new.name_en)
  where d.specialty_id = new.id;
  return new;
end;
$$;

create trigger specialties_refresh_doctors
after update of name_ar, name_en on public.specialties
for each row execute function public.specialties_refresh_doctors();

-- ---------------------------------------------------------------------------
-- Doctor submissions (public suggestions awaiting review)
-- ---------------------------------------------------------------------------

create table public.doctor_submissions (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(btrim(full_name)) between 2 and 150),
  specialty_id uuid references public.specialties (id) on delete set null,
  specialty_other text check (specialty_other is null or length(btrim(specialty_other)) between 2 and 80),
  clinic_phone text check (clinic_phone is null or clinic_phone ~ '^[0-9+ ()-]{5,20}$'),
  governorate_id uuid not null references public.governorates (id) on delete restrict,
  area_id uuid not null,
  address text not null check (length(btrim(address)) between 3 and 300),
  map_url text check (map_url is null or map_url ~* '^https?://'),
  latitude numeric(9, 6) check (latitude is null or latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude is null or longitude between -180 and 180),
  submitter_name text check (submitter_name is null or length(submitter_name) <= 100),
  submitter_contact text check (submitter_contact is null or length(submitter_contact) <= 150),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  approved_doctor_id uuid references public.doctors (id) on delete set null,
  admin_note text check (admin_note is null or length(admin_note) <= 500),
  created_at timestamptz not null default now(),
  constraint doctor_submissions_area_fkey foreign key (area_id, governorate_id)
    references public.areas (id, governorate_id) on delete restrict,
  constraint doctor_submissions_specialty_present
    check (status <> 'pending' or specialty_id is not null or specialty_other is not null),
  constraint doctor_submissions_review_stamp
    check (status = 'pending' or reviewed_at is not null)
);

create index doctor_submissions_status_idx on public.doctor_submissions (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Facilities (laboratories, pharmacies, medical centers)
-- ---------------------------------------------------------------------------

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 150),
  type text not null check (type in ('lab', 'pharmacy', 'medical_center')),
  governorate_id uuid not null references public.governorates (id) on delete restrict,
  area_id uuid not null,
  address text not null check (length(btrim(address)) between 3 and 300),
  phone text check (phone is null or phone ~ '^[0-9+ ()-]{5,20}$'),
  map_url text check (map_url is null or map_url ~* '^https?://'),
  latitude numeric(9, 6) check (latitude is null or latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude is null or longitude between -180 and 180),
  is_active boolean not null default true,
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint facilities_area_fkey foreign key (area_id, governorate_id)
    references public.areas (id, governorate_id) on delete restrict,
  constraint facilities_coordinates_pair check ((latitude is null) = (longitude is null))
);

create index facilities_type_location_idx on public.facilities (type, governorate_id, area_id) where is_active;
create index facilities_search_idx on public.facilities using gin (search_text extensions.gin_trgm_ops);

create or replace function public.facilities_set_search_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_text := public.normalize_arabic(new.name);
  return new;
end;
$$;

create trigger facilities_search_text
before insert or update of name on public.facilities
for each row execute function public.facilities_set_search_text();

create trigger facilities_updated_at
before update on public.facilities
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Advertisements
-- ---------------------------------------------------------------------------

create table public.advertisements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 2 and 120),
  advertiser_name text not null check (length(btrim(advertiser_name)) between 2 and 120),
  image_path text not null check (length(btrim(image_path)) > 0),
  governorate_id uuid references public.governorates (id) on delete set null,
  area_id uuid,
  address text check (address is null or length(address) <= 300),
  map_url text check (map_url is null or map_url ~* '^https?://'),
  phone text check (phone is null or phone ~ '^[0-9+ ()-]{5,20}$'),
  placement text not null
    check (placement in ('home_top', 'home_middle', 'doctors_list', 'facilities_list')),
  display_order integer not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint advertisements_area_fkey foreign key (area_id, governorate_id)
    references public.areas (id, governorate_id) on delete set null (area_id),
  constraint advertisements_area_needs_governorate
    check (area_id is null or governorate_id is not null),
  constraint advertisements_period check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create index advertisements_placement_idx
  on public.advertisements (placement, display_order) where is_active;

create trigger advertisements_updated_at
before update on public.advertisements
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Abuse protection for the public submission endpoint (service role only)
-- ---------------------------------------------------------------------------

create table public.submission_rate_limits (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index submission_rate_limits_lookup_idx
  on public.submission_rate_limits (ip_hash, created_at desc);
