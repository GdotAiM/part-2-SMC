import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Lazy initialization — only create the pool when first accessed.
// This prevents the server from crashing at import time when DATABASE_URL
// is not configured (e.g. on Replit Autoscale before a DB is provisioned).
// Routes that need the database will fail gracefully at request time instead.

let _pool: pg.Pool | null = null;
let _db: NodePgDatabase<typeof schema> | null = null;

// ── Deep-noop chain for offline mode ──────────────────────────────────────
// Returns a callable Proxy that intercepts both property access and function
// calls, always returning itself.  This lets chained APIs such as
//   db.select().from(t).where(...).orderBy(...).limit(...)
// complete without throwing, returning a noop thenable at the end.
function deepNoop(): any {
  const fn: any = () => deepNoop();
  return new Proxy(fn, {
    get(t, prop) {
      if (prop === "then" || prop === "catch") return undefined;   // not a promise
      if (prop === Symbol.toPrimitive) return () => "[noop-db]";
      if (prop === "toJSON") return () => null;
      return deepNoop();
    },
    apply(t, _this, args) {
      return deepNoop();
    },
    construct(t, args) {
      return deepNoop();
    },
  });
}

function getPool(): pg.Pool {
  if (!process.env.DATABASE_URL) return deepNoop();
  if (!_pool) {
    _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
}

export const pool = new Proxy({} as pg.Pool, {
  get(_target, prop) {
    return (getPool() as any)[prop];
  },
});

export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop) {
    if (!process.env.DATABASE_URL) {
      return deepNoop();
    }
    if (!_db) {
      _db = drizzle(getPool(), { schema });
    }
    return (_db as any)[prop];
  },
});

export * from "./schema";
