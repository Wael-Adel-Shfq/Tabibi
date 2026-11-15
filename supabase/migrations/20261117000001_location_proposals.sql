-- Tabibi: visitors can propose a place that is missing from the location tree.
--
-- The location tree is managed by admins only. When a visitor suggesting a
-- doctor cannot find the district / center / city / area, they pick the
-- deepest existing level and type the missing name in `location_other`.
-- Such a suggestion may sit at any level; the admin then chooses or creates
-- the real location when approving it.

alter table public.doctor_submissions
  add column location_other text
    check (location_other is null or length(btrim(location_other)) between 2 and 80);

-- Same as before, except that a submission carrying a proposed place may
-- point at a broad level (governorate or region).
create or replace function public.set_location_path()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  loc public.locations%rowtype;
  proposes_place boolean;
begin
  if new.location_id is null then
    new.location_path := '{}';
    return new;
  end if;

  select * into loc from public.locations where id = new.location_id;
  if not found then
    raise exception 'location_missing' using errcode = '23503';
  end if;

  -- `location_other` only exists on doctor_submissions; read it generically.
  proposes_place := tg_table_name = 'doctor_submissions'
    and nullif(btrim(coalesce(to_jsonb(new) ->> 'location_other', '')), '') is not null;

  if tg_table_name <> 'advertisements' and not proposes_place and public.location_too_broad(loc.kind) then
    raise exception 'location_too_broad' using errcode = '23514';
  end if;

  new.location_path := loc.path;
  return new;
end;
$$;

-- Re-run the location check when the proposal is added or removed.
drop trigger doctor_submissions_location_path on public.doctor_submissions;
create trigger doctor_submissions_location_path
before insert or update of location_id, location_other on public.doctor_submissions
for each row execute function public.set_location_path();

-- Approval can now place the doctor somewhere other than where the visitor
-- pointed. Raises `location_required` when the visitor proposed a new place
-- and no location was chosen; the doctors trigger still rejects broad levels
-- with `location_too_broad`.
drop function public.approve_submission(uuid, uuid, boolean);

create function public.approve_submission(
  p_submission_id uuid,
  p_specialty_id uuid default null,
  p_allow_duplicate boolean default false,
  p_location_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.doctor_submissions%rowtype;
  v_specialty_id uuid;
  v_location_id uuid;
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

  if s.location_other is not null and p_location_id is null then
    raise exception 'location_required' using errcode = 'P0001';
  end if;
  v_location_id := coalesce(p_location_id, s.location_id);

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
    s.full_name, v_specialty_id, s.clinic_phone, v_location_id,
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

revoke all on function public.set_location_path() from public, anon, authenticated;
revoke all on function public.approve_submission(uuid, uuid, boolean, uuid) from public, anon;
grant execute on function public.approve_submission(uuid, uuid, boolean, uuid) to authenticated;
