-- Tabibi: replace the fixed governorate -> area pair with a location tree.
--
--   governorate -> region (Cairo) -> district | city -> area
--   governorate -> district | center | city -> area
--
-- Records (doctors, facilities, submissions, advertisements) point at one
-- location and keep a copy of its ancestor chain in `location_path`, so a
-- filter at any level is a single indexed `location_path @> '{id}'` test.
-- Existing governorates and areas keep their ids; legacy areas that sat
-- directly under a governorate become districts.

-- ---------------------------------------------------------------------------
-- Tree table
-- ---------------------------------------------------------------------------

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.locations (id) on delete restrict,
  kind text not null
    check (kind in ('governorate', 'region', 'district', 'center', 'city', 'area')),
  name_ar text not null check (length(btrim(name_ar)) between 2 and 80),
  name_en text check (name_en is null or length(btrim(name_en)) between 2 and 80),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  -- Ancestor ids from the governorate down to this row (inclusive).
  path uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint locations_parent_name_key unique nulls not distinct (parent_id, name_ar),
  constraint locations_governorate_is_root check ((kind = 'governorate') = (parent_id is null))
);

create index locations_parent_idx on public.locations (parent_id, sort_order);
create index locations_path_idx on public.locations using gin (path);

-- Which kinds may sit directly under which.
create or replace function public.location_child_allowed(parent_kind text, child_kind text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case parent_kind
    when 'governorate' then child_kind in ('region', 'district', 'center', 'city')
    when 'region' then child_kind in ('district', 'city')
    when 'center' then child_kind in ('city', 'area')
    when 'district' then child_kind = 'area'
    when 'city' then child_kind = 'area'
    else false
  end;
$$;

-- Levels too broad to place a doctor, facility or suggestion at.
create or replace function public.location_too_broad(kind text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select kind in ('governorate', 'region');
$$;

-- Validates the hierarchy and computes `path`.
create or replace function public.locations_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent public.locations%rowtype;
begin
  if tg_op = 'UPDATE' and new.kind is distinct from old.kind then
    if exists (
      select 1 from public.locations c
      where c.parent_id = new.id and not public.location_child_allowed(new.kind, c.kind)
    ) then
      raise exception 'location_kind_not_allowed' using errcode = '23514';
    end if;
    if public.location_too_broad(new.kind) and (
      exists (select 1 from public.doctors where location_id = new.id)
      or exists (select 1 from public.facilities where location_id = new.id)
      or exists (select 1 from public.doctor_submissions where location_id = new.id)
    ) then
      raise exception 'location_too_broad' using errcode = '23514';
    end if;
  end if;

  if new.parent_id is null then
    new.path := array[new.id];
    return new;
  end if;

  select * into parent from public.locations where id = new.parent_id;
  if not found then
    raise exception 'location_parent_missing' using errcode = '23503';
  end if;
  if new.id = any (parent.path) then
    raise exception 'location_cycle' using errcode = '23514';
  end if;
  if not public.location_child_allowed(parent.kind, new.kind) then
    raise exception 'location_kind_not_allowed' using errcode = '23514';
  end if;

  new.path := parent.path || new.id;
  return new;
end;
$$;

create trigger locations_before_write
before insert or update of parent_id, kind on public.locations
for each row execute function public.locations_before_write();

-- ---------------------------------------------------------------------------
-- Move existing reference data into the tree (same ids)
-- ---------------------------------------------------------------------------

insert into public.locations (id, parent_id, kind, name_ar, name_en, is_active, sort_order, created_at)
select id, null, 'governorate', name_ar, name_en, is_active, sort_order, created_at
from public.governorates;

insert into public.locations (id, parent_id, kind, name_ar, name_en, is_active, sort_order, created_at)
select id, governorate_id, 'district', name_ar, name_en, is_active, sort_order, created_at
from public.areas;

-- Cairo's administrative regions.
insert into public.locations (parent_id, kind, name_ar, name_en, sort_order)
select g.id, 'region', r.name_ar, r.name_en, r.sort_order
from public.locations g
cross join (values
  ('المنطقة الشرقية', 'Eastern Region', 1),
  ('المنطقة الشمالية', 'Northern Region', 2),
  ('المنطقة الجنوبية', 'Southern Region', 3),
  ('المنطقة الغربية', 'Western Region', 4),
  ('المدن العمرانية الجديدة', 'New Urban Cities', 5)
) as r (name_ar, name_en, sort_order)
where g.kind = 'governorate' and g.name_en = 'Cairo'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Records point at a location
-- ---------------------------------------------------------------------------

alter table public.doctors
  add column location_id uuid references public.locations (id) on delete restrict,
  add column location_path uuid[] not null default '{}';
alter table public.facilities
  add column location_id uuid references public.locations (id) on delete restrict,
  add column location_path uuid[] not null default '{}';
alter table public.doctor_submissions
  add column location_id uuid references public.locations (id) on delete restrict,
  add column location_path uuid[] not null default '{}';
alter table public.advertisements
  add column location_id uuid references public.locations (id) on delete set null,
  add column location_path uuid[] not null default '{}';

-- Keeps `location_path` in step with `location_id` and enforces the minimum level.
create or replace function public.set_location_path()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  loc public.locations%rowtype;
begin
  if new.location_id is null then
    new.location_path := '{}';
    return new;
  end if;

  select * into loc from public.locations where id = new.location_id;
  if not found then
    raise exception 'location_missing' using errcode = '23503';
  end if;
  if tg_table_name <> 'advertisements' and public.location_too_broad(loc.kind) then
    raise exception 'location_too_broad' using errcode = '23514';
  end if;

  new.location_path := loc.path;
  return new;
end;
$$;

create trigger doctors_location_path
before insert or update of location_id on public.doctors
for each row execute function public.set_location_path();
create trigger facilities_location_path
before insert or update of location_id on public.facilities
for each row execute function public.set_location_path();
create trigger doctor_submissions_location_path
before insert or update of location_id on public.doctor_submissions
for each row execute function public.set_location_path();
create trigger advertisements_location_path
before insert or update of location_id on public.advertisements
for each row execute function public.set_location_path();

update public.doctors set location_id = area_id;
update public.facilities set location_id = area_id;
update public.doctor_submissions set location_id = area_id;
update public.advertisements set location_id = coalesce(area_id, governorate_id);

alter table public.doctors alter column location_id set not null;
alter table public.facilities alter column location_id set not null;
alter table public.doctor_submissions alter column location_id set not null;

-- Moving a location re-roots its descendants and every record under it.
create or replace function public.locations_after_move()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.path is not distinct from old.path then
    return null;
  end if;

  update public.locations d
  set path = new.path || d.path[array_position(d.path, new.id) + 1:]
  where d.path @> array[new.id] and d.id <> new.id;

  update public.doctors r set location_path = l.path
  from public.locations l
  where l.id = r.location_id and r.location_path @> array[new.id];
  update public.facilities r set location_path = l.path
  from public.locations l
  where l.id = r.location_id and r.location_path @> array[new.id];
  update public.doctor_submissions r set location_path = l.path
  from public.locations l
  where l.id = r.location_id and r.location_path @> array[new.id];
  update public.advertisements r set location_path = l.path
  from public.locations l
  where l.id = r.location_id and r.location_path @> array[new.id];

  return null;
end;
$$;

create trigger locations_after_move
after update of parent_id on public.locations
for each row execute function public.locations_after_move();

-- ---------------------------------------------------------------------------
-- Drop the old two-level model
-- ---------------------------------------------------------------------------

alter table public.doctors drop column governorate_id, drop column area_id;
alter table public.facilities drop column governorate_id, drop column area_id;
alter table public.doctor_submissions drop column governorate_id, drop column area_id;
alter table public.advertisements drop column governorate_id, drop column area_id;

drop table public.areas;
drop table public.governorates;

create index doctors_location_path_idx on public.doctors using gin (location_path);
create index facilities_location_path_idx on public.facilities using gin (location_path);
create index advertisements_location_idx on public.advertisements (location_id);

-- ---------------------------------------------------------------------------
-- Visibility: a record is public only while its whole location chain is active
-- ---------------------------------------------------------------------------

create or replace function public.location_path_active(p uuid[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.locations l where l.id = any (p) and not l.is_active
  );
$$;

-- Ordered names of a location chain, for display. PostgREST exposes the
-- per-table overloads below as a computed `location_chain` column.
create or replace function public.location_chain_of(p uuid[])
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', l.id, 'kind', l.kind, 'name_ar', l.name_ar, 'name_en', l.name_en)
      order by u.ord
    ),
    '[]'::jsonb
  )
  from unnest(p) with ordinality as u (id, ord)
  join public.locations l on l.id = u.id;
$$;

create or replace function public.location_chain(public.doctors)
returns jsonb language sql stable set search_path = ''
as $$ select public.location_chain_of($1.location_path); $$;
create or replace function public.location_chain(public.facilities)
returns jsonb language sql stable set search_path = ''
as $$ select public.location_chain_of($1.location_path); $$;
create or replace function public.location_chain(public.doctor_submissions)
returns jsonb language sql stable set search_path = ''
as $$ select public.location_chain_of($1.location_path); $$;
create or replace function public.location_chain(public.advertisements)
returns jsonb language sql stable set search_path = ''
as $$ select public.location_chain_of($1.location_path); $$;

alter table public.locations enable row level security;

grant select on public.locations to anon, authenticated;
grant insert, update, delete on public.locations to authenticated;
grant all on public.locations to service_role;

create policy "locations: public reads active chain"
on public.locations for select to anon, authenticated
using (is_active and public.location_path_active(path));

create policy "locations: admin manages"
on public.locations for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy "doctors: public reads active" on public.doctors;
create policy "doctors: public reads active"
on public.doctors for select to anon, authenticated
using (is_active and public.location_path_active(location_path));

drop policy "facilities: public reads active" on public.facilities;
create policy "facilities: public reads active"
on public.facilities for select to anon, authenticated
using (is_active and public.location_path_active(location_path));

drop policy "advertisements: public reads active in period" on public.advertisements;
create policy "advertisements: public reads active in period"
on public.advertisements for select to anon, authenticated
using (
  is_active
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at > now())
  and public.location_path_active(location_path)
);

