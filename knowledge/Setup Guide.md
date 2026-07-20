---
tags: [setup, onboarding, development]
aliases: [Setup Guide, Onboarding]
---

# Setup Guide

## Prerequisites
- Node.js 22+
- pnpm 9
- Docker Desktop (for PostgreSQL)
- (Optional) Fireworks AI API key
- (Optional) TradingView Desktop with CDP

## One-Time Setup

```powershell
# 1. Clone and install
cd part-2-SMC
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env: set FIREWORKS_API_KEY, DATABASE_URL

# 3. Start PostgreSQL
cd deploy/local
docker compose up -d db

# 4. Apply trust auth (Windows Docker workaround)
docker compose exec db sh -c "echo 'host all all all trust' >> /var/lib/postgresql/data/pg_hba.conf && psql -U smc -d smc_liquidity -c 'SELECT pg_reload_conf();'"

# 5. Run migration
docker compose exec db psql -U smc -d smc_liquidity < docs/migrations/003_learning_framework.sql

cd ../..

# 6. Build and start
pnpm --filter @workspace/api-server run build
node artifacts/api-server/dist/index.mjs

# 7. Verify
curl http://localhost:3001/api/healthz
curl http://localhost:3001/api/learning/dashboard
```

## Starting TV Desktop

```powershell
# Launch TV Desktop with CDP debugging
# Find the package:
Get-AppxPackage -Name "*TradingView*"
# Launch:
Start-Process "shell:AppsFolder\TradingView.Desktop_<family>!TradingView.Desktop" -ArgumentList "--remote-debugging-port=9222"
```

## Running the AI

Set `FIREWORKS_API_KEY` in `.env`:
```env
LLM_PROVIDER=fireworks
FIREWORKS_API_KEY=fw_xxxxxxxxxxxxxxxxxxx
```

## Frontend (Session Cockpit)

```powershell
# IMPORTANT: Build from PowerShell on Windows, not Git Bash
# Git Bash leaks BASE_PATH=/Program Files/Git/ which breaks asset loading
$env:BASE_PATH="/"; $env:PORT="3000"
pnpm --filter @workspace/liquidity-hunter run build

# Serve the built SPA (proxies /api/* → localhost:3001)
node serve-frontend.mjs

# Or use Vite dev server (hot reload)
pnpm --filter @workspace/liquidity-hunter run dev
```

## Quick Reference Commands

```bash
# Build API server
pnpm --filter @workspace/api-server run build

# Build frontend (from PowerShell with BASE_PATH set)
# $env:BASE_PATH="/"; $env:PORT="3000"; pnpm --filter @workspace/liquidity-hunter run build

# Start API server
pnpm --filter @workspace/api-server run start

# Serve frontend
node serve-frontend.mjs

# Run comparison cycle
curl -X POST http://localhost:3001/api/learning/comparisons/analyze \
  -H "Content-Type: application/json" \
  -d '{"symbol":"EURUSD","timeframe":"15m","market":"forex"}'

# View learning dashboard
curl http://localhost:3001/api/learning/dashboard

# Health check
curl http://localhost:3001/api/healthz

# Set price alert on TV Desktop
curl -X POST http://localhost:3001/api/agent-loop/tv-alert-create \
  -H "Content-Type: application/json" \
  -d '{"price": 1.1050, "condition": "crossing", "message": "EURUSD alert"}'

# Draw BOS/CHoCH lines on TV Desktop
curl -X POST http://localhost:3001/api/agent-loop/tv-draw \
  -H "Content-Type: application/json" \
  -d '{"action": "bos", "breaks": [{"type":"CHoCH","price":1.1050,"direction":"bearish"}]}'

# MCP tools
curl -s -X POST http://localhost:3002/mcp \
  -H "Accept: application/json, text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"cli","version":"1.0"}},"id":"1"}'
```
