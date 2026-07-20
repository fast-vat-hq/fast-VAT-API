# Fast-VAT-API

Hyper-fast, low-latency EU & Nordic VAT calculation API.

## Tech Stack

- **Runtime:** Node.js (v20+) with TypeScript (strict mode, ES modules)
- **Framework:** Express.js, optimized for Vercel Serverless/Edge deployments
- **Database:** Supabase (Postgres) via a serverless-safe `pg` connection pool
- **Geolocation:** Local MaxMind `GeoLite2-Country.mmdb` lookup (<1ms, no network calls)
- **VAT validation:** EU VIES SOAP service with a local cache fallback

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /health` | Liveness check |
| `GET /v1/rates` | Full EU + Nordic standard VAT rate table |
| `GET /v1/rates/:country` | Rate for one country (ISO code, e.g. `SE`) |
| `POST /v1/quote` | Core product: VAT quote + dual-factor location evidence |

`POST /v1/quote` body: `{ "amount": 10000, "ip": "1.2.3.4", "cardBin": "457173", "vatNumber": "SE556677889901" }`
(`amount` in minor units; `cardBin` and `vatNumber` optional). Returns the
rate, VAT amount, reverse-charge status (VIES-validated B2B), the IP/BIN
evidence record, and the stored audit id.

## Project Structure

```
src/
  db.ts      Serverless-safe Postgres connection pool (DATABASE_URL)
  geo.ts     In-memory GeoLite2 country lookup: getCountryFromIp(ip)
  rates.ts   EU + Nordic standard VAT rates (verify before launch!)
  bin.ts     Card BIN -> issuing country (cache + binlist.net fallback)
  vies.ts    EU VIES VAT number validation (3s timeout, cache fallback)
  audit.ts   Compliance audit trail writer
  app.ts     Express app (default export — Vercel entry)
  local-server.ts  Local dev entry (npm run dev)
public/
  index.html Interactive API tester UI
db/
  schema.sql Supabase tables (run once in SQL editor)
data/
  GeoLite2-Country.mmdb   (not committed - download from MaxMind)
```

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Download the free [GeoLite2 Country database](https://www.maxmind.com/en/geolite2/signup)
   (requires a MaxMind account) and place `GeoLite2-Country.mmdb` in `data/`.

3. Create a `.env` file with your Supabase pooler connection string
   (port 6543, transaction mode):

   ```
   DATABASE_URL=postgresql://user:password@host:6543/postgres
   ```

4. Type-check and run locally:

   ```bash
   npm run typecheck
   npm run dev        # tester UI + API at http://localhost:3000
   ```

## Deploying to Vercel

1. In Vercel project **Settings → Build and Deployment**, set **Framework Preset** to **Express**.
2. Leave Build Command / Output Directory overrides **off**.
3. Set environment variables:
   - `DATABASE_URL` — Supabase transaction-pooler connection string
   - `MAXMIND_LICENSE_KEY` — from MaxMind account → Manage License Keys
4. Redeploy. Tester UI at `/`, API under `/v1/`.
