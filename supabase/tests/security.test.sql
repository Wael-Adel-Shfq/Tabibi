begin;
create extension if not exists pgtap with schema extensions;

create or replace function pg_temp.fixtures() returns void
language plpgsql as $$
declare
  cairo uuid;
  spec uuid;
begin
  select id into cairo from public.governorates where name_en = 'Cairo';
  select id into spec from public.specialties where name_en = 'Pediatrics';

  insert into public.governorates (id, name_ar, name_en, is_active)
  values ('00000000-0000-0000-0000-0000000000a0', 'محافظة مخفية', 'Hidden Governorate', false);

  insert into public.areas (id, governorate_id, name_ar, name_en, is_active) values
    ('00000000-0000-0000-0000-0000000000b1', cairo, 'منطقة اختبار ظاهرة', 'Test Visible Area', true),
    ('00000000-0000-0000-0000-0000000000b2', cairo, 'منطقة اختبار مخفية', 'Test Hidden Area', false);

  insert into public.doctors (id, full_name, specialty_id, clinic_phone, governorate_id, area_id, address, is_active) values
    ('00000000-0000-0000-0000-0000000000d1', 'اختبار ظاهر', spec, '0221234567', cairo,
     '00000000-0000-0000-0000-0000000000b1', 'عنوان اختبار 1', true),
    ('00000000-0000-0000-0000-0000000000d2', 'اختبار مخفي', spec, null, cairo,
     '00000000-0000-0000-0000-0000000000b1', 'عنوان اختبار 2', false);

  insert into public.facilities (id, name, type, governorate_id, area_id, address, is_active) values
    ('00000000-0000-0000-0000-0000000000f1', 'معمل اختبار', 'lab', cairo,
     '00000000-0000-0000-0000-0000000000b1', 'عنوان اختبار 3', true),
    ('00000000-0000-0000-0000-0000000000f2', 'صيدلية مخفية', 'pharmacy', cairo,
     '00000000-0000-0000-0000-0000000000b1', 'عنوان اختبار 4', false);

  insert into public.advertisements (id, title, advertiser_name, image_path, placement, is_active, starts_at, ends_at) values
    ('00000000-0000-0000-0000-0000000000e1', 'اعلان ظاهر', 'معلن', 'a.webp', 'home_top', true, null, null),
    ('00000000-0000-0000-0000-0000000000e2', 'اعلان متوقف', 'معلن', 'b.webp', 'home_top', false, null, null),
    ('00000000-0000-0000-0000-0000000000e3', 'اعلان منتهي', 'معلن', 'c.webp', 'home_top', true,
     now() - interval '10 days', now() - interval '1 day'),
    ('00000000-0000-0000-0000-0000000000e4', 'اعلان قادم', 'معلن', 'd.webp', 'home_top', true,
     now() + interval '1 day', null),
    ('00000000-0000-0000-0000-0000000000e5', 'اعلان داخل الفترة', 'معلن', 'e.webp', 'doctors_list', true,
     now() - interval '1 day', now() + interval '1 day');

  insert into public.doctor_submissions (id, full_name, specialty_id, clinic_phone, governorate_id, area_id, address) values
    ('00000000-0000-0000-0000-0000000000c1', 'مقترح جديد', spec, '0229999999', cairo,
     '00000000-0000-0000-0000-0000000000b1', 'عنوان مقترح');

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

select plan(62);
select pg_temp.fixtures();

-- ===========================================================================
-- 1. Anonymous visitor
-- ===========================================================================
set local role anon;

