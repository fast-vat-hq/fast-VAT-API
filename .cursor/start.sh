#!/usr/bin/env bash
# Per-boot reconciliation for the Fast-VAT-API Cloud Agent environment.
#
# Brings up the local Postgres instance that stands in for Supabase in
# development, ensures the role/database/schema exist, and writes the
# dev-server .env. Idempotent and safe to run on every boot; it returns
# once Postgres is accepting connections.
set -euo pipefail

cd "$(dirname "$0")/.."

DB_NAME=vat
DB_USER=vat
DB_PASSWORD=vatpass   # local, throwaway credentials for the dev database only

# Discover the installed PostgreSQL cluster (version + name) instead of
# hardcoding a major version, so this keeps working across base-image upgrades.
read -r PG_VERSION PG_CLUSTER PG_PORT <<<"$(pg_lsclusters -h | awk 'NR==1 {print $1, $2, $3}')"
if [ -z "${PG_VERSION:-}" ]; then
  echo "!! No PostgreSQL cluster found. Did install.sh run?" >&2
  exit 1
fi
echo "==> Using Postgres cluster ${PG_VERSION}/${PG_CLUSTER} (port ${PG_PORT})"

echo "==> Starting Postgres cluster"
sudo pg_ctlcluster "${PG_VERSION}" "${PG_CLUSTER}" start || true

echo "==> Waiting for Postgres to accept connections"
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q -p "${PG_PORT}"; then
    break
  fi
  sleep 1
done
sudo -u postgres pg_isready -p "${PG_PORT}"

echo "==> Ensuring role, database and schema exist"
sudo -u postgres psql -p "${PG_PORT}" -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 \
  || sudo -u postgres psql -p "${PG_PORT}" -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';"
sudo -u postgres psql -p "${PG_PORT}" -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
  || sudo -u postgres createdb -p "${PG_PORT}" -O "${DB_USER}" "${DB_NAME}"
sudo -u postgres psql -p "${PG_PORT}" -v ON_ERROR_STOP=1 -d "${DB_NAME}" -f db/schema.sql >/dev/null
sudo -u postgres psql -p "${PG_PORT}" -d "${DB_NAME}" \
  -c "GRANT ALL ON SCHEMA public TO ${DB_USER};" \
  -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO ${DB_USER};" >/dev/null

# The npm scripts load runtime config from .env (--env-file=.env). These are
# local dev values only; real production secrets are injected as env vars.
echo "==> Writing .env for the dev server"
cat > .env <<EOF
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${PG_PORT}/${DB_NAME}
PORT=3000
EOF

echo "==> start.sh complete: Postgres ready on port ${PG_PORT}, .env written"
