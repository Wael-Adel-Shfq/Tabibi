begin;
create extension if not exists pgtap with schema extensions;

-- Fixture ids. Location tree used by the tests:
--   Cairo (seeded) -> Southern Region (seeded) -> d-1 Test District -> a-1 Test Area
--                                              -> d-2 Hidden District (inactive) -> a-2 Area Under Hidden
--   Minya (seeded) -> c-1 Test Center -> a-3 Test Village
create or replace function pg_temp.fixtures() returns void
language plpgsql as $$
declare
  cairo uuid;
  south uuid;
  minya uuid;
  spec uuid;
begin
  select id into cairo from public.locations where kind = 'governorate' and name_en = 'Cairo';
  select id into minya from public.locations where kind = 'governorate' and name_en = 'Minya';
  select id into south from public.locations where parent_id = cairo and name_en = 'Southern Region';
  select id into spec from public.specialties where name_en = 'Pediatrics';

  insert into public.locations (id, parent_id, kind, name_ar, name_en, is_active) values
    ('00000000-0000-0000-0000-0000000000d1', south, 'district', 'حي اختبار', 'Test District', true),
    ('00000000-0000-0000-0000-0000000000d2', south, 'district', 'حي اختبار مخفي', 'Hidden District', false);
  insert into public.locations (id, parent_id, kind, name_ar, name_en, is_active) values
    ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d1', 'area', 'منطقة اختبار', 'Test Area', true),
    ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000d2', 'area', 'منطقة تحت المخفي', 'Area Under Hidden', true),
    ('00000000-0000-0000-0000-0000000000c1', minya, 'center', 'مركز اختبار', 'Test Center', true);
  insert into public.locations (id, parent_id, kind, name_ar, name_en) values
    ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000c1', 'area', 'قرية اختبار', 'Test Village');

  insert into public.doctors (id, full_name, specialty_id, clinic_phone, location_id, address, is_active) values
    ('00000000-0000-0000-0000-000000000101', 'اختبار ظاهر', spec, '0221234567',
     '00000000-0000-0000-0000-0000000000a1', 'عنوان اختبار 1', true),
    ('00000000-0000-0000-0000-000000000102', 'اختبار مخفي', spec, null,
     '00000000-0000-0000-0000-0000000000a1', 'عنوان اختبار 2', false),
    ('00000000-0000-0000-0000-000000000103', 'اختبار تحت منطقة مخفية', spec, null,
     '00000000-0000-0000-0000-0000000000a2', 'عنوان اختبار 3', true),
    ('00000000-0000-0000-0000-000000000104', 'اختبار في مركز', spec, null,
     '00000000-0000-0000-0000-0000000000c1', 'عنوان اختبار 4', true);

  insert into public.facilities (id, name, type, location_id, address, is_active) values
    ('00000000-0000-0000-0000-0000000000f1', 'معمل اختبار', 'lab', '00000000-0000-0000-0000-0000000000a1', 'عنوان 5', true),
    ('00000000-0000-0000-0000-0000000000f2', 'صيدلية مخفية', 'pharmacy', '00000000-0000-0000-0000-0000000000a1', 'عنوان 6', false);

  insert into public.advertisements (id, title, advertiser_name, image_path, placement, is_active, starts_at, ends_at) values
    ('00000000-0000-0000-0000-0000000000e1', 'اعلان ظاهر', 'معلن', 'a.webp', 'home_top', true, null, null),
    ('00000000-0000-0000-0000-0000000000e2', 'اعلان متوقف', 'معلن', 'b.webp', 'home_top', false, null, null),
    ('00000000-0000-0000-0000-0000000000e3', 'اعلان منتهي', 'معلن', 'c.webp', 'home_top', true,
     now() - interval '10 days', now() - interval '1 day'),
    ('00000000-0000-0000-0000-0000000000e4', 'اعلان قادم', 'معلن', 'd.webp', 'home_top', true,
     now() + interval '1 day', null),
    ('00000000-0000-0000-0000-0000000000e5', 'اعلان داخل الفترة', 'معلن', 'e.webp', 'doctors_list', true,
     now() - interval '1 day', now() + interval '1 day');
  insert into public.advertisements (id, title, advertiser_name, image_path, placement, location_id) values
    ('00000000-0000-0000-0000-0000000000e6', 'اعلان في حي مخفي', 'معلن', 'f.webp', 'home_top',
     '00000000-0000-0000-0000-0000000000d2');

  insert into public.doctor_submissions (id, full_name, specialty_id, clinic_phone, location_id, address) values
    ('00000000-0000-0000-0000-0000000000c9', 'مقترح جديد', spec, '0229999999',
     '00000000-0000-0000-0000-0000000000a1', 'عنوان مقترح');

  insert into auth.users (id, email) values
    ('00000000-0000-0000-0000-000000000001', 'admin@test.local'),
    ('00000000-0000-0000-0000-000000000002', 'user@test.local');
  update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000001';
