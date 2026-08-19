#!/usr/bin/env bash
# Idempotent dependency refresh for the Fast-VAT-API Cloud Agent environment.
# Runs after the repository is checked out. Must terminate (no long-running
# processes here) so it is safe as the environment `install` phase.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Installing Node dependencies (npm ci)"
# Skip lifecycle scripts so a missing MAXMIND_LICENSE_KEY (used only by the
# optional GeoLite2 download in `postinstall`) never fails dependency install.
npm ci --ignore-scripts

# The MaxMind GeoLite2 country database powers IP-based geolocation (evidence
# piece #1 of the dual-factor location proof). It requires a free license key.
# Download it only when the key is available; the API still runs without it
# (IP lookups return null and the quote falls back to card-BIN evidence).
if [ -n "${MAXMIND_LICENSE_KEY:-}" ]; then
  echo "==> MAXMIND_LICENSE_KEY detected: downloading GeoLite2-Country database"
  node scripts/download-geolite2.mjs
else
  echo "==> MAXMIND_LICENSE_KEY not set: skipping GeoLite2 download."
  echo "    IP geolocation is disabled until the secret is added; card-BIN"
  echo "    evidence and all other endpoints work without it."
fi

echo "==> install.sh complete"
