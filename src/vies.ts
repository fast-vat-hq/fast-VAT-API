import { query } from "./db.js";

/**
 * EU VIES VAT number validation (SOAP) with resiliency:
 * - Live calls are wrapped in a strict 3-second timeout.
 * - Successful answers are written to the vies_company_cache table.
 * - If VIES is down or slow, we fall back to the local cache.
 */

export interface ViesResult {
  valid: boolean;
  companyName: string | null;
  /** "vies" = live answer, "cache" = local fallback */
  source: "vies" | "cache";
  checkedAt: string;
}

const VIES_URL =
  "https://ec.europa.eu/taxation_customs/vies/services/checkVatService";
const VIES_TIMEOUT_MS = 3_000;

interface ViesCacheRow extends Record<string, unknown> {
  valid: boolean;
  company_name: string | null;
  checked_at: string;
}

async function checkVatLive(
  countryCode: string,
  vatNumber: string,
): Promise<{ valid: boolean; companyName: string | null }> {
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:urn="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
  <soapenv:Header/>
  <soapenv:Body>
    <urn:checkVat>
      <urn:countryCode>${countryCode}</urn:countryCode>
      <urn:vatNumber>${vatNumber}</urn:vatNumber>
    </urn:checkVat>
  </soapenv:Body>
</soapenv:Envelope>`;

  const response = await fetch(VIES_URL, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8" },
    body: envelope,
    signal: AbortSignal.timeout(VIES_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`VIES responded with HTTP ${response.status}`);
  }

  const xml = await response.text();
  const validMatch = /<(?:\w+:)?valid>(true|false)<\/(?:\w+:)?valid>/.exec(xml);
  if (validMatch === null) {
    throw new Error("Unexpected VIES response shape");
  }
  const nameMatch = /<(?:\w+:)?name>([^<]*)<\/(?:\w+:)?name>/.exec(xml);
  const rawName = nameMatch?.[1]?.trim() ?? "";

  return {
    valid: validMatch[1] === "true",
    companyName: rawName === "" || rawName === "---" ? null : rawName,
  };
}

export async function checkVatNumber(
  countryCode: string,
  vatNumber: string,
): Promise<ViesResult | null> {
  const fullVatNumber = `${countryCode}${vatNumber}`;

  try {
    const live = await checkVatLive(countryCode, vatNumber);
    const checkedAt = new Date().toISOString();
    try {
      await query(
        `insert into vies_company_cache (vat_number, country_code, valid, company_name, checked_at)
         values ($1, $2, $3, $4, $5)
         on conflict (vat_number)
         do update set valid = $3, company_name = $4, checked_at = $5`,
        [fullVatNumber, countryCode, live.valid, live.companyName, checkedAt],
      );
    } catch (err) {
      console.error("Failed to write VIES cache (continuing)", err);
    }
    return { ...live, source: "vies", checkedAt };
  } catch (err) {
    console.warn("VIES live check failed, falling back to cache", err);
  }

  try {
    const rows = await query<ViesCacheRow>(
      `select valid, company_name, checked_at
       from vies_company_cache where vat_number = $1`,
      [fullVatNumber],
    );
    const row = rows[0];
    if (row !== undefined) {
      return {
        valid: row.valid,
        companyName: row.company_name,
        source: "cache",
        checkedAt: new Date(row.checked_at).toISOString(),
      };
    }
  } catch (err) {
    console.error("VIES cache lookup failed", err);
  }

  return null;
}
