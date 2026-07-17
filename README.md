# Fast-VAT-API

Hyper-fast, low-latency EU & Nordic VAT calculation API.

## Tech Stack

- **Runtime:** Node.js (v20+) with TypeScript (strict mode, ES modules)
- **Framework:** Express.js, optimized for Vercel Serverless/Edge deployments
- **Database:** Supabase (Postgres) via a serverless-safe `pg` connection pool
- **Geolocation:** Local MaxMind `GeoLite2-Country.mmdb` lookup (<1ms, no network calls)
- **VAT validation:** EU VIES SOAP service with a local cache fallback

## Project Structure

```
src/
  db.ts    Serverless-safe Postgres connection pool (DATABASE_URL)
  geo.ts   In-memory GeoLite2 country lookup: getCountryFromIp(ip)
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

4. Type-check:

   ```bash
   npx tsc --noEmit
   ```
