# SMC Pulse Predict — Full Capabilities Report

**Date:** July 18, 2026
**Scope:** What the app could do at the start of our sessions vs. what it can do now, plus aspirational gaps

---

## Before: Baseline (Pre-Sessions, Jun 5–23)

The app was a stock/forex dashboard on Replit. It had:

- **SMC Analysis Engine** — structure, liquidity, order blocks, FVG detection
- **Multi-TF Dashboard** — symbol picker, trading style selector, TF agent cards
- **Basic Chart** — Lightweight Charts v4 with candlestick rendering
- **Auto-refresh** — countdown ring with manual refresh trigger
- **No AI, no real-time data, no trading, no Docker, no database, no CI, no strategies, no TV integration, no narrative, no reasoning**

---

## After: Current Capabilities (Jul 18, 2026)

### SMC/ICT Analysis Engine (8 modules)
`artifacts/api-server/src/lib/smc/`

| Module | What it does |
|---|---|
| `structure.ts` | Pivot detection (ATR-normalized, NASOS loop), BOS/CHoCH classification, market phase inference (accumulation/manipulation/expansion/distribution/continuation) |
| `liquidity.ts` | BSL/SSL/EQH/EQL pool scanning with sweep probability scoring, nearest pool identification |
| `order-blocks.ts` | OB detection, breaker blocks, 6-factor confidence scoring (MSS proximity, FVG overlap, volume profile, displacement ratio, penetration, efficiency) |
| `fvg.ts` | Fair Value Gap detection with fill-fraction tracking and inversion mechanics |
| `pd-array.ts` | Premium/Discount/Equilibrium zones, dealing range HL/equilibrium, current bias |
| `daily-bias.ts` | HTF 1D structure-primary bias with SMA(20) fallback, consecutive-day counting |
| `smt.ts` | SMT divergence between correlated pairs with magnitude + timing scoring |
| `report.ts` | Orchestrator — assembles all modules, cross-module adjustments, HTF bias → OB confidence, confluence-boosted draw targets, session state, market narrative |

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
- **TV Desktop CDP fallback** — reads candles directly from chart via `chrome-remote-interface` when API is down
- **Candle Store** — in-memory ring buffer, persistent across WS reconnects

### Strategy Evaluation System (NEW — Jul 18)
`lib/api-zod/src/strategies/` — 96 vitest tests

| Layer | What it does |
|---|---|
| **14 Predicates** | Pure functions (`hasBias`, `hasOrderBlock`, `hasFVG`, `hasMarketStructureShift`, `hasInducementZone`, `priceWithinOTEzone`, `hasConsolidationZone`, `isWithinSession`, `hasSMTConfirmation`, `hasHighImpactNewsWithin`, `isNewsBlackoutWindow`, etc.) each returning `{ matched, evidence, score? }` |
| **Rule Tree** | Recursive discriminated union — `predicate` / `and` / `or` / `not`. Zod-validated. |
| **StrategyEvaluator** | Walks a Rule tree against `Map<string, SmcReport>` via predicate function registry |
| **StrategyRegistry** | Auto-loads 41 templates, supports `register()`/`unregister()`, `detectAll(reports)` → ranked `DetectionResult[]` |
| **41 Templates** | Classical Horizon (12), Charter Blueprint (12), Modern Confluence (5), Market Maker Cycles (2), Temporal & Reversal (10) |

**API routes:**
- `GET /api/strategies` — list registered strategies (41 loaded)
- `POST /api/strategies/detect` — multi-TF detection, ranked by match status + score
- `POST /api/strategies/detect?reason=true` — + deterministic narrative + LLM reasoning assessment

### Narrative Generator (NEW — Jul 18)
`artifacts/api-server/src/lib/narrative/generate-narrative.ts` — 33 tests

- **Deterministic** — no LLM call, pure template instantiation
- **5-paragraph output:** Market direction → Session context → Liquidity direction → Key levels → Strategy overlay
- Powered by `StrategyDetectionSummary[]` + `Map<string, SmcReport>`

