/**
 * Standard VAT rates for EU member states plus non-EU Nordics (NO, IS).
 *
 * IMPORTANT: rates change by legislation. These values were compiled in
 * July 2026 and MUST be re-verified against official sources before any
 * production launch (EU: https://taxation-customs.ec.europa.eu, national
 * tax authorities for NO/IS). Keeping this table correct is the product.
 */

export interface VatRate {
  /** ISO 3166-1 alpha-2 country code */
  readonly country: string;
  /** Standard VAT rate in percent, e.g. 25 or 25.5 */
  readonly standardRate: number;
  readonly currency: string;
  /** EU member state (participates in VIES / reverse charge) */
  readonly isEuMember: boolean;
}

const RATES_LAST_VERIFIED = "2026-07-17";

const RATES: ReadonlyArray<VatRate> = [
  { country: "AT", standardRate: 20, currency: "EUR", isEuMember: true },
  { country: "BE", standardRate: 21, currency: "EUR", isEuMember: true },
  { country: "BG", standardRate: 20, currency: "EUR", isEuMember: true },
  { country: "HR", standardRate: 25, currency: "EUR", isEuMember: true },
  { country: "CY", standardRate: 19, currency: "EUR", isEuMember: true },
  { country: "CZ", standardRate: 21, currency: "CZK", isEuMember: true },
  { country: "DK", standardRate: 25, currency: "DKK", isEuMember: true },
  { country: "EE", standardRate: 24, currency: "EUR", isEuMember: true },
  { country: "FI", standardRate: 25.5, currency: "EUR", isEuMember: true },
  { country: "FR", standardRate: 20, currency: "EUR", isEuMember: true },
  { country: "DE", standardRate: 19, currency: "EUR", isEuMember: true },
  { country: "GR", standardRate: 24, currency: "EUR", isEuMember: true },
  { country: "HU", standardRate: 27, currency: "HUF", isEuMember: true },
  { country: "IE", standardRate: 23, currency: "EUR", isEuMember: true },
  { country: "IT", standardRate: 22, currency: "EUR", isEuMember: true },
  { country: "LV", standardRate: 21, currency: "EUR", isEuMember: true },
  { country: "LT", standardRate: 21, currency: "EUR", isEuMember: true },
  { country: "LU", standardRate: 17, currency: "EUR", isEuMember: true },
  { country: "MT", standardRate: 18, currency: "EUR", isEuMember: true },
  { country: "NL", standardRate: 21, currency: "EUR", isEuMember: true },
  { country: "PL", standardRate: 23, currency: "PLN", isEuMember: true },
  { country: "PT", standardRate: 23, currency: "EUR", isEuMember: true },
  { country: "RO", standardRate: 21, currency: "RON", isEuMember: true },
  { country: "SK", standardRate: 23, currency: "EUR", isEuMember: true },
  { country: "SI", standardRate: 22, currency: "EUR", isEuMember: true },
  { country: "ES", standardRate: 21, currency: "EUR", isEuMember: true },
  { country: "SE", standardRate: 25, currency: "SEK", isEuMember: true },
  // Non-EU Nordics: separate VAT regimes (NO: VOEC scheme, not VIES).
  { country: "NO", standardRate: 25, currency: "NOK", isEuMember: false },
  { country: "IS", standardRate: 24, currency: "ISK", isEuMember: false },
];

const RATES_BY_COUNTRY: ReadonlyMap<string, VatRate> = new Map(
  RATES.map((r) => [r.country, r]),
);

export function getVatRate(countryCode: string): VatRate | null {
  return RATES_BY_COUNTRY.get(countryCode.toUpperCase()) ?? null;
}

export function listVatRates(): { lastVerified: string; rates: ReadonlyArray<VatRate> } {
  return { lastVerified: RATES_LAST_VERIFIED, rates: RATES };
}
