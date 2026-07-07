# SMC Pulse Predict — Full Capabilities Report

**Date:** July 7, 2026
**Scope:** What the app could do at the start of our sessions vs. what it can do now, plus aspirational gaps

---

## Before: Baseline (Pre-Sessions, Jun 5–23)

The app was a stock/forex dashboard on Replit. It had:

- **SMC Analysis Engine** — structure, liquidity, order blocks, FVG detection
- **Multi-TF Dashboard** — symbol picker, trading style selector, TF agent cards
- **Basic Chart** — Lightweight Charts v4 with candlestick rendering
- **Auto-refresh** — countdown ring with manual refresh trigger
- **No AI, no real-time data, no trading, no Docker, no database, no CI**

---

## After: Current Capabilities (Jul 7, 2026)

### SMC/ICT Analysis Engine (8 modules)
`artifacts/api-server/src/lib/smc/`

| Module | What it does |
|---|---|
| `structure.ts` | Pivot detection (ATR-normalized), BOS/CHoCH classification, market phase |
| `liquidity.ts` | BSL/SSL/EQH/EQL pool scanning with sweep probability scoring |
| `order-blocks.ts` | OB detection, breaker blocks, 6-factor confidence scoring |
| `fvg.ts` | Fair Value Gap detection with fill-fraction tracking |
| `pd-array.ts` | Premium/Discount/Equilibrium from dealing range |
| `daily-bias.ts` | HTF 1D structure-primary bias with SMA(20) fallback |
| `smt.ts` | SMT divergence between correlated pairs with magnitude + timing scoring |
| `report.ts` | Orchestrator — assembles all modules, cross-module adjustments, narrative |

### Real-Time Data Pipeline
`artifacts/api-server/src/lib/realtime/`

| Component | Capability |
|---|---|
| `binance-ws.ts` | Multi-symbol Binance US WebSocket, shared connection, auto-reconnect, geo-fallback, REST backfill |
| `forex-ws.ts` | Finnhub WS (with API key) or Yahoo polling (15s, no key needed), auto-fallback |
| `candle-store.ts` | Thread-safe in-memory candle accumulator with EventEmitter |
| `sse-manager.ts` | SSE client registry + broadcast to browsers |
| `analysis-bridge.ts` | Candle close → auto report rebuild → SSE push, cache pre-warming |

### Market Data Fetchers
- `binance.ts` — Binance REST (no key required) for crypto OHLCV
- `yahoo.ts` — Yahoo Finance REST (no key required) for forex OHLCV

### AI Agent System
`artifacts/api-server/src/lib/llm/provider.ts` + `artifacts/api-server/src/routes/agents*.ts`

| Endpoint | Capability |
|---|---|
| `POST /api/agents/ask` | Streaming Q&A with full SMC report context (SSE) |
| `POST /api/agents/pipeline` | 4-agent sequential pipeline: Structure → Liquidity → FVG → Confluence |
| `POST /api/agents/ask-mcp` | MCP-aware agent with autonomous tool calling (up to 3 rounds) |

**LLM Provider abstraction** — supports Fireworks (default), AMD/vLLM, OpenAI, and custom BYOK endpoints. Switched via `LLM_PROVIDER` env var.

### MCP (Model Context Protocol) Tier 3
`artifacts/api-server/src/lib/mcp/`

| Category | Detail |
|---|---|
| **Tools** | 11 SMC analysis tools: analyze_structure, analyze_liquidity, analyze_order_blocks, analyze_fvg, analyze_pd_array, get_daily_bias, detect_smt, get_draw_targets, build_full_report, get_live_candles, scan_all_timeframes |
| **Resources** | `smc://candles/{market}/{symbol}/{timeframe}`, `smc://status` |
| **Prompts** | smc-analysis (6-step structured ICT/SMC workflow) |
| **Server** | FastMCP v4.3.2 running on port 3002/3003 |
| **Registry** | Tool registry for in-process direct execution (bypasses FastMCP internals) |

### Trading & Execution Layer
`artifacts/api-server/src/lib/execution/` + `services/`

| Component | Capability |
|---|---|
| **SignalGenerator** (561 lines) | SmcReport → UnifiedTradeSignal, single-TF + multi-TF cascade |
| **TradeLedgerService** (188 lines) | CRUD for signals via Drizzle ORM in PostgreSQL |
| **PerformanceMatrixService** (331 lines) | Sharpe, win rate, profit factor, max drawdown per 7-dimension combination |
| **BrokerAdapter interface** | Abstract broker with isReady, executeOrder, getBalance, getOpenOrders, closeOrder, getOrderStatus |
| **MockBrokerAdapter** | File-based .jsonl ledger for development |
| **AlpacaAdapter** (321 lines) | Real paper trading via Alpaca Markets API — symbol translation (BTCUSDT→BTC/USD), market orders, account queries, status mapping |
| **ExecutionManager** | REVIEW/LIVE mode toggle, broker-agnostic signal execution |
| **deriveSide()** | Shared helper: take_profit > entry_price → BUY, else SELL (fixed the old `entry_price > 0` bug) |
| **BacktestRunner** (294 lines) | Real SMC engine on sliding windows across 5 timeframes × 3 assets |