end;
$$;

-- Switch the current transaction to a signed-in user.
create or replace function pg_temp.login(uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

select plan(83);
select pg_temp.fixtures();

-- ===========================================================================
-- 0. Location tree rules (as the table owner)
-- ===========================================================================

select results_eq(
  $$ select array_length(path, 1) from public.locations where id = '00000000-0000-0000-0000-0000000000a1' $$,
  $$ values (4) $$,
  'an area under a Cairo region has a four-level path');
select results_eq(
  $$ select array_length(path, 1) from public.locations where id = '00000000-0000-0000-0000-0000000000a3' $$,
  $$ values (3) $$,
  'a village under a center has a three-level path');
select throws_ok(
  $$ insert into public.locations (parent_id, kind, name_ar) values
     ('00000000-0000-0000-0000-0000000000a1', 'district', 'حي تحت منطقة') $$,
  '23514', 'location_kind_not_allowed', 'a district cannot sit under an area');
select throws_ok(
  $$ insert into public.locations (parent_id, kind, name_ar) values (null, 'area', 'منطقة بلا أب') $$,
  '23514', null, 'only governorates can be roots');
select throws_ok(
  $$ update public.locations set parent_id = '00000000-0000-0000-0000-0000000000a1'
     where id = '00000000-0000-0000-0000-0000000000d1' $$,
  '23514', null, 'a location cannot move under its own descendant');
select throws_ok(
  $$ insert into public.doctors (full_name, specialty_id, location_id, address)
     select 'واسع', specialty_id, (select id from public.locations where name_en = 'Cairo'), 'عنوان'
     from public.doctors limit 1 $$,
  '23514', 'location_too_broad', 'a doctor cannot be placed at governorate level');
select throws_ok(
  $$ delete from public.locations where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '23503', null, 'a location in use cannot be deleted');

-- ===========================================================================
-- 1. Anonymous visitor
-- ===========================================================================
set local role anon;

select isnt_empty($$ select 1 from public.locations where kind = 'governorate' $$, 'anon sees governorates');
select is((select count(*) from public.locations where id in (
    '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2',
    '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2')),
  2::bigint, 'anon does not see inactive locations or anything under them');

select results_eq(
  $$ select id from public.doctors where id::text like '00000000-0000-0000-0000-0000000001%' order by id $$,
  $$ values ('00000000-0000-0000-0000-000000000101'::uuid), ('00000000-0000-0000-0000-000000000104'::uuid) $$,
  'anon sees active doctors whose whole location chain is active');
select is((select count(*) from public.facilities where id in
    ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2')),
  1::bigint, 'anon sees active facilities only');
select results_eq(
  $$ select id from public.advertisements where id::text like '00000000-0000-0000-0000-0000000000e%' order by id $$,
  $$ values ('00000000-0000-0000-0000-0000000000e1'::uuid), ('00000000-0000-0000-0000-0000000000e5'::uuid) $$,
  'anon sees only active advertisements inside their period and in active locations');

-- Filtering at every level of the tree.
select is((select count(*) from public.doctors
    where location_path @> array[(select id from public.locations where name_en = 'Cairo')]
      and id::text like '00000000-0000-0000-0000-0000000001%'), 1::bigint,
  'filter by governorate (Cairo) includes doctors in its regions and districts');
select is((select count(*) from public.doctors
    where location_path @> array[(select id from public.locations where name_en = 'Southern Region')]
      and id::text like '00000000-0000-0000-0000-0000000001%'), 1::bigint,
  'filter by region');
select is((select count(*) from public.doctors
    where location_path @> array['00000000-0000-0000-0000-0000000000d1'::uuid]), 1::bigint,
  'filter by district');
select is((select count(*) from public.doctors
    where location_path @> array['00000000-0000-0000-0000-0000000000a1'::uuid]), 1::bigint,
  'filter by area');
select is((select count(*) from public.doctors
    where location_path @> array['00000000-0000-0000-0000-0000000000c1'::uuid]), 1::bigint,
  'filter by center includes a doctor placed at the center itself');
select is(
  (select jsonb_array_length(public.location_chain(d)) from public.doctors d
   where id = '00000000-0000-0000-0000-000000000101'), 4,
  'location_chain returns the four names for display');

select throws_ok($$ select * from public.doctor_submissions $$, '42501', null, 'anon cannot read submissions');
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon cannot read profiles');
select throws_ok($$ select * from public.submission_rate_limits $$, '42501', null, 'anon cannot read rate limits');

select throws_ok(
  $$ insert into public.doctors (full_name, specialty_id, location_id, address)
     select 'دخيل', specialty_id, location_id, 'عنوان' from public.doctors limit 1 $$,
  '42501', null, 'anon cannot insert doctors');
select throws_ok($$ update public.doctors set full_name = 'تعديل' $$, '42501', null, 'anon cannot update doctors');
select throws_ok($$ delete from public.doctors $$, '42501', null, 'anon cannot delete doctors');
select throws_ok(
  $$ insert into public.doctor_submissions (full_name, specialty_other, location_id, address, status)
     select 'مباشر', 'تخصص', location_id, 'عنوان', 'approved' from public.doctors limit 1 $$,
  '42501', null, 'anon cannot insert submissions directly, only through the Edge Function');
select throws_ok(
  $$ insert into public.locations (parent_id, kind, name_ar)
     select id, 'district', 'جديد' from public.locations where kind = 'governorate' limit 1 $$,
  '42501', null, 'anon cannot insert locations');
select throws_ok($$ update public.locations set is_active = false $$, '42501', null, 'anon cannot update locations');
select throws_ok($$ delete from public.facilities $$, '42501', null, 'anon cannot delete facilities');
select throws_ok($$ update public.advertisements set is_active = true $$, '42501', null, 'anon cannot update advertisements');
select throws_ok($$ delete from public.specialties $$, '42501', null, 'anon cannot delete specialties');
select throws_ok(
  $$ select public.approve_submission('00000000-0000-0000-0000-0000000000c9') $$,
  '42501', null, 'anon cannot call approve_submission');
select throws_ok($$ select public.reject_submission('00000000-0000-0000-0000-0000000000c9') $$,
  '42501', null, 'anon cannot call reject_submission');
select throws_ok($$ select public.admin_dashboard_stats() $$, '42501', null, 'anon cannot read dashboard stats');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('ad-images', 'anon.webp') $$,
  '42501', null, 'anon cannot upload advertisement images');

-- ===========================================================================
-- 2. Signed-in user without the admin role
-- ===========================================================================
reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000002');

select is(public.is_admin(), false, 'normal user is not admin');
select results_eq($$ select id from public.profiles $$,
  $$ values ('00000000-0000-0000-0000-000000000002'::uuid) $$, 'user reads only their own profile');
select throws_ok($$ update public.profiles set role = 'admin' $$, '42501', null,
  'user cannot promote themself to admin');
select throws_ok(
  $$ insert into public.profiles (id, role) values ('00000000-0000-0000-0000-000000000099', 'admin') $$,
  '42501', null, 'user cannot insert profiles');
select throws_ok(
  $$ insert into public.doctors (full_name, specialty_id, location_id, address)
     select 'دخيل', specialty_id, location_id, 'عنوان' from public.doctors limit 1 $$,
  '42501', null, 'user cannot insert doctors (RLS)');
select is_empty($$ update public.doctors set is_active = false returning id $$, 'user update of doctors affects no rows');
select is_empty($$ delete from public.doctors returning id $$, 'user delete of doctors affects no rows');
select is_empty($$ delete from public.locations returning id $$, 'user cannot delete locations');
select is_empty($$ update public.locations set is_active = false returning id $$, 'user cannot update locations');
select is_empty($$ update public.advertisements set display_order = 99 returning id $$, 'user cannot update advertisements');
select is_empty($$ select id from public.doctor_submissions $$, 'user cannot see submissions');
select is_empty($$ update public.doctor_submissions set admin_note = 'x' returning id $$, 'user cannot update submissions');
select throws_ok($$ select public.approve_submission('00000000-0000-0000-0000-0000000000c9') $$,
  '42501', 'not_authorized', 'user cannot approve submissions');
select throws_ok($$ select public.reject_submission('00000000-0000-0000-0000-0000000000c9') $$,
  '42501', 'not_authorized', 'user cannot reject submissions');
select throws_ok($$ select public.find_duplicate_doctors('00000000-0000-0000-0000-0000000000c9') $$,
  '42501', 'not_authorized', 'user cannot run duplicate detection');
select throws_ok($$ select public.admin_dashboard_stats() $$, '42501', 'not_authorized', 'user cannot read dashboard stats');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('ad-images', 'user.webp') $$,
  '42501', null, 'user cannot upload advertisement images');

