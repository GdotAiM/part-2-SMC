# SMC Pulse Predict — Complete Architecture Report

## Principal Software Architect's Reverse Engineering & System Audit

**Repository:** `part-2-SMC`  
**Generated:** 2026-07-14  
**Type:** pnpm monorepo — Node.js 22+, Express 5, React 19  
**Primary Language:** TypeScript (esbuild-bundled server, Vite-bundled frontend)  

---

## Table of Contents

1. Executive Summary
2. Repository Structure & Module Map
3. Project Stack & Dependencies
4. Architecture Overview
5. SMC Engine Architecture
6. AI & LLM Pipeline
7. Agent Loop Engine Flow
8. AI Flow Diagram
9. Backend Architecture
10. Frontend Architecture
11. Database ER Diagram
12. API Documentation
13. Sequence Diagrams
14. User Journey
15. Technical Debt Report
16. Risk Assessment
17. Improvement Roadmap
18. Complete Glossary
19. Onboarding Guide
20. "How the Entire System Works" Narrative

---

## 1. Executive Summary

SMC Pulse Predict is an AI Trading Operating System that applies ICT (Inner Circle Trader) / SMC (Smart Money Concepts) methodology to live market data. It runs as a monorepo with 3 artifacts, 3 shared libraries, and 2 deployment targets.

**Core Capabilities:**
- Real-time OHLCV ingestion (Binance WS for crypto, Finnhub/Yahoo for forex)
- 7-module SMC detection engine (structure, liquidity, OB, FVG, PD Array, daily bias, SMT divergence)
- Multi-agent AI pipeline (Fireworks AI / DeepSeek V4 Pro) with streaming SSE
- Autonomous Agent Loop with memory, guardrails, and observability
- TradingView Desktop CDP integration (86 MCP tools)
- Learning & Validation Framework comparing internal engine vs TV indicators
- **Truth Engine** — decision arbitration layer that resolves "who do I trust?" by combining reliability, outcome history, and market context into one authoritative answer per level
- Trade ledger with 7-dimension performance matrix
- Backtesting with sliding-window SMC simulation
- Broker-agnostic execution (MockBroker / Alpaca paper trading)

---

## 2. Repository Structure & Module Map

```
workspace/
│
├── artifacts/
│   ├── api-server/              # Node.js/Express 5 backend
│   │   └── src/
│   │       ├── index.ts          # Process entry: dotenv → port bind → WS subscribe → MCP
│   │       ├── app.ts            # Express factory: compression → cors → json → routes
│   │       ├── routes/           # 10 route modules
│   │       │   ├── index.ts          # Router mount
│   │       │   ├── health.ts         # GET /api/healthz
│   │       │   ├── symbols.ts        # GET /api/symbols
│   │       │   ├── analysis.ts       # GET /api/analysis/{crypto,forex}
│   │       │   ├── agents.ts         # POST /api/agents/{ask,pipeline}
│   │       │   ├── agents-mcp.ts     # POST /api/agents/ask-mcp
│   │       │   ├── agent-loop.ts     # Agent Loop REST+SSE endpoints
│   │       │   ├── stream.ts         # GET /api/stream/:symbol (SSE)
│   │       │   ├── ledger.ts         # Ledger, signals, broker, backtest
│   │       │   └── learning.ts       # 10 learning/validation endpoints
│   │       └── lib/ (see module sections below)
│   │
│   ├── liquidity-hunter/         # React 19 SPA frontend
│   │   └── src/
│   │       ├── pages/
│   │       │   ├── dashboard.tsx     # Main multi-TF dashboard
│   │       │   ├── Analytics.tsx     # Trade ledger + performance matrix
│   │       │   ├── Broker.tsx        # Broker execution dashboard
│   │       │   ├── AgentLoop.tsx     # Agent Loop control panel
│   │       │   └── LearningDashboard.tsx  # Learning framework dashboard (unwired)
│   │       └── components/
│   │           ├── ConfluenceCard.tsx
│   │           ├── ConfluenceSheet.tsx
│   │           ├── IntelligenceSheet.tsx
│   │           ├── ChartView.tsx     # TradingView Lightweight Charts v5
│   │           ├── AgentChat.tsx
│   │           ├── AgentPipeline.tsx
│   │           └── ui/              # shadcn/ui primitives
│   │
│   └── mockup-sandbox/           # Vite sandbox (experimental)
│
├── lib/
│   ├── db/                       # Drizzle ORM schema + lazy pool
│   │   └── schema/
│   │       ├── index.ts          # trades, performance_matrix, agent_loop_*, agent_memory
│   │       └── learning.ts       # detection_comparisons, outcomes, model_performance, etc.
│   ├── api-client-react/         # React Query hooks + shared types
│   ├── api-spec/                 # OpenAPI 3.1 contract
│   └── api-zod/                  # Zod schemas
│
├── deploy/
│   ├── local/                    # Docker Compose (Intel/AMD CPU)
│   └── amd-developer-cloud/      # Docker Compose + vLLM (AMD MI300X GPU)
│
├── claude-code-proxy/            # OpenAI-compatible proxy for Claude Code
├── scripts/                      # cd p-proxy, launch-tv.bat, start scripts
├── data/                         # mock_broker/ volumes
└── docs/                         # Architecture, migration, learning framework docs
```

---

## 3. Project Stack & Dependencies

### Backend (`@workspace/api-server`)

| Category | Package | Purpose |
|---|---|---|
| Server | `express@^5.2.1` | HTTP framework (Express 5, async router) |
| Build | `esbuild@0.27.3` | TypeScript bundler (single-file output) |
| ORM | `drizzle-orm@0.45.2` | PostgreSQL ORM (type-safe queries) |
| DB | `pg@^8.20.0` | Node-postgres driver |
| Real-time | `ws@^8.21.0` | WebSocket client (Binance) |
| Logging | `pino@^9.14.0` + `pino-http` | Structured JSON logging |
| CDP | `puppeteer@^25.3.0` | Legacy TV Desktop CDP |
| CDP | `chrome-remote-interface@^0.34.0` | New TV Desktop CDP |
| MCP | `fastmcp@^4.3.2` | Model Context Protocol server |
| LLM | `langfuse@^3.38.20` | LLM observability/tracing |
| AI | `axios@^1.17.0` | HTTP client for Fireworks AI API |
| Env | `dotenv@^17.4.2` | .env loading |
| Validation | `zod@3.25.76` | Schema validation |

### Frontend (`@workspace/liquidity-hunter`)

