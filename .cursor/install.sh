#!/usr/bin/env bash
# One-time / idempotent setup for the Fast-VAT-API Cloud Agent environment.
# Runs after the repository is checked out. Provisions the system packages and
# Node dependencies the app needs, then (optionally) fetches the GeoLite2
# database. Must terminate — no long-running processes here.
set -euo pipefail

cd "$(dirname "$0")/.."

# --- System packages -------------------------------------------------------
# The app targets Supabase Postgres in production; in development we run a
# local PostgreSQL instance instead so the audit trail and VIES/BIN caches
# work without any external service or secret. Installing here (rather than
# at boot) keeps `start` fast and, with environment builds, bakes Postgres
# into the build baseline. apt is idempotent, so re-runs are cheap no-ops.
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
# Skip lifecycle scripts so a missing MAXMIND_LICENSE_KEY (used only by the
# optional GeoLite2 download in `postinstall`) never fails dependency install.
npm ci --ignore-scripts

# --- Optional geolocation database -----------------------------------------
# The MaxMind GeoLite2 country database powers IP-based geolocation (evidence
# piece #1 of the dual-factor location proof). It needs a free license key.
# Download it only when the key is available; the API still runs without it
# (IP lookups return null and quotes fall back to card-BIN evidence).
if [ -n "${MAXMIND_LICENSE_KEY:-}" ]; then
  echo "==> MAXMIND_LICENSE_KEY detected: downloading GeoLite2-Country database"
  node scripts/download-geolite2.mjs
else
  echo "==> MAXMIND_LICENSE_KEY not set: skipping GeoLite2 download."
  echo "    IP geolocation is disabled until the secret is added; card-BIN"
  echo "    evidence and all other endpoints work without it."
fi

echo "==> install.sh complete"