reset role;
select is((select count(*) from public.doctors where full_name like 'اختبار%'), 4::bigint,
  'doctors are intact after user write attempts');
select is((select status from public.doctor_submissions where id = '00000000-0000-0000-0000-0000000000c9'),
  'pending', 'submission is still pending after user attempts');

-- ===========================================================================
-- 3. Administrator
-- ===========================================================================
select pg_temp.login('00000000-0000-0000-0000-000000000001');

select is(public.is_admin(), true, 'admin is recognised');
select is((select count(*) from public.doctors where full_name like 'اختبار%'), 4::bigint,
  'admin sees inactive doctors and doctors under inactive locations');
select is((select count(*) from public.locations where id = '00000000-0000-0000-0000-0000000000d2'), 1::bigint,
  'admin sees inactive locations');
select lives_ok(
  $$ insert into public.locations (parent_id, kind, name_ar, name_en)
     select id, 'city', 'مدينة اختبار', 'Test City' from public.locations
     where name_en = 'New Urban Cities' $$,
  'admin can add a city under the New Urban Cities region');
select lives_ok($$ update public.facilities set is_active = true where id = '00000000-0000-0000-0000-0000000000f2' $$,
  'admin can update facilities');
select isnt_empty($$ delete from public.advertisements where id = '00000000-0000-0000-0000-0000000000e2' returning id $$,
  'admin can delete advertisements');
