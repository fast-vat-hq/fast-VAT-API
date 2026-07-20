import path from "node:path";
import express, { type Request, type Response } from "express";
import { getCountryFromIp } from "./geo.js";
import { getCountryFromBin } from "./bin.js";
import { getVatRate, listVatRates } from "./rates.js";
import { checkVatNumber } from "./vies.js";
import { writeAuditLog } from "./audit.js";

export const app = express();
app.use(express.json());

// Tester UI files live in web/ (not public/) so Vercel does not treat
// that folder as a static build output directory.
app.use(express.static(path.resolve(process.cwd(), "web")));

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

/** Free tier: full rate table. */
app.get("/v1/rates", (_req: Request, res: Response) => {
  res.json(listVatRates());
});

/** Free tier: single country rate. */
app.get("/v1/rates/:country", (req: Request, res: Response) => {
  const countryParam = req.params.country;
  const rate = getVatRate(typeof countryParam === "string" ? countryParam : "");
  if (rate === null) {
    res.status(404).json({ error: "Unknown or unsupported country code" });
    return;
  }
  res.json(rate);
});

interface QuoteRequestBody {
  /** Net amount in minor units (cents / öre) */
  amount: number;
  /** Customer IP address (IPv4 or IPv6) */
  ip: string;
  /** First 6-8 digits of the customer's card (optional, evidence #2) */
  cardBin?: string;
  /** Buyer VAT number incl. country prefix, e.g. "SE556677889901" (B2B) */
  vatNumber?: string;
}

function parseQuoteBody(body: unknown): QuoteRequestBody | string {
  if (typeof body !== "object" || body === null) return "Request body must be a JSON object";
  const b = body as Record<string, unknown>;
  if (typeof b.amount !== "number" || !Number.isInteger(b.amount) || b.amount < 0) {
    return "'amount' must be a non-negative integer in minor units (e.g. cents)";
  }
  if (typeof b.ip !== "string" || b.ip.length === 0) {
    return "'ip' must be a non-empty string";
  }
  if (b.cardBin !== undefined && typeof b.cardBin !== "string") {
    return "'cardBin' must be a string when provided";
  }
  if (b.vatNumber !== undefined && typeof b.vatNumber !== "string") {
    return "'vatNumber' must be a string when provided";
  }
  return {
    amount: b.amount,
    ip: b.ip,
    cardBin: b.cardBin as string | undefined,
    vatNumber: b.vatNumber as string | undefined,
  };
}

const VAT_NUMBER_PATTERN = /^([A-Z]{2})([0-9A-Za-z+*.]{2,12})$/;

/**
 * The core product: given checkout facts (amount, IP, optionally card BIN
 * and buyer VAT number), return the VAT to charge plus a stored
 * dual-factor location evidence record.
 */
app.post("/v1/quote", async (req: Request, res: Response) => {
  const parsed = parseQuoteBody(req.body);
  if (typeof parsed === "string") {
    res.status(400).json({ error: parsed });
    return;
  }

  const warnings: string[] = [];

  // Evidence piece 1: IP geolocation (local, <1ms).
  const ipCountry = getCountryFromIp(parsed.ip);
  // Evidence piece 2: card BIN issuing country.
  const binCountry =
    parsed.cardBin !== undefined ? await getCountryFromBin(parsed.cardBin) : null;

  const evidenceMatch = ipCountry !== null && ipCountry === binCountry;
  if (parsed.cardBin !== undefined && binCountry === null) {
    warnings.push("Card BIN could not be resolved to a country; only one piece of location evidence available.");
  }
  if (ipCountry !== null && binCountry !== null && !evidenceMatch) {
    warnings.push(`Location evidence mismatch: IP says ${ipCountry}, card BIN says ${binCountry}. Flag for manual review; IP country used.`);
  }

  const customerCountry = ipCountry ?? binCountry;
  if (customerCountry === null) {
    res.status(422).json({
      error: "Customer location could not be determined from IP or card BIN",
    });
    return;
  }

  // B2B: a VIES-validated EU VAT number means reverse charge (0%).
  let vies: { valid: boolean; companyName: string | null; source: string } | null = null;
  let reverseCharge = false;
  if (parsed.vatNumber !== undefined) {
    const match = VAT_NUMBER_PATTERN.exec(parsed.vatNumber.toUpperCase().replace(/\s/g, ""));
    if (match === null) {
      res.status(400).json({ error: "'vatNumber' format is invalid (expected e.g. SE556677889901)" });
      return;
    }
    const vatCountry = match[1] as string;
    const vatDigits = match[2] as string;
    const result = await checkVatNumber(vatCountry, vatDigits);
    if (result === null) {
      warnings.push("VIES is unavailable and no cached validation exists; treated as B2C (VAT charged). Retry later to refund/adjust.");
    } else {
      vies = { valid: result.valid, companyName: result.companyName, source: result.source };
      if (result.source === "cache") {
        warnings.push("VIES validation served from local cache (upstream unavailable).");
      }
      reverseCharge = result.valid;
    }
  }

  const rate = getVatRate(customerCountry);
  if (rate === null) {
    // Outside EU/Nordic scope: no VAT collected by this service.
    const auditId = await writeAuditLog({
      ip: parsed.ip,
      ipCountry,
      binCountry,
      evidenceMatch,
      customerCountry,
      vatRate: null,
      amount: parsed.amount,
      vatAmount: null,
      vatNumber: parsed.vatNumber ?? null,
      viesValid: vies?.valid ?? null,
      notes: "outside_scope",
    });
    if (auditId === null) warnings.push("Audit record could not be stored (database unreachable).");
    res.json({
      customerCountry,
      inScope: false,
      vatRate: 0,
      vatAmount: 0,
      totalAmount: parsed.amount,
      reverseCharge: false,
      vies,
      evidence: { ipCountry, binCountry, match: evidenceMatch },
      auditId,
      warnings,
    });
    return;
  }

  const vatRate = reverseCharge ? 0 : rate.standardRate;
  const vatAmount = Math.round((parsed.amount * vatRate) / 100);

  const auditId = await writeAuditLog({
    ip: parsed.ip,
    ipCountry,
    binCountry,
    evidenceMatch,
    customerCountry,
    vatRate,
    amount: parsed.amount,
    vatAmount,
    vatNumber: parsed.vatNumber ?? null,
    viesValid: vies?.valid ?? null,
    notes: reverseCharge ? "reverse_charge" : null,
  });
  if (auditId === null) warnings.push("Audit record could not be stored (database unreachable).");

  res.json({
    customerCountry,
    inScope: true,
    currency: rate.currency,
    vatRate,
    vatAmount,
    totalAmount: parsed.amount + vatAmount,
    reverseCharge,
    vies,
    evidence: { ipCountry, binCountry, match: evidenceMatch },
    auditId,
    warnings,
  });
});

export default app;