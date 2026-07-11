# SMC Pulse Predict — Local Deployment (Intel / AMD CPU)

Run the full SMC Pulse Predict stack on **any x86_64 laptop** — Intel Core i5/i7/i9
or AMD Ryzen — without a GPU. LLM inference is handled by
[Fireworks AI](https://fireworks.ai) (cloud-hosted DeepSeek V4 Pro), so all you
need is Docker and an internet connection.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Your Laptop (Intel / AMD CPU)                    │
│                                                              │
│  ┌──────────────────────────┐   ┌──────────────────────────┐ │
│  │  SMC API Server           │   │  PostgreSQL 16            │ │
│  │  port 3001 — REST + SSE   │   │  port 5432 (internal)     │ │
│  │  port 3002 — MCP          │   │                          │ │
│  │                           │   │  User: smc                │ │
│  │  LLM_PROVIDER=fireworks   │   │  DB: smc_liquidity        │ │
│  └─────────────┬─────────────┘   └──────────────────────────┘ │
│                │                                              │
│  ┌─────────────┴─────────────┐                               │
│  │  Frontend (nginx)          │                               │
│  │  port 3000                 │                               │
│  └───────────────────────────┘                               │
│                                                              │
│         🌐 Fireworks AI (cloud) — DeepSeek V4 Pro             │
└──────────────────────────────────────────────────────────────┘
```

## Prerequisites

- **Docker** 24+ and **Docker Compose** v2
- **Fireworks AI API key** — free tier available at [fireworks.ai/api-keys](https://fireworks.ai/api-keys)
- **4 GB RAM** free (API server ~200 MB, PostgreSQL ~100 MB, frontend ~10 MB)

## Quick Start

### 1. Get a Fireworks API key

Visit [https://fireworks.ai/api-keys](https://fireworks.ai/api-keys), sign up,
and create an API key.  The free tier includes enough tokens for personal use.

### 2. Configure

```bash
cd deploy/local
cp .env.example .env
# Edit .env — paste your FIREWORKS_API_KEY
```

### 3. Launch

```bash
docker compose up -d
```

First build takes 2–3 minutes (TypeScript compilation + Vite build). Subsequent
starts are instant.

### 4. Verify

```bash
# API server is up
curl http://localhost:3001/api/healthz

# MCP endpoint is accepting connections (external AI agents)
curl http://localhost:3002/mcp

# Frontend is serving
curl -I http://localhost:3000

# End-to-end: ask the AI a question
curl -N http://localhost:3001/api/agents/ask-mcp \
  -H "Content-Type: application/json" \
  -d '{"question":"What is the current BTC structure on the 4h timeframe?"}'
```

Open **http://localhost:3000** in your browser for the full dashboard.

## Switching LLM Providers

The stack supports four providers — just change `LLM_PROVIDER` in `.env`:

| Provider | What it uses | Needs GPU? | API key |
|---|---|---|---|
| `fireworks` | Fireworks AI (DeepSeek V4 Pro) | No | `FIREWORKS_API_KEY` |
| `openai` | OpenAI (GPT-4o) | No | `OPENAI_API_KEY` |
| `custom` | Any OpenAI-compatible endpoint | No | `LLM_API_KEY` |
| `amd` | Self-hosted vLLM on AMD GPU | **Yes** | None |

## Resource Usage on Intel i5 (7th Gen)

| Container | CPU | RAM |
|---|---|---|
| `api` (Node.js) | ~2% idle, 15–30% under load | ~150 MB |
| `db` (PostgreSQL) | ~1% idle | ~80 MB |
| `frontend` (nginx) | <1% | ~10 MB |
| **Total** | **~3% idle** | **~250 MB** |

The i5-7200U or i5-7300HQ handles this comfortably — the heavy LLM work runs on
Fireworks' cloud GPUs, not your laptop.

## Stopping

```bash
docker compose down          # stop containers, keep database volume
docker compose down -v       # stop and delete everything (reset database)
```

## Troubleshooting

**"Missing API key" in API logs**
→ Make sure `FIREWORKS_API_KEY` is set in `deploy/local/.env` and you ran
`docker compose up -d` from the `deploy/local/` directory.

**Frontend loads but charts are empty**
→ You need market data API keys (`BINANCE_API_KEY`, `FINNHUB_API_KEY`) for live
data.  Without them, crypto falls back to Binance public WebSocket (works for
most pairs) and forex uses Yahoo polling.

**Port 3000/3001/3002 already in use**
→ Change `FRONTEND_PORT`, `API_PORT`, or `MCP_PORT` in `.env`.

**Build fails on low memory**
→ Docker BuildKit can use significant RAM during the Vite build.  If you have
≤8 GB RAM, try:
```bash
DOCKER_BUILDKIT=1 docker compose build --memory=2g api
```
