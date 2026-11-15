# Tabibi (طبيبي): Medical Directory

An Arabic-first, mobile-first directory of doctors, laboratories, pharmacies and medical centers in Egypt. Visitors browse and search without an account and can suggest a doctor. Administrators curate every record from a protected dashboard.

- **App:** Angular 22 (standalone, zoneless, signals, Signal Forms), Ionic 9 for the public app, Angular Material 22 for the admin area, Tailwind CSS 4, ngx-translate (Arabic and English, RTL/LTR).
- **Backend:** Supabase (Postgres with Row Level Security, Auth, Storage, one Edge Function).
- **Native:** Capacitor 8 projects for Android and iOS.

## How security works

Every rule is enforced by the database. The Angular route guard only improves navigation.

| Data | Visitors (`anon`) and signed-in non-admins | Admins (`profiles.role = 'admin'`) |
|---|---|---|
| Governorates, areas, specialties, doctors, facilities | Read active rows only | Full management |
| Advertisements | Read active rows inside their display period | Full management |
| Doctor submissions | No access at all | Read, review, delete |
| Profiles | Read own row | Read all |
| Ad images (Storage) | Public download only | Upload, replace, delete |

- **Suggestions go through the `submit-doctor` Edge Function.** It validates the input, ignores bot submissions (honeypot field), rate-limits to 5 per hour per salted IP hash, and inserts the row as `pending`. Clients have no `INSERT` grant on `doctor_submissions`.
- **Approvals happen in one transaction.** `approve_submission()` checks the caller is an admin, refuses likely duplicates (same phone, or a similar name in the same governorate) unless the admin confirms, creates the doctor, and records the reviewer and review time.
- **Review fields are locked.** A trigger blocks direct updates to `status`, `reviewed_by`, `reviewed_at` and `approved_doctor_id`, so they can only change through the review functions.
- **No one can grant themself admin.** No client role can insert or update `profiles`. Roles are changed only by SQL run as the database owner.
- **The service role key never reaches the app.** It exists only as an Edge Function secret. The app uses the publishable key.

The SQL tests in `supabase/tests/security.test.sql` (62 assertions) cover the allowed and denied cases for visitors, a normal user, and an admin.

## Project layout

```
src/app/
  core/          Supabase client, auth, i18n, models, toast
  shared/        loading/error/empty states, form field, location filter, ad slot, utils
  features/
    home/ doctors/ facilities/ doctor-submissions/ advertisements/ locations/ shell/
    admin/       login, shell, dashboard, lookups (governorates/areas/specialties),
                 doctors, facilities, submissions, advertisements
public/i18n/     ar.json, en.json
supabase/
  migrations/    schema, security (grants, RLS, RPCs), storage, reference data
  functions/submit-doctor/
  tests/         pgTAP security tests
  scripts/       create-local-admin.sh
android/ ios/    Capacitor native projects
```

## Prerequisites

- Node.js 22+ and npm
- Docker Desktop (for the local Supabase stack and the SQL tests)
- The Supabase CLI is installed as a dev dependency: use `npx supabase …`

## Local development

```bash
npm install
```

```bash
npm run db:start
```

This starts the local Supabase stack (API on port 55321, database on 55322, Studio on 55323). It applies all migrations, including the 27 governorates and the starter specialties.

```bash
npm run functions:serve
```

Leave that running in its own terminal. It serves the `submit-doctor` function.

```bash
npm run admin:local
```

This creates the local test admin from `LOCAL_ADMIN_EMAIL` / `LOCAL_ADMIN_PASSWORD` (defaults in `.env.example`). It refuses to run against anything other than a local stack.

```bash
npm run start:local
```

The app runs against the local stack at http://localhost:4200, and the admin area is at `/admin`. Before adding doctors or facilities, add some **areas** under a governorate in the admin.

`npm start` uses `src/environments/environment.ts` (the hosted development project) instead.

### Tests

```bash
npm run db:test
```

```bash
npm test -- --watch=false
```

```bash
npm run build
```

## Configuration

The app reads public configuration from `src/environments/`:

| File | Used by | Contents |
|---|---|---|
| `environment.ts` | `ng serve`, development builds | Hosted development project URL and publishable key |
| `environment.prod.ts` | `ng build` (production) | Hosted production project URL and publishable key |
| `environment.local.ts` | `npm run start:local` | Local stack URL and the CLI's built-in local key |

Only publishable keys belong in these files. `.env.example` lists the public values and the local-only test admin.

## Deploying the backend to a hosted project

Run these once for each hosted project (development, then production).

```bash
npx supabase login
```

```bash
npx supabase link --project-ref YOUR-PROJECT-REF
```

```bash
npx supabase db push
```

```bash
npx supabase secrets set RATE_LIMIT_SALT=$(openssl rand -hex 32)
```

```bash
npx supabase functions deploy submit-doctor --no-verify-jwt
```

The function gets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` automatically from the platform. `--no-verify-jwt` is needed because visitors are anonymous.

Then, in the Supabase dashboard for that project:

1. **Authentication → Sign In / Providers:** turn off **Allow new users to sign up**. Admin accounts are created by you, not by visitors.
2. **Authentication → URL Configuration:** set the site URL to where the app is hosted.

### Create the first admin

1. **Authentication → Users → Add user:** create the admin with an email and a strong password, and tick "Auto confirm".
2. **SQL Editor:** this runs as the database owner, which is the only role allowed to change roles.

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'admin@example.com');
```

To remove admin rights, run the same statement with `role = 'user'`.

## Deploying the web app

```bash
npm run build
```

Upload `dist/Tabibi/browser/` to any static host. Configure the host to serve `index.html` for unknown paths, because the app uses client-side routing.

## Native apps (Capacitor)

```bash
npm run build
```

```bash
npx cap sync
```

```bash
npx cap open android
```

`npx cap open ios` needs a Mac with Xcode. Change `appId` in `capacitor.config.ts` before you publish to a store.

## Advertisements

- Placements: `home_top`, `home_middle`, `doctors_list`, `facilities_list`.
- An ad shows only while it is active and the current time is inside its optional start and end dates. Ads with a governorate show only when the visitor filters by that governorate or by none.
- Images are resized in the browser to a maximum width of 1200 px and saved as WebP under a random file name. The bucket accepts WebP, JPEG or PNG up to 2 MB. Replacing or deleting an ad deletes its old image.

## Out of scope

Payments, ad analytics, bookings, reviews, doctor accounts and push notifications are not part of this MVP.
