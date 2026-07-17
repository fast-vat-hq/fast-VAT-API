import { readFileSync } from "node:fs";
import path from "node:path";
import { Reader, type ReaderModel } from "@maxmind/geoip2-node";

/**
 * In-memory MaxMind GeoLite2 country lookup.
 *
 * The .mmdb file is read into memory once at cold start and every lookup is
 * a pure in-process binary-tree search, keeping latency well under 1ms with
 * no network round-trips.
 */

const DB_PATH = path.resolve(process.cwd(), "data", "GeoLite2-Country.mmdb");

let reader: ReaderModel | null = null;

function getReader(): ReaderModel {
  if (reader === null) {
    reader = Reader.openBuffer(readFileSync(DB_PATH));
  }
  return reader;
}

/**
 * Resolve an IP address (IPv4 or IPv6) to its 2-letter ISO country code,
 * e.g. "SE". Returns null when the IP is unknown, private/reserved, or
 * malformed — callers must treat null as "location unproven" for the
 * dual-factor compliance check.
 */
export function getCountryFromIp(ip: string): string | null {
  try {
    const response = getReader().country(ip);
    return response.country?.isoCode ?? null;
  } catch {
    // AddressNotFoundError (private/reserved ranges) or invalid IP input.
    return null;
  }
}
