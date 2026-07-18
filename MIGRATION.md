# Migration Checklist — Local → Production (Railway / Render / Supabase)

This document covers the steps to deploy the SMC API server to a cloud
platform (Railway or Render) with Supabase PostgreSQL, preserving all
existing data and configuration patterns.

---

## Phase 1: Database (Supabase)

### 1.1 — Create Supabase project
1. Go to [supabase.com](https://supabase.com) → New project.
2. Choose region closest to your API server.
3. Note the **Connection string** from Project Settings → Database.
   Format: `postgresql://postgres:[PASSWORD]@[HOST]:6543/postgres`

### 1.2 — Verify connection string compatibility
Our codebase uses `pg.Pool` with a standard `connectionString` param
(`lib/db/src/index.ts:42`). Supabase's string works as-is — no changes needed.

**Before** (local): `postgresql://smc:smc-liquidity-hunter@db:5432/smc_liquidity`
**After**  (Supabase): `postgresql://postgres:XXXXXXXXXX@db.xxxxx.supabase.co:6543/postgres`

### 1.3 — Push the schema
Run from your local machine (or a CI job) pointed at Supabase:

```bash
# Override DATABASE_URL to target Supabase (one-time migration push)
DATABASE_URL="postgresql://postgres:XXX@db.xxxxx.supabase.co:6543/postgres" \
  pnpm --filter @workspace/db run push
```

Drizzle Kit will create all tables: `trades`, `performance_matrix`,
`agent_loop_runs`, `agent_loop_steps`, `agent_memory`.

> **⚠ Important:** `pnpm run push` is additive — it creates tables/columns
> without dropping data. But it does NOT migrate existing data. If you have
> data in a local Postgres that you need to keep, use `pg_dump`/`pg_restore`
> **before** running `push`.

### 1.4 — (If migrating data) pg_dump / pg_restore

```bash
# Dump local DB
pg_dump "postgresql://smc:smc-liquidity-hunter@localhost:5433/smc_liquidity" \
  --no-owner --no-acl -Fc > smc-dump.dump

# Restore to Supabase
pg_restore "postgresql://postgres:XXX@db.xxxxx.supabase.co:6543/postgres" \
  --no-owner --no-acl -Fc smc-dump.dump
```

---

## Phase 2: Platform Setup

### 2.1 — Choose a platform

**Railway** (railway.json provided):
- Push repo → `railway.json` is auto-detected.
- Add env vars via Dashboard or `railway variables` CLI.
- Supabase add-on available in Railway marketplace.

**Render** (render.yaml provided):
- Blueprint auto-detects `render.yaml`.
- PostgreSQL is provisioned via the `databases` block.
- Set secrets (API keys) via Dashboard (marked `sync: false`).

### 2.2 — Set environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Supabase connection string |
| `FIREWORKS_API_KEY` | Yes* | *Or set `LLM_PROVIDER` + corresponding key |
| `LLM_PROVIDER` | No | Defaults to `fireworks` |
| `LLM_MODEL` | No | Override default model |
| `CORS_ORIGINS` | No | Set to your frontend domain in production |
| `ALPACA_API_KEY_ID` | No | Paper trading |
| `ALPACA_API_SECRET_KEY` | No | Paper trading |
| `LANGFUSE_PUBLIC_KEY` | No | Observability |
| `LANGFUSE_SECRET_KEY` | No | Observability |

### 2.3 — Verify the deploy

```bash
# Health check
curl https://your-service.com/api/healthz
# -> {"status":"ok"}

# Symbols endpoint (no DB required)
curl https://your-service.com/api/symbols
```

---

## Phase 3: Production Hardening

- [ ] Restrict `CORS_ORIGINS` to your frontend domain (never `*` in prod)
- [ ] Rotate Supabase `DATABASE_URL` password (Settings → Database → Reset password)
- [ ] Enable **Connection Pooler** (Supabase → Database → Connection pooling) and use port `6543` for serverless-friendly pooled connections
- [ ] Set `LOG_LEVEL=warn` in production to reduce noise
- [ ] Add a **Session Pooler timeout** if using PgBouncer (set `?pgbouncer=true&connection_limit=1` on the Supabase connection string)
- [ ] Verify health check endpoint returns `200` before routing traffic
- [ ] Configure **auto-scaling** (Railway: horizontal scaling; Render: instance type)
- [ ] Set up a **staging environment** (duplicate service pointing at a separate Supabase project)
- [ ] Add **alerts** for 5xx errors, high memory, connection pool exhaustion
- [ ] Review Docker `HEALTHCHECK` interval (currently 30s; adjust for your platform's probe timing)

---

## Phase 4: Frontend (if deploying)

The frontend (`artifacts/liquidity-hunter`) is a Vite SPA. Options:

1. **Render Static Site**: Point build command at `artifacts/liquidity-hunter`,
   publish directory `dist/public`. Set env `VITE_API_BASE_URL` to your api-server URL.
2. **Railway Static Site**: Similar — publish the built `dist/public` folder.
3. **Vercel / Netlify**: Connect repo, set root directory to `artifacts/liquidity-hunter`,
   build command `pnpm install && pnpm run build`.

> **Important:** The frontend is NOT included in the Dockerfile's `runner` stage
> (which only runs the API server). The Dockerfile `frontend` stage (nginx) is
> available if you prefer a single-box deployment, but for cloud deployments
> you'll typically deploy them as separate services.

---

## Quick Reference

```bash
# ── Drizzle schema push ──────────────────────────────────────────
DATABASE_URL="postgresql://..." pnpm --filter @workspace/db run push

# ── Dump local data ──────────────────────────────────────────────
pg_dump "postgresql://smc:smc-liquidity-hunter@localhost:5433/smc_liquidity" -Fc > backup.dump

# ── Restore to Supabase ──────────────────────────────────────────
pg_restore "postgresql://postgres:XXX@db.xxxxx.supabase.co:6543/postgres" -Fc backup.dump

# ── Verify tables exist ──────────────────────────────────────────
psql "postgresql://postgres:XXX@db.xxxxx.supabase.co:6543/postgres" -c "\dt"

# ── Test api-server health ────────────────────────────────────────
curl -s https://your-service.com/api/healthz
```
