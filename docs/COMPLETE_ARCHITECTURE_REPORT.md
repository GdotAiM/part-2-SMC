# SMC Pulse Predict — Complete Architecture Report

**Principal Software Architect's System Audit & Reverse Engineering**

| Attribute | Value |
|---|---|
| **Repository** | `part-2-SMC` |
| **Generated** | 2026-07-18 |
| **Package Manager** | pnpm (workspace monorepo) |
| **Runtime** | Node.js 22+, Express 5, React 19 |
| **Language** | TypeScript (strict) — esbuild-bundled server, Vite-bundled frontend |
| **Database** | PostgreSQL 16 via Drizzle ORM |
| **LLM Provider** | Multi-provider: Fireworks AI (default), OpenAI, Groq, AMD vLLM, Ollama |
| **TradingView** | CDP integration (104+ tools via chrome-remote-interface) |
| **Test Framework** | vitest (api-zod: 96 tests), hand-rolled assertions (api-server: ~200 tests) |
| **CI/CD** | GitHub Actions (typecheck → build → Docker), Railway/Render blueprints |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Comparison: Before vs. After](#2-comparison-before-vs-after)
3. [Repository Structure & Module Map](#3-repository-structure--module-map)
4. [Monorepo Package Map](#4-monorepo-package-map)
5. [Stack & Dependencies](#5-stack--dependencies)
6. [SMC/ICT Analysis Engine](#6-smcict-analysis-engine)
7. [Strategy Evaluation System](#7-strategy-evaluation-system)
8. [Backend Architecture](#8-backend-architecture)
9. [Frontend Architecture](#9-frontend-architecture)
10. [AI & LLM Pipeline](#10-ai--llm-pipeline)
11. [Agent Loop Engine](#11-agent-loop-engine)
12. [Real-Time Data Pipeline](#12-real-time-data-pipeline)
13. [TradingView Desktop Integration](#13-tradingview-desktop-integration)
14. [Memory & Learning Systems](#14-memory--learning-systems)
15. [Database Schema (Drizzle ORM)](#15-database-schema-drizzle-orm)
16. [Narrative Generator & Reasoning Agent](#16-narrative-generator--reasoning-agent)
17. [External Intelligence & Economic Calendar](#17-external-intelligence--economic-calendar)
18. [Deployment & Infrastructure](#18-deployment--infrastructure)
19. [API Endpoint Reference](#19-api-endpoint-reference)
20. [Technical Debt & Risk Assessment](#20-technical-debt--risk-assessment)
21. [Glossary](#21-glossary)

---

## 1. Executive Summary

SMC Pulse Predict is an **AI Trading Operating System** that applies ICT (Inner Circle Trader) / SMC (Smart Money Concepts) methodology to live market data. It runs as a pnpm monorepo with 5 backend artifacts, 3 shared libraries, and 2 deployment targets.

The system ingests OHLCV data from Binance (crypto) and Yahoo Finance (forex), runs an 8-module SMC analysis engine to detect institutional price patterns (liquidity pools, order blocks, fair value gaps, market structure shifts, SMT divergence), and presents results through a React SPA dashboard. A multi-provider LLM system powers AI agents that can read, interpret, and draw on TradingView charts via Chrome DevTools Protocol.

Since July 2026, the system has undergone a **major expansion** adding:
- **Strategy Evaluation System** — 41 ICT/SMC models encoded as predicate rule trees with a registry and evaluator
- **Narrative Generator** — deterministic template-based market commentary
- **Reasoning Agent** — adversarial LLM-based trade setup evaluation
- **Economic Calendar Refresh** — Firecrawl + ScrapeGraphAI pipeline
- **Groq LLM Provider** — additional fast-inference option
- **Deployment Blueprints** — Railway + Render + Supabase migration
- **104+ TradingView Desktop Tools** — chart control, drawing, Pine Script, alerts, replay, UI clicking
- **Obsidian Vault** — integrated documentation and knowledge management

---

## 2. Comparison: Before vs. After

### Capability Matrix

| Capability | Pre-Sessions (Jun 5–23) | Current (Jul 18, 2026) |
|---|---|---|
| **SMC Engine Modules** | structure, liquidity, OB, FVG | +pd-array, daily-bias, smt, report (8 total) |
| **Strategy Matching** | None | 41 models via predicate rule trees |
| **Narrative Generation** | None | Deterministic template-based (5 sections) |
| **LLM Reasoning** | None | Adversarial prompt, calibrated 0–100 score |
| **LLM Providers** | Fireworks AI only | Fireworks, OpenAI, Custom, AMD vLLM, Ollama, **Groq** |
| **TradingView Tools** | 0 | 104+ (chart, drawing, Pine, alerts, replay, UI click) |
| **TV Desktop Launch** | Not working | MSIX fix via `shell:AppsFolder` with `--remote-debugging-port` |
| **Real-Time Data** | None | Binance WS (crypto) + Finnhub/Yahoo (forex) + SSE |
| **Agent Loop** | None | Observe→Interpret→Reason→Decide→Act→Evaluate→Update |
| **Memory Systems** | None | Episodic + Semantic + Qdrant vector memory |
| **Database** | None | PostgreSQL 16 via Drizzle ORM (13 tables) |
| **Model Definitions DB** | None | `model_definitions` + `economic_events` tables |
| **Economic Calendar** | None | Firecrawl + ScrapeGraphAI pipeline |
| **Deployment** | Replit only | Railway + Render + Supabase blueprints |
| **Documentation** | Sporadic | Obsidian vault, CLAUDE.md, COMPLETE_ARCHITECTURE_REPORT.md |
| **Test Coverage** | ~150 assertions (api-server) | +96 vitest tests (api-zod), +68 standalone assertions |
| **CI/CD** | None | GitHub Actions (typecheck → build → Docker) |
| **Docker** | None | Multi-stage (builder → runner → frontend) |
| **Frontend State** | Basic dashboard | Cascade hooks, strategy display, OS Output panel, CAL button |

### Route Expansion

| Route | Pre-Sessions | Current |
|---|---|---|
| `/api/analysis/crypto` | ✅ | ✅ |
| `/api/analysis/forex` | ✅ | ✅ |
| `/api/agents/ask` | ❌ | ✅ |
| `/api/agents/ask-mcp` | ❌ | ✅ (37+ tools) |
| `/api/agents/pipeline` | ❌ | ✅ |
| `/api/agent-loop/*` | ❌ | ✅ (10 endpoints) |
| `/api/learning/*` | ❌ | ✅ (8 endpoints) |
| `/api/stream/*` | ❌ | ✅ |
| `/api/strategies` | ❌ | ✅ (list + detect) |
| `/api/external-intel/refresh` | ❌ | ✅ |
| `/api/strategies/detect?reason=true` | ❌ | ✅ (narrative + reasoning) |
| `/api/learning/read-tv-indicator-levels` | ❌ | ✅ |

---

## 3. Repository Structure & Module Map

```
part-2-SMC/
├── artifacts/
│   ├── api-server/                     # Express 5 + FastMCP backend
│   │   ├── src/
│   │   │   ├── index.ts                # Entry: dotenv, port bind, WS init, MCP server
│   │   │   ├── app.ts                  # Express app factory (compression, CORS, routes)
│   │   │   ├── lib/
│   │   │   │   ├── logger.ts           # Pino structured logger
│   │   │   │   ├── smc/                # SMC/ICT analysis engine (8 modules)
│   │   │   │   ├── fetchers/           # Binance + Yahoo OHLCV fetchers
│   │   │   │   ├── realtime/           # WebSocket, candle store, SSE, analysis bridge
│   │   │   │   ├── llm/                # Multi-provider LLM + structured output
│   │   │   │   ├── mcp/                # FastMCP server, tools, resources, prompts
│   │   │   │   ├── integrations/
│   │   │   │   │   ├── tradingview/          # Legacy Puppeteer-based TV (~11 tools)
│   │   │   │   │   └── tradingview-desktop/  # CDP-based TV (104+ tools)
│   │   │   │   ├── loop/               # Agent Loop engine (Observe→Update)
│   │   │   │   ├── memory/             # Episodic + Semantic + Qdrant
│   │   │   │   ├── harness/            # LoopTracer + LoopEvaluator
│   │   │   │   ├── agents/             # Reasoning agent (adversarial LLM)
│   │   │   │   ├── narrative/          # Deterministic narrative generator
│   │   │   │   ├── external-intel/     # Economic calendar refresh job
│   │   │   │   ├── services/           # SignalGenerator, TradeLedger, PerformanceMatrix
│   │   │   │   ├── learning/           # Comparison engine, outcome evaluator
│   │   │   │   ├── reflection/         # Reflection engine
│   │   │   │   ├── reliability/        # Reliability engine
│   │   │   │   ├── evaluation/         # LLM-as-Judge evaluator
│   │   │   │   ├── optimization/       # Prompt optimizer (DSPy-equivalent)
│   │   │   │   ├── news/               # NewsFetcher, PdfParser, Chunker
│   │   │   │   ├── observability/      # Langfuse tracing
│   │   │   │   ├── truth/              # Truth engine (arbitration)
│   │   │   │   ├── backtest/           # Backtest runner
│   │   │   │   ├── fusion/             # Evidence fusion layer
│   │   │   │   └── realtime/           # Real-time analysis bridge
│   │   │   └── routes/
│   │   │       ├── index.ts            # Router mount (aggregates all routes)
│   │   │       ├── analysis.ts         # GET /api/analysis/* (crypto, forex, from-tv, from-bars)
│   │   │       ├── agents.ts           # POST /api/agents/{ask,pipeline}
│   │   │       ├── agents-mcp.ts       # POST /api/agents/ask-mcp (37+ tools)
│   │   │       ├── agent-loop.ts       # POST /api/agent-loop/* (10 routes)
│   │   │       ├── learning.ts         # GET /api/learning/* (comparison, reliability)
│   │   │       ├── ledger.ts           # Signals, broker, backtest
│   │   │       ├── strategies.ts       # GET/POST /api/strategies (NEW)
│   │   │       ├── external-intel.ts   # GET /api/external-intel/refresh (NEW)
│   │   │       ├── stream.ts           # GET /api/stream/:symbol (SSE)
│   │   │       ├── symbols.ts          # GET /api/symbols
│   │   │       └── health.ts           # GET /api/healthz
│   │   ├── build.mjs                   # esbuild bundler
│   │   └── dist/index.mjs              # Built binary (~11.4 MB)
│   │
│   ├── liquidity-hunter/               # React SPA (Vite, Tailwind 4, shadcn/ui)
│   │   ├── src/
│   │   │   ├── main.tsx                # React root mount
│   │   │   ├── App.tsx                 # Wouter router
│   │   │   ├── pages/
│   │   │   │   ├── dashboard.tsx       # Main dashboard (state orchestration)
│   │   │   │   ├── AgentLoop.tsx       # Agent Loop management page
│   │   │   │   ├── Analytics.tsx       # Trade ledger + performance matrix
│   │   │   │   ├── BrokerView.tsx      # Broker connection & orders
│   │   │   │   └── not-found.tsx       # 404
│   │   │   ├── components/
│   │   │   │   ├── ConfluenceCard.tsx   # Multi-TF cascade + strategy display
│   │   │   │   ├── ConfluenceSheet.tsx  # Multi-TF deep dive overlay
│   │   │   │   ├── IntelligenceSheet.tsx # Single-TF full analysis + TradeActions
│   │   │   │   ├── OSOutputPanel.tsx    # Narrative + reasoning display (NEW)
│   │   │   │   ├── ChartView.tsx        # Lightweight Charts v5
│   │   │   │   ├── AgentChat.tsx        # Q&A chat with AI analyst
│   │   │   │   ├── AgentPipeline.tsx    # 4-agent sequential pipeline
│   │   │   │   ├── MarketBriefing.tsx   # AI market briefing
│   │   │   │   ├── TradeActions.tsx     # Execute/LIVE/Monitor controls
│   │   │   │   ├── MarketIntelligence.tsx
│   │   │   │   ├── AgentLoopDashboard.tsx # Loop runner + history
│   │   │   │   ├── BacktestRunnerUI.tsx
│   │   │   │   ├── CandlestickChart.tsx
│   │   │   │   ├── TvStatus.tsx        # TV connection indicator
│   │   │   │   ├── TvCardControl.tsx   # Per-TF TV drawing control
│   │   │   │   └── ui/                 # 58 shadcn/ui primitives
│   │   │   ├── hooks/
│   │   │   │   ├── useCascadeStrategy.ts # Strategy detection hook (NEW)
│   │   │   │   ├── use-mobile.tsx
│   │   │   │   ├── use-toast.ts
│   │   │   │   └── realtime.ts         # SSE real-time hook
│   │   │   └── lib/
│   │   │       ├── api.ts              # All fetch wrappers (detectStrategies, refreshCalendar, ...)
│   │   │       ├── smc-display.ts       # Bias/confidence/formatting helpers
│   │   │       ├── alpaca-url.ts        # Alpaca chart URL builder
│   │   │       ├── format.ts            # Price formatting
│   │   │       └── realtime.ts          # Realtime data hook
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── mockup-sandbox/                 # Design preview server
│
├── lib/
│   ├── api-spec/                       # OpenAPI 3.1 spec + orval config
│   ├── api-client-react/               # Generated React Query hooks
│   ├── api-zod/
│   │   ├── src/
│   │   │   ├── generated/              # Orval-generated Zod + TS types (SmcReport, etc.)
│   │   │   ├── strategies/             # Strategy evaluation system (NEW)
│   │   │   │   ├── predicates.ts       # 14 predicate functions + EconomicEvent
│   │   │   │   ├── rules.ts            # Rule discriminated union + StrategyDefinition
│   │   │   │   ├── evaluator.ts        # StrategyEvaluator (walks rule tree)
│   │   │   │   ├── registry.ts         # StrategyRegistry (41 templates, detectAll)
│   │   │   │   ├── index.ts            # Barrel export
│   │   │   │   ├── templates/
│   │   │   │   │   ├── modern-confluence.ts   # 5 models
│   │   │   │   │   ├── charter-blueprint.ts   # 12 models
│   │   │   │   │   ├── classical-horizon.ts   # 12 models
│   │   │   │   │   └── mmxm-and-temporal.ts   # 12 models
│   │   │   │   ├── predicates.test.ts  # 96 vitest tests
│   │   │   │   ├── evaluator.test.ts   # 12 tests
│   │   │   │   └── registry.test.ts    # 16 tests
│   │   │   └── index.ts
│   │   ├── vitest.config.ts
│   │   └── package.json
│   └── db/
│       ├── src/
│       │   ├── index.ts                # Lazy DB pool + deep-noop Proxy
│       │   └── schema/
│       │       ├── index.ts            # Barrel (aggregates all tables)
│       │       ├── learning.ts          # Detection comparisons, outcomes, model perf
│       │       ├── model-definitions.ts # 41 ICT/SMC models (NEW)
│       │       └── economic-events.ts   # Economic calendar (NEW)
│       ├── seeds/
│       │   └── model-definitions.ts    # 41-model seed (NEW)
│       ├── drizzle/
│       │   ├── 0000_thin_frightful_four.sql  # Initial schema migration
│       │   └── 0001_silent_wilson_fisk.sql   # Economic events migration (NEW)
│       ├── drizzle.config.ts
│       └── package.json
│
├── deploy/
│   ├── local/                           # Intel/AMD CPU Docker Compose
│   │   ├── docker-compose.yml           # api + db + frontend + qdrant + ollama
│   │   ├── nginx/default.conf
│   │   └── .env.example
│   └── amd-developer-cloud/            # AMD MI300X GPU Docker Compose
│       ├── docker-compose.yml           # vllm + api + db + frontend
│       ├── nginx/default.conf
│       ├── .env.amd
│       └── setup.sh
│
├── scripts/
│   ├── launch-tv.bat                    # TV Desktop CDP launcher (Windows)
│   └── cdp-proxy.mjs                    # CDP port proxy for Docker
│
├── docs/
│   ├── COMPLETE_ARCHITECTURE_REPORT.md  # This file
│   ├── CAPABILITIES_REPORT.md           # Before/after capability comparison
│   ├── EXPERT_REPORT.md                 # Expert-level system audit
│   ├── LEARNING_FRAMEWORK.md            # Learning framework docs
│   ├── MCP_CHAT_CAPABILITIES.md         # MCP agent capabilities
│   └── archive/                         # Archived previous versions
│
├── .claude/
│   └── settings.local.json              # Claude Code permissions config
│
├── .obsidian/                           # Obsidian vault config
│   ├── obsidian.json                    # Workspace settings (dataview, tasks)
│   ├── app.json, core-plugins.json
│   └── community-plugins.json
│
├── CLAUDE.md                            # Codebase guide (145 lines)
├── railway.json                         # Railway deployment blueprint
├── render.yaml                          # Render deployment blueprint
├── MIGRATION.md                         # Supabase migration checklist
├── Dockerfile                           # Multi-stage (builder → runner → frontend)
└── pnpm-workspace.yaml
```

---

## 4. Monorepo Package Map

| Package | Path | Type | Role | Tests |
|---|---|---|---|---|
| `@workspace/api-spec` | `lib/api-spec/` | lib | OpenAPI 3.0 spec + orval config | — |
| `@workspace/api-zod` | `lib/api-zod/` | lib | Zod schemas + TS types + **strategy evaluation** | 96 vitest |
| `@workspace/api-client-react` | `lib/api-client-react/` | lib | React Query hooks + fetch wrappers | — |
| `@workspace/db` | `lib/db/` | lib | Drizzle ORM schema + migrations + seeds | — |
| `@workspace/api-server` | `artifacts/api-server/` | app | Express 5 + FastMCP backend | ~200 assertions |
| `@workspace/liquidity-hunter` | `artifacts/liquidity-hunter/` | app | React SPA (Vite + Tailwind 4) | — |
| `@workspace/scripts` | `scripts/` | app | CLI utilities (launch-tv, cdp-proxy) | — |

---

## 5. Stack & Dependencies

### Backend (`artifacts/api-server`)

| Category | Libraries |
|---|---|
| **Framework** | Express 5, FastMCP 4 |
| **LLM** | Fireworks AI API, OpenAI API, Groq API, Ollama |
| **Database** | Drizzle ORM, pg, drizzle-zod |
| **Browser Automation** | chrome-remote-interface, Puppeteer 25 |
| **Web Scraping** | **Firecrawl** (NEW), ScrapeGraphAI API |
| **Real-Time** | ws (WebSocket), SSE |
| **Observability** | Langfuse, Pino |
| **Build** | esbuild 0.27, tsx |
| **Vector DB** | Qdrant (js-client-rest) |
| **Other** | cheerio, pdf-parse, axios, compression, cookie-parser, cors |

### Frontend (`artifacts/liquidity-hunter`)

| Category | Libraries |
|---|---|
| **Framework** | React 19, React DOM 19 |
| **Routing** | Wouter |
| **Server State** | TanStack React Query 5 |
| **UI** | Tailwind CSS 4, shadcn/ui (58 primitives), Radix UI |
| **Charts** | Lightweight Charts 5, Recharts 2 |
| **Animation** | Framer Motion 12 |
| **Icons** | Lucide React |
| **Build** | Vite 7, vite-plugin-react |
| **Forms** | React Hook Form, Zod |

---

## 6. SMC/ICT Analysis Engine

**Location:** `artifacts/api-server/src/lib/smc/`

The core analysis engine — 8 modules that process OHLCV candle arrays into structured ICT/SMC detections.

### Module Map

| Module | File | Input | Output | Key Logic |
|---|---|---|---|---|
| **Structure** | `structure.ts` | `Candle[]`, timeframe | `StructureResult` | ATR-normalized pivot detection (NASOS loop), BOS/CHoCH classification, market phase inference (accumulation/manipulation/expansion/distribution/continuation) |
| **Liquidity** | `liquidity.ts` | `Candle[]`, timeframe, market | `LiquidityResult` | BSL/SSL/EQH/EQL pool scanning, sweep probability scoring, nearest pool identification |
| **Order Blocks** | `order-blocks.ts` | `Candle[]`, `FVG[]` | `OrderBlock[]` | Contiguous displacement detection, 6-factor confidence scoring (MSS proximity, FVG overlap, volume profile, displacement ratio, penetration, efficiency) |
| **FVG** | `fvg.ts` | `Candle[]`, market | `FairValueGap[]` | Gap detection (bullish/bearish), fill-fraction tracking, inversion mechanics |
| **PD Array** | `pd-array.ts` | `Candle[]`, timeframe | `PdArrayResult` | Premium/discount/equilibrium zones, dealing range HL/equilibrium, current bias |
| **Daily Bias** | `daily-bias.ts` | daily `Candle[]` | `DailyBiasResult` | HTF bias, strength, consecutive-day counting, swing reference |
| **SMT** | `smt.ts` | primary + correlated `Candle[]` | `SmtDivergence` | Divergence detection between two correlated symbols |
| **Report** | `report.ts` | All of the above + options | `SmcReport` | Orchestrator — calls all 7 modules, assigns roles, builds narrative, derives session state, scores draw targets with confluence boost |

### Report Builder Flow (`report.ts`)

```
buildReport(candles, symbol, market, timeframe, options)
├── analyzeStructure()     → StructureResult
├── analyzeFVG()           → FairValueGap[]
├── analyzeLiquidity()     → LiquidityResult
├── analyzeOrderBlocks()   → OrderBlock[]
├── analyzePdArray()       → PdArrayResult
├── analyzeDailyBias()     → DailyBiasResult
├── analyzeSMT()           → SmtDivergence
├── HTF bias → OB confidence adjustment
├── confluenceBoost()      → scored DrawTarget[]
├── deriveSessionState()   → "London Expansion — Bullish"
└── buildMarketNarrative() → plain-English narrative string
```

### Data Fallback Chain

```
getCandlesWithFallback(symbol, timeframe)
├── 1. CandleStore (in-memory real-time accumulator)
├── 2. TV Desktop CDP (chrome-remote-interface → chart bars)
├── 3. Binance API (crypto) / Yahoo Finance API (forex)
└── Returns: Candle[]
```

---

## 7. Strategy Evaluation System

**Location:** `lib/api-zod/src/strategies/` (NEW — July 18)

A complete system for matching ICT/SMC trading models against multi-timeframe SMC reports using predicate rule trees.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Strategy Evaluation System                │
├────────────┬──────────┬─────────────┬──────────┬────────────┤
│ predicates │  rules   │  evaluator  │ registry │ templates  │
│ 14 fns     │  Zod     │ Rule →      │ 41       │ .ts files  │
│ returning  │  schema  │ Predicate   │ models   │ matching   │
│ {matched,  │  (and,   │ Result via  │ auto-    │ seed data  │
│ evidence,  │  or,     │ function    │ loaded   │ 1:1        │
│ score?}    │  not)    │ registry    │          │            │
└────────────┴──────────┴─────────────┴──────────┴────────────┘
```

### Predicate Functions (14)

| Function | Description | Extra Args |
|---|---|---|
| `hasBias` | Structure bias or daily bias is non-neutral | — |
| `hasOrderBlock` | At least one valid, unmitigated OB | — |
| `hasLiquidityPool` | Unswept liquidity pool exists | — |
| `hasFVG` | Unfilled FVG (fillFraction < 0.5) | — |
| `biasAligned` | Structure bias matches target direction | `direction` |
| `hasDailyBias` | Non-neutral daily bias with strength ≥ 0.3 | — |
| `confluenceScore` | Multi-factor confluence (0–1) | — |
| `priceNearOBProximal` | Price within tolerance of OB proximal | `tolerancePct` |
| `hasMarketStructureShift` | BOS/CHoCH breaks detected | — |
| `hasInducementZone` | LH/HL pivot in trend | — |
| `priceWithinOTEzone` | Price in 62–79% retracement zone | `direction?` |
| `hasConsolidationZone` | Ranging trend / equilibrium / tight range | — |
| `isWithinSession` | Pool tags or contextual session match | `session` |
| `hasSMTConfirmation` | SMT divergence with min confidence | `minConfidence?` |
| **`hasHighImpactNewsWithin`** | Upcoming high-impact economic event | `events[]`, `windowMs` (NEW) |
| **`isNewsBlackoutWindow`** | Inside blackout around high-impact event | `events[]`, `blackoutMs` (NEW) |

### Rule Tree Operators

| Operator | Behavior | Score |
|---|---|---|
| `predicate` | Calls function from registry | Function's score |
| `and` | All sub-rules must match | Average of all |
| `or` | Any sub-rule matches | Best of all |
| `not` | Negates inner result | `1 - inner` |

### Templates (41 Models)

| Category | Count | IDs |
|---|---|---|
| Classical Horizon (2019) | 12 | `classical-01` through `classical-12` |
| Charter Blueprint | 12 | `charter-01` through `charter-12` |
| Modern Confluence | 5 | `smc-confluence-1` through `smc-confluence-5` |
| Market Maker Cycles | 2 | `mmxm-mmsm`, `mmxm-mmbm` |
| Temporal & Reversal | 10 | `temporal-silver-bullet-*`, `reversal-*`, `framework-*` |

### Route

```http
POST /api/strategies/detect
Content-Type: application/json
{"symbol": "BTCUSDT", "timeframes": ["4h", "1h", "15m"]}
```
Optional query param `?reason=true` appends:
- `narrative` — deterministic narrative from `generateNarrative()`
- `reasoning` — LLM assessment from `reasoning-agent.ts`

---

## 8. Backend Architecture

### Server Startup (`index.ts`)

```
1. Load dotenv
2. Import Express app + SMC MCP server + real-time modules
3. Bind PORT (REST/SSE) + MCP_PORT (FastMCP HTTP Stream)
4. Start Binance WS + Forex WS subscriptions
5. Start TradeSettlementService
6. Start MCP server on port 3002
7. Install SIGTERM/SIGINT handlers (graceful shutdown)
```

### Express Middleware Stack (`app.ts`)

```
compression → pino-http logging → CORS → JSON body parser → router
```

### Route Mounting (`routes/index.ts`)

| Router | Mount | Updated |
|---|---|---|
| `healthRouter` | `/api` | — |
| `symbolsRouter` | `/api` | — |
| `analysisRouter` | `/api` | — |
| `agentsRouter` | `/api` | Jul 14 (TV-aware prompt) |
| `streamRouter` | `/api` | — |
| `agentsMcpRouter` | `/api` | Jul 14 (10 new tools) |
| `ledgerRouter` | `/api` | — |
| `agentLoopRouter` | `/api` | — |
| `learningRouter` | `/api/learning` | Jul 14 (TV indicator reader) |
| `strategiesRouter` | `/api` | **Jul 18 (NEW)** |
| `externalIntelRouter` | `/api` | **Jul 18 (NEW)** |

### Key Design Patterns

**1. Cached Analysis Pipeline** (`analysis.ts`):
- 60-second in-memory TTL cache (Map-based)
- Parallel OHLCV fetches via `Promise.all`
- Candle store fallback when external APIs fail
- `updateCachedReport()` for SSE pre-warming

**2. Lazy DB Connection** (`lib/db/src/index.ts`):
- Proxy-based deep-noop when `DATABASE_URL` unset
- Pool created on first access, not at import time
- Routes gracefully degrade to empty states

**3. Multi-Provider LLM** (`lib/llm/provider.ts`):
- Provider selected via `LLM_PROVIDER` env var
- All providers use the same OpenAI-compatible chat completions API
- `extractStructured()` retries on JSON parse failure (Instructor pattern)

**4. StrategyEvaluation Pipeline** (`routes/strategies.ts`):
- Parallel OHLCV fetch across timeframes
- Per-timeframe `buildReport()` with error isolation
- `registry.detectAll()` → ranked results (matched > failed > error, desc score)
- Optional `?reason=true` gates narrative + LLM reasoning

---

## 9. Frontend Architecture

### Component Hierarchy

```
App (Wouter Router)
├── Dashboard (page)
│   ├── Header (sticky)
│   │   ├── Market/Symbol/Timeframe/Controls
│   │   ├── SMT Toggle + Correlated Symbol
│   │   ├── CHART / ANALYTICS / BROKER / AGENT / INTEL / CAL buttons
│   │   └── Auto-refresh countdown ring + Live Price
│   ├── MarketBriefing (AI narrative banner)
│   ├── ConfluenceCard (multi-TF cascade + strategy detection)
│   │   ├── StrategySection (primary name/score + Execute Now + alternatives)
│   │   ├── Cascade Flow (TF boxes with arrows)
│   │   └── Per-TF Mini Cards (draw target, confidence)
│   ├── TfAgentCard × N (per-timeframe agent cards)
│   └── Session footer (daily bias, PD, BSL/SSL, SMT, cascade anchor)
│   └── Overlays:
│       ├── ConfluenceSheet (slide-over panel, multi-TF synthesis)
│       ├── IntelligenceSheet (slide-over panel, single-TF deep-dive)
│       │   ├── Strategy Context Badge
│       │   ├── Trade Setup Summary + TradeActions
│       │   ├── Structure / Liquidity / FVG / Order Flow sections
│       │   ├── Confidence Drivers
│       │   ├── OSOutputPanel (narrative + reasoning) ← NEW
│       │   ├── AgentPipeline + AgentLoopSection + MarketIntelligence
│       │   └── AgentChat (bottom-fixed)
│       └── ChartView (Lightweight Charts v5)
├── AgentLoop (page)
│   └── AgentLoopDashboard (tabs: Run/Monitors/History/Memory)
├── Analytics (page) — Trade ledger + Performance Matrix
└── BrokerView (page) — Broker connection + order management
```

### State Management

No global state manager — state is distributed across components:

| State | Owner | Mechanism |
|---|---|---|
| Market, symbol, TF style, SMT | `dashboard.tsx` | `useState` |
| Analysis reports (7 TFs) | `dashboard.tsx` | TanStack Query (server state) |
| Strategy detection results | `useCascadeStrategy` hook | TanStack Query → `{ primary, alternatives, narrative, reasoning }` |
| Sheet visibility | `dashboard.tsx` | `useState<sheet \| null>` |
| OS Output Panel | `OSOutputPanel` | `useState<open>` (collapsible) |
| Live price data | `useRealtimeStream` hook | SSE events |
| Agent conversation | `AgentChat.tsx` | `useState<Message[]>` |
| Pipeline streaming | `AgentPipeline.tsx` | `useState<AgentResult[]>` |
| Loop state | `AgentLoopDashboard.tsx` | `useState<LoopStepEvent[]>` |
| Calendar refresh | `dashboard.tsx` | `useState<result>` (CAL button toast) |

### Cascade Computation

```
TRADING_STYLES: Array<{ label, desc, timeframes }>
  ├── "Scalp":   [1m, 5m, 15m]
  ├── "Intraday": [15m, 1h, 4h]
  ├── "Swing":    [4h, 1d, 1w]
  └── "All":      [1m, 5m, 15m, 1h, 4h, 1d, 1w]

getRoles(timeframes):
  sort by TF_WEIGHT descending
  → richest TF = "BIAS SETTER"
  → lowest TF = "ENTRY TRIGGER"
  → middle TFs = "CONFIRMATION"

cascade.anchorTf = highest TF with loaded data
cascade.anchorBias = getBias(anchorReport)
```

---

## 10. AI & LLM Pipeline

### Multi-Provider Architecture

```
LLM_PROVIDER=fireworks | openai | custom | amd | ollama | groq
              │
              ▼
resolveLlmConfig() → LlmConfig { baseUrl, apiKey, model, provider }
              │
              ├── chatCompletion()      → non-streaming (Langfuse-traced)
              └── streamChatCompletion() → SSE streaming (async generator)
                       │
                       ▼
              extractStructured(schema, prompt)
                  ├── Zod schema → LLM prompt injection
                  ├── JSON extraction + Zod.parse()
                  └── 2 retries on parse failure
```

### Provider Comparison

| Provider | Default Model | Base URL | Auth | Use Case |
|---|---|---|---|---|
| Fireworks | `deepseek-v4-pro` | `api.fireworks.ai/inference/v1` | `FIREWORKS_API_KEY` | Default — fast, cheap |
| OpenAI | `gpt-4o` | `api.openai.com/v1` | `OPENAI_API_KEY` | GPT-4 fallback |
| Custom | (configurable) | `LLM_BASE_URL` | `LLM_API_KEY` | Any OpenAI-compatible |
| AMD | `gemma-4-26B-A4B-it` | `localhost:8000/v1` | `not-needed` | Self-hosted vLLM on MI300X |
| Ollama | `llama-3.1-8b` | `host.docker.internal:11434/v1` | `not-needed` | Local inference |
| **Groq** | `llama3-70b-8192` | `api.groq.com/openai/v1` | `GROQ_API_KEY` | **NEW — fast inference** |

### Agent Endpoints

| Endpoint | Type | Tools Available |
|---|---|---|
| `POST /api/agents/ask` | SSE streaming | 0 (pure LLM Q&A) |
| `POST /api/agents/pipeline` | SSE streaming | 4 sequential agents |
| `POST /api/agents/ask-mcp` | SSE streaming | 37+ MCP tools (SMC + TV) |

### LLM Cost Tracking (`provider.ts`)

```ts
const MODEL_COST_MAP = {
  "accounts/fireworks/models/deepseek-v4-pro": { input: 1.20, output: 4.80 },
  "gpt-4o": { input: 2.50, output: 10.00 },
  "llama3-70b-8192": { input: 0.59, output: 0.79 },
  "llama3-8b-8192": { input: 0.05, output: 0.08 },
  // 6 Groq models + 13 others
};
```

---

## 11. Agent Loop Engine

**Location:** `artifacts/api-server/src/lib/loop/`

A fully autonomous Observe→Interpret→Reason→Decide→Act→Evaluate→Update cycle.

### Loop Cycle

```
1. OBSERVE     — Store SmcReport in LoopContext, check guardrails
2. INTERPRET   — Call 8 SMC tools via toolRegistry (structure, liquidity, OB, FVG, PD, bias, SMT, draw)
3. REASON      — Build prompt from interpreted data + memory, call LLM
                └── TV reconciliation injected if TV_ENABLED=true
4. DECIDE      — Validate Decision through AgentGuardrails (confidence, risk, confluence)
5. ACT         — Generate signal via SignalGenerator, log to ledger
6. EVALUATE    — Score run via LoopEvaluator (LLM-as-Judge)
7. UPDATE      — Persist trace to DB via LoopTracer, store memory entries
```

### Component Architecture

```
AgentLoop.ts
├── LoopContext.ts       — Working memory, iteration/step tracking
├── AgentGuardrails.ts   — Confidence floor (≥60), risk limits, confluence checks
└── MonitoringManager.ts — Background candle-close monitor registry

MemoryService.ts
├── EpisodicMemory.ts    — Past signals/outcomes via TradeLedgerService
└── SemanticMemory.ts    — Patterns via agent_memory table

Harness/
├── LoopTracer.ts        — Step-level tracing + DB persistence (agent_loop_steps)
└── LoopEvaluator.ts     — Post-run scoring + memory ingestion
```

### Endpoints

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
| GET | `/api/agent-loop/tv-*` | TV status/connect/sync |

---

## 12. Real-Time Data Pipeline

### Data Sources

| Source | Assets | Adapter | Method |
|---|---|---|---|
| Binance | Crypto (BTC, ETH, SOL, BNB, ...) | `binance-ws.ts` | WebSocket (kline streams) |
| Finnhub | Forex (EURUSD, GBPUSD, ...) | `forex-ws.ts` | WebSocket |
| Yahoo Finance | Forex (fallback) | `yahoo.ts` | REST polling (15s) |
| Candle Store | All (cached) | `candle-store.ts` | In-memory ring buffer |

### Real-Time Flow (per candle close)

```
Binance WS / Forex Poller
  → candleStore.applyUpdate({isClosed: true})
    → emits "candleClosed"
      → sseManager broadcasts SSE "candle_closed" → browsers
      → analysis-bridge:
          1. candleStore.getCandles() → fresh Candle[]
          2. buildReport() → fresh SmcReport
          3. updateCachedReport() → REST cache pre-warmed
          4. sseManager.broadcastReport() → SSE "report_update"
            → browser: onReportUpdate → setQueryData → instant UI update
```

### SSE Channels

| Event | Payload | Frequency |
|---|---|---|
| `connected` | — | On connection |
| `candle_update` | `{ symbol, timeframe, candle }` | Every tick |
| `candle_closed` | `{ symbol, timeframe }` | Every candle close |
| `report_update` | `{ timeframe, report: SmcReport }` | Every candle close |

---

## 13. TradingView Desktop Integration

### Two Integration Paths

| Aspect | `tradingview/` (Legacy) | `tradingview-desktop/` (Current) |
|---|---|---|
| Tools | ~11 | **104+** |
| Connection | Puppeteer → CDP | `chrome-remote-interface` → CDP |
| API | `window.tvWidget` | `_exposed_chartWidgetCollection` |
| Health Check | `page.evaluate(() ⇒ document.title)` | `_browser.connected` |
| Drawing | Canvas click (unreliable) | `ChartApiInstance.createStudy()` |
| Launch | `puppeteer.launch()` (own browser) | CDP to existing TV desktop |

### Desktop Tools by Category (104+)

| Category | Count | Tools |
|---|---|---|
| Chart | ~8 | get state, set symbol, set timeframe, set type, visible range, scroll to date, symbol info, search |
| Drawing | ~5 | create shape, list, get properties, remove, clear all |
| Data | ~8 | OHLCV bars, quote, depth, indicator values, Pine lines/labels/boxes, strategy results, trades, equity |
| Alerts | ~3 | create, list, delete |
| Indicators | ~3 | add, remove, get |
| Pane | ~4 | get/set layout, focus, set symbol |
| Replay | ~8 | start, stop, autoplay, step forward, trade (buy/sell/close), get status |
| Tabs | ~3 | get, switch, close |
| UI | ~15 | click, open panel, fullscreen, keyboard, type text, hover, scroll, mouse click, find element, evaluate JS, layout |
| Pine | ~8 | get/set source, compile, publish, library, info, templates |
| Capture | ~1 | screenshot |
| Watchlist | ~3 | get, add, remove |
| Health | ~3 | ping, connect |
| **MCP Tools** | **+10** | `tv_chart_set_symbol`, `tv_ui_click`, `tv_data_get_quote`, etc. |
| **Legacy Web** | **+11** | `tv_get_chart_state`, `tv_draw_horizontal_line`, etc. |

### MSIX Launch Fix (Windows Only)

```powershell
# Discover installed packages
$folder = New-Object -ComObject Shell.Application
$folder.Namespace("shell:AppsFolder").Items()
# → 31178TradingViewInc.TradingView_q4jpyh43s5mv6!TradingView.Desktop

# Launch with CDP debugging
Start-Process "shell:AppsFolder\31178TradingViewInc.TradingView_q4jpyh43s5mv6!TradingView.Desktop" `
  -ArgumentList "--remote-debugging-port=9222"
```

### TV Drawing Architecture

```
SMC Engine → DrawTarget[]
  │ POST /api/agent-loop/tv-draw
  ▼
tv-draw route handler:
  1. Connect via CDP (chrome-remote-interface)
  2. Switch chart: setSymbol + setResolution
  3. Wait for bars (~3-6s)
  4. Compute BSL/SSL/Current levels
  5. For each level:
     └── ChartApiInstance.createStudy(id, "hl_0", "Horizontal Line", ...)
  6. Return { levels, logs }
```

---

## 14. Memory & Learning Systems

### Three-Tier Memory

| Tier | Storage | Scope | Key Operation |
|---|---|---|---|
| **Episodic** | `TradeLedgerService` (DB) | Past signals and outcomes | `findSimilarSetups()` |
| **Semantic** | `agent_memory` table (DB) | Patterns and procedural rules | `store()`, `query()` |
| **Vector** | Qdrant (external) | Similar setup search | `storeSignal()`, `findSimilar()` |

### Learning Framework (Comparison Engine)

```
TV Desktop → readPineDetections() → comparison with SMC engine
  │
  ├── extractEngineDetections(report) → Detection[]
  ├── extractTvDetections(tvData)     → Detection[]
  ├── compareDetections(engine, tv)    → AgreementAnalysis[]
  └── calculateComparisonMetrics()     → Win rates, reliability scores
```

### Learning Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/learning/comparisons` | Past comparison records |
| GET | `/api/learning/read-tv-indicator-levels` | Read Pine indicator values from TV |
| GET | `/api/learning/comparisons/analyze` | Run comparison on current data |
| GET | `/api/learning/evaluate-outcomes` | Evaluate forward outcomes |
| GET | `/api/learning/arbitrate` | Truth Engine arbitration |
| GET | `/api/learning/reliability` | Reliability reports |
| GET | `/api/learning/parameter-suggestions` | Parameter optimization |
| GET | `/api/learning/events` | Learning events |
| GET | `/api/learning/patterns` | Pattern statistics |

---

## 15. Database Schema (Drizzle ORM)

### Table Map (13 tables, PostgreSQL 16)

| Table | Schema File | Purpose | Key Columns |
|---|---|---|---|
| `trades` | `learning.ts` | Trade ledger | symbol, setup_type, entry/exit, outcome |
| `performance_matrix` | `learning.ts` | Pre-computed metrics per dimension | win_rate, sharpe, profit_factor |
| `detection_comparisons` | `learning.ts` | TV vs Engine detection records | detection_type, agreement |
| `detection_outcomes` | `learning.ts` | Forward-outcome evaluation | outcome, correct_source |
| `model_performance` | `learning.ts` | Per-source accumulated reliability | reliability_score |
| `parameter_history` | `learning.ts` | Parameter optimization history | current/suggested value |
| `learning_events` | `learning.ts` | Significant learning observations | event_type, significance |
| `pattern_statistics` | `learning.ts` | Recurring pattern analysis | occurrence_count, win_rate |
| `agent_loop_runs` | `learning.ts` | Agent loop run history | total_iterations, evaluation_score |
| `agent_loop_steps` | `learning.ts` | Step-level trace data | step_type, input/output snapshot |
| `agent_memory` | `learning.ts` | Semantic/procedural knowledge | memory_key, content, tags |
| `model_definitions` | **`model-definitions.ts` (NEW)** | 41 ICT/SMC model catalog | name, version, requires, parameters |
| `economic_events` | **`economic-events.ts` (NEW)** | Economic calendar events | time, currency, event, impact, forecast |

### Unique Constraints

| Table | Constraint | Purpose |
|---|---|---|
| `performance_matrix` | `(asset_class, symbol, setup_type, setup_subtype, timeframe_cascade, market_regime, session_context)` | Dimension combo uniqueness |
| `agent_memory` | `memory_key` | Key-value uniqueness |
| `model_performance` | `(source, detection_type)` | Per-source reliability |
| `economic_events` | **`(time, currency, event)`** | **Idempotent upsert** |

### Seed Data

`lib/db/seeds/model-definitions.ts` — 41 ICT/SMC model definitions:
- Classical Horizon (2019): 12 models (intraday scalping → core scalping)
- Charter Blueprint: 12 models (pedagogical series)
- Modern Confluence: 5 models (HTF+BOS+FVG → Five Box)
- Market Maker Cycles: 2 models (MMSM, MMBM)
- Temporal & Reversal: 10 models (Silver Bullet ×3 → 2 FVG)

Run: `DATABASE_URL="..." pnpm --filter @workspace/db run seed:models`

---

## 16. Narrative Generator & Reasoning Agent

### Narrative Generator (`generate-narrative.ts`)

**Pure deterministic function** — no LLM call. Takes strategy detection results and a TF report map, produces 5-paragraph institutional commentary.

**Sections:**
1. **Direction** — HTF bias, confidence, phase, daily bias alignment
2. **Session** — ICT session state, PD Array position
3. **Liquidity** — Nearest BSL/SSL with scores and directional inference
4. **Levels** — Draw targets, dealing range, equilibrium, current price
5. **Strategy** — Primary strategy name/score + alternatives

**33 tests** — fixtures cover bullish, bearish, neutral, and empty map scenarios.

### Reasoning Agent (`reasoning-agent.ts`)

**LLM-powered evaluation** — uses `extractStructured()` for Zod-validated output.

**Prompt structure:**
1. Summarise setup in one sentence
2. Identify 2–3 specific reasons it **could fail** (adversarial challenge)
3. Weigh bull case vs bear case
4. Calibrated confidence score 0–100:
   - 0–30: Weak — do not trade
   - 31–50: Marginal — needs confirmation
   - 51–70: Moderate — viable
   - 71–85: Strong — multiple confluence
   - 86–100: Exceptional

**14 tests** — uses mock LLM function (no real API calls in tests).

---

## 17. External Intelligence & Economic Calendar

### Refresh Pipeline (`refresh-job.ts`)

```
refreshEconomicCalendar() → RefreshResult
  │
  ├── 1. scrapeForexFactory()
  │     FirecrawlAppV1.scrapeUrl("https://www.forexfactory.com/calendar")
  │     → raw markdown
  │
  ├── 2. structureWithScrapeGraphAI(markdown)
  │     POST https://api.scrapegraphai.com/v1/llm/extract
  │     → EconomicEventRow[] (time, currency, event, impact, forecast, previous, actual)
  │
  └── 3. upsertEvents(rows)
        onConflictDoUpdate({ target: [time, currency, event] })
        → No duplicates on re-scrape
```

**Requires:** `FIRECRAWL_API_KEY`, `SCRAPEGRAPH_API_KEY`, `DATABASE_URL`
**Route:** `GET /api/external-intel/refresh`

### Economic Calendar Predicates (NEW — Jul 18)

- **`hasHighImpactNewsWithin`** — checks upcoming high-impact events within configurable window
- **`isNewsBlackoutWindow`** — checks if current time is within X minutes before/after any high-impact event

Both accept `EconomicEvent[]` via the evaluator's `args` mechanism. Commented out in Silver Bullet templates with a TODO until the evaluator context can inject events at runtime.

---

## 18. Deployment & Infrastructure

### Docker Multi-Stage Build (`Dockerfile`)

```
Builder (node:22-alpine)
  ├── Install pnpm, copy manifests
  ├── pnpm install
  ├── Build api-server (esbuild → dist/)
  └── Build frontend (Vite → dist/public/)

Runner (node:22-alpine)          ← Used by Railway/Render
  ├── Copy dist + install prod deps
  ├── Install Chromium (for Puppeteer)
  └── CMD: node dist/index.mjs

Frontend (nginx:alpine)
  ├── Copy built assets
  └── CMD: nginx serve
```

### Deployment Targets

| Platform | Blueprint | Database | Notes |
|---|---|---|---|
| **Railway** | `railway.json` | Railway Postgres or Supabase | Auto-detected, health-checked |
| **Render** | `render.yaml` | Managed PostgreSQL 16 | Blueprint with secrets sync: false |
| **Supabase** | `MIGRATION.md` | Supabase PostgreSQL | Compatible with existing Drizzle setup |
| **Docker (local)** | `deploy/local/docker-compose.yml` | PostgreSQL + Qdrant + Ollama | CPU-friendly, Fireworks AI for LLM |
| **AMD Cloud** | `deploy/amd-developer-cloud/docker-compose.yml` | PostgreSQL | vLLM on MI300X, local LLM inference |

### Environment Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PORT` | Yes | 3001 | REST/SSE port |
| `MCP_PORT` | No | 3002 | FastMCP server |
| `DATABASE_URL` | No | — | PostgreSQL (graceful noop if unset) |
| `LLM_PROVIDER` | No | `fireworks` | Provider selection |
| `FIREWORKS_API_KEY` | Conditional | — | Required for Fireworks AI |
| `GROQ_API_KEY` | Conditional | — | Required for Groq |
| `TV_ENABLED` | No | false | TradingView integration |
| `TV_CONNECTION_TYPE` | No | `web` | `web` (Puppeteer) or `desktop` (CDP) |
| `FIRECRAWL_API_KEY` | Conditional | — | Economic calendar scraping |
| `SCRAPEGRAPH_API_KEY` | Conditional | — | Economic calendar structuring |
| `ALPACA_API_KEY_ID` | No | — | Paper trading (falls back to MockBroker) |

---

## 19. API Endpoint Reference

### Analysis

| Method | Path | Description | Cache |
|---|---|---|---|
| GET | `/api/healthz` | Health check | No |
| GET | `/api/symbols` | Supported symbols | No |
| GET | `/api/analysis/crypto` | Full SMC report (crypto) | 60s |
| GET | `/api/analysis/forex` | Full SMC report (forex) | 60s |
| POST | `/api/analysis/from-bars` | SMC from external bars | 60s |
| GET | `/api/analysis/from-tv` | SMC from TV Desktop bars | 60s |

### AI Agents

| Method | Path | Description |
|---|---|---|
| POST | `/api/agents/ask` | AI Q&A via Fireworks (SSE) |
| POST | `/api/agents/pipeline` | 4-agent pipeline (SSE) |
| POST | `/api/agents/ask-mcp` | MCP tool-calling agent (SSE, 37+ tools) |

### Strategy Evaluation (NEW)

| Method | Path | Description |
|---|---|---|
| GET | `/api/strategies` | List registered strategies |
| POST | `/api/strategies/detect` | Multi-TF detection |
| POST | `/api/strategies/detect?reason=true` | Detection + narrative + reasoning |

### Agent Loop

| Method | Path | Description |
|---|---|---|
| POST | `/api/agent-loop/run` | One-shot loop cycle (SSE) |
| POST | `/api/agent-loop/start-monitoring` | Background monitor |
| POST | `/api/agent-loop/stop-monitoring` | Stop monitor |
| GET | `/api/agent-loop/status` | Active monitors |
| GET | `/api/agent-loop/runs` | Historical runs |
| GET | `/api/agent-loop/runs/:id` | Detailed run trace |
| POST | `/api/agent-loop/runs/:id/evaluate` | Trigger evaluation |
| GET | `/api/agent-loop/memory` | Semantic memory |
| POST | `/api/agent-loop/memory` | Store memory |
| DELETE | `/api/agent-loop/memory/:id` | Delete memory |

### TradingView

| Method | Path | Description |
|---|---|---|
| GET | `/api/agent-loop/tv-status` | TV connection status |
| POST | `/api/agent-loop/tv-config` | Update TV config |
| POST | `/api/agent-loop/tv-connect` | Force reconnect |
| POST | `/api/agent-loop/tv-sync` | Sync SMC levels |

### Learning

| Method | Path | Description |
|---|---|---|
| GET | `/api/learning/comparisons` | Detection comparisons |
| GET | `/api/learning/read-tv-indicator-levels` | Read Pine levels from TV |
| GET | `/api/learning/comparisons/analyze` | Run comparison analysis |
| GET | `/api/learning/evaluate-outcomes` | Evaluate outcomes |
| GET | `/api/learning/arbitrate` | Truth Engine arbitration |
| GET | `/api/learning/reliability` | Reliability reports |
| GET | `/api/learning/parameter-suggestions` | Parameter recommendations |

### Real-Time

| Method | Path | Description |
|---|---|---|
| GET | `/api/stream/:symbol` | SSE real-time stream |
| GET | `/api/stream/status` | Stream health |

### Ledger & Broker

| Method | Path | Description |
|---|---|---|
| GET | `/api/ledger` | Trade history |
| POST | `/api/signals/generate` | Generate signals |
| POST | `/api/signals/execute` | Execute signal |
| GET | `/api/broker/status` | Broker connection status |
| POST | `/api/broker/mode` | Switch REVIEW/LIVE mode |
| GET | `/api/account` | Account balance |
| POST | `/api/backtest/run` | Run backtest |

### External Intelligence (NEW)

| Method | Path | Description |
|---|---|---|
| GET | `/api/external-intel/refresh` | Trigger economic calendar refresh |

---

## 20. Technical Debt & Risk Assessment

### Known Issues

| Issue | Impact | Status |
|---|---|---|
| **analysis.ts volume type** | TypeScript error: `volume?: number` not assignable to `Candle.volume: number` 3 times | **Pre-existing** — cast needs fixing |
| **hasEqualHighsLows not implemented** | Five Box Setup template uses partial rule tree | **Known** — referenced by seed, predicate not written |
| **6 unimplemented predicates** | `hasDisplacement`, `hasLiquiditySweep`, `hasBreakerBlock`, `hasSessionAlignment`, `hasRangeExpansion`, `hasWeeklyExpansionContext` | **Known** — templates use proxy predicates |
| **TV MSIX sandbox** | CDP doesn't bind by default | **Workaround** — documented `shell:AppsFolder` fix in `.env` |
| **No test for `strategies.ts` route** | HTTP integration test missing | **Todo** — route tested manually only |
| **No vitest config in api-server** | New tests use `tsx` runner (hand-rolled assertions) | **Pattern** — no migration needed |
| **`pnpm-lock.yaml` stale** | Dependencies from this session not yet committed to lockfile | **Pending** — `pnpm install --no-frozen-lockfile` will regenerate |
| **Frontend state management** | No global store — props drilled through dashboard | **Architectural decision** — works at current scale |
| **Browser API key exposed** | `FIREWORKS_API_KEY` in `.env` committed to repo | **Security risk** — should be environment-only |

### Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| LLM API key exposure in `.env` | **High** | Validate `.env` is in `.gitignore` (currently tracked) |
| No test coverage for routes | Medium | Manual testing pre-commit |
| No dependency locking | Medium | Commit `pnpm-lock.yaml` |
| MSIX sandbox blocks CDP | Low | Documented workaround |
| Database connection hard-fails | Low | Deep-noop proxy for offline mode |
| TV data fetch hangs | Low | 10s timeouts on all CDP evaluate calls |

### Improvement Roadmap

| Priority | Item | Effort |
|---|---|---|
| P0 | Rotate committed API keys, add `.env` to `.gitignore` | 5min |
| P0 | Commit `pnpm-lock.yaml` | 2min |
| P1 | Implement missing 7 predicates | 1 session |
| P1 | Add HTTP integration tests for `strategies.ts` route | 1 session |
| P2 | Wire economic events into evaluator args | 1 session |
| P2 | Add `isNewsBlackoutWindow` to Silver Bullet templates | 30min |
| P3 | CI test runner for api-server tests | 1 session |
| P3 | Global state (Zustand) if dashboard component grows further | 2 sessions |

---

## 21. Glossary

| Term | Definition |
|---|---|
| **BSL** | Buy-Side Liquidity — resting stop orders above swing highs |
| **SSL** | Sell-Side Liquidity — resting stop orders below swing lows |
| **BOS** | Break of Structure — price breaks through a swing point |
| **CHoCH** | Change of Character — structural reversal signal |
| **FVG** | Fair Value Gap — price imbalance between consecutive candles |
| **OB** | Order Block — institutional footprint zone |
| **IDM** | Inducement — internal consolidation that traps retail stops |
| **OTE** | Optimal Trade Entry — 62–79% Fibonacci retracement zone |
| **MSS** | Market Structure Shift — pivot sequence break signaling reversal |
| **SMT** | Smart Money Technique — divergence between correlated assets |
| **PD Array** | Premium/Discount Array — buy in discount, sell in premium |
| **ICT** | Inner Circle Trader — Michael Huddleston's methodology |
| **SMC** | Smart Money Concepts — retail-friendly ICT derivatives |
| **IPDA** | Interbank Price Delivery Algorithm — price delivery cycles |
| **PO3** | Power of Three — Accumulation, Manipulation, Distribution |
| **CDP** | Chrome DevTools Protocol — browser automation interface |
| **MCP** | Model Context Protocol — AI tool standard |
| **SSE** | Server-Sent Events — real-time push to browser |
| **StrategyDefinition** | Named rule tree with metadata (Zod-validated) |
| **Rule** | Recursive discriminated union (predicate / and / or / not) |
| **Predicate** | Pure function returning `{ matched, evidence, score? }` |
| **DetectionResult** | Evaluation output with `strategyId`, `status`, `matched`, `score` |
| **Narrative** | Deterministic 5-paragraph market commentary |
| **Reasoning** | LLM-generated adversarial evaluation |

---

*Generated 2026-07-18. For the latest version, see the Obsidian vault at `.obsidian/` or the live docs at `docs/`.*