| Category | Package | Purpose |
|---|---|---|
| Framework | `react@19.1.0` + `react-dom@19.1.0` | UI |
| Bundler | `vite@^7.3.2` | Build + dev server |
| Routing | `wouter@^3.3.5` | Lightweight router |
| Data | `@tanstack/react-query@^5.90.21` | Server state |
| Charts | `lightweight-charts@^5.2.0` | TV Lightweight Charts |
| UI | `shadcn/ui` + `tailwindcss@4.1.14` | Component system |
| Anim | `framer-motion@^12.23.24` | Animations |

### Shared Libraries

| Package | Purpose |
|---|---|
| `@workspace/db` | Drizzle schema + lazy-initialized pg pool proxy |
| `@workspace/api-client-react` | React Query hooks + TypeScript types |
| `@workspace/api-zod` | Zod schemas matching OpenAPI contract |

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (React SPA)                      │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────┐ ┌────────────┐  │
│  │  Dashboard   │ │  Analytics   │ │  Broker  │ │Agent Loop  │  │
│  │  (7 TF cards)│ │  (ledger)    │ │  (trades)│ │(monitoring)│  │
│  └──────┬───────┘ └──────┬───────┘ └────┬─────┘ └─────┬──────┘  │
│         │                │              │              │         │
│         └────────────────┴──────┬───────┴──────────────┘         │
│                          │ SSE / REST │                          │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                    ┌──────┴──────┐
                    │ Express 5   │
                    │  (port 3001)│
                    └──────┬──────┘
                           │
      ┌────────────────────┼──────────────────────────┐
      │                    │                          │
┌─────┴─────┐    ┌────────┴────────┐        ┌─────────┴────────┐
│ Routes    │    │  SMC Engine     │        │  Real-Time       │
│ (10 mods) │    │  (7 detectors)  │        │  (WS + Store)    │
└─────┬─────┘    └────────┬────────┘        └─────────┬────────┘
      │                   │                          │
      │           ┌───────┴───────┐         ┌────────┴────────┐
      │           │ buildReport() │         │ Binance WS     │
      │           │ confluence()  │         │ Finnhub/Yahoo  │
      │           │ narrative()   │         │ candle-store   │
      │           └───────────────┘         │ SSE broadcast  │
      │                                     └────────────────┘
      │
      ├──→ FastMCP Server (port 3002)
      │         │
      │    ┌────┴────┐
      │    │ 86 TV   │
      │    │ tools   │←── TradingView Desktop (CDP port 9222)
      │    │ 12 SMC  │
      │    │ tools   │
      │    └─────────┘
      │
      ├──→ PostgreSQL 16 (Docker)
      │     ├─ trades / performance_matrix
      │     ├─ agent_loop_runs / steps / memory
      │     ├─ detection_comparisons / outcomes
      │     └─ learning_events / model_performance / parameter_history / pattern_statistics
      │
      └──→ Fireworks AI (DeepSeek V4 Pro)
            ├─ /api/agents/ask (Q&A)
            ├─ /api/agents/pipeline (4-agent)
            └─ /api/agents/ask-mcp (tool-calling)
```

---

## 5. SMC Engine Architecture

The SMC engine is located at `artifacts/api-server/src/lib/smc/` with 7 pure detection modules orchestrated by `report.ts`.

### Module Dependency Graph

```
report.ts (orchestrator)
├── structure.ts      { function: analyzeStructure }
│   ├── config.ts     { SMC_CONFIG — shared constants }
│   └── types.ts      { all shared interfaces }
├── liquidity.ts      { function: analyzeLiquidity }
├── fvg.ts            { function: analyzeFVG }
├── order-blocks.ts   { function: analyzeOrderBlocks }
├── pd-array.ts       { function: analyzePdArray }
├── daily-bias.ts     { function: analyzeDailyBias }
└── smt.ts            { function: analyzeSMT }
```

### Detection Algorithm Summary

| Module | Input | Output | Algorithm | Complexity |
|---|---|---|---|---|
| **structure.ts** | Candle[], timeframe | StructureResult (trend, bias, confidence, pivots, breaks, phase) | ATR-normalised window pivot detection → HH/HL/LH/LL classification → BOS/CHoCH labelling → phase inference | O(n × lookback) |
| **liquidity.ts** | Candle[], timeframe, market | LiquidityResult (BSL/SSL pools with scores + sweep probability) | Window extremum finder → pool grouping → session-weighted scoring → exponential probability-of-sweep | O(n × window) |
| **order-blocks.ts** | Candle[], FVG[] | OrderBlock[] (type, proximal/distal, confidence, breaker) | Displacement detection (ATR threshold) → backward OB search → FVG confluence check → mitigation scan → confidence scoring | O(n × lookForward) |
| **fvg.ts** | Candle[], market | FairValueGap[] (top, bottom, fillFraction, isInversion) | 3-candle gap detection → forward fill tracking → inversion identification → minimum size filter | O(n²) worst |
| **pd-array.ts** | Candle[], timeframe | PdArrayResult (premium/discount, equilibrium, zones) | Dealing range from window → equilibrium midpoint → zone generation | O(n) |
| **daily-bias.ts** | Candle[] (1D) | DailyBiasResult (bias, strength, evidence) | Structure-primary (pivot sequence) → PD confirmation → SMA secondary tiebreaker → strength table | O(n) |
| **smt.ts** | Candles[] (primary + correlated) | SmtDivergence (detected, type, confidence, time) | Aligned extremum finder → HH/LL divergence check → magnitude + timing confidence | O(n²) |

### buildReport() Orchestration Flow

```
analyzeStructure()  ──→ structure ──┐
analyzeFVG()        ──→ fvg ────────┤
analyzeLiquidity()  ──→ liquidity ──┤
analyzeOrderBlocks() ──→ obs ──────┼─→ confluenceBoost() → DrawTarget[]
analyzePdArray()    ──→ pdArray ───┤
analyzeDailyBias()  ──→ dailyBias ─┤
analyzeSMT()        ──→ smt ───────┘
                                    ↓
                          deriveSessionState()
                          buildMarketNarrative()
                                    ↓
                              SmcReport