### Reasoning Agent (NEW — Jul 18)
`artifacts/api-server/src/lib/agents/reasoning-agent.ts` — 14 tests

- **Adversarial prompt:** summarise setup → identify 2–3 failure modes → weigh bull/bear → output calibrated 0–100 score
- **Zod-validated** `{ reasoning, confidenceScore }` output via `extractStructured()`
- **Risk-aware:** accepts `RiskParams` (maxRiskPerTrade, minRR, riskTolerance, executionMode)
- **DI-ready:** optional `llmFn` parameter for testing (no real API calls in tests)

### Economic Calendar & External Intel (NEW — Jul 18)
`artifacts/api-server/src/lib/external-intel/`

| Component | What it does |
|---|---|
| `refresh-job.ts` | 3-step pipeline: Firecrawl scrape ForexFactory → ScrapeGraphAI LLM extraction → Drizzle upsert into `economic_events` (unique on `time, currency, event`) |
| `GET /api/external-intel/refresh` | Manual trigger route |

**New DB table:** `economic_events` (time, currency, event, impact, forecast, previous, actual, refreshedAt)

**New predicates:** `hasHighImpactNewsWithin`, `isNewsBlackoutWindow` — check for upcoming high-impact events and blackout windows. Commented into Silver Bullet templates (TODO until evaluator can inject DB events).

### AI Agent System
`artifacts/api-server/src/lib/llm/provider.ts` + `artifacts/api-server/src/routes/agents*.ts`

| Endpoint | Capability |
|---|---|
| `POST /api/agents/ask` | Streaming Q&A with full SMC report context (SSE) |
| `POST /api/agents/pipeline` | 4-agent sequential pipeline: Structure → Liquidity → FVG → Confluence |
| `POST /api/agents/ask-mcp` | MCP-aware agent with autonomous tool calling (37+ tools) |

**LLM Providers (6):**

| Provider | Default Model | Auth | Env Var |
|---|---|---|---|
| **Fireworks** (default) | `deepseek-v4-pro` | API key | `FIREWORKS_API_KEY` |
| **OpenAI** | `gpt-4o` | API key | `OPENAI_API_KEY` |
| **Custom** | configurable | API key | `LLM_API_KEY` |
| **AMD vLLM** | `gemma-4-26B-A4B-it` | None | `LLM_BASE_URL` |
| **Ollama** | `llama-3.1-8b` | None | — |
| **Groq** | `llama3-70b-8192` | API key | `GROQ_API_KEY` |

**Cost tracking:** 19 model pricings in `MODEL_COST_MAP`, Langfuse observability on all calls, fallback cost for unknown models.

### Agent Loop Engine
`artifacts/api-server/src/lib/loop/`

A fully autonomous **Observe→Interpret→Reason→Decide→Act→Evaluate→Update** cycle:

| Step | Action |
|---|---|
| 1. **Observe** | Store SmcReport in LoopContext, check guardrails |
| 2. **Interpret** | Call 8 SMC tools via toolRegistry (structure, liquidity, OB, FVG, PD, bias, SMT, draw) |
| 3. **Reason** | Build prompt from interpreted data + memory + TV reconciliation, call LLM |
| 4. **Decide** | Validate Decision through AgentGuardrails (confidence ≥60, risk limits, confluence ≥3) |
| 5. **Act** | Generate signal via SignalGenerator, log to ledger |
| 6. **Evaluate** | Score run via LoopEvaluator (LLM-as-Judge) |
| 7. **Update** | Persist trace to DB via LoopTracer, store memory entries |

**Background monitoring:** `MonitoringManager` — runs loop on every candle close for registered symbols/timeframes.

**Endpoints (10):** run, start/stop-monitoring, status, runs, runs/:id, evaluate, memory CRUD, tv-status/connect/sync.

### Memory & Learning Systems
`artifacts/api-server/src/lib/memory/`

