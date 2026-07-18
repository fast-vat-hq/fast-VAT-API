import { query } from "./db.js";

/**
 * Compliance audit trail. Every VAT quote writes one row proving how the
 * customer's location was determined: IP-detected country vs card BIN
 * country (the dual-factor location proof required for EU digital
 * services VAT).
 */

export interface AuditEntry {
  ip: string;
  ipCountry: string | null;
  binCountry: string | null;
  evidenceMatch: boolean;
  customerCountry: string | null;
  vatRate: number | null;
  /** Net amount in minor units (e.g. cents / öre) */
  amount: number;
  /** VAT amount in minor units */
  vatAmount: number | null;
  vatNumber: string | null;
  viesValid: boolean | null;
  notes: string | null;
}

interface AuditIdRow extends Record<string, unknown> {
  id: string;
}

/**
 * Returns the stored audit row id, or null when the database is
 * unreachable (the quote still succeeds; the caller must surface a
 * warning so the merchant knows no evidence record was stored).
 */
export async function writeAuditLog(entry: AuditEntry): Promise<string | null> {
  try {
    const rows = await query<AuditIdRow>(
      `insert into audit_logs
         (ip, ip_country, bin_country, evidence_match, customer_country,
          vat_rate, amount, vat_amount, vat_number, vies_valid, notes)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       returning id`,
      [
        entry.ip,
        entry.ipCountry,
        entry.binCountry,
        entry.evidenceMatch,
        entry.customerCountry,
        entry.vatRate,
        entry.amount,
        entry.vatAmount,
        entry.vatNumber,
        entry.viesValid,
        entry.notes,
      ],
    );
    return rows[0]?.id ?? null;
  } catch (err) {
    console.error("Failed to write audit log", err);
    return null;
  }
}
