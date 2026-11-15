# Tabibi — Medical Directory: Design

Date: 2026-11-14. Status: approved in chat (suggestions 1–11 accepted, with the changes listed under "Decisions").

## Goal

A lightweight, Arabic-first medical directory for Egypt. Visitors browse doctors, laboratories, pharmacies and medical centers by governorate, area and specialty, and can suggest a doctor. Admins curate everything. It is not a booking or clinic-management system.

## Decisions

| Topic | Decision |
|---|---|
| Framework | Angular 22.1 (existing scaffold, zoneless, OnPush default) |
| Public UI | Ionic 9 components, imported from `@ionic/angular` |
| Admin UI | Angular Material 22 (table, paginator, dialog, form field, select, snackbar) |
| Layout / utilities | Tailwind 4 (already installed) |
| PrimeNG | Not used (replaced by Angular Material) |
| Forms | Signal Forms (`@angular/forms/signals`) |
| i18n | `@ngx-translate/core` 18, runtime switch, Arabic default, English second |
| Templates | No inline templates or styles; every component has `.ts`, `.html`, `.css` |
| Backend | Supabase: Postgres, Auth, Storage, one Edge Function |
| Targets | Web/PWA plus Android and iOS through Capacitor 8 |
| Country | Egypt: 27 governorates seeded; areas are added by the admin |
| Admin area | Lazy `/admin` route tree in the same app |
| State | Signals and services; no NgRx |

Existing `src/environments/environment.ts` (dev project) and `environment.prod.ts` (prod project) hold the Supabase URL and publishable key. They are wired in with `fileReplacements`. Only publishable keys ever appear in the frontend.

## Architecture

```
src/app/
  core/
    supabase/        SupabaseService (single client), database types
    auth/            AuthService (session signal, isAdmin signal), admin guard
    i18n/            language service (lang + dir on <html>), translate loader
    models/          entity types
  shared/
    components/      loading, error-state, empty-state, location-filter,
                     contact-actions, ad-slot, page-header
    utils/           arabic normalization, map/tel link helpers, image resize
  features/
    home/
    doctors/         list, detail, DoctorsService
    doctor-submissions/  form, SubmissionsService (calls Edge Function)
    facilities/      one list + detail, parametrised by type
    advertisements/  AdsService (used by ad-slot)
    locations/       LocationsService (governorates, areas, specialties; cached)
    admin/
      login/ shell/ dashboard/ governorates/ areas/ specialties/
      doctors/ submissions/ facilities/ advertisements/
supabase/
  migrations/  functions/submit-doctor/  tests/  seed.sql
```

Data access lives only in domain services. Components read signals and call service methods. UI services (toast, confirm dialog, language) are separate from domain services.

Routing: public shell with Ionic tabs (Home, Doctors, Facilities, Suggest). `/admin/login` is public; every other `/admin/**` route sits behind `adminGuard` and loads lazily. The guard is a convenience only; the database enforces access.

## Database

All tables use `uuid` primary keys (`gen_random_uuid()`), `created_at`, and `updated_at` with a trigger where rows are edited.

- `profiles(id → auth.users, role 'user'|'admin', created_at)`. Created by trigger on signup with role `user`. No client insert/update/delete grants.
- `governorates(name_ar, name_en, is_active, sort_order)`; unique `name_ar`.
- `areas(governorate_id, name_ar, name_en, is_active, sort_order)`; unique `(governorate_id, name_ar)`.
- `specialties(name_ar, name_en, is_active, sort_order)`; unique `name_ar`. Added beyond the original schema so filtering is reliable.
- `doctors(full_name, specialty_id, clinic_phone, governorate_id, area_id, address, map_url, latitude, longitude, is_active, search_text, created_at, updated_at)`. Every row in this table is approved by definition; "approved and active" equals `is_active`.
- `doctor_submissions(full_name, specialty_id null, specialty_other null, clinic_phone, governorate_id, area_id, address, map_url, latitude, longitude, submitter_name, submitter_contact, status, reviewed_by, reviewed_at, approved_doctor_id, admin_note, created_at)`. Check: one of `specialty_id` / `specialty_other` is present.
- `facilities(name, type 'lab'|'pharmacy'|'medical_center', governorate_id, area_id, address, phone, map_url, latitude, longitude, is_active, search_text, created_at, updated_at)`.
- `advertisements(title, advertiser_name, image_path, governorate_id, area_id, address, map_url, phone, placement, display_order, is_active, starts_at, ends_at, created_at, updated_at)`. `placement` is checked against `home_top`, `home_middle`, `doctors_list`, `facilities_list`. Check `ends_at > starts_at`.
- `submission_rate_limits(ip_hash, created_at)`. Service role only.