select throws_ok($$ update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000002' $$,
  '42501', null, 'even an admin cannot change roles through the API');
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('ad-images', 'admin.webp') $$,
  'admin can upload advertisement images');

-- Moving a district re-roots its areas and the doctors under it.
select lives_ok(
  $$ update public.locations
     set parent_id = (select id from public.locations where name_en = 'Eastern Region')
     where id = '00000000-0000-0000-0000-0000000000d1' $$,
  'admin can move a district to another region');
select is(
  (select location_path[2] from public.doctors where id = '00000000-0000-0000-0000-000000000101'),
  (select id from public.locations where name_en = 'Eastern Region'),
  'doctors under a moved district follow it');
select is(
  (select path[2] from public.locations where id = '00000000-0000-0000-0000-0000000000a1'),
  (select id from public.locations where name_en = 'Eastern Region'),
  'areas under a moved district follow it');

-- Review workflow -----------------------------------------------------------
select throws_ok(
  $$ update public.doctor_submissions set status = 'approved', reviewed_at = now()
     where id = '00000000-0000-0000-0000-0000000000c9' $$,
  '42501', 'review_columns_are_managed_by_rpc', 'status cannot be changed outside the review functions');

select is_empty($$ select 1 from public.doctors where full_name = 'مقترح جديد' $$,
  'a pending suggestion is not in the doctors directory');

select lives_ok($$ select public.approve_submission('00000000-0000-0000-0000-0000000000c9') $$,
  'admin approves a submission');
select results_eq(
  $$ select count(*), min(location_id::text) from public.doctors where full_name = 'مقترح جديد' and is_active $$,
  $$ values (1::bigint, '00000000-0000-0000-0000-0000000000a1') $$,
  'approval creates exactly one active doctor at the suggested location');
select results_eq(
  $$ select status, reviewed_by, reviewed_at is not null, approved_doctor_id is not null
     from public.doctor_submissions where id = '00000000-0000-0000-0000-0000000000c9' $$,
  $$ values ('approved', '00000000-0000-0000-0000-000000000001'::uuid, true, true) $$,
  'approval records status, reviewer, date and the created doctor');
select throws_ok($$ select public.approve_submission('00000000-0000-0000-0000-0000000000c9') $$,
  'P0001', 'submission_not_pending', 'a submission cannot be approved twice');