-- ---------------------------------------------------------------------------
-- Review workflow on the new columns
-- ---------------------------------------------------------------------------

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
      d.location_path[1] = p_governorate_id
      and extensions.similarity(
        public.normalize_arabic(d.full_name), public.normalize_arabic(p_full_name)
      ) >= 0.5
    );
$$;

drop function public.find_duplicate_doctors(uuid);

create function public.find_duplicate_doctors(p_submission_id uuid)
returns table (
  id uuid,
  full_name text,
  specialty_name_ar text,
  specialty_name_en text,
  clinic_phone text,
  address text,
  location_chain jsonb,
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
    d.id, d.full_name, sp.name_ar, sp.name_en, d.clinic_phone, d.address,
    public.location_chain_of(d.location_path), d.is_active, dup.name_similarity, dup.phone_match
  from public.doctor_submissions s
  cross join lateral public.duplicate_doctors_for(s.full_name, s.clinic_phone, s.location_path[1]) dup
  join public.doctors d on d.id = dup.doctor_id
  join public.specialties sp on sp.id = d.specialty_id
  where s.id = p_submission_id
  order by dup.phone_match desc, dup.name_similarity desc;
end;
$$;

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
    select 1 from public.duplicate_doctors_for(s.full_name, s.clinic_phone, s.location_path[1])
  ) then
    raise exception 'possible_duplicate' using errcode = 'P0001';
  end if;

  insert into public.doctors (
    full_name, specialty_id, clinic_phone, location_id,
    address, map_url, latitude, longitude, is_active
  )
  values (
    s.full_name, v_specialty_id, s.clinic_phone, s.location_id,
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

-- ---------------------------------------------------------------------------
-- Function privileges for everything created or replaced above
-- ---------------------------------------------------------------------------

revoke all on function public.location_child_allowed(text, text) from public, anon, authenticated;
revoke all on function public.location_too_broad(text) from public, anon, authenticated;
revoke all on function public.locations_before_write() from public, anon, authenticated;
revoke all on function public.set_location_path() from public, anon, authenticated;
revoke all on function public.locations_after_move() from public, anon, authenticated;
revoke all on function public.duplicate_doctors_for(text, text, uuid) from public, anon, authenticated;
revoke all on function public.location_path_active(uuid[]) from public;
revoke all on function public.location_chain_of(uuid[]) from public;
revoke all on function public.find_duplicate_doctors(uuid) from public, anon;
revoke all on function public.approve_submission(uuid, uuid, boolean) from public, anon;

grant execute on function public.location_path_active(uuid[]) to anon, authenticated, service_role;
grant execute on function public.location_chain_of(uuid[]) to anon, authenticated, service_role;
grant execute on function public.location_chain(public.doctors) to anon, authenticated, service_role;
grant execute on function public.location_chain(public.facilities) to anon, authenticated, service_role;
grant execute on function public.location_chain(public.doctor_submissions) to authenticated, service_role;
grant execute on function public.location_chain(public.advertisements) to anon, authenticated, service_role;
grant execute on function public.find_duplicate_doctors(uuid) to authenticated;
grant execute on function public.approve_submission(uuid, uuid, boolean) to authenticated;
