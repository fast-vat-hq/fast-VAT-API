#!/usr/bin/env bash
# Per-boot reconciliation for the Fast-VAT-API Cloud Agent environment.
# Brings up the local Postgres instance that stands in for Supabase in
# development, ensures the schema exists, and writes the dev-server .env.
# Idempotent and safe to run on every boot; it returns once ready.
set -euo pipefail

cd "$(dirname "$0")/.."

PG_VERSION=16
PG_CLUSTER=main
DB_NAME=vat
DB_USER=vat
DB_PASSWORD=vatpass   # local, throwaway credentials for the dev database only

echo "==> Starting Postgres cluster ${PG_VERSION}/${PG_CLUSTER}"
sudo pg_ctlcluster "${PG_VERSION}" "${PG_CLUSTER}" start || true

echo "==> Waiting for Postgres to accept connections"
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then
    break
  fi
  sleep 1
done
sudo -u postgres pg_isready

echo "==> Ensuring role, database and schema exist"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
  || sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -f db/schema.sql >/dev/null
sudo -u postgres psql -d "${DB_NAME}" \
  -c "GRANT ALL ON SCHEMA public TO ${DB_USER};" \
  -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO ${DB_USER};" >/dev/null

# The npm scripts load runtime configuration from .env (--env-file=.env).
# These are local dev values only; real secrets are injected as env vars.
echo "==> Writing .env for the dev server"
cat > .env <<EOF
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}
PORT=3000
EOF

echo "==> start.sh complete: Postgres ready, .env written"