```

### Configuration Engine (`config.ts`)

All tunable parameters are centralized in `SMC_CONFIG`. Per-timeframe overrides exist for pivot lookback (2–5) and ATR period (6–14). Key parameters: `equalLevelThreshold: 0.001`, `fvgMinBodyRatio: 0.5`, `obRequireFvg: true`, `sessionWeights.overlap: 1.5`.

---

## 6. AI & LLM Pipeline

### Provider Architecture (`lib/llm/provider.ts`)

```
LLM_PROVIDER env var
├── "fireworks" (default) → https://api.fireworks.ai/inference/v1
│     Model: accounts/fireworks/models/deepseek-v4-pro
│     Cost: $1.20/1M input, $4.80/1M output
├── "openai" → https://api.openai.com/v1
│     Model: gpt-4o ($2.50/$10.00 per 1M)
├── "amd" → self-hosted vLLM (http://host:8000/v1)
│     Model: google/gemma-4-26B-A4B-it
├── "custom" → any OpenAI-compatible endpoint
└── "ollama" → http://host.docker.internal:11434/v1
```

### Three AI Interaction Modes

| Mode | Route | Streaming | Context | Use Case |
|---|---|---|---|---|
| **Q&A** | `POST /api/agents/ask` | SSE | SmcReport + 8-turn history | User asks questions about current chart |
| **Pipeline** | `POST /api/agents/pipeline` | SSE (4-agent) | SmcReport | Structured analysis (Structure → Liquidity → FVG → Confluence) |
| **Agent Loop** | `POST /api/agent-loop/run` | SSE (7-step) | Report + memory + news | Autonomous reasoning → decision → signal |
| **MCP Agent** | `POST /api/agents/ask-mcp` | SSE | Tool definitions + context | LLM autonomously calls 11 SMC tools |

### Prompt Construction

The `buildSystemPrompt()` function injects the live SmcReport as a structured market brief: structure bias, liquidity pools, OBs, FVGs, PD array, SMT, and top draw targets. All prices are literal — the model cannot hallucinate levels.

---

## 7. Agent Loop Engine Flow

The Agent Loop (`lib/loop/AgentLoop.ts`) implements a 7-step autonomous cycle:

```
LoopConfig → AgentLoop.run(report)
  │
  ├── 1. OBSERVE
  │     └── Store SmcReport in LoopContext
  │         Check guardrails (confidence floor, risk limits)
  │
  ├── 2. INTERPRET
  │     └── Call 8 SMC tools via toolRegistry:
  │         analyze_structure, analyze_liquidity, analyze_order_blocks,
  │         analyze_fvg, analyze_pd_array, get_daily_bias,
  │         detect_smt, get_draw_targets
  │
  ├── 3. REASON  (← LLM call)
  │     └── Build prompt: interpreted data + episodic memory +
  │         semantic memory + news context + TV reconciliation
  │         → Call LLM → receive structured Decision
  │
  ├── 4. DECIDE
  │     └── Validate Decision through AgentGuardrails:
  │         - confidenceFloor: must meet minimum confidence
  │         - maxRiskPerTrade: R:R must not exceed limit
  │         - requiredConfluenceMin: enough confluence factors
  │
  ├── 5. ACT
  │     └── If decision = generate_signal:
  │         → SignalGenerator.generateFromReport()
  │         → TradeLedgerService.logSignal()
  │
  ├── 6. EVALUATE
  │     └── LoopEvaluator.score(): base score + confidence bonus + tool efficiency
  │
  └── 7. UPDATE
        └── LoopTracer.persist() → agent_loop_runs + agent_loop_steps
            MemoryService.recordOutcome() → agent_memory
```

### Memory Architecture

```
MemoryService
├── EpisodicMemory ← TradeLedgerService
│   ├── getRecentBySymbol(symbol, limit)
│   ├── getBySetupType(type, limit)
│   └── getWinRate(symbol, type?)
│
├── SemanticMemory ← agent_memory table
│   ├── getTopPatterns(symbol)
│   ├── getRulesForRegime(regime)
│   └── storeEntry(key, content, tags)
│
└── QdrantMemory (optional, vector)
    ├── storeSignal(signal, candles, report)
    └── findSimilar(setup, limit) → similar past setups
```

---

## 8. AI Flow Diagram

```
Client                        Server                    Fireworks AI
  │                             │                          │
  │  POST /api/agents/ask       │                          │
  │  { question, report }       │                          │
  │────────────────────────────►│                          │
  │                             │  buildSystemPrompt()     │
  │                             │  inject SmcReport        │
  │                             │                          │
  │                             │  POST /chat/completions  │
  │                             │─────────────────────────►│
  │                             │                          │
  │  ◄── SSE: {"content":"The"} │  ◄── stream delta ──────│
  │  ◄── SSE: {"content":" "}   │  ◄── stream delta ──────│
  │  ◄── SSE: {"content":"nearest"} │                       │
  │  ...                         │  ...                    │
  │  ◄── SSE: {"done":true}     │  ◄── [DONE] ────────────│
```

For the Agent Loop, step 3 (Reason) uses the same streaming pattern but with a much richer prompt including memory, news, and TV reconciliation.

---

## 9. Backend Architecture

### Layers

| Layer | Directory | Notes |
|---|---|---|
| **Entry** | `src/index.ts` | dotenv → port validation → Express listen → WS subscribe → MCP start |
| **Express** | `src/app.ts` | compression + cors + pino-http + json parser → mount /api |
| **Routes** | `src/routes/` | 10 modules, each a sub-router |
| **SMC Engine** | `src/lib/smc/` | 7 detection modules + config + types + report |
| **Real-time** | `src/lib/realtime/` | binance-ws + forex-ws + candle-store + sse-manager + analysis-bridge |
| **AI** | `src/lib/llm/` | provider.ts + structured.ts |
| **Agent Loop** | `src/lib/loop/` | AgentLoop + LoopContext + AgentGuardrails + MonitoringManager |
| **Memory** | `src/lib/memory/` | EpisodicMemory + SemanticMemory + MemoryService + vector/ |
| **Observability** | `src/lib/harness/` | LoopTracer + LoopEvaluator |
| **Execution** | `src/lib/execution/` | BrokerAbstraction + AlpacaAdapter + ExecutionManager |
| **Services** | `src/lib/services/` | SignalGenerator + TradeLedgerService + PerformanceMatrixService + TradeSettlementService |
| **Backtest** | `src/lib/backtest/` | BacktestRunner (sliding-window) |
| **MCP** | `src/lib/mcp/` | server.ts + tool-registry + tools/ + resources/ + prompts/ |
| **Learning** | `src/lib/comparison/` | ComparisonEngine |
| | `src/lib/fusion/` | EvidenceFusionLayer |
| | `src/lib/truth/` | TruthEngine (Decision Arbitration) |
| | `src/lib/learning/` | LearningService |
| | `src/lib/reliability/` | ReliabilityEngine |
| | `src/lib/reflection/` | ReflectionEngine |
| | `src/lib/evaluation/` | OutcomeEvaluator |
| | `src/lib/optimization/` | ParameterRecommendationService |
| **Integrations** | `src/lib/integrations/tradingview/` | Legacy TV CDP (Puppeteer) |
| | `src/lib/integrations/tradingview-desktop/` | New TV CDP (chrome-remote-interface, 86 tools) |

### Route Table

| Path | Method | Router Module |
|---|---|---|
| `/api/healthz` | GET | health.ts |
| `/api/symbols` | GET | symbols.ts |
| `/api/analysis/crypto` | GET | analysis.ts |
| `/api/analysis/forex` | GET | analysis.ts |
| `/api/agents/ask` | POST | agents.ts |
| `/api/agents/pipeline` | POST | agents.ts |
| `/api/agents/ask-mcp` | POST | agents-mcp.ts |
| `/api/agent-loop/run` | POST | agent-loop.ts |
| `/api/agent-loop/start-monitoring` | POST | agent-loop.ts |
| `/api/agent-loop/stop-monitoring` | POST | agent-loop.ts |
| `/api/agent-loop/status` | GET | agent-loop.ts |
| `/api/agent-loop/runs` | GET | agent-loop.ts |
| `/api/stream/:symbol` | GET | stream.ts |
| `/api/ledger` | GET | ledger.ts |
| `/api/ledger/pending` | GET | ledger.ts |
| `/api/signals/generate` | POST | ledger.ts |
| `/api/signals/execute` | POST | ledger.ts |
| `/api/broker/status` | GET | ledger.ts |
| `/api/broker/mode` | POST | ledger.ts |
| `/api/account` | GET | ledger.ts |
| `/api/performance-matrix` | GET | ledger.ts |
| `/api/performance-matrix/rebuild` | POST | ledger.ts |
| `/api/backtest/run` | POST | ledger.ts |
| `/api/backtest/run-multi` | POST | ledger.ts |
| `/api/agent-loop/tv-status` | GET | agent-loop.ts |
| `/api/agent-loop/tv-config` | POST | agent-loop.ts |
| `/api/agent-loop/tv-connect` | POST | agent-loop.ts |
| `/api/learning/comparisons` | GET/POST | learning.ts |
| `/api/learning/evaluate-outcomes` | POST | learning.ts |
| `/api/learning/reliability` | GET | learning.ts |
| `/api/learning/parameter-suggestions` | GET/POST | learning.ts |
| `/api/learning/events` | GET | learning.ts |
| `/api/learning/patterns` | GET | learning.ts |
| `/api/learning/dashboard` | GET | learning.ts |

---

## 10. Frontend Architecture

### Routing (Wouter)

```
/              → Dashboard (multi-TF analysis)
/analytics     → Trade ledger + performance matrix
/broker        → Broker execution controls
/agent-loop    → Agent Loop dashboard + monitoring
*              → 404
```

### Dashboard Component Tree

```
Dashboard (page)
├── Header (market selector, bias icons, real-time badge)
├── ConfluenceCard (multi-TF cascade summary)
│   └── TfAgentCard × N (one per timeframe)
│       ├── BiasIcon
│       ├── TfLabel
│       ├── TvCardControl
│       └── OnClick → IntelligenceSheet
├── ConfluenceSheet (overlay — deep multi-TF cascade)
├── IntelligenceSheet (overlay — single-TF deep dive)
├── ChartView (overlay — lightweight-charts v5)
├── MarketBriefing (footer bar)
└── TvStatus (footer)
```

### State Management

**No global state manager** (no Redux/Zustand). State is split:
- **Server state**: TanStack Query (React Query) — analysis reports, symbols
- **UI state**: `useState` in dashboard.tsx — selected market, style, sheets
- **Real-time**: `useRealtimeStream` hook — SSE candle updates
- **History**: `useState<Message[]>` in AgentChat, `useState<LoopStepEvent[]>` in AgentLoop

### UI Component Library

shadcn/ui with Tailwind CSS v4, dark mode enforced (`documentElement.classList.add("dark")`).

---

## 11. Database ER Diagram

### Tables (11 total)

```
trades
├── id UUID PK
├── asset_class VARCHAR(20)    — STOCK | FOREX | CRYPTO
├── symbol VARCHAR(20)
├── setup_type VARCHAR(50)     — OB | FVG | MSS | CHoCH | BOS | ...
├── setup_subtype VARCHAR(50)  — BULLISH_OB | BEARISH_OB | ...
├── entry_price DECIMAL(20,8)
├── stop_loss DECIMAL(20,8)
├── take_profit DECIMAL(20,8)
├── confidence_score INTEGER
├── analysis_context JSONB     — timeframe_cascade, market_regime, session, htf_bias, confluence
├── parameter_snapshot JSONB
├── execution_mode VARCHAR(10)  — REVIEW | LIVE
├── outcome JSONB              — pnl, win, exit_reason
├── rationale JSONB            — structure_confluence, liquidity_quality
├── structure_confluence INTEGER
├── liquidity_quality INTEGER
├── confluence_count INTEGER
├── risk_reward_ratio DECIMAL(8,4)
├── signal_timestamp TIMESTAMP
├── created_at TIMESTAMP
├── closed_at TIMESTAMP?
└── order_id VARCHAR(100)?
    Indexes: asset+setup, symbol+setup, execution_mode, created_at

performance_matrix
├── id UUID PK
├── asset_class VARCHAR(20)
├── symbol VARCHAR(20)
├── setup_type VARCHAR(50)
├── setup_subtype VARCHAR(50)
├── timeframe_cascade VARCHAR(50)
├── market_regime VARCHAR(50)
├── session_context VARCHAR(50)
├── win_rate DECIMAL(5,4)
├── sharpe_ratio DECIMAL(8,4)
├── profit_factor DECIMAL(8,4)
├── avg_win / avg_loss DECIMAL(16,4)
├── max_drawdown DECIMAL(5,4)
├── trials INTEGER
├── is_significant BOOLEAN
├── parameters JSONB
├── last_calculated / last_optimized TIMESTAMP
    UNIQUE: (asset_class, symbol, setup_type, setup_subtype, timeframe_cascade, market_regime, session_context)

agent_loop_runs
├── id UUID PK
├── symbol VARCHAR(20)
├── timeframe VARCHAR(5)
├── market VARCHAR(10)
├── config_snapshot JSONB
├── status VARCHAR(20)          — running | completed | error | stopped
├── triggered_by VARCHAR(20)    — candle_close | api | scheduled | manual
├── total_iterations INTEGER
├── total_tokens INTEGER
├── result JSONB
├── evaluation_score INTEGER?
├── evaluation JSONB?
├── started_at / completed_at TIMESTAMP
    Indexes: symbol, status, started_at

agent_loop_steps (FK → agent_loop_runs CASCADE)
├── id UUID PK
├── run_id UUID FK
├── iteration_sequence INTEGER
├── step_type VARCHAR(30)       — observe | interpret | reason | decide | act | evaluate | update_memory
├── started_at / completed_at TIMESTAMP
├── duration_ms INTEGER
├── input_snapshot / output_snapshot JSONB
├── tool_calls JSONB
├── error VARCHAR(500)?
    Indexes: run_id, step_type

agent_memory
├── id UUID PK
├── memory_key VARCHAR(200) UNIQUE
├── content TEXT
├── source VARCHAR(30)          — matrix | episode | manual | evaluation
├── score DECIMAL(5,4)
├── tags VARCHAR(50)[]
├── is_durable BOOLEAN
├── source_run_id VARCHAR(100)?
├── created_at / last_accessed_at TIMESTAMP

detection_comparisons
├── id UUID PK
├── symbol VARCHAR(20)
├── timeframe VARCHAR(5)
├── market VARCHAR(10)
├── detection_type VARCHAR(30)  — OB | FVG | BOS | CHOCH | LIQUIDITY_SWEEP | ...
├── price_level DECIMAL(20,8)
├── tv_detected BOOLEAN
├── tv_confidence DECIMAL(5,4)?
├── tv_price DECIMAL(20,8)?
├── tv_metadata JSONB
├── engine_detected BOOLEAN
├── engine_confidence DECIMAL(5,4)?
├── engine_price DECIMAL(20,8)?
├── engine_metadata JSONB
├── agreement VARCHAR(20)       — BOTH_DETECTED | TV_ONLY | ENGINE_ONLY | NEITHER
├── price_discrepancy_pct DECIMAL(10,4)?
├── confidence_gap DECIMAL(5,4)?
├── candle_time TIMESTAMP
├── signal_id VARCHAR(100)?

detection_outcomes (FK → detection_comparisons CASCADE)
├── id UUID PK
├── comparison_id UUID FK
├── outcome VARCHAR(30)         — RESPECTED | SWEPT | IGNORED | FILLED | REVERSAL | ...
├── touch_price / max_extension DECIMAL?
├── bars_until_touch INTEGER?
├── correct_source VARCHAR(20)? — TV | ENGINE | BOTH | NEITHER
├── would_win BOOLEAN?
├── hypothetical_pnl_pct DECIMAL?

model_performance
├── id UUID PK
├── source VARCHAR(10)          — TV | ENGINE
├── detection_type VARCHAR(30)
├── total_detections INTEGER
├── correct_detections INTEGER
├── false_positives INTEGER
├── reliability_score DECIMAL(5,4)
├── symbol_reliability / timeframe_reliability / session_reliability / regime_reliability JSONB
├── rolling_30d_accuracy DECIMAL(5,4)?
├── improvement_trend DECIMAL(6,4)?
    UNIQUE: (source, detection_type)

parameter_history
├── id UUID PK
├── component VARCHAR(30)       — structure | liquidity | ob | fvg | ...
├── parameter_name VARCHAR(50)  — atrPeriod | pivotLookback | fvgMinBodyRatio | ...
├── current_value DECIMAL(12,6)
├── suggested_value DECIMAL(12,6)
├── sample_size INTEGER
├── win_rate_improvement DECIMAL(6,4)?
├── confidence DECIMAL(5,4)?
├── status VARCHAR(20)          — suggested | approved | applied | rejected | superseded
├── approved_at TIMESTAMP?
├── approved_by VARCHAR(100)?

learning_events
├── id UUID PK
├── event_type VARCHAR(30)      — AGREEMENT_BREAKTHROUGH | PARAMETER_SUGGESTION | ...
├── title VARCHAR(200)
├── description TEXT
├── evidence / metadata JSONB
├── significance DECIMAL(3,2)

pattern_statistics
├── id UUID PK
├── pattern_name VARCHAR(100)
├── pattern_type VARCHAR(30)    — FAILURE_PATTERN | SUCCESS_PATTERN | DISAGREEMENT_PATTERN
├── description TEXT
├── conditions JSONB
├── occurrence_count INTEGER
├── win_rate_when_present DECIMAL(5,4)?
├── confidence DECIMAL(5,4)?
├── first_observed / last_observed TIMESTAMP
```

---

## 12. API Documentation

All API routes listed in section 9 (Backend Architecture). Key patterns:

- **Analysis**: `GET /api/analysis/{market}?symbol=X&timeframe=Y` returns full `SmcReport` JSON. Cache TTL 60s.
- **AI (Q&A)**: `POST /api/agents/ask` with `{question, report, history}` → SSE stream of tokens. 1024 max tokens.
- **AI (Pipeline)**: `POST /api/agents/pipeline` with `{report}` → SSE stream of 4 agents. 512 tokens each.
- **Agent Loop**: `POST /api/agent-loop/run` with `{symbol, timeframe}` → SSE stream of 7 steps.
- **SSE Streaming**: `GET /api/stream/:symbol?timeframes=1m,5m` → real-time candle updates.
- **Signal Generation**: `POST /api/signals/generate` with `{symbol, market, timeframe}` → generated signal.
- **Learning**: `POST /api/learning/comparisons/analyze` → compare TV vs Engine, store result.

---

## 13. Sequence Diagrams

### Candle Close → SSE Broadcast Flow

```
Binance WS                         candleStore                analysis-bridge                  SSE Manager              Browser
  │                                    │                         │                                │                      │
  │  kline event (isClosed=true)       │                         │                                │                      │
  │──────────────────────────────────►│                         │                                │                      │
  │                                    │  applyUpdate()          │                                │                      │
  │                                    │  emit("candleClosed")   │                                │                      │
  │                                    │────────────────────────►│                                │                      │
  │                                    │                         │  getCandles(sym, tf)            │                      │
  │                                    │◄────────────────────────│                                │                      │
  │                                    │  Candle[]               │                                │                      │
  │                                    │────────────────────────►│                                │                      │
  │                                    │                         │  buildReport() → SmcReport     │                      │
  │                                    │                         │  updateCachedReport()          │                      │
  │                                    │                         │  broadcastReport(report)        │                      │
  │                                    │                         │───────────────────────────────►│                      │
  │                                    │                         │                                │  SSE: "report_update" │
  │                                    │                         │                                │──────────────────────►│
```

### TV Comparison Cycle

```
Browser/CLI                    API Server                  TV Desktop CDP              PostgreSQL
  │                               │                            │                        │
  │ POST /learning/comparisons    │                            │                        │
  │ /analyze                      │                            │                        │
  │──────────────────────────────►│                            │                        │
  │                               │  fetch candles             │                        │
  │                               │  buildReport()             │                        │
  │                               │                            │                        │
  │                               │  readPineLevels()          │                        │
  │                               │───────────────────────────►│                        │
  │                               │  TV DetectionPoint[]       │                        │
  │                               │◄───────────────────────────│                        │
  │                               │                            │                        │
  │                               │  compareDetections()       │                        │
  │                               │  extractEngineDetections() │                        │
  │                               │  evidenceFusionLayer.fuse()│                        │
  │                               │                            │                        │
  │                               │  storeComparisons()        │                        │
  │                               │───────────────────────────────────────────────────►│
  │                               │                            │                        │
  │  {comparisons, decisions,     │                            │                        │
  │   metrics, report}            │                            │                        │
  │◄──────────────────────────────│                            │                        │
```

---

## 14. User Journey

### First-Time User Flow

1. User opens `http://localhost:3000`
2. Dashboard loads with 7 timeframe cards for BTCUSDT (default)
3. Each card shows: bias icon, confidence bar, draw target, key metrics
4. User can switch style (Scalp/Intraday/Swing/All) or market (Crypto/Forex)
5. User taps a timeframe card → IntelligenceSheet opens with full analysis
   - Structure narrative, BOS/CHoCH markers, liquidity pools, OBs, FVGs, PD array
6. User can ask questions in AgentChat ("Where is the draw?")
7. User can run the 4-agent pipeline for structured analysis
8. User opens ConfluenceCard → ConfluenceSheet for multi-TF cascade view
9. Charts display OB/FVG rectangles, KZO lines, BOS/CHoCH markers

### Power User Flow

1. Enables TV Desktop integration → levels drawn on their TV chart
2. Configures Agent Loop monitoring for a symbol/timeframe
3. Reviews analytical performance on the Agent Loop history tab
4. Generates signals via SignalGenerator → views in Broker page
5. REVIEW mode execution → monitors outcome via TradeSettlementService
6. Reviews performance via Analytics page (performance matrix)
7. Runs backtests on past data → populates performance matrix
8. Reviews comparison data on Learning Dashboard

---

## 15. Technical Debt Report

### Critical Issues

| # | Issue | Location | Impact | Suggested Fix |
|---|---|---|---|---|
| 1 | **esbuild variable renaming breaks Drizzle ORM** | `build.mjs` + `LearningService.ts` | Batch inserts fail; forced to use raw `pg.Pool` queries in learning routes. `@workspace/db` Proxy-based lazy pool is bundled by esbuild and the Proxy/Proxy-chain breaks for some methods | Either: (a) mark `@workspace/db`, `drizzle-orm`, and `pg` as external in `build.mjs` and ensure they're available at runtime, or (b) replace the Proxy-based lazy pool with a standard singleton pattern |
| 2 | **Import path breaks in new TV Desktop module** | `tradingview-desktop/core/connection.ts` and related files | Import paths reference `../../tradingview/config.js` — fragile relative path coupling | Create a shared re-export barrel at `integrations/config.ts` that both integration modules import from |
| 3 | **No unit test execution infrastructure** | All `.test.ts` files | Tests exist (`ComparisonEngine.test.ts`, `structure.test.ts`) but no test runner configured in CI | Add vitest configuration, test scripts to package.json |

### Medium Issues

| # | Issue | Location | Impact | Suggested Fix |
|---|---|---|---|---|
| 4 | **Learning Dashboard not wired into frontend router** | `LearningDashboard.tsx` exists but `App.tsx` has no route for it | Framework data only accessible via API, not UI | Add `<Route path="/learning" component={LearningDashboard} />` to `App.tsx` |
| 5 | **No migration runner** | `docs/migrations/` has raw SQL | Manual SQL execution required to set up DB | Integrate with Drizzle Kit or add a migration script |
| 6 | **Mixed authentication patterns in DB connection** | `@workspace/db` uses Proxy-based lazy pool; learning routes use raw `pg.Pool` | Two different connection strategies, one is known-broken | Standardize on one pattern (recommend: raw `pg.Pool` singleton) |
| 7 | **Frontend TanStack Query hooks are "manually maintained"** | Comment in `api-client-react` says generated types but hooks are hand-written | Risk of drift between API schema and frontend types | Adopt `openapi-typescript` codegen or tRPC |
| 8 | **No rate limiting on API** | Express app has no rate limiter | A chatty client could exhaust Fireworks AI token budget | Add `express-rate-limit` middleware |

### Minor Issues

| # | Issue | Location | Impact | Suggested Fix |
|---|---|---|---|---|
| 9 | **Hardcoded fallback `extra_hosts` IP** | `deploy/local/docker-compose.yml:63` | `192.168.100.8` is specific to one network | Use `host.docker.internal` or auto-detect |
| 10 | **Cache eviction is simple count-based FIFO** | `routes/analysis.ts` | Rarely accessed but worst-case O(n) eviction | Use `Map` with insertion-order iteration limit or `lru-cache` package |
| 11 | **`dotenv.config()` path hardcoded** | `src/index.ts` | `../../../.env` works from dist but breaks if project structure changes | Runtime resolution or config option |
| 12 | **`workspace` version strings all `0.0.0`** | All `package.json` files | No release versioning | Add `semantic-release` or manual versioning |
| 13 | **Docker compose `version: "3.9"` is obsolete** | `deploy/local/docker-compose.yml:19` | Warning on every Docker command | Remove `version` field |

---

## 16. Risk Assessment

| Risk | Probability | Severity | Mitigation |
|---|---|---|---|
| **Fireworks AI API outage** | Low | High | Provider abstraction supports 5 providers; can switch to OpenAI, vLLM, or Ollama via env var |
| **Binance WebSocket DNS failure** | Medium | Medium | 2-endpoint fallback chain (binance.us → binance.com) + auto-reconnect with exponential backoff |
| **Yahoo Finance API rate limiting** | High | Medium | 60s cache mitigates; forex falls back to 15s polling with no key needed |
| **TV Desktop CDP API changes** | Medium | Medium | Version-based app detection (TV Desktop 3.1.0+) with Electron version compatibility checking |
| **Docker PostgreSQL data loss** | Low | High | Named volumes (`pgdata`) persist across restarts; migration at `docs/migrations/003` |
| **LLM token cost runaway** | Medium | Low | `max_tokens` capped at 512–1024; cost tracking via Langfuse; model pricing table |
| **Learning framework data accumulation** | Low | Low | Insert-only tables with no current archiving — ~1KB per comparison, 100k/year ≈ 100MB |
| **TypeScript/esbuild version mismatch** | Low | Medium | esbuild 0.27.3 with TypeScript 5.9 — both modern, esbuild's TS support is up-to-date |

---

## 17. Improvement Roadmap

### Immediate (0–2 weeks)

1. **Fix esbuild + Drizzle ORM Proxy compatibility** — Mark `@workspace/db`, `drizzle-orm`, `pg` as external in `build.mjs`. Resolve the root cause of batch-insert failures
2. **Wire Learning Dashboard into frontend** — Add route and navigation link
3. **Configure test runner** — Vitest setup, make existing tests executable
4. **Add migration runner** — Script that applies `docs/migrations/003_learning_framework.sql` automatically

### Short-term (2–6 weeks)

5. **Database connection standardization** — Replace Proxy-based lazy pool with direct `pg.Pool` singleton pattern across the entire codebase
6. **Auto-compare on monitoring** — When Agent Loop monitors a symbol, automatically run comparison cycles after each candle close
7. **Outcome evaluation automation** — After comparison is stored, schedule evaluation after N lookback candles
8. **Parameter recommendation UI** — UI for viewing/approving/rejecting parameter suggestions

### Medium-term (6–12 weeks)

9. **Learning Dashboard visualizations** — Add charts for reliability trends, comparison heatmaps, agreement time-series
10. **Cross-symbol pattern learning** — Detect patterns that generalize across symbols and asset classes
11. **Git-based parameter versioning** — Track approved parameter changes as structured commits
12. **Alert system** — Notify when per-type reliability crosses configurable thresholds

### Long-term (3–6 months)

13. **Performance Matrix integration with learning** — Feed outcome evaluation results into Performance Matrix for enriched analytics
14. **Multi-timeframe outcome correlation** — Determine which TFs have the most predictive reliability
15. **Autonomous parameter evolution** — Auto-approve parameter changes with confidence > 95% and > 1000 examples
16. **Engine overtakes TV milestone tracking** — Detect and celebrate when internal engine surpasses TV reliability for any detection type

---

## 18. Complete Glossary

### Core Types & Interfaces

| Name | Module | Description |
|---|---|---|
| `Candle` | `smc/types` | `{ time, open, high, low, close, volume }` |
| `SmcReport` | `smc/report` | Complete market analysis — structure, liquidity, OBs, FVGs, PD array, bias, SMT, draw targets, narrative, session state |
| `StructureResult` | `smc/structure` | `{ trend, bias, confidence, pivots[], breaks[], phase, narrative, evidence[] }` |
| `LiquidityResult` | `smc/liquidity` | `{ pools[], nearestBSL, nearestSSL }` |
| `OrderBlock` | `smc/order-blocks` | `{ type, proximal, distal, isMitigated, isBreaker, confidence, confidenceFactors[] }` |
| `FairValueGap` | `smc/fvg` | `{ type, top, bottom, fillFraction, isInversion }` |
| `PdArrayResult` | `smc/pd-array` | `{ currentBias, zones[], dealingRange, equilibrium }` |
| `DailyBiasResult` | `smc/daily-bias` | `{ bias, strength, consecutiveDays, evidence[] }` |
| `SmtDivergence` | `smc/smt` | `{ detected, type, confidence, time }` |
| `DrawTarget` | `smc/report` | `{ price, type, score, direction, label, evidence[] }` |
| `UnifiedTradeSignal` | `services/SignalGenerator` | Complete trade signal with entry/SL/TP, R:R, confidence, context, rationale |
| `LoopConfig` | `loop/types` | Configuration for Agent Loop: symbol, timeframe, guardrails, limits |
| `LoopResult` | `loop/types` | Outcome of a loop cycle: action, confidence, narrative |
| `Decision` | `loop/types` | LLM-generated decision: action type, reason, confidence |
| `ComparisonRecord` | `comparison/ComparisonEngine` | TV vs Engine comparison for one detection point |
| `FusedDecision` | `fusion/EvidenceFusionLayer` | Fused evidence: composite confidence, explanation, supporting/contradicting evidence |
| `TruthVerdict` | `truth/TruthEngine` | Single authoritative verdict: chosen source, adopted price, final confidence, selection rationale |
| `ArbitratedMarketView` | `truth/TruthEngine` | Complete arbitrated market picture handed to the AI: all verdicts, overall confidence, market summary string |
| `ArbitrationStrategy` | `truth/TruthEngine` | Enum: BOTH_AGREE, TRUST_HIGHER_RELIABILITY, TV_FALLBACK, ENGINE_FALLBACK, FALLBACK_COMPOSITE, INSUFFICIENT_DATA |
| `DetectionPoint` | `comparison/ComparisonEngine` | `{ detectionType, price, confidence, metadata }` |
| `OutcomeEval` | `evaluation/OutcomeEvaluator` | Market outcome for a detection: respected/swept/ignored, correct source |
| `TradeReflection` | `reflection/ReflectionEngine` | Post-trade analysis: disagreements, who was correct, rules proposed |
| `ParameterRecommendation` | `optimization/ParameterRecommendationService` | Suggested parameter change with evidence |

### Key Services & Their Responsibilities

| Service | Responsibility |
|---|---|
| **SignalGenerator** | Converts SmcReport → UnifiedTradeSignal. Entry = nearest aligned OB/FVG, SL = opposite liquidity, TP = top draw target, confidence = 30% structure + 40% confluence + 30% OB. Cascade mode reads 3 timeframes (bias setter → confirmation → entry trigger). |
| **TradeLedgerService** | CRUD for trades table. `logSignal()`, `getPendingSignals()`, `querySignals()`. Handles DB-unavailable gracefully (no crash). |
| **PerformanceMatrixService** | 7-dimension pivot table. Dimensions: asset_class, symbol, setup_type, setup_subtype, timeframe_cascade, market_regime, session_context. Metrics: win_rate, sharpe_ratio, profit_factor, avg_win, avg_loss, max_drawdown. |
| **TradeSettlementService** | Background 30s interval poller. Checks pending trades against current market price, determines if SL/TP were hit, records outcomes. Can work with candle store or fetched data. |
| **BacktestRunner** | Sliding-window SMC simulation. Configurable window size (candles), future bars for outcome, step size. Runs `buildReport()` on each window, generates signals via `SignalGenerator`, evaluates outcomes. |
| **ExecutionManager** | Wraps BrokerAdapter with REVIEW/LIVE mode toggle. REVIEW = dry-run, LIVE = actual order placement. Mode switching requires `{ confirm: "LIVE" }` for safety. |

### TradingView Integration Modules

| Module | Technology | Tools | Status |
|---|---|---|---|
| **Legacy TV CDP** | `puppeteer` | 11 TV tools, `window.tvWidget` API, keyboard/mouse drawing | Backward compatible, desktop drawing unreliable |
| **TV Desktop CDP** | `chrome-remote-interface` | 86 tools across 13 categories, `window.TradingViewApi` for reliable chart control | Active, preferred. All drawing via `createShape()` |

---

## 19. Onboarding Guide

### Day 1 — Setup

```powershell
# Prerequisites
1. Install Node.js 22+, pnpm 9
2. Install Docker Desktop (for PostgreSQL)
3. Get a Fireworks AI API key (free tier)

# Clone
cd part-2-SMC
cp .env.example .env
# Edit .env: set FIREWORKS_API_KEY, DATABASE_URL

# Install
pnpm install

# Build
pnpm --filter @workspace/api-server run build

# Start PostgreSQL
cd deploy/local
docker compose up -d db
# Apply trust auth (one-time):
docker compose exec db sh -c "echo 'host all all all trust' >> /var/lib/postgresql/data/pg_hba.conf && psql -U smc -d smc_liquidity -c 'SELECT pg_reload_conf();'"
cd ../..

# Run migration
docker compose -f deploy/local/docker-compose.yml exec db psql -U smc -d smc_liquidity < docs/migrations/003_learning_framework.sql

# Start API server
node artifacts/api-server/dist/index.mjs

# Verify
curl http://localhost:3001/api/healthz
curl http://localhost:3001/api/learning/dashboard
```

### Day 2 — Understanding the Architecture

Read these files in order:
1. `README.md` — Feature overview
2. `ARCHITECTURE.md` — Folder tree and module responsibilities
3. `BACKEND.md` — Route table, SMC engine API, data flow
4. `AI_SYSTEM.md` — LLM pipeline, prompt construction, agent modes
5. `ICT_IMPLEMENTATION.md` — Each SMC detection algorithm in detail
6. `ARTIFACTS/api-server/src/lib/smc/types.ts` — All type definitions
7. `docs/LEARNING_FRAMEWORK.md` — Comparison + validation framework

### Day 3 — Making Changes

Key development patterns:
- **New SMC detection**: Add to `src/lib/smc/` as pure function, register in `report.ts`
- **New route**: Create file in `src/routes/`, add to `routes/index.ts`
- **New MCP tool**: Add to `src/lib/mcp/tools/`, register in `server.ts` and `tool-registry.ts`
- **Build**: Always run `pnpm --filter @workspace/api-server run build` before testing
- **Debug**: Check `api-server.log` for structured logs

---

## 20. "How the Entire System Works" Narrative

### End-to-End in Plain English

**SMC Pulse Predict** is a system that watches financial markets through the lens of ICT (Inner Circle Trader) methodology and helps traders understand what smart money is doing.

**Step 1: Market data arrives.** Binance's WebSocket sends real-time price updates for crypto like BTC/USDT every time a new candle forms (every minute, every 5 minutes, etc.). For forex like EUR/USD, the system polls Yahoo Finance every 15 seconds. All this data flows into an in-memory candle store — a live accumulator of price bars.

**Step 2: The SMC engine analyzes every candle.** Seven detection modules run in sequence every time a candle closes — in under 20 milliseconds:
- **Structure** finds swing highs and lows, classifies them as Higher Highs, Lower Highs, Higher Lows, or Lower Lows, then identifies Break of Structure (trend continues) and Change of Character (trend may be reversing). It even infers the market phase: is price accumulating, manipulating, expanding, or distributing?
- **Liquidity** identifies where stop-loss orders cluster — above swing highs (buy-side liquidity), below swing lows (sell-side liquidity). It scores these pools by how many times price touched them, which trading session they formed in, and how recent they are.
- **Order Blocks** finds the last candle before a big price move — that candle represents where institutions placed their orders. It computes whether price has already returned to "mitigate" that level.
- **Fair Value Gaps** spots 3-candle imbalances — areas where price moved too fast and left a gap. It tracks whether price has returned to fill it.
- **PD Array** divides the price range into premium (expensive — look to sell) and discount (cheap — look to buy).
- **Daily Bias** checks the daily chart to determine the higher-timeframe direction, used as a filter for lower-timeframe trades.
- **SMT Divergence** compares two correlated instruments (like BTC and ETH) — if one makes a new high while the other doesn't, it signals a potential reversal.

All seven outputs merge into a single `SmcReport` — a complete market brief.

**Step 3: The report goes everywhere.** It's cached for 60 seconds for dashboard refreshes, pushed instantly via SSE to open browser tabs, and fed to the AI analyst.

**Step 4: AI analyzes and answers.** A DeepSeek V4 Pro model running on Fireworks AI receives the SmcReport as context. Users can ask questions ("Where is the liquidity?"), run a 4-agent pipeline that examines structure → liquidity → gaps → confluence in sequence, or activate the Agent Loop — a fully autonomous cycle that observes, interprets, reasons with the LLM, decides what to do, acts (generating signals or trades), evaluates its performance, and updates its memory for next time.

**Step 5: Everything is tracked.** Every generated signal goes to the trade ledger. Every trade outcome feeds into a 7-dimension performance matrix that answers "what works best" — by setup type, market regime, session, timeframe, and more.

**Step 6: TradingView Desktop controls.** The system can connect to your local TradingView Desktop app via Chrome DevTools Protocol. It reads live chart data directly, draws order blocks and FVG zones on your charts, and exposes 86 tools for external AI agents (Claude Desktop, etc.) to control TV — change symbols, draw Fibonacci levels, run Pine Scripts, even control replay mode.

**Step 7: The learning feedback loop.** A recently-built Learning & Validation Framework compares the internal SMC engine's detections against what TradingView Pine indicators (like LuxAlgo's ICT tools) show. Every agreement and disagreement is stored in PostgreSQL. Over time, as price plays out and the system can see "who was right," it builds per-type reliability scores: "Our engine is 96% reliable for Order Blocks but only 64% for SMT." It then generates parameter recommendations — "Our displacement threshold should change from 1.5× ATR to 1.8× ATR based on 842 examples with 97% confidence" — requiring human approval before applying.

**Step 8: Backtesting validates everything.** A sliding-window backtester runs the SMC engine over historical data, generates hypothetical signals, tracks what would have happened, and feeds results back into the performance matrix.

**The long-term vision:** TradingView indicators are the initial teacher. The internal SMC engine is the student. Historical market outcomes are the examiner. Over time, the student should learn enough from reality that it no longer depends on the teacher. The platform is designed to become an autonomous, self-improving market intelligence system.