| Tier | Storage | Scope | Key Operation |
|---|---|---|---|
| **Episodic** | TradeLedgerService (DB) | Past signals and outcomes | `findSimilarSetups()` |
| **Semantic** | `agent_memory` table (DB) | Patterns and procedural rules | `store()`, `query()` |
| **Vector** | Qdrant (external) | Similar setup search | `storeSignal()`, `findSimilar()` |

### Comparison Engine & Learning Framework

| Component | What it does |
|---|---|
| **ComparisonEngine** | Extracts detections from SMC reports and TV Desktop Pine indicator levels, compares both, calculates agreement metrics |
| **TruthEngine** | Arbitrates when TV and Engine disagree — determines which source is more reliable per detection type |
| **OutcomeEvaluator** | Evaluates forward outcomes — did price respect, sweep, or ignore each detection? |
| **ReliabilityEngine** | Accumulates per-source, per-type reliability scores over time |
| **Prompt Optimizer** | DSPy-equivalent — optimizes LLM prompt templates based on outcome data |
| **Reflection Engine** | Self-critical analysis of past agent decisions |

**Learning endpoints (8):** comparisons, read-tv-indicator-levels, analyze, evaluate-outcomes, arbitrate, reliability, parameter-suggestions, events, patterns.

### MCP (Model Context Protocol) Server
`artifacts/api-server/src/lib/mcp/`

| Category | Detail |
|---|---|
| **Tools** | 11 SMC analysis tools + 11 legacy TV tools + 10 MCP agent tools = 32 |
| **Desktop Tools** | **104+** via `registerAllDesktopTools` (chart, drawing, data, alerts, indicators, pane, replay, tabs, UI, Pine, capture, watchlist, health) |
| **Resources** | `smc://candles/{market}/{symbol}/{timeframe}`, `smc://status` |
| **Prompts** | `smc-analysis` (6-step structured ICT/SMC workflow) |
| **Server** | FastMCP v4.3.2 on port 3002 (HTTP Stream transport) |

### Trading & Execution Layer
`artifacts/api-server/src/lib/execution/` + `services/`

| Component | Capability |
|---|---|
| **SignalGenerator** (561 lines) | SmcReport → UnifiedTradeSignal, single-TF + multi-TF cascade |
| **TradeLedgerService** (188 lines) | CRUD for signals via Drizzle ORM in PostgreSQL |
| **PerformanceMatrixService** (331 lines) | Sharpe, win rate, profit factor, max drawdown per 7-dimension combination |
| **BrokerAdapter interface** | Abstract broker with isReady, executeOrder, getBalance, getOpenOrders, closeOrder, getOrderStatus |
| **MockBrokerAdapter** | File-based .jsonl ledger for development |
| **AlpacaAdapter** (321 lines) | Real paper trading via Alpaca Markets API — symbol translation (BTCUSDT→BTC/USD), market orders, account queries, 14→4 status mapping |
| **ExecutionManager** | REVIEW/LIVE mode toggle, broker-agnostic signal execution |
| **deriveSide()** | Shared helper: take_profit > entry_price → BUY, else SELL |
| **BacktestRunner** (294 lines) | Real SMC engine on sliding windows across 5 timeframes × 3 assets |

### TradingView Desktop Integration

**Two integration paths coexist:**

| Aspect | `tradingview/` (Legacy) | `tradingview-desktop/` (Current) |
|---|---|---|
| Tools | ~11 | **104+** |
| Connection | Puppeteer → CDP | `chrome-remote-interface` → CDP |
| API | `window.tvWidget` | `_exposed_chartWidgetCollection` |
| Drawing | Canvas click (unreliable) | `ChartApiInstance.createStudy()` |
| Launch | `puppeteer.launch()` | CDP to existing desktop MSIX |

**Desktop Tools by Category (104+):**