reset role;
insert into public.doctor_submissions (id, full_name, specialty_id, clinic_phone, location_id, address)
values ('00000000-0000-0000-0000-0000000000c8', 'مقترح جديد',
  (select id from public.specialties where name_en = 'Pediatrics'), '0229999999',
  '00000000-0000-0000-0000-0000000000a1', 'عنوان مكرر');
insert into public.doctor_submissions (id, full_name, specialty_other, location_id, address)
values ('00000000-0000-0000-0000-0000000000c7', 'طبيب بتخصص غير مدرج', 'تخصص نادر',
  '00000000-0000-0000-0000-0000000000a3', 'عنوان آخر');
select pg_temp.login('00000000-0000-0000-0000-000000000001');

select isnt_empty($$ select id from public.find_duplicate_doctors('00000000-0000-0000-0000-0000000000c8') $$,
  'duplicate detection finds the existing doctor');
select throws_ok($$ select public.approve_submission('00000000-0000-0000-0000-0000000000c8') $$,
  'P0001', 'possible_duplicate', 'approval stops on a possible duplicate');
select lives_ok($$ select public.reject_submission('00000000-0000-0000-0000-0000000000c8', 'مكرر') $$,
  'admin rejects a submission');
select results_eq(
  $$ select status, admin_note, reviewed_by, approved_doctor_id is null
     from public.doctor_submissions where id = '00000000-0000-0000-0000-0000000000c8' $$,
  $$ values ('rejected', 'مكرر', '00000000-0000-0000-0000-000000000001'::uuid, true) $$,
  'rejection records status, note and reviewer without creating a doctor');
select throws_ok($$ select public.approve_submission('00000000-0000-0000-0000-0000000000c7') $$,
  'P0001', 'specialty_required', 'an unlisted specialty must be resolved before approval');

-- Proposed places ----------------------------------------------------------
reset role;
select throws_ok(
  $$ insert into public.doctor_submissions (full_name, specialty_id, location_id, address)
     select 'مقترح واسع', id, (select id from public.locations where name_en = 'Minya'), 'عنوان'
     from public.specialties limit 1 $$,
  '23514', 'location_too_broad', 'a suggestion cannot stop at a governorate without proposing a place');
insert into public.doctor_submissions (id, full_name, specialty_id, location_id, location_other, address)
select '00000000-0000-0000-0000-0000000000c6', 'مقترح بمكان جديد', id,
  (select id from public.locations where name_en = 'Minya'), 'قرية جديدة', 'عنوان'
from public.specialties limit 1;
select pg_temp.login('00000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.approve_submission('00000000-0000-0000-0000-0000000000c6') $$,
  'P0001', 'location_required', 'a proposed place must be resolved to a real location before approval');
select throws_ok(
  $$ select public.approve_submission('00000000-0000-0000-0000-0000000000c6', null, false,
       (select id from public.locations where name_en = 'Minya')) $$,
  '23514', 'location_too_broad', 'approval cannot place a doctor at governorate level');
select lives_ok(
  $$ select public.approve_submission('00000000-0000-0000-0000-0000000000c6', null, false,
       '00000000-0000-0000-0000-0000000000a3') $$,
  'admin approves a proposed-place suggestion by choosing the real location');
select is((select location_id from public.doctors where full_name = 'مقترح بمكان جديد'),
  '00000000-0000-0000-0000-0000000000a3'::uuid,
  'approval places the doctor at the location the admin chose');

-- Popup advertisements -----------------------------------------------------
select lives_ok(
  $$ insert into public.advertisements
       (title, advertiser_name, image_path, placement, popup_delay_seconds, popup_duration_seconds, popup_repeat_hours)
     values ('اعلان منبثق', 'معلن', 'p.webp', 'popup_doctors', 3, 10, 12) $$,
  'admin can create a popup advertisement with timing');
select throws_ok(
  $$ insert into public.advertisements (title, advertiser_name, image_path, placement, popup_duration_seconds)
     values ('اعلان منبثق قصير', 'معلن', 'q.webp', 'popup_home', 1) $$,
  '23514', null, 'popup duration must be at least 3 seconds');

-- Search normalisation ------------------------------------------------------
reset role;
select is(public.normalize_arabic('أَحْمَد  إبراهيم فاطمة مصطفى'), 'احمد ابراهيم فاطمه مصطفي',
  'normalize_arabic folds hamza, taa marbuta, alef maqsura and diacritics');

select * from finish();
rollback;
