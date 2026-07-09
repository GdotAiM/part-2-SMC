# Demo Guide — SMC Pulse Predict

Step-by-step instructions to run the app end-to-end for a hackathon demo.
Target time-to-demo: **under 2 minutes** once dependencies are installed.

> The app degrades gracefully with missing config — it boots with **only
> `PORT` set**. Without a database the Analytics page shows empty states
> (no crash); without an LLM key the AI endpoints report "not configured".
> So you can demo the dashboard + chart + real-time pipeline even before
> wiring Postgres or vLLM.

## Prerequisites

- Node.js 22+, pnpm 9 (`corepack enable && corepack prepare pnpm@9 --activate`)
- (Optional) a Postgres instance — only for the trade ledger / performance matrix
- (Optional) a vLLM server or `FIREWORKS_API_KEY` — only for the AI agents

## 1. Configure env

```bash
cp .env.example .env
# Defaults are fine for a no-DB, no-key dashboard demo.
# To enable AI: set LLM_PROVIDER + LLM_BASE_URL (or FIREWORKS_API_KEY).
# To enable the ledger: set DATABASE_URL.
```

## 2. Install + build

```bash
pnpm install
pnpm --filter @workspace/db run build        # builds the db package
pnpm --filter @workspace/api-zod run build   # builds the zod schemas
pnpm --filter @workspace/api-server run build
```

## 3. Start the API server

```bash
pnpm --filter @workspace/api-server run start
# → Server listening on http://localhost:3001
# → MCP server on http://localhost:3002/mcp
# → Binance WS connected (live BTC candles streaming)
```

Smoke check:

```bash
curl http://localhost:3001/api/healthz     # {"status":"ok"}
curl http://localhost:3001/api/symbols     # gzip-compressed JSON
curl http://localhost:3001/api/analysis/crypto?symbol=BTCUSDT&timeframe=1h
```

## 4. Start the frontend

```bash
pnpm --filter @workspace/liquidity-hunter run dev
# → http://localhost:5173
```

## 5. The demo flow (3 minutes)

1. Open `http://localhost:5173` → **Dashboard** loads with live BTC data and a
   pulsing **LIVE** badge (real Binance WS price).
2. **CRYPTO → BTC/USDT → INTRADAY** → watch the timeframe cascade: H4 sets
   direction, H1 confirms, M15 triggers. The ConfluenceCard shows how many TFs
   agree.
3. Tap any timeframe card → **Intelligence Sheet** opens: market overview,
   daily bias with evidence, liquidity map (BSL/SSL pools), order blocks with
   confidence, FVGs, PD array, draw targets, and a derived trade setup
   (entry/SL/TP/R:R).
4. Tap **CHART** → candlestick chart with SMC overlays drawn on a canvas
   (order blocks, FVG boxes, BOS/CHoCH lines, PD premium/discount zones,
   session bands, SMT markers).
5. **AI Market Briefing** (if LLM configured) → streams a structured read of
   the current report; ask a follow-up question in the chat box.
6. Open the **Agent Pipeline** tab → watch the 4 agents stream in sequence
   (Structure → Liquidity → FVG → Confluence); the Confluence agent
   synthesizes the prior three.
7. `/analytics` → trade ledger + performance matrix (empty states if no DB;
   seeded data if DB configured). Generate a signal live.
8. `/broker` → broker status, account, REVIEW/LIVE mode switch (LIVE is
   gated behind an explicit confirm).

## AMD / vLLM demo (if you have an MI300X VM)

```bash
cd deploy/amd-developer-cloud
cp .env.amd .env   # fill HF_TOKEN, optionally FIREWORKS_API_KEY
docker compose up -d
# vllm (MI300X, Gemma 4) → healthy
# api (LLM_PROVIDER=amd) → routes agent inference to vllm:8000
# db, frontend → healthy
```

Then the AI Market Briefing and agent endpoints run on **local Gemma 4
inference** — no external API calls.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Dashboard loads but AI says "not configured" | No LLM key and no vLLM reachable. Set `FIREWORKS_API_KEY` or start vLLM with `LLM_PROVIDER=amd`. |
| `/analytics` shows empty states | No `DATABASE_URL`. Expected — set it to populate the ledger, or run `pnpm --filter @workspace/api-server run generate-demo-backtest` to seed demo data. |
| No live price / "LIVE" badge absent | Binance WS endpoint blocked. The server auto-fails over US → global; check network. Forex always works (Yahoo polling). |
| Forex "Pro Chart" button missing | TradingView widget is crypto-only; the lightweight-charts ChartView still works for forex. |