select isnt_empty($$ select 1 from public.governorates $$, 'anon sees active governorates');
select is((select count(*) from public.governorates where id = '00000000-0000-0000-0000-0000000000a0'), 0::bigint, 'anon does not see inactive governorates');
select is((select count(*) from public.areas where id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2')), 1::bigint, 'anon sees only active areas');
select is((select count(*) from public.doctors where full_name like 'اختبار%'), 1::bigint,
  'anon sees active doctors only');
select is((select count(*) from public.facilities where id in ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2')), 1::bigint, 'anon sees active facilities only');
select results_eq(
  $$ select id from public.advertisements where id::text like '00000000-0000-0000-0000-0000000000e%' order by id $$,
  $$ values ('00000000-0000-0000-0000-0000000000e1'::uuid), ('00000000-0000-0000-0000-0000000000e5'::uuid) $$,
  'anon sees only active advertisements inside their display period');

select throws_ok($$ select * from public.doctor_submissions $$, '42501', null, 'anon cannot read submissions');
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon cannot read profiles');
select throws_ok($$ select * from public.submission_rate_limits $$, '42501', null, 'anon cannot read rate limits');

select throws_ok(
  $$ insert into public.doctors (full_name, specialty_id, governorate_id, area_id, address)
     select 'دخيل', specialty_id, governorate_id, area_id, 'عنوان' from public.doctors limit 1 $$,
  '42501', null, 'anon cannot insert doctors');
select throws_ok($$ update public.doctors set full_name = 'تعديل' $$, '42501', null, 'anon cannot update doctors');
select throws_ok($$ delete from public.doctors $$, '42501', null, 'anon cannot delete doctors');
select throws_ok(
  $$ insert into public.doctor_submissions (full_name, specialty_other, governorate_id, area_id, address, status)
     select 'مباشر', 'تخصص', governorate_id, area_id, 'عنوان', 'approved' from public.doctors limit 1 $$,
  '42501', null, 'anon cannot insert submissions directly, only through the Edge Function');
select throws_ok($$ insert into public.governorates (name_ar, name_en) values ('جديدة', 'New') $$,
  '42501', null, 'anon cannot insert governorates');
select throws_ok($$ update public.areas set is_active = false $$, '42501', null, 'anon cannot update areas');
select throws_ok($$ delete from public.facilities $$, '42501', null, 'anon cannot delete facilities');
select throws_ok($$ update public.advertisements set is_active = true $$, '42501', null, 'anon cannot update advertisements');
select throws_ok($$ delete from public.specialties $$, '42501', null, 'anon cannot delete specialties');
select throws_ok(
  $$ select public.approve_submission('00000000-0000-0000-0000-0000000000c1') $$,
  '42501', null, 'anon cannot call approve_submission');
select throws_ok($$ select public.reject_submission('00000000-0000-0000-0000-0000000000c1') $$,
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
  $$ insert into public.doctors (full_name, specialty_id, governorate_id, area_id, address)
     select 'دخيل', specialty_id, governorate_id, area_id, 'عنوان' from public.doctors limit 1 $$,
  '42501', null, 'user cannot insert doctors (RLS)');
select is((select count(*) from public.doctors where full_name like 'اختبار%'), 1::bigint,
  'user sees active doctors only');
select is_empty($$ update public.doctors set is_active = false returning id $$, 'user update of doctors affects no rows');
select is_empty($$ delete from public.doctors returning id $$, 'user delete of doctors affects no rows');
select is_empty($$ delete from public.governorates returning id $$, 'user cannot delete governorates');
select is_empty($$ update public.advertisements set display_order = 99 returning id $$, 'user cannot update advertisements');
select is_empty($$ select id from public.doctor_submissions $$, 'user cannot see submissions');
select is_empty($$ update public.doctor_submissions set admin_note = 'x' returning id $$, 'user cannot update submissions');
select throws_ok($$ select public.approve_submission('00000000-0000-0000-0000-0000000000c1') $$,
  '42501', 'not_authorized', 'user cannot approve submissions');
select throws_ok($$ select public.reject_submission('00000000-0000-0000-0000-0000000000c1') $$,
  '42501', 'not_authorized', 'user cannot reject submissions');
select throws_ok($$ select public.find_duplicate_doctors('00000000-0000-0000-0000-0000000000c1') $$,
  '42501', 'not_authorized', 'user cannot run duplicate detection');
select throws_ok($$ select public.admin_dashboard_stats() $$, '42501', 'not_authorized', 'user cannot read dashboard stats');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('ad-images', 'user.webp') $$,
  '42501', null, 'user cannot upload advertisement images');

reset role;
select is((select count(*) from public.doctors where full_name like 'اختبار%'), 2::bigint,
  'doctors are intact after user write attempts');
select is((select status from public.doctor_submissions where id = '00000000-0000-0000-0000-0000000000c1'),
  'pending', 'submission is still pending after user attempts');

-- ===========================================================================
-- 3. Administrator
-- ===========================================================================
select pg_temp.login('00000000-0000-0000-0000-000000000001');

select is(public.is_admin(), true, 'admin is recognised');
select is((select count(*) from public.doctors where full_name like 'اختبار%'), 2::bigint,
  'admin sees inactive doctors too');
select is((select count(*) from public.governorates where id = '00000000-0000-0000-0000-0000000000a0'), 1::bigint, 'admin sees inactive governorates');
select lives_ok($$ insert into public.governorates (name_ar, name_en) values ('محافظة اختبار', 'Test Gov') $$,
  'admin can insert governorates');
select lives_ok($$ update public.facilities set is_active = true where id = '00000000-0000-0000-0000-0000000000f2' $$,
  'admin can update facilities');
select isnt_empty($$ delete from public.advertisements where id = '00000000-0000-0000-0000-0000000000e2' returning id $$,
  'admin can delete advertisements');
select throws_ok($$ update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000002' $$,
  '42501', null, 'even an admin cannot change roles through the API');
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('ad-images', 'admin.webp') $$,
  'admin can upload advertisement images');
select throws_ok(
  $$ insert into public.doctors (full_name, specialty_id, governorate_id, area_id, address)
     select 'منطقة خاطئة', d.specialty_id, '00000000-0000-0000-0000-0000000000a0', d.area_id, 'عنوان'
     from public.doctors d limit 1 $$,
  '23503', null, 'area must belong to the selected governorate');

-- Review workflow -----------------------------------------------------------
select throws_ok(
  $$ update public.doctor_submissions set status = 'approved', reviewed_at = now()
     where id = '00000000-0000-0000-0000-0000000000c1' $$,
  '42501', 'review_columns_are_managed_by_rpc', 'status cannot be changed outside the review functions');

select is_empty($$ select 1 from public.doctors where full_name = 'مقترح جديد' $$,
  'a pending suggestion is not in the doctors directory');

select lives_ok($$ select public.approve_submission('00000000-0000-0000-0000-0000000000c1') $$,
  'admin approves a submission');
select is((select count(*) from public.doctors where full_name = 'مقترح جديد' and is_active), 1::bigint,
  'approval creates exactly one active doctor');
select results_eq(
  $$ select status, reviewed_by, reviewed_at is not null, approved_doctor_id is not null
     from public.doctor_submissions where id = '00000000-0000-0000-0000-0000000000c1' $$,
  $$ values ('approved', '00000000-0000-0000-0000-000000000001'::uuid, true, true) $$,
  'approval records status, reviewer, date and the created doctor');
select throws_ok($$ select public.approve_submission('00000000-0000-0000-0000-0000000000c1') $$,
  'P0001', 'submission_not_pending', 'a submission cannot be approved twice');

reset role;
insert into public.doctor_submissions (id, full_name, specialty_id, clinic_phone, governorate_id, area_id, address)
select '00000000-0000-0000-0000-0000000000c2', 'مقترح جديد', specialty_id, '0229999999', governorate_id, area_id, 'عنوان مكرر'
from public.doctor_submissions where id = '00000000-0000-0000-0000-0000000000c1';
insert into public.doctor_submissions (id, full_name, specialty_other, governorate_id, area_id, address)
select '00000000-0000-0000-0000-0000000000c3', 'طبيب بتخصص غير مدرج', 'تخصص نادر', governorate_id, area_id, 'عنوان آخر'
from public.doctor_submissions where id = '00000000-0000-0000-0000-0000000000c1';
select pg_temp.login('00000000-0000-0000-0000-000000000001');

select isnt_empty($$ select id from public.find_duplicate_doctors('00000000-0000-0000-0000-0000000000c2') $$,
  'duplicate detection finds the existing doctor');
select throws_ok($$ select public.approve_submission('00000000-0000-0000-0000-0000000000c2') $$,
  'P0001', 'possible_duplicate', 'approval stops on a possible duplicate');
select lives_ok($$ select public.reject_submission('00000000-0000-0000-0000-0000000000c2', 'مكرر') $$,
  'admin rejects a submission');
select results_eq(
  $$ select status, admin_note, reviewed_by, approved_doctor_id is null
     from public.doctor_submissions where id = '00000000-0000-0000-0000-0000000000c2' $$,
  $$ values ('rejected', 'مكرر', '00000000-0000-0000-0000-000000000001'::uuid, true) $$,
  'rejection records status, note and reviewer without creating a doctor');
select throws_ok($$ select public.approve_submission('00000000-0000-0000-0000-0000000000c3') $$,
  'P0001', 'specialty_required', 'an unlisted specialty must be resolved before approval');

-- Search normalisation ------------------------------------------------------
reset role;
select is(public.normalize_arabic('أَحْمَد  إبراهيم فاطمة مصطفى'), 'احمد ابراهيم فاطمه مصطفي',
  'normalize_arabic folds hamza, taa marbuta, alef maqsura and diacritics');

select * from finish();
rollback;
