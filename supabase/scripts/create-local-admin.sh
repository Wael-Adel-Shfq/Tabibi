#!/usr/bin/env bash
# Creates (or re-promotes) an administrator on the LOCAL Supabase stack only.
# Credentials come from LOCAL_ADMIN_EMAIL / LOCAL_ADMIN_PASSWORD (see .env.example).
# Never run this against a hosted project; use the README "Create the first admin" steps there.
set -euo pipefail

cd "$(dirname "$0")/../.."

EMAIL="${LOCAL_ADMIN_EMAIL:-admin@tabibi.local}"
PASSWORD="${LOCAL_ADMIN_PASSWORD:-local-admin-123}"

STATUS="$(npx --no-install supabase status -o json)"
API_URL="$(node -e 'console.log(JSON.parse(process.argv[1]).API_URL)' "$STATUS")"
SECRET="$(node -e 'console.log(JSON.parse(process.argv[1]).SECRET_KEY)' "$STATUS")"
DB_URL="$(node -e 'console.log(JSON.parse(process.argv[1]).DB_URL)' "$STATUS")"

case "$API_URL" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) echo "Refusing to run: $API_URL is not a local stack." >&2; exit 1 ;;
esac

curl -s -o /dev/null -X POST "$API_URL/auth/v1/admin/users" \
  -H "apikey: $SECRET" -H "Authorization: Bearer $SECRET" -H 'Content-Type: application/json' \
  --data-binary "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"email_confirm\":true}" || true

docker exec -i supabase_db_Tabibi psql -U postgres -v ON_ERROR_STOP=1 -c \
  "update public.profiles set role = 'admin' where id = (select id from auth.users where email = '$EMAIL');" >/dev/null

echo "Local admin ready: $EMAIL"
