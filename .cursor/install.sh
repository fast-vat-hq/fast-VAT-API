#!/usr/bin/env bash
# Idempotent setup for the Fast-VAT-API Cloud Agent environment.
#
# Runs once after the repository is checked out (and bakes into the build
# baseline when environment builds are enabled). Provisions the system
# packages and Node dependencies the app needs. Must terminate: no
# long-running processes belong here — the dev server lives in a terminal
# and Postgres is started per-boot by start.sh.
set -euo pipefail

cd "$(dirname "$0")/.."

# --- System packages -------------------------------------------------------
# Production targets Supabase Postgres; in development we run a local
# PostgreSQL instance so the audit trail and VIES/BIN caches work without any
# external service or secret. apt is idempotent, so re-runs are cheap no-ops.
if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  echo "==> Installing PostgreSQL"
  sudo apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    postgresql postgresql-contrib
else
  echo "==> PostgreSQL already installed, skipping apt install"
fi

# --- Node dependencies -----------------------------------------------------
echo "==> Installing Node dependencies (npm ci)"
# --ignore-scripts skips the postinstall GeoLite2 download so a missing
# MAXMIND_LICENSE_KEY never fails dependency installation. The database is
# fetched separately (below) only when the key is available.
npm ci --ignore-scripts

# --- Optional geolocation database -----------------------------------------
# The MaxMind GeoLite2 country database powers IP-based geolocation (evidence
# piece #1 of the dual-factor location proof). It needs a free MaxMind license
# key. Download it only when the key is present; the API still runs without it
# (IP lookups return null and quotes fall back to card-BIN evidence).
if [ -n "${MAXMIND_LICENSE_KEY:-}" ]; then
  echo "==> MAXMIND_LICENSE_KEY detected: downloading GeoLite2-Country database"
  node scripts/download-geolite2.mjs
else
  echo "==> MAXMIND_LICENSE_KEY not set: skipping GeoLite2 download."
  echo "    IP geolocation stays disabled until the secret is added; card-BIN"
  echo "    evidence, the rate endpoints and everything else work without it."
fi

echo "==> install.sh complete"
