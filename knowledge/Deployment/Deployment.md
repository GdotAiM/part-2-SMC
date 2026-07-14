---
tags: [deployment, docker, amd, infrastructure]
aliases: [Deployment, Docker]
---

# Deployment

## Docker Compose (Local / Intel CPU)

**File:** `deploy/local/docker-compose.yml`

Four services:
- **api** — Express server (port 3001) + MCP (port 3002)
- **db** — PostgreSQL 16 (port 5433)
- **frontend** — nginx serving SPA (port 3000)
- **qdrant** (optional) — Vector memory database
- **ollama** (optional) — Local LLM inference

**Quick start:**
```bash
cd deploy/local
cp .env.example .env
# Edit .env — add FIREWORKS_API_KEY
docker compose up -d
```

**Dockerfile:** Multi-stage build
- `builder` stage — TypeScript compilation + Vite build
- `runner` stage — Production Node.js runtime (Alpine)
- `frontend` stage — nginx static file server

## Docker Compose (AMD Developer Cloud / MI300X)

**File:** `deploy/amd-developer-cloud/docker-compose.yml`

Co-locates vLLM inference server (ROCm on MI300X) with the API server.
- vLLM service with ROCm GPU passthrough
- API server connecting to `http://vllm:8000/v1`
- Database + frontend same as local deployment

## Environment Variables

| Variable | Default | Required | Description |
|---|---|---|---|
| `PORT` | 3001 | Yes | HTTP server port |
| `MCP_PORT` | 3002 | No | MCP server port |
| `DATABASE_URL` | — | No | PostgreSQL connection |
| `FIREWORKS_API_KEY` | — | Yes (AI) | Fireworks AI key |
| `LLM_PROVIDER` | fireworks | No | fireworks/openai/amd/custom/ollama |
| `TV_ENABLED` | false | No | Enable TV Desktop integration |
| `TV_CDP_PORT` | 9222 | No | TV Desktop debug port |
| `TV_CONNECTION_TYPE` | web | No | desktop/web |
| `FINNHUB_API_KEY` | — | No | Forex WebSocket (falls back to Yahoo) |
| `ALPACA_API_KEY_ID` | — | No | Paper trading |
| `LANGFUSE_PUBLIC_KEY` | — | No | LLM tracing |

## CI Pipeline
**File:** `.github/workflows/ci.yml`

Jobs:
1. `build-and-typecheck` — Install → tsc build → typecheck → esbuild
2. `docker-build` — Docker build validation (no push)

## Docker Notes
- Windows DNS fix: `dns: 8.8.8.8` in docker-compose for Binance connectivity
- CDP Proxy for Windows: `scripts/cdp-proxy.mjs` bridges 127.0.0.1:9222 → 0.0.0.0:29222
- PostgreSQL data persisted in named volumes (`pgdata`)
- Chromium in Alpine (Dockerfile `RUN apk add chromium nss`)