Constraints: an area must belong to the row's governorate (composite foreign key `(area_id, governorate_id)` → `areas(id, governorate_id)`); latitude and longitude ranges; `map_url` must start with `http://` or `https://`; phone matches `^[0-9+ ()-]{5,20}$`; non-empty trimmed text.

Search: `normalize_arabic(text)` (immutable) lowercases, strips diacritics and tatweel, and maps أإآ→ا, ة→ه, ى→ي. `search_text` is maintained by trigger (name plus specialty names for doctors) and indexed with `pg_trgm` GIN. Clients apply the same normalization to the query before `ilike`.

Functions (all `security definer`, fixed `search_path`):

- `is_admin()` — true when the caller's profile role is `admin`. Used by every policy.
- `find_duplicate_doctors(submission_id)` — admin only. Returns doctors with the same normalized phone, or trigram name similarity ≥ 0.5 in the same governorate.
- `approve_submission(submission_id, specialty_id, allow_duplicate)` — admin only. Locks the pending row, refuses when duplicates exist unless `allow_duplicate`, inserts the doctor, and sets status, `reviewed_by`, `reviewed_at`, `approved_doctor_id` in one transaction.
- `reject_submission(submission_id, note)` — admin only.
- `admin_dashboard_stats()` — admin only; the six counters.

## Security

RLS is enabled on every table. Grants are reviewed as well as policies.

| Table | anon / authenticated non-admin | admin |
|---|---|---|
| governorates, areas, specialties | select where `is_active` | all |
| doctors, facilities | select where `is_active` | all |
| advertisements | select where active and inside `starts_at`/`ends_at` | all |
| doctor_submissions | nothing | select, update, delete (insert only by Edge Function) |
| profiles | select own row | select all; role changes only by SQL as a privileged role |
| submission_rate_limits | nothing | nothing |

Write privileges are revoked from `anon` on all tables. `authenticated` keeps table grants so admin policies can apply; non-admins are stopped by RLS. Admin RPCs are executable by `authenticated` only and check `is_admin()` inside.

The first admin is created by signing the user up (dashboard or CLI) and running one documented SQL statement as the database owner. Public sign-up is disabled in the Supabase project settings.

## Doctor submission flow

1. Visitor fills the form (Signal Forms validation, hidden honeypot field).
2. The app calls the `submit-doctor` Edge Function with the publishable key.
3. The function validates every field, rejects honeypot hits, hashes the client IP with a secret salt, and refuses more than 5 submissions per hour per hash. It verifies the governorate, area and specialty are active, then inserts with the service role key (function secret only) with `status = 'pending'`.
4. Admin reviews, sees possible duplicates, then approves (choosing or creating the specialty when "other" was used) or rejects with a note.

## Advertisements and storage

Bucket `ad-images`, public read, 2 MB limit, MIME types `image/webp`, `image/jpeg`, `image/png`. Storage policies allow insert, update and delete only when `is_admin()`. Files use random UUID names, so only images referenced by a published ad are discoverable. The admin form resizes to a maximum width of 1200 px and encodes WebP in the browser before upload. Replacing or deleting an ad removes the old object.

`<app-ad-slot placement="…">` loads the active ads for a placement, optionally narrowed by the selected governorate, ordered by `display_order`.

## UI

Arabic-first, RTL by default (`<html lang="ar" dir="rtl">`), language toggle in the header. Calm medical palette (teal primary, neutral surfaces), system Arabic-friendly font stack with Cairo. Cards for doctors and facilities with Call (`tel:`), Map, and Details actions. Every list has loading, empty and error states and paginates on the server (infinite scroll in public lists, paginator in admin tables). No decorative animation. Meets WCAG AA: labelled controls, visible focus, contrast-checked colors.

## Testing

- SQL security tests in `supabase/tests/` (pgTAP, run with `supabase test db`): anon can read only active rows; anon cannot write any table or read submissions; a normal user cannot promote themself or call admin RPCs; an admin can do all of it; approval creates exactly one doctor and stamps the reviewer; expired or inactive ads are hidden.
- Vitest unit tests for Arabic normalization, link helpers and filter logic.
- Manual pass in the browser at mobile width for the public flows and the admin flows.
- `ng build` production build must pass.

## Risks

- Signal Forms with Ionic and Material inputs: verified against the Angular docs during Phase 1. If a control does not bind, it gets a thin wrapper component implementing the signal-forms control contract.
- Native builds: Android needs Android Studio and iOS needs a Mac; the Capacitor projects are configured here but store builds happen on those machines.
- Applying migrations to the hosted projects needs the Supabase CLI linked by the owner.

## Out of scope

Payments, ad analytics, booking, reviews, doctor accounts, push notifications, working hours.
