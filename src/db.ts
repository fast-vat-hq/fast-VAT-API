// pg is CommonJS; use the default import for ESM runtime compatibility.
import pg from "pg";
import type { Pool, PoolConfig } from "pg";

const { Pool: PgPool } = pg;

/**
 * Serverless-safe Postgres (Supabase) connection pool.
 *
 * In serverless/edge environments every warm invocation reuses the same
 * module scope, but a cold start creates a fresh one. Caching the pool on
 * `globalThis` guarantees exactly one pool per runtime instance, preventing
 * connection leakage when the bundler re-evaluates this module (e.g. during
 * dev hot-reload) or when many concurrent lambdas would otherwise each open
 * their own full-size pool and exhaust Supabase's connection limit.
 */

const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  // Keep the per-instance pool tiny: total connections used =
  // (concurrent serverless instances) x (max). Supabase free tier allows ~60.
  max: 3,
  // Release idle connections quickly so frozen lambdas don't hold them.
  idleTimeoutMillis: 10_000,
  // Fail fast instead of queueing forever if the pool is saturated.
  connectionTimeoutMillis: 5_000,
  // Cap connection lifetime so the pooler can rebalance.
  maxLifetimeSeconds: 300,
  ssl: { rejectUnauthorized: false },
};

declare global {
  // eslint-disable-next-line no-var
  var __vatApiPgPool: Pool | undefined;
}

function createPool(): Pool {
  const pool = new PgPool(poolConfig);
  // Prevent an errored idle client from crashing the process.
  pool.on("error", (err: Error) => {
    console.error("Unexpected error on idle Postgres client", err);
  });
  return pool;
}

export const pool: Pool = globalThis.__vatApiPgPool ?? createPool();
globalThis.__vatApiPgPool = pool;

/** Convenience helper for one-off parameterized queries. */
export async function query<Row extends Record<string, unknown>>(
  text: string,
  params: ReadonlyArray<unknown> = [],
): Promise<Row[]> {
  const result = await pool.query(text, params as unknown[]);
  return result.rows as Row[];
}