| Category | Count | Examples |
|---|---|---|
| Chart | ~8 | get state, set symbol, set timeframe, visible range, scroll, symbol info/search |
| Drawing | ~5 | create shape, list, get properties, remove, clear all |
| Data | ~8 | OHLCV bars, quote, depth, indicator values, Pine lines/labels/boxes, strategy results |
| Alerts | ~3 | create, list, delete |
| Indicators | ~3 | add, remove, get |
| Pane | ~4 | get/set layout, focus, set symbol |
| Replay | ~8 | start, stop, autoplay, step, trade (buy/sell/close) |
| Tabs | ~3 | get, switch, close |
| UI | ~15 | click, mouse click, keyboard, type text, hover, scroll, find element, open panel, fullscreen |
| Pine | ~8 | get/set source, compile, publish, library, info, templates |
| Capture | ~1 | screenshot |
| Watchlist | ~3 | get, add, remove |
| Health | ~3 | ping, connect |

**MSIX Launch Fix (Windows):**
```powershell
Start-Process "shell:AppsFolder\31178TradingViewInc.TradingView_q4jpyh43s5mv6!TradingView.Desktop" `
  -ArgumentList "--remote-debugging-port=9222"
```

### Database Layer (13 tables)
`lib/db/src/schema/`

| Table | Schema | Purpose | Unique Key |
|---|---|---|---|
| `trades` | `learning.ts` | Trade ledger (31 cols, 5 indexes) | — |
| `performance_matrix` | `learning.ts` | Pre-computed metrics (19 cols) | 7-dimension combo |
| `detection_comparisons` | `learning.ts` | TV vs Engine detection records | — |
| `detection_outcomes` | `learning.ts` | Forward-outcome evaluation | — |
| `model_performance` | `learning.ts` | Per-source reliability | (source, detection_type) |
| `parameter_history` | `learning.ts` | Parameter optimization history | — |
| `learning_events` | `learning.ts` | Learning observations | — |
| `pattern_statistics` | `learning.ts` | Pattern analysis | — |
| `agent_loop_runs` | `learning.ts` | Loop run history | — |
| `agent_loop_steps` | `learning.ts` | Step-level traces | — |
| `agent_memory` | `learning.ts` | Semantic knowledge | memory_key |
| `model_definitions` | **`model-definitions.ts` (NEW)** | 41 ICT/SMC model catalog | id (text PK) |
| `economic_events` | **`economic-events.ts` (NEW)** | Economic calendar | (time, currency, event) |

### Seed Data
`lib/db/seeds/model-definitions.ts` — 41 ICT/SMC model definitions across 5 categories:
- **Classical Horizon (2019):** 12 models — intraday scalping through core scalping
- **Charter Blueprint:** 12 models — pedagogical series, market structure through IPDA
- **Modern Confluence:** 5 models — HTF+BOS+FVG through Five Box
- **Market Maker Cycles:** 2 models — MMSM (sell), MMBM (buy)
- **Temporal & Reversal:** 10 models — Silver Bullet ×3, Judas Swing, PO3, Turtle Soup, Unicorn, SCOB, Sharp Turn, 2 FVG

Run: `DATABASE_URL="..." pnpm --filter @workspace/db run seed:models` (idempotent)

### API Endpoints (60+)

#### Analysis
| Method | Path | Description | Cache |
|---|---|---|---|
| GET | `/api/healthz` | Health check | No |
| GET | `/api/symbols` | Supported symbols (10 crypto, 10 forex) | No |
| GET | `/api/analysis/crypto` | Full SMC report (crypto) | 60s |
| GET | `/api/analysis/forex` | Full SMC report (forex) | 60s |
| POST | `/api/analysis/from-bars` | SMC from external bars | 60s |
| GET | `/api/analysis/from-tv` | SMC from TV Desktop bars | 60s |

#### AI Agents
| Method | Path | Description |
|---|---|---|
| POST | `/api/agents/ask` | AI Q&A via LLM (SSE) |
| POST | `/api/agents/pipeline` | 4-agent pipeline (SSE) |
| POST | `/api/agents/ask-mcp` | MCP tool-calling agent (SSE, 37+ tools) |

#### Strategy Evaluation (NEW)
| Method | Path | Description |
|---|---|---|
| GET | `/api/strategies` | List registered strategies (41) |
| POST | `/api/strategies/detect` | Multi-TF detection |
| POST | `/api/strategies/detect?reason=true` | + narrative + reasoning |

#### Agent Loop
| Method | Path | Description |
|---|---|---|
| POST | `/api/agent-loop/run` | One-shot loop cycle (SSE) |
| POST | `/api/agent-loop/start-monitoring` | Background candle-close monitor |
| POST | `/api/agent-loop/stop-monitoring` | Stop monitor |
| GET | `/api/agent-loop/status` | Active monitors |
| GET | `/api/agent-loop/runs` | Historical runs |
| GET | `/api/agent-loop/runs/:id` | Detailed trace |
| POST | `/api/agent-loop/runs/:id/evaluate` | Trigger evaluation |
| GET | `/api/agent-loop/memory` | Semantic memory query |
| POST | `/api/agent-loop/memory` | Store memory entry |
| DELETE | `/api/agent-loop/memory/:id` | Delete memory |

#### Learning
| Method | Path | Description |
|---|---|---|
| GET | `/api/learning/comparisons` | Detection comparisons |
| GET | `/api/learning/read-tv-indicator-levels` | Read Pine levels from TV |
| GET | `/api/learning/comparisons/analyze` | Run comparison analysis |
| GET | `/api/learning/evaluate-outcomes` | Evaluate outcomes |
| GET | `/api/learning/arbitrate` | Truth Engine arbitration |
| GET | `/api/learning/reliability` | Reliability reports |
| GET | `/api/learning/parameter-suggestions` | Parameter recommendations |
| GET | `/api/learning/events` | Learning events |
| GET | `/api/learning/patterns` | Pattern statistics |

#### Real-Time
| Method | Path | Description |
|---|---|---|
| GET | `/api/stream/:symbol` | SSE real-time stream |
| GET | `/api/stream/status` | Stream health |

#### Ledger & Broker
| Method | Path | Description |
|---|---|---|
| GET | `/api/ledger` | Trade history |
| POST | `/api/signals/generate` | Generate signals |
| POST | `/api/signals/execute` | Execute signal |
| GET | `/api/broker/status` | Broker status |
| POST | `/api/broker/mode` | Set REVIEW/LIVE mode |
| GET | `/api/account` | Account balance |
| POST | `/api/backtest/run` | Run backtest |

#### External Intelligence (NEW)
| Method | Path | Description |
|---|---|---|
| GET | `/api/external-intel/refresh` | Trigger economic calendar refresh |

### Frontend — 5 Pages
`artifacts/liquidity-hunter/src/`

| Page | Route | Content |
|---|---|---|
| **Dashboard** | `/` | Multi-TF SMC analysis, **strategy detection (41 models)**, cascade flow, TF agent cards, confidence bars, draw targets, live price badge, real-time WebSocket, AI agent chat, visual chart, **OS Output Panel (narrative + reasoning)**, **Execute Now button**, **Economic Calendar refresh button (CAL)** |
| **Analytics** | `/analytics` | Trade ledger table, performance metrics, setup rankings |
| **Broker** | `/broker` | Connection status, mode toggle, account overview, orders |
| **Agent Loop** | `/agent-loop` | Loop runner, monitor manager, run history, memory viewer |
| **Not Found** | `*` | 404 page |

**Key components (new in bold):**
- ConfluenceCard → **StrategySection (primary name/score + Execute Now + alternatives)**
- **OSOutputPanel** — collapsible narrative + reasoning display with confidence score badges
- IntelligenceSheet → **strategy context badge** + OSOutputPanel
- ConfluenceSheet, ChartView, AgentChat, AgentPipeline, TradeActions
- MarketBriefing, TvStatus, TvCardControl
- AgentLoopDashboard, BacktestRunnerUI, CandlestickChart/MarketIntelligence
- 58 shadcn/ui primitives

**State management:** No global store — `useState` + TanStack Query + `useCascadeStrategy` hook.

### LLM Provider Comparison

| Provider | Default Model | Input Cost/1M | Output Cost/1M | Best For |
|---|---|---|---|---|
| Fireworks | deepseek-v4-pro | $1.20 | $4.80 | Default — fast, cheap |
| OpenAI | gpt-4o | $2.50 | $10.00 | GPT-4 quality |
| OpenAI | gpt-4o-mini | $0.15 | $0.60 | Cheap fast path |
| Groq | llama3-70b-8192 | $0.59 | $0.79 | Fast inference |
| Groq | mixtral-8x7b-32768 | $0.24 | $0.24 | Budget |
| AMD vLLM | gemma-4-26B-A4B-it | $0 | $0 | Self-hosted (MI300X) |
| Ollama | llama-3.1-8b | $0 | $0 | Local CPU inference |

### Local CPU Deployment
`deploy/local/`

| Component | Detail |
|---|---|
| **docker-compose.yml** | API server + PostgreSQL + nginx frontend + Qdrant + Ollama — no GPU required |
| **.env.example** | Fireworks AI defaults, optional OpenAI/Custom/Groq/AMD/vLLM/Ollama providers |
| **README.md** | Setup guide, resource estimates, provider switching, troubleshooting |

### AMD Developer Cloud Deployment
`deploy/amd-developer-cloud/`

| Component | Detail |
|---|---|
| **docker-compose.yml** | Co-located vLLM (ROCm/MI300X) + API server + PostgreSQL + frontend |
| **setup.sh** | One-time VM provisioning (Docker, ROCm, vLLM image pull) |
| **.env.amd** | All configurable values (LLM_MODEL, VLLM_*, Alpaca keys, etc.) |
| **Default model** | Google Gemma 4 26B A4B (MoE, ~58 GB, single MI300X) |

### Deployment Blueprints (NEW — Jul 18)

| Platform | File | Database | Notes |
|---|---|---|---|
| **Railway** | `railway.json` | Railway Postgres or Supabase | Auto-detected, health-checked |
| **Render** | `render.yaml` | Managed PostgreSQL 16 | Blueprint with sync:false secrets |
| **Supabase** | `MIGRATION.md` | Supabase PostgreSQL | Compatible with existing Drizzle setup |

### DevOps & Infrastructure

| Component | Detail |
|---|---|
| **Dockerfile** | Multi-stage (builder → runner → frontend), node:22-alpine, non-root user, healthchecks |
| **.dockerignore** | Excludes node_modules, .git, logs, docs, deploy/, IDE files |
| **CI (GitHub Actions)** | `.github/workflows/ci.yml` — typecheck + build + Docker on push/PR to main |
| **TypeScript** | Libs pass `tsc -b`, frontend passes `tsc --noEmit`, server passes except 3 pre-existing `analysis.ts` volume-optional errors |

### Test Coverage

| Package | Runner | Tests | Files |
|---|---|---|---|
| `lib/api-zod` (predicates) | vitest | 96 | 1 |
| `lib/api-zod` (evaluator) | vitest | 12 | 1 |
| `lib/api-zod` (registry) | vitest | 16 | 1 |
| `api-server` (narrative) | tsx | 33 | 1 |
| `api-server` (reasoning agent) | tsx | 14 | 1 |
| `api-server` (Groq provider) | tsx | 21 | 1 |
| `api-server` (legacy SMC) | tsx | ~150 | 7 |
| **Total** | | **~342** | **13** |

### Documentation (NEW — Jul 18)

| Document | Lines | Purpose |
|---|---|---|
| `CLAUDE.md` | 145 | Codebase guide — auto-read by Claude Code in future sessions |
| `docs/COMPLETE_ARCHITECTURE_REPORT.md` | 1,157 | Full system audit (21 sections, 32-term glossary) |
| `docs/CAPABILITIES_REPORT.md` | (this file) | Before/after capability comparison |
| `MIGRATION.md` | ~100 | Supabase migration checklist |
| `.obsidian/` | 4 config files | Obsidian vault (dataview, tasks, excalidraw, mermaid, kanban, git) |
| `knowledge-vault/` (memory) | 4 files | Strategy evaluation, Groq, DB schemas, deployment |

---

## What We Added (Sessions Jun 23 – Jul 18)

### Phase 1: Real-Time + AI (Jul 7)
| Feature | Details |
|---|---|
| **AlpacaAdapter** | Full BrokerAdapter for Alpaca Paper API — symbol translation, market orders, account queries, 14→4 status mapping |
| **Broker page** | Frontend `/broker` — connection status, mode toggle with LIVE confirmation dialog, account overview, orders table |
| **Gemma 4 switch** | AMD deployment default from Qwen2.5-VL-7B to Gemma 4 26B A4B |
| **Docker hardening** | Non-root user, healthchecks, .dockerignore, EXPOSE 3002 |
| **CI pipeline** | GitHub Actions: typecheck → build → Docker |
| **Bug fixes** | Side derivation, mode switching, Alpaca casing, JSON parse, COOKIE_SECRET removed, healthcheck paths |
| **TypeScript** | 27→0 errors resolved |

### Phase 2: Agent Loop + Memory + TV Desktop (Jul 14)
| Feature | Details |
|---|---|
| **Agent Loop Engine** | Full Observe→Interpret→Reason→Decide→Act→Evaluate→Update cycle with monitoring |
| **Memory Systems** | Episodic (TradeLedger) + Semantic (agent_memory) + Vector (Qdrant) |
| **TradingView Desktop** | 70+ tools via CDP (chart, data, drawing, alerts, indicators, replay, tabs, UI clicking, Pine, capture) |
| **Comparison Engine** | Read LuxAlgo/Pine levels from TV, compare vs SMC engine, reliability scoring |
| **Truth Engine** | Arbitration when TV and Engine disagree |
| **Outcome Evaluation** | Forward-outcome evaluation per detection type |
| **10 MCP Agent Tools** | tv_chart_set_symbol, tv_ui_click, tv_data_get_quote, etc. |
| **Reflection Engine** | Self-critical analysis of past decisions |
| **Prompt Optimizer** | DSPy-equivalent prompt optimization |
| **Agent System Prompts** | TV-aware + capability-aware (agents know what they can do) |

### Phase 3: Strategy Evaluation + Narrative + Deployment (Jul 18)
| Feature | Details |
|---|---|
| **14 Predicate Functions** | Pure SMC condition evaluators with 96 vitest tests |
| **41 Model Templates** | Classical, Charter, Modern Confluence, MMXM, Temporal/Reversal |
| **Rule Engine** | Recursive AND/OR/NOT rule trees, Zod-validated |
| **StrategyEvaluator** | Walks rule trees against multi-TF reports |
| **StrategyRegistry** | Auto-loads 41 templates, `detectAll()` → ranked results |
| **Narrative Generator** | Deterministic 5-paragraph market commentary (33 tests) |
| **Reasoning Agent** | Adversarial LLM evaluation (14 tests, mocked LLM) |
| **Economic Calendar** | Firecrawl + ScrapeGraphAI pipeline, Drizzle upsert |
| **Groq Provider** | 6th LLM provider (fast inference) |
| **DB Schemas** | `model_definitions` + `economic_events` tables, migrations |
| **DB Seed** | 41 ICT/SMC models, idempotent upsert |
| **Deployment Blueprints** | Railway + Render + Supabase |
| **CLAUDE.md** | 145-line codebase guide |
| **Architecture Report** | 1,157-line full system audit |
| **Obsidian Vault** | Integrated knowledge management (dataview, tasks) |
| **Frontend** | Strategy display (ConfluenceCard), OS Output Panel, Execute Now, CAL button |

### Bug fixes & Quality
| Fix | Details |
|---|---|
| **CDP port matching** | Changed `.includes("tradingview")` → `.includes("tradingview.com")` (MSIX path contained "TradingView.Desktop_") |
| **Health check** | Changed `document.title` evaluate → `_browser.connected` (CSP blocks evaluate on Electron TV) |
| **Goto strategy** | Changed `networkidle2` → `domcontentloaded` (live WS data keeps network active indefinitely) |
| **analysis.ts** | 3 remaining `volume?: number` vs `volume: number` type errors (pre-existing) |
| **pnpm-lock** | Dependencies from this session pending lockfile commit |

---

## What Does NOT Exist Yet (Aspirational Gaps)

### From AMD_INFRASTRUCTURE.md
| Feature | Status |
|---|---|
| Vision-Language Chart Analysis (Qwen2.5-VL) | **Not built** — no `lib/ml/`, no `/api/vision/analyze`, no chart screenshot pipeline |
| LoRA fine-tuning pipeline | **Not built** — no `export-training-data.ts`, no `fine-tune/train.py` |
| Dual-model vLLM config (VL + agent model concurrently) | **Not built** — docker-compose runs single model |
| MCP tool for chart image analysis | **Not built** |

### Unimplemented Predicates (7)
These predicates are referenced by the seed data but no function exists yet:
| Predicate | Used By | Substitute |
|---|---|---|
| `hasDisplacement` | classical-01, -05, -12, charter-02, temporal-*, framework-2fvg | — |
| `hasLiquiditySweep` | classical-01, -03, -06, -07, -09, -10, mmxm-*, temporal-* | `hasLiquidityPool` (partial proxy) |
| `hasBreakerBlock` | reversal-unicorn | — |
| `hasSessionAlignment` | classical-01, -05, -11, charter-07, temporal-judas | `isWithinSession` (partial proxy) |
| `hasRangeExpansion` | classical-05, -08, -10, -11, charter-06, -11 | — |
| `hasWeeklyExpansionContext` | classical-08, charter-06 | — |
| `hasEqualHighsLows` | classical-04? (not in seed), modern-confluence-5 | `hasConsolidationZone` (partial proxy) |

### Other known gaps
| Feature | Status |
|---|---|
| End-to-end AMD MI300X deployment | **Not tested** — docker compose validated but never run on real MI300X |
| Live (real-money) Alpaca trading | **Deliberately excluded** — PAPER_BASE hardcoded, no path to live endpoint |
| Multi-broker support | **Not built** — BrokerAdapter interface exists, only Mock + Alpaca |
| Economic events wired into evaluator | **Not wired** — templates have TODO comment, predicates exist |
| HTTP integration tests for strategies route | **Not built** — tested manually only |
| `.env` committed with API keys | **Security risk** — needs rotation and `.gitignore` |

---

## Verification Status (End-to-End)

| What | Verified? | How |
|---|---|---|
| TypeScript compilation (libs) | ✓ | `tsc -b` passes |
| TypeScript compilation (api-server) | ✓ | 3 pre-existing analysis.ts errors only |
| TypeScript compilation (frontend) | ✓ | `tsc --noEmit` passes |
| vitest tests (96) | ✓ | 3 files, all pass |
| Narrative tests (33) | ✓ | Bullish, bearish, neutral, empty map |
| Reasoning agent tests (14) | ✓ | Mocked LLM, all pass |
| Groq provider tests (21) | ✓ | Config selection, key fallback, env overrides |
| API endpoints | ✓ | All 60+ routes respond (live system check) |
| Strategy detection | ✓ | 41 loaded, 6 matched on BTCUSDT 4h |
| TV Desktop CDP | ✓ | `shell:AppsFolder` launch, port 9222 responding (Chrome/140) |
| Frontend | ✓ | HTTP 200, full SPA served (Vite) |
| Docker build | ✓ | `docker build` succeeds |
| Docker Compose config | ✓ | `docker compose config` parses |
| CI workflow | ✓ | GitHub Actions push succeeded |
| AMD MI300X deployment | ✗ | Validated config only — never run on real GPU hardware |
| `.env` API key exposure | ✗ | Keys committed — needs rotation |

---

*Generated 2026-07-18. For the latest version, consult `docs/archive/CAPABILITIES_REPORT.md` for the Jul 7 baseline or the Obsidian vault at `.obsidian/`.*