### REST API Endpoints (16)

| # | Method | Path | Purpose |
|---|---|---|---|
| 1 | GET | `/api/healthz` | Health check |
| 2 | GET | `/api/symbols` | Supported symbols |
| 3 | GET | `/api/analysis/crypto` | Full SMC report for crypto |
| 4 | GET | `/api/analysis/forex` | Full SMC report for forex |
| 5 | POST | `/api/agents/ask` | Streaming Q&A (SSE) |
| 6 | POST | `/api/agents/pipeline` | 4-agent pipeline (SSE) |
| 7 | POST | `/api/agents/ask-mcp` | MCP-aware agent with tool calling (SSE) |
| 8 | GET | `/api/stream/:symbol` | Real-time candle stream (SSE) |
| 9 | GET | `/api/stream/status` | Stream system status |
| 10 | GET | `/api/ledger` | Query signals with filters |
| 11 | GET | `/api/ledger/pending` | Pending signals |
| 12 | GET | `/api/performance-matrix` | Matrix data |
| 13 | POST | `/api/performance-matrix/rebuild` | Trigger matrix recomputation |
| 14 | POST | `/api/signals/generate` | Generate live signals from SMC engine |
| 15 | POST | `/api/signals/execute` | Execute signal through broker |
| 16 | GET | `/api/account` | Broker account status (balance + open orders) |
| 17 | POST | `/api/broker/mode` | Set execution mode (REVIEW/LIVE) with confirmation guard |
| 18 | GET | `/api/broker/status` | Broker name, readiness, current mode, paper flag |

### Frontend — 4 Pages
`artifacts/liquidity-hunter/src/`

| Page | Route | Content |
|---|---|---|
| **Dashboard** | `/` | Multi-TF SMC analysis, TF agent cards, confidence bars, draw targets, live price badge with pulsing dot, real-time WebSocket, AI agent chat with MCP toggle, visual chart overlay |
| **Analytics** | `/analytics` | Trade ledger table with filters, performance metrics, setup rankings by asset, signal detail sheet |
| **Broker** | `/broker` | Connection status card, PAPER/LIVE mode badge (pulsing dot for LIVE), REVIEW/LIVE toggle with typed "LIVE" confirmation dialog, account overview (4 cards, 15s polling), open orders table (color-coded status badges), execution log with mode distinction |
| **Not Found** | `*` | 404 page |

**Key components:** ConfluenceCard, ConfluenceSheet, IntelligenceSheet, ChartView (Lightweight Charts v5 with PD Array overlay, SMT markers, session backgrounds), AgentChat, AgentPipeline, TradeLedgerDashboard, PerformanceMatrixHeatmap, SignalDetailSheet

**UI library:** 50+ shadcn/ui primitives (Card, Badge, Table, Switch, AlertDialog, Select, Tabs, Skeleton, etc.)

### AMD Developer Cloud Deployment
`deploy/amd-developer-cloud/`

| Component | Detail |
|---|---|
| **docker-compose.yml** | Co-located vLLM (ROCm/MI300X) + API server, GPU passthrough, full healthchecks |
| **setup.sh** | One-time VM provisioning (Docker, ROCm verification, vLLM image pull) |
| **.env.amd** | All configurable values: LLM_MODEL, LLM_TOOL_PARSER, LLM_PROVIDER, VLLM_*, CORS_ORIGINS, ALPACA_API_KEY_ID/SECRET, etc. |
| **README.md** | Deployment guide, Gemma 4 sizing table, vLLM flags reference, security notes |
| **Default model** | Google Gemma 4 26B A4B (MoE, ~58 GB, fits single MI300X) |

**vLLM Flags:** `--tool-call-parser $LLM_TOOL_PARSER`, `--reasoning-parser $LLM_TOOL_PARSER`, `--enable-auto-tool-choice`, `--trust-remote-code`, `--enforce-eager`

### DevOps & Infrastructure

| Component | Detail |
|---|---|
| **Dockerfile** | Multi-stage build (node:22-alpine), non-root `node` user, healthcheck via Node's http module, exposes 3001 + 3002 |
| **.dockerignore** | Excludes node_modules, .git, logs, docs, deploy/, IDE files, .env |
| **CI (GitHub Actions)** | `.github/workflows/ci.yml`: build + typecheck api-server and liquidity-hunter, Docker build validation. Runs on push/PR to main. |
| **TypeScript** | Zero errors across both packages (all 27 pre-existing errors resolved) |

### Database Layer
`lib/db/src/schema/`

- **trades** — 31 columns, jsonb for analysis_context/parameter_snapshot/outcome, 5 indexes
- **performanceMatrix** — 19 columns, 7-dimension unique index, 3 indexes
- Drizzle ORM with PostgreSQL, lazy-init pool (no crash when DATABASE_URL is unset)

### External Integrations

| Service | Type | Key Required? |
|---|---|---|
| Binance US | Crypto data (REST + WebSocket) | No |
| Yahoo Finance | Forex data (REST) | No |
| Finnhub | Forex data (WebSocket) | Yes (optional — falls back to Yahoo) |
| Fireworks AI | LLM inference (DeepSeek V4 Pro) | Yes (FIREWORKS_API_KEY) |
| Alpaca Markets | Paper trading execution | Yes (ALPACA_API_KEY_ID + SECRET) |

