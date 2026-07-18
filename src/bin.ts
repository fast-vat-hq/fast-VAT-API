import { query } from "./db.js";

/**
 * Card BIN (first 6-8 digits) -> issuing country. Evidence piece #2 for the
 * dual-factor location proof.
 *
 * Lookup order: local bin_country_cache table first, then the free
 * binlist.net API (3s timeout) whose answer is cached forever.
 *
 * NOTE: binlist.net's free tier is rate-limited to a handful of requests
 * per hour and its data is incomplete. Before charging customers, swap
 * this for a licensed BIN database (kept behind the same function
 * signature) - the cache table means the swap is invisible to callers.
 */

const BINLIST_TIMEOUT_MS = 3_000;

interface BinCacheRow extends Record<string, unknown> {
  country: string | null;
}

async function lookupBinLive(bin: string): Promise<string | null> {
  const response = await fetch(`https://lookup.binlist.net/${bin}`, {
    headers: { "Accept-Version": "3" },
    signal: AbortSignal.timeout(BINLIST_TIMEOUT_MS),
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`binlist.net responded with HTTP ${response.status}`);
  }
  const data = (await response.json()) as {
    country?: { alpha2?: string };
  };
  return data.country?.alpha2 ?? null;
}

export async function getCountryFromBin(cardBin: string): Promise<string | null> {
  const bin = cardBin.replace(/\D/g, "").slice(0, 8);
  if (bin.length < 6) return null;

  try {
    const rows = await query<BinCacheRow>(
      "select country from bin_country_cache where bin = $1",
      [bin],
    );
    const cached = rows[0];
    if (cached !== undefined) return cached.country;
  } catch (err) {
    console.error("BIN cache lookup failed (continuing to live lookup)", err);
  }

  let country: string | null;
  try {
    country = await lookupBinLive(bin);
  } catch (err) {
    console.warn("Live BIN lookup failed", err);
    return null;
  }

  try {
    await query(
      `insert into bin_country_cache (bin, country, checked_at)
       values ($1, $2, now())
       on conflict (bin) do update set country = $2, checked_at = now()`,
      [bin, country],
    );
  } catch (err) {
    console.error("Failed to write BIN cache (continuing)", err);
  }

  return country;
}
