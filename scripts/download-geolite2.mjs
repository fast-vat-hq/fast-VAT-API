/**
 * Downloads GeoLite2-Country.mmdb from MaxMind at build/deploy time.
 * Skips if the file is already present (local dev). Requires the
 * MAXMIND_LICENSE_KEY environment variable (free MaxMind account:
 * account portal -> Manage License Keys).
 */
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";

const TARGET = "data/GeoLite2-Country.mmdb";
const ARCHIVE = "data/geolite2.tar.gz";

if (existsSync(TARGET)) {
  console.log("GeoLite2-Country.mmdb already present, skipping download.");
  process.exit(0);
}

const key = process.env.MAXMIND_LICENSE_KEY;
if (!key) {
  console.error("MAXMIND_LICENSE_KEY is required to download the GeoLite2 database.");
  process.exit(1);
}

mkdirSync("data", { recursive: true });

const url = `https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-Country&license_key=${encodeURIComponent(key)}&suffix=tar.gz`;
console.log("Downloading GeoLite2-Country from MaxMind...");
const res = await fetch(url);
if (!res.ok) {
  console.error(`MaxMind download failed: HTTP ${res.status} ${res.statusText}`);
  process.exit(1);
}
writeFileSync(ARCHIVE, Buffer.from(await res.arrayBuffer()));

// Archive contains a dated folder; --strip-components flattens it into data/.
execSync(`tar -xzf ${ARCHIVE} -C data --strip-components=1`, { stdio: "inherit" });
unlinkSync(ARCHIVE);

if (!existsSync(TARGET)) {
  console.error("Extraction finished but GeoLite2-Country.mmdb not found.");
  process.exit(1);
}
console.log("GeoLite2-Country.mmdb ready.");