---

## What We Added (Sessions Jul 7)

All of these were built or fixed in our sessions:

### New features
| Feature | Details |
|---|---|
| **AlpacaAdapter** | Full BrokerAdapter implementation for Alpaca Paper API — symbol translation, market orders, account queries, 14→4 status mapping |
| **Broker page** | Frontend dashboard at `/broker` — connection status, mode switching with confirmation dialog, account overview, open orders table, execution log |
| **Broker API endpoints** | `POST /api/broker/mode` (with LIVE confirmation guard), `GET /api/broker/status` |
| **Gemma 4 switch** | Changed AMD deployment default from Qwen2.5-VL-7B to Gemma 4 26B A4B across .env.amd, docker-compose.yml, provider.ts, README |
| **Docker hardening** | Non-root user, healthcheck via Node http module, EXPOSE 3002, .dockerignore |
| **CI pipeline** | GitHub Actions: typecheck → build → Docker validation on push/PR |
| **CORS wiring** | CORS_ORIGINS env var now actually read by app.ts — comma-separated allowlist with `*` wildcard default |
| **LLM_TOOL_PARSER env var** | vLLM parser flags are now env-var-driven instead of hardcoded — supports gemma4, hermes, mistral, llama3_json, pythonic |

### Bug fixes
| Bug | Fix |
|---|---|
| **Side derivation** | `entry_price > 0` always true → `take_profit > entry_price ? BUY : SELL` |
| **Silent mode switching** | `/signals/execute` no longer accepts `mode` in body — prevents any caller from flipping server to LIVE |
| **Alpaca side casing** | "BUY"/"SELL" → "buy"/"sell" (Alpaca requires lowercase) |
| **Fire-and-forget switch** | `confirmLiveSwitch` now properly awaits `switchMode` |
| **JSON parse robustness** | Read response as text before parsing — clear error messages instead of "Unexpected end" |
| **Dead COOKIE_SECRET** | Removed from docker-compose.yml, .env.amd, and README — no session middleware exists |
| **LLM_PROVIDER hardcoded** | Changed from bare literal `amd` to `${LLM_PROVIDER:-amd}` — overridable via .env |
| **Healthcheck paths** | Fixed `/health` → `/api/healthz` in docker-compose.yml, setup.sh, README |
| **Archive integrity** | Archived old README correctly, but flagged that it captured the intermediate Gemma 4 state, not the true Qwen original |

### Code quality
| Metric | Before | After |
|---|---|---|
| TypeScript errors (api-server) | 27 | 0 |
| TypeScript errors (liquidity-hunter) | pre-existing | 0 |
| Duplicated model name defaults | 5 locations | Consolidated with sync comments |
| Hardcoded config values | 3 (parsers, provider, model) | 0 (all env-var-driven) |

---

## What Does NOT Exist Yet (Aspirational Gaps)

### From AMD_INFRASTRUCTURE.md
| Feature | Status |
|---|---|
| Vision-Language Chart Analysis (Qwen2.5-VL) | **Not built** — no `lib/ml/`, no `/api/vision/analyze`, no chart screenshot pipeline |
| LoRA fine-tuning pipeline | **Not built** — no `export-training-data.ts`, no `fine-tune/train.py` |
| Dual-model vLLM config (VL + agent model concurrently) | **Not built** — docker-compose runs single model |
| MCP tool for chart image analysis | **Not built** |

### Other known gaps
| Feature | Status |
|---|---|
| End-to-end AMD MI300X deployment | **Not tested** — docker compose validated but never run on real MI300X hardware |
| Live (real-money) Alpaca trading | **Deliberately excluded** — PAPER_BASE hardcoded, no path to live endpoint |
| Multi-broker support (beyond Alpaca) | **Not built** — BrokerAdapter interface exists, only Mock + Alpaca implemented |
| Forex execution through Alpaca | **Deliberately rejected** — Alpaca doesn't support forex, adapter returns clean error |
| Database required for trading | **Optional** — MockBrokerAdapter works without PostgreSQL, AlpacaAdapter is stateless |

---

## Verification Status (End-to-End)

| What | Verified? | How |
|---|---|---|
| TypeScript compilation | ✓ | `tsc --noEmit` passes for both packages |
| API endpoints | ✓ | All 18 endpoints return correct JSON (curl tested) |
| Alpaca paper API | ✓ | Full round-trip: place order → getOrderStatus (FILLED) → getOpenOrders → closeOrder (correctly rejected) |
| Broker page mode switch | ✓ | REVIEW→LIVE with confirmation dialog, LIVE→REVIEW immediate |
| Docker build | ✓ | `docker build` succeeds, healthcheck verified in image inspect |
| Docker Compose config | ✓ | `docker compose config` parses without errors |
| CI workflow | ✓ | Push succeeded (workflow scope needed for .github/workflows/) |
| AMD MI300X deployment | ✗ | Validated config only — never run on real GPU hardware |
