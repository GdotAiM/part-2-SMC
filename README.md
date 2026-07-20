# SMC Pulse OS -- Liquidity Hunter

> **Real-time ICT/SMC market intelligence for crypto and forex traders.**
> A full-stack web application that algorithmically detects institutional order flow concepts -- Order Blocks, Fair Value Gaps, BOS/CHoCH, liquidity pools, and SMT divergence -- and surfaces them through a narrative-stage cockpit with an embedded AI analyst.

---

## Vision

Most retail traders lose because they see charts the wrong way. Institutions don't buy at support and sell at resistance -- they hunt liquidity, create imbalance, and deliver price into equilibrium. SMC Pulse OS translates the Inner Circle Trader (ICT) methodology into a live, automated analysis engine that processes OHLCV data and produces the same read a trained SMC analyst would perform manually, in seconds, across every timeframe simultaneously.

---

## Key Features

| Feature | Description |
|---|---|
| **Session Cockpit** | 10 narrative-stage workflow (Watching -> Scanning -> LiquiditySwept -> Displacement -> MSS Forming -> FVG Formed -> EntryReady -> InTrade -> Review -> NoTrade) -- the trading day organized by market structure events |
| **3-Column Shell Layout** | LiveTimeline (left) | Stage View (center) | DecisionFunnel + QuickTools (right) with resizable panels |
| **QuickTools Panel** | 9 collapsible trading widgets: Killzone Timer, Silver Bullet Timer, Breaker Blocks, Displacement Gauge, Range Expansion, OTE Zone Calculator, Risk Calculator, Daily Trade Counter, LuxAlgo Comparison |
| **Timeframe Presets** | Scalp (1m/5m/15m), Intraday (15m/1h/4h), Swing (4h/1d/1w) with per-TF chips showing bias dots |
| **ICT Structure Engine** | ATR-normalised pivot detection -> BOS / CHoCH classification -> phase inference (Accumulation -> Manipulation -> Expansion) |
| **Liquidity Hunter** | BSL / SSL / Equal Highs / Equal Lows pool detection with session-weighted scoring and probability-of-sweep |
| **Order Block Detection** | Bullish & bearish OBs with breaker block classification, FVG confluence, and institutional confidence scoring |
| **Fair Value Gap Engine** | FVG detection with fill-fraction tracking and inversion FVG identification |
| **PD Array** | Premium / Discount / Equilibrium zone computation from dealing range |
| **Daily Bias** | HTF 1D structure-primary bias (0.55--0.88 strength) used to gate lower-TF OB confidence |
| **SMT Divergence** | Correlated-pair divergence detection (BTC/ETH, EUR/GBP) with magnitude + timing scoring |
| **Draw on Liquidity** | Confluence-boosted target scoring that ranks BSL/SSL/OB/FVG as next price objectives |
| **Visual Chart Layer** | TradingView Lightweight Charts (v5) with session backgrounds, OB/FVG rectangles, BOS/CHoCH markers, KZO lines |
| **TradingView Desktop CDP Integration** | Dual-path CDP connection to TV Desktop App: **(1)** Legacy Puppeteer path for drawing SMC levels (BSL/SSL/FVGs/killzones) via keyboard shortcuts, used as data fallback. **(2)** New chrome-remote-interface path with 70+ MCP tools for full chart control -- switch symbol/timeframe, draw shapes, read OHLCV bars, read indicator levels (LuxAlgo), add indicators, create alerts, read Depth of Market, control replay mode. Used as primary data source when Binance/Yahoo are DNS-blocked |
| **Mark BOS/CHoCH Drawing** | `POST /api/agent-loop/tv-draw` with `"bos"` action -- draws BOS/CHoCH lines from structure breaks directly on the TV Desktop chart |
| **Set Alert Form** | Create price alerts with crossing/above/below conditions from the cockpit -> `POST /api/agent-loop/tv-alert-create` |
| **TV Desktop Agent Awareness** | Both AI agents (`POST /api/agents/ask` and `POST /api/agents/ask-mcp`) are fully aware of all 70+ TV Desktop capabilities. They can read your TV indicators (LuxAlgo ICT tools), cross-reference against the internal SMC engine, draw levels, open/close panels, and click Buy/Sell buttons for paper trading |
| **LuxAlgo / Pine Indicator Comparison** | Reads horizontal line levels from ANY Pine Script indicator on your TV chart (LuxAlgo ICT Concepts, Smart Money Concepts, etc.), auto-classifies into OB/FVG/BOS/CHoCH/liquidity sweep types, and cross-references against the internal SMC engine via the Comparison Engine. Produces agreement rates, price discrepancies, and Truth Engine arbitrated verdicts per detection type |
| **Chart Bar Reader (TV Fallback)** | `GET /api/analysis/from-tv` reads OHLCV bars directly from TV Desktop via CDP and runs the full SMC analysis (300+ candles). Seeds the candle store so all SMC tools work seamlessly. Essential on machines where Binance/Yahoo APIs are DNS-blocked |
| **TV UI Trading** | The MCP agent can click Buy/Sell buttons on your TV Desktop chart (via `tv_ui_click` with data-name selectors) if you're signed into your paper trading account. Also supports Alpaca paper trading via env vars |
| **AI Agent Chat** | Accessible from the cockpit TopBar -- streaming Q&A with full TV/comparison capability awareness, plus MCP tool-calling mode (27 autonomous tools: 11 SMC + 10 TV Desktop + 6 Comparison Engine). Supports both tool-calling and classic chat modes |
| **Langfuse Observability** | LLM call tracing, cost tracking, and run scoring via Langfuse (configurable via env vars, graceful fallback) |
| **Prompt Optimization** | LLM-as-judge evaluation and improvement of agent prompts (DSPy-equivalent) for ongoing performance gains |
| **RAG / News / Vector Memory** | News fetching (RSS + CoinMarketCap), text chunking, PDF parsing, and Qdrant vector database for long-term setup memory with "find similar past setups" |
| **Structured Outputs** | Zod-powered structured output extraction with retry (Instructor pattern) -- eliminates JSON parsing errors from pipeline |
| **Capability Coverage Tracking** | 96% UI coverage (52/54 capabilities) measured via `uiCoverage` tracking in `capabilities.ts` |
| **Backtest Runner** | Sliding-window SMC backtest engine with configurable lookback, timeframe, and asset selection -- results populate the Performance Matrix |
| **Strategy Evaluation System** | 59 ICT/SMC model templates across 7 ontology layers, predicate-based rule engine, multi-TF detection via `POST /api/strategies/detect` |
| **MCP Tier 3** | FastMCP v4.3.2 server on port 3002 -- 73 TV Desktop tools + 12 SMC tools, 4 resources, 2 prompts for external AI agent access |
| **Broker Execution** | Broker-agnostic trade execution with REVIEW/LIVE mode toggle, Alpaca Paper API adapter, file-based mock broker |
| **Broker Dashboard** | `/broker` page -- account overview, open orders table, mode switch with typed-LIVE confirmation, execution log |
| **Market Narrative** | Auto-generated institutional narrative string per report |
| **Session State** | Real-time ICT session inference: Asian Range / London Expansion / NY Open / PM Distribution |
| **Real-Time Price Feed** | Binance US WebSocket (crypto) + Finnhub WS / Yahoo polling (forex) with SSE push to browser |
| **Live Price Badge** | Green pulsing indicator when real-time stream is connected, price updates in real-time |
| **60s Cache** | In-memory TTL cache prevents repeated data-provider hits on dashboard refresh |
| **Auto Candle-Close Refresh** | Server rebuilds SMC reports on candle close and pushes to browser -- no polling needed |

---

## Screenshots

> _Screenshots pending. Open the app and hit the **CHART** button to see the visual layer._

| Session Cockpit | Chart View |
|---|---|
| 3-column stage-driven trading cockpit with LiveTimeline, Stage View, and QuickTools | Candlesticks + OB/FVG/session overlays |

---

## Demo

Run locally (see Installation below) then visit `http://localhost:5173`.

### Session Cockpit workflow

- **Select a symbol** from the TopBar symbol selector
- Choose a **Timeframe Preset**: Scalp (1m/5m/15m), Intraday (15m/1h/4h), or Swing (4h/1d/1w)
- The **Session Cockpit** auto-detects the current narrative stage from live market structure
- Watch the **LiveTimeline** (left) for chronological events: structure breaks, sweeps, FVG fills
- Use **QuickTools** (right) for killzone timers, OTE calculator, risk calculator, and LuxAlgo comparison
- Tap the **Agent Chat** button in the TopBar to ask the AI about current market conditions
- Press **Ctrl+K** for the Capability Explorer to search all 54 capabilities
- Tap the **TV** status indicator in the TopBar to draw levels, FVGs, BOS/CHoCH, or create alerts on your TV Desktop chart

### Classic dashboard pages

- Navigate to `/agent-loop` for the Agent Loop dashboard -- run one-shot analysis, start background monitors, browse historical runs, and inspect learned patterns
- Visit `/analytics` for trade ledger, performance matrix, and signal generation
- Visit `/broker` for account overview, open orders, and REVIEW/LIVE mode toggle

---

## Architecture Overview

```
                                Session Cockpit (React SPA)
┌─────────────────────────────────────────────────────────────────────────────┐
│  TopBar: symbol selector | timeframe presets | session clock | TV status    │
├──────────────┬───────────────────────────────┬──────────────────────────────┤
│              │                               │                              │
│ LiveTimeline │     Stage View (center)       │  DecisionFunnel              │
│  (260px)     │                               │  QuickTools (9 widgets)      │
│              │  Watching / Scanning /        │                              │
│  Chronological│  LiquiditySwept / Displacement│  Killzone Timer              │
│  event log   │  MssForming / FvgFormed /     │  Silver Bullet Timer         │
│              │  EntryReady / InTrade /       │  Breaker Blocks              │
│              │  Review / NoTrade             │  Displacement Gauge          │
│              │                               │  OTE Zone Calculator         │
│              │  Overlays:                    │  Risk Calculator             │
│              │   - EvidencePanel             │  LuxAlgo Comparison          │
│              │   - AgentChat (420px)         │                              │
│              │   - CapabilityExplorer (⌘K)   │                              │
│              │   - ChartView (fullscreen)    │                              │
└──────────────┴───────────────────────────────┴──────────────────────────────┘
                       │ HTTP REST + SSE (dual channel)
┌──────────────────────▼───────────────────────────────────────────────────────┐
│                    Express 5 API Server                                       │
│  /api/analysis/crypto|forex      /api/agents/ask|ask-mcp                    │
│  /api/stream/:symbol (SSE)       /api/stream/status                         │
│  /api/strategies/detect          /api/smc-eval/evaluate|score               │
│  /api/agent-loop/tv-draw         /api/agent-loop/tv-alert-create            │
│  /api/analysis/from-tv           /api/learning/comparisons/analyze          │
│  /api/broker/mode|status         /api/account                               │
│  /api/ledger                     /api/signals/*                             │
│  60s in-memory TTL cache                                                    │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │ Real-Time Pipeline                                               │       │
│  │  binance-ws.ts -> candle-store -> sse-manager                    │       │
│  │  forex-ws.ts   ->     |          -> analysis-bridge              │       │
│  │                -> candleClosed    -> buildReport                 │       │
│  │                                   -> cache + SSE push            │       │
│  ├──────────────────────────────────────────────────────────────────┤       │
│  │ Execution Layer                                                  │       │
│  │  ExecutionManager -> MockBrokerAdapter (file)                    │       │
│  │                   -> AlpacaAdapter (paper API)                   │       │
│  │  SignalGenerator -> TradeLedgerService (PG)                      │       │
│  ├──────────────────────────────────────────────────────────────────┤       │
│  │ Strategy Evaluation Layer                                        │       │
│  │  StrategyRegistry (59 templates) -> PredicateEngine (21 preds)   │       │
│  │  -> StrategyEvaluator -> POST /api/strategies/detect             │       │
│  └──────────────────────────────────────────────────────────────────┘       │
└──────┬──────────────────────────────┬────────────────────────────────────────┘
       │                              │
┌──────▼──────────┐  ┌────────────────▼────────────┐
│  Binance US WS  │  │  Finnhub WS / Yahoo poll    │
│  + REST API     │  │  + REST API                 │
│  (Crypto)       │  │  (Forex)                    │
└─────────────────┘  └─────────────────────────────┘
```

---

## Technology Stack

### Backend
| Layer | Technology |
|---|---|
| Runtime | Node.js 20 + TypeScript 5 |
| Framework | Express 5 |
| Logger | Pino (JSON structured logging) |
| Data (Crypto) | Binance REST + WebSocket (no key required) |
| Data (Forex) | Yahoo Finance REST + Finnhub WebSocket (optional) |
| AI | Multi-provider LLM abstraction -- Fireworks AI (DeepSeek V4 Pro, default), OpenAI (GPT-4o), Groq (Llama 3), Ollama (local), self-hosted vLLM (AMD GPU), or custom OpenAI-compatible endpoints |
| MCP | FastMCP v4.3.2 on port 3002 -- 73 TV Desktop tools + 12 SMC tools, 4 resources, 2 prompts |
| Execution | BrokerAdapter interface -- MockBroker (file-based) + AlpacaAdapter (paper API) |
| Database | PostgreSQL via Drizzle ORM (optional -- server runs without it) |
| Cache | In-process Map, 60s TTL |
| CDP | `chrome-remote-interface` + `puppeteer` -- dual-path TradingView Desktop integration |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS + shadcn/ui |
| Data Fetching | TanStack Query v5 |
| Charts | TradingView Lightweight Charts v5 |
| Animations | Framer Motion |
| Router | Wouter |

### Monorepo
| Package | Purpose |
|---|---|
| `artifacts/api-server` | Backend Express server |
| `artifacts/liquidity-hunter` | Frontend React SPA |
| `lib/api-client-react` | TanStack Query hooks (manually maintained) |
| `lib/api-spec` | OpenAPI 3.1 spec |
| `lib/api-zod` | Zod schemas + Strategy Evaluation System |
| `lib/db` | Drizzle ORM -- trades + performance matrix + model definitions tables |
| `deploy/local` | Local CPU deployment (Docker Compose -- Intel/AMD laptop, no GPU) |
| `deploy/amd-developer-cloud` | AMD MI300X GPU deployment (Docker Compose + vLLM + Gemma 4) |

---

## AI Pipeline Overview

```
User taps "SMT" button or asks agent in AgentChat
        |
POST /api/agents/pipeline { report: SmcReport }
        |
System prompt built from live SmcReport data
(price, structure, liquidity map, OBs, FVGs, SMT, draw targets)
        |
Sequential agent loop (SSE streaming):
  1. Structure Agent   -> market structure narrative
  2. Liquidity Agent   -> BSL/SSL hunt probability
  3. FVG Agent         -> rebalance vs continuation gaps
  4. Confluence Agent  -> final synthesis + invalidation level
        |
Frontend streams each agent token-by-token into AgentPipeline panel
```

Also supports:
- `POST /api/agents/ask` -- single-turn Q&A with full report context and conversation history (last 8 turns). Agent is fully aware of TV Desktop CDP, LuxAlgo comparison, reliability scoring, and trading capabilities
- `POST /api/agents/ask-mcp` -- tool-calling agent with 27 autonomous tools (11 SMC analysis + 10 TV Desktop chart/UI + 6 Comparison Engine). Autonomously chains TV connect -> read bars -> SMC analysis -> LuxAlgo compare -> reliability check -> draw on chart

---

## ICT Accuracy

The SMC engine was audited for ICT/SMC conceptual correctness on July 20, 2026. All core algorithms -- pivot detection, BOS/CHoCH reversal logic, market phase inference, liquidity pool sweep detection, breaker block polarity flipping, and FVG fill mechanics -- were verified against primary ICT source material and cross-referenced against the 13 ICT Insights reference documents in this repository. A wiring audit also fixed double-multiplication bugs, broken prop connections, and dead import paths across the engine and cockpit layers.

---

## ICT/SMC Concepts Implemented

- Market Structure (Pivots: HH / HL / LH / LL)
- Break of Structure (BOS)
- Change of Character (CHoCH / MSS)
- Market Phase: Accumulation -> Manipulation -> Expansion -> Distribution -> Continuation
- Buy-Side Liquidity (BSL) -- Equal Highs, prior session highs
- Sell-Side Liquidity (SSL) -- Equal Lows, prior session lows
- Probability of Sweep scoring per liquidity pool
- Order Blocks (Bullish / Bearish)
- Breaker Blocks (mitigated OBs that flip polarity)
- Fair Value Gaps (FVG)
- Inversion FVG
- Premium / Discount / Equilibrium (PD Array)
- Dealing Range
- Daily Bias (HTF anchor)
- SMT Divergence (correlated pair)
- Draw on Liquidity (DOL) -- scored target engine
- Session analysis: Asian Range / London / NY AM / NY PM / PM Distribution
- KZO (Key Zone -- OB proximal line)
- Displacement detection (candle expansion vs ATR)
- MSS (Market Structure Shift) forming detection

---

## Project Structure

```
workspace/
├── artifacts/
│   ├── api-server/                  # Express backend
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── smc/             # ICT engine (core algorithms)
│   │       │   │   ├── config.ts
│   │       │   │   ├── types.ts
│   │       │   │   ├── structure.ts
│   │       │   │   ├── structure.test.ts
│   │       │   │   ├── liquidity.ts
│   │       │   │   ├── liquidity.test.ts
│   │       │   │   ├── order-blocks.ts
│   │       │   │   ├── order-blocks.test.ts
│   │       │   │   ├── fvg.ts
│   │       │   │   ├── fvg.test.ts
│   │       │   │   ├── pd-array.ts
│   │       │   │   ├── pd-array.test.ts
│   │       │   │   ├── daily-bias.ts
│   │       │   │   ├── daily-bias.test.ts
│   │       │   │   ├── smt.ts
│   │       │   │   ├── smt.test.ts
│   │       │   │   └── report.ts
│   │       │   ├── fetchers/        # Market data
│   │       │   │   ├── binance.ts
│   │       │   │   └── yahoo.ts
│   │       │   ├── realtime/        # Real-time infrastructure
│   │       │   │   ├── binance-ws.ts
│   │       │   │   ├── forex-ws.ts
│   │       │   │   ├── candle-store.ts
│   │       │   │   ├── sse-manager.ts
│   │       │   │   └── analysis-bridge.ts
│   │       │   ├── execution/       # Broker execution layer
│   │       │   │   ├── BrokerAbstraction.ts
│   │       │   │   └── AlpacaAdapter.ts
│   │       │   ├── comparison/      # LuxAlgo vs SMC Engine comparison
│   │       │   ├── narrative/       # Market commentary generator
│   │       │   ├── agents/          # AI agent + reasoning agent
│   │       │   ├── llm/             # Multi-provider LLM abstraction
│   │       │   ├── integrations/    # TV Desktop CDP (chrome-remote-interface + Puppeteer)
│   │       │   └── mcp/             # MCP server (FastMCP v4.3)
│   │       └── routes/              # API endpoints
│   │           ├── analysis.ts
│   │           ├── agents.ts
│   │           ├── agents-mcp.ts
│   │           ├── agent-loop.ts
│   │           ├── stream.ts
│   │           ├── ledger.ts        # Trading + broker
│   │           ├── smc-eval.ts      # SMC-EVAL benchmark
│   │           ├── strategies.ts    # Strategy detection
│   │           ├── symbols.ts
│   │           └── health.ts
│   └── liquidity-hunter/            # React frontend
│       └── src/
│           ├── shell/               # Session Cockpit shell
│           │   ├── SessionCockpitShell.tsx
│           │   ├── TopBar.tsx
│           │   └── LiveTimeline.tsx
│           ├── stages/              # Narrative stage views (10 stages)
│           │   ├── ScanningView.tsx
│           │   ├── LiquiditySweptView.tsx
│           │   ├── DisplacementView.tsx
│           │   ├── MssFormingView.tsx
│           │   ├── FvgFormedView.tsx
│           │   ├── EntryView.tsx
│           │   ├── InTradeView.tsx
│           │   ├── ReviewView.tsx
│           │   └── NoTradeView.tsx
│           ├── panels/              # Cockpit panels
│           │   ├── DecisionFunnel.tsx
│           │   ├── QuickTools.tsx
│           │   ├── EvidencePanel.tsx
│           │   └── SessionFlowIndicator.tsx
│           ├── state/               # State management
│           │   ├── narrative.ts
│           │   ├── capabilities.ts
│           │   ├── market-store.ts
│           │   └── profile-store.ts
│           ├── pages/               # Classic pages (legacy)
│           │   ├── OsDashboard.tsx
│           │   ├── Analytics.tsx
│           │   └── Broker.tsx
│           └── components/          # Shared components
│               ├── IntelligenceSheet.tsx
│               ├── ConfluenceCard.tsx
│               ├── ConfluenceSheet.tsx
│               ├── ChartView.tsx
│               ├── AgentChat.tsx
│               ├── AgentPipeline.tsx
│               ├── TvStatus.tsx
│               ├── CapabilityExplorer.tsx
│               └── SignalDetailSheet.tsx
├── ICT Insights/                    # ICT theory reference documents
│   ├── 01-pivot-detection.md
│   ├── 02-bos-choch.md
│   ├── 03-market-phase.md
│   ├── 04-liquidity-pools.md
│   ├── 05-order-blocks.md
│   ├── 06-fair-value-gaps.md
│   ├── 07-inversion-fvg.md
│   ├── 08-pd-array.md
│   ├── 09-daily-bias.md
│   ├── 10-smt-divergence.md
│   ├── 11-draw-on-liquidity.md
│   ├── 12-session-analysis.md
│   └── 13-configuration-reference.md
├── lib/
│   ├── api-spec/                    # OpenAPI 3.1 definition
│   ├── api-client-react/            # TanStack Query hooks
│   ├── api-zod/                     # Zod schemas + Strategy Evaluation System
│   └── db/                          # Drizzle ORM + seeds
└── pnpm-workspace.yaml
```

---

## Installation

### Option 1: Docker (recommended -- zero-config)

Choose the deployment that matches your hardware:

#### Local / Intel CPU (any laptop)

No GPU required. LLM inference runs on Fireworks AI's cloud.

```bash
cd deploy/local
cp .env.example .env
# Edit .env -> add your FIREWORKS_API_KEY from https://fireworks.ai/api-keys
docker compose up -d
```

Open **http://localhost:3000** for the full stack (frontend + API + database).

#### AMD MI300X GPU (self-hosted LLM)

Requires an AMD Developer Cloud VM with MI300X GPUs.

```bash
cd deploy/amd-developer-cloud
chmod +x setup.sh && ./setup.sh
cp .env.amd .env
# Edit .env -> set HF_TOKEN for gated models
docker compose up -d
```

See `deploy/local/README.md` and `deploy/amd-developer-cloud/README.md` for full guides.

### Option 2: Run from source (dev mode)

**Prerequisites:** Node.js >= 20, pnpm >= 9

```bash
git clone <repo-url>
cd workspace
pnpm install
```

```bash
# Start API server (port 3001 by default)
pnpm --filter @workspace/api-server run dev

# Start frontend (port 5173 by default)
pnpm --filter @workspace/liquidity-hunter run dev
```

Then open `http://localhost:5173`.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `LLM_PROVIDER` | No | LLM backend: `fireworks` (default), `openai`, `custom`, `amd`, `ollama`, or `groq`. See `deploy/local/README.md` for provider options. |
| `FIREWORKS_API_KEY` | Yes (for Fireworks) | Fireworks AI key for the analyst agent. Get one free at https://fireworks.ai |
| `LLM_API_KEY` | Depends on provider | API key for your chosen LLM provider. Set via `FIREWORKS_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`, or `LLM_API_KEY` depending on provider. |
| `FINNHUB_API_KEY` | No | Finnhub API key for forex real-time WebSocket. Without it, Yahoo polling is used as fallback (free, no key). Get one free at https://finnhub.io |
| `ALPACA_API_KEY_ID` | No | Alpaca Paper Trading API key ID. Set both this and the secret to enable live paper-trading execution through AlpacaAdapter. Without them, the server uses MockBrokerAdapter (file-based, no real orders) |
| `ALPACA_API_SECRET_KEY` | No | Alpaca Paper Trading API secret key |
| `DATABASE_URL` | No | PostgreSQL connection string for persistent trade ledger + performance matrix. Server runs without it (ledger and matrix endpoints return empty) |

Set via your platform's secrets manager or `.env` at the repo root. Each deployment directory (`deploy/local/`, `deploy/amd-developer-cloud/`) has its own `.env.example` with sensible defaults.

---

## Example API Request

```bash
# Crypto analysis -- BTC/USDT 4h with ETH/USDT correlation
curl "http://localhost:3001/api/analysis/crypto?symbol=BTCUSDT&timeframe=4h&correlatedSymbol=ETHUSDT"

# Forex analysis -- EUR/USD 1h
curl "http://localhost:3001/api/analysis/forex?symbol=EURUSD=X&timeframe=1h"

# Real-time stream -- BTC/USDT 1m candles (SSE)
curl -N "http://localhost:3001/api/stream/BTCUSDT?timeframes=1m,5m,15m"

# Stream status -- active symbols and candle counts
curl "http://localhost:3001/api/stream/status"
```

---

## Example API Response (abbreviated)

```json
{
  "symbol": "BTCUSDT",
  "market": "crypto",
  "timeframe": "4h",
  "currentPrice": 59740.37,
  "narrative": "Daily bearish. BOS bearish confirmed. Price in premium zone. Nearest objective: SSL at 59,094.",
  "sessionState": "Asian Range Formation",
  "structure": {
    "bias": "bearish",
    "phase": "expansion",
    "confidence": 0.72,
    "evidence": ["2 BOS bearish", "CHoCH at 61,200"]
  },
  "liquidity": {
    "nearestBSL": { "price": 65549.94, "probabilityOfSweep": 0.34 },
    "nearestSSL": { "price": 59093.99, "probabilityOfSweep": 0.71 }
  },
  "orderBlocks": [
    {
      "type": "bearish", "proximal": 61400, "distal": 60800,
      "confidence": 0.81, "confidenceFactors": ["✓ HTF bias aligned", "✓ FVG confluence"],
      "isMitigated": false, "isBreaker": false
    }
  ],
  "draw": [
    { "type": "SSL", "price": 59093.99, "score": 1.42, "direction": "short",
      "evidence": ["✓ SSL @ 59,094", "Prob sweep: 71%", "✓ HTF bias aligned"] }
  ]
}
```

---

## TradingView Desktop Integration

The app connects to your local TradingView Desktop app via Chrome DevTools Protocol (CDP) using two complementary paths:

### Path 1: Legacy Puppeteer (chart drawing + data fallback)
- Draws BSL/SSL/Current/FVG/killzones directly on your TV Desktop chart from the frontend
- **Contextual switching** -- click the **[TV]** button on any timeframe card -> switches TV Desktop to that symbol/timeframe and draws liquidity levels
- Reads 300+ bars as data fallback when Binance/Yahoo APIs are DNS-blocked

### Path 2: New chrome-remote-interface (70+ MCP tools -- FULL control)
- **Chart control**: switch symbol, timeframe, chart type, scroll to date, search symbols
- **Drawing**: horizontal lines, trend lines, Fibonacci, rectangles, rays, text, arrows, BOS/CHoCH markers
- **Data reading**: OHLCV bars (for SMC analysis via `/api/analysis/from-tv`), real-time quotes, Depth of Market / order book, indicator values, strategy backtest results
- **Indicator management**: add, remove, inspect any indicator (LuxAlgo ICT tools, etc.)
- **Pine Script**: get/set source, compile, publish, library management
- **Alerts**: create price alerts with crossing/above/below conditions, list, delete
- **UI automation**: click elements, open/close panels (trading, alerts, watchlist), keyboard shortcuts, type text, mouse clicks
- **Replay mode**: start/stop replay, autoplay, step forward, trade in replay
- **Trading**: click Buy/Sell buttons on the chart (data-name="buy-order-button" / "sell-order-button") if signed into paper trading account
- **Capture**: screenshot the chart

### AI Agent Awareness
Both AI agents (`/api/agents/ask` and `/api/agents/ask-mcp`) are fully aware of all TV Desktop capabilities. When asked "can you read LuxAlgo levels?" or "can you place a trade?", they respond with the correct tools and endpoints rather than "I can't do that."

The MCP tool-calling agent (`/api/agents/ask-mcp`) autonomously chains: `tv_connect` -> `tv_data_get_ohlcv` -> `analyze_from_tv_bars` -> `read_tv_indicator_levels` -> `compare_engine_vs_tv` -> `tv_draw_shape` -> `tv_ui_click`

### LuxAlgo / TV Indicator Comparison Pipeline
- Reads horizontal line levels from ANY Pine Script indicator (LuxAlgo ICT Concepts, Smart Money Concepts, custom scripts)
- Auto-classifies levels into detection types: OB, FVG, BOS, CHOCH, LIQUIDITY_SWEEP, SMT
- Cross-references TV indicator levels against the internal SMC engine via `/api/learning/comparisons/analyze`
- Produces agreement rates, price discrepancies, confidence gaps per detection type
- Truth Engine arbitrates between TV and engine based on historical reliability
- Reliability scores built over time via outcome evaluation (`/api/learning/evaluate-outcomes`)

### Quick Start (Windows)

```powershell
# 1. Start the API server (with LLM + TV + no-DB mode)
scripts\start-server-full.ps1

# 2. Start the frontend
scripts\run-frontend.ps1

# 3. Launch TradingView Desktop with CDP enabled
scripts\launch-tv.bat

# 4. Open http://localhost:3000
```

### Frontend Controls

| Button | Location | Action |
|--------|----------|--------|
| **TV** (header, green pulsing) | TopBar -> opens TV Status modal | Shows connection status, chart info. Has buttons for draw actions (levels, FVGs, killzones, BOS/CHoCH, clear, all) and Set Alert form |
| **[TV]** (on each timeframe card) | Inside the timeframe agent card | Switches TV Desktop to that symbol/timeframe, draws BSL/SSL/Current rays |

### Data Fallback Chain

```
Agent Loop or SMC tool needs candles
  +-- 1. Candle Store (in-memory cache)
  +-- 2. Binance Direct API / Yahoo Finance
  +-- 3. TradingView Desktop CDP (chrome-remote-interface)
       +-- GET /api/analysis/from-tv?symbol=X&timeframe=Y
           +-- Reads 500 bars from TV chart -> runs buildReport()
           +-- Seeds candle store -> subsequent SMC tools hit cache
```

### Architecture

```
TradingView Desktop (Electron, --remote-debugging-port=9222)
    |
    +-- Path 1: Puppeteer CDP (legacy)
    |   +-- chart.ts (getBars, getSymbol, getTimeframe)
    |   +-- connection.ts (keyboardPress, mouseClick)
    |   +-- Used by: tool-registry data fallback, agent-loop route
    |
    +-- Path 2: chrome-remote-interface (new, active)
    |   +-- /api/analysis/from-tv -- read bars -> SMC report
    |   +-- /api/learning/read-tv-indicator-levels -- LuxAlgo levels
    |   +-- /api/agents/ask-mcp -- 27 tools (SMC + TV + Comparison)
    |   +-- /api/learning/comparisons/analyze -- TV vs Engine
    |   +-- /api/agent-loop/tv-draw -- draw shapes with "bos" action
    |   +-- /api/agent-loop/tv-alert-create -- create price alerts
    |   +-- 70+ FastMCP tools for external AI agents (Claude Desktop)
    |
    +-- AI Agent (POST /api/agents/ask-mcp)
        +-- Autonomously chains: connect -> read bars -> analyze -> compare -> draw -> trade
```

### Key API Endpoints (New)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/analysis/from-tv` | Read bars from TV Desktop CDP -> run full SMC report |
| `POST` | `/api/analysis/from-bars` | Accept external OHLCV bars -> run SMC analysis |
| `GET` | `/api/learning/read-tv-indicator-levels` | Read LuxAlgo/indicator levels from TV chart |
| `GET` | `/api/agent-loop/tv-status` | Check TV Desktop CDP connection status |
| `POST` | `/api/agent-loop/tv-connect` | Force re-connect to TV Desktop |
| `POST` | `/api/agent-loop/tv-draw` | Draw SMC levels on TV chart (levels, fvgs, killzones, bos, clear, all) |
| `POST` | `/api/agent-loop/tv-alert-create` | Create a price alert on the TV chart |
| `POST` | `/api/strategies/detect` | Multi-TF strategy detection across 59 ICT/SMC templates |

### Windows MSIX Notes

- TV Desktop is an MSIX package installed in `WindowsApps`
- Launch with CDP: `Start-Process "shell:AppsFolder\31178TradingViewInc.TradingView_q4jpyh43s5mv6!TradingView.Desktop" -ArgumentList "--remote-debugging-port=9222"`
- Page matching uses `tradingview.com` (not `tradingview`) to avoid matching MSIX path
- The chrome-remote-interface path works with MSIX; the legacy Puppeteer path may not

---

## Roadmap

- [x] WebSocket live price feed (Binance US for crypto, Finnhub/Yahoo for forex)
- [x] Real-time candle-close SMC report rebuild with SSE push to browser
- [x] TV Desktop CDP integration -- dual-path (Puppeteer + chrome-remote-interface, 70+ tools)
- [x] Contextual TV drawing -- [TV] button on each timeframe card
- [x] AI agent system -- streaming Q&A + 4-agent pipeline + MCP tool-calling (27 tools)
- [x] MCP Tier 3 server -- 73 TV Desktop tools + 12 SMC tools for external AI agents
- [x] Agent TV Desktop awareness -- agents know all 70+ TV capabilities, LuxAlgo comparison, trading
- [x] LuxAlgo / TV Indicator Comparison Engine -- read, classify, compare, arbitrate
- [x] TV bar reading for SMC analysis -- `GET /api/analysis/from-tv` works when Binance/Yahoo are down
- [x] TV draw BOS/CHoCH -- `POST /api/agent-loop/tv-draw` with `"bos"` action
- [x] TV alert creation -- `POST /api/agent-loop/tv-alert-create`
- [x] Session Cockpit -- 10 narrative-stage workflow replacing the old dashboard
- [x] QuickTools panel -- 9 collapsible widgets (Killzone Timer, Silver Bullet, Breaker Blocks, Displacement Gauge, Range Expansion, OTE Calculator, Risk Calculator, Daily Trade Counter, LuxAlgo Comparison)
- [x] Agent Chat -- accessible from cockpit TopBar, dual-mode (MCP tool-calling + classic)
- [x] Capability Coverage Tracking -- 96% UI coverage (52/54 capabilities)
- [x] Timeframe Presets -- Scalp (1m/5m/15m) / Intraday (15m/1h/4h) / Swing (4h/1d/1w)
- [x] Broker abstraction -- MockBroker + AlpacaAdapter with REVIEW/LIVE mode toggle
- [x] Broker dashboard -- `/broker` page with account overview, orders, mode switch
- [x] Strategy Evaluation System -- 59 templates, 7-layer ontology, predicate-based rule engine
- [x] SMC-EVAL Benchmark -- 100 scenarios, 5-category scoring engine
- [x] Backtesting -- sliding-window backtest runner using real SMC engine
- [x] Trade journal -- PostgreSQL-backed ledger + performance matrix per setup
- [x] Docker + CI -- multi-stage Dockerfile, local CPU + AMD MI300X docker-compose, GitHub Actions
- [x] TypeScript -- zero errors across both packages
- [x] End-to-end MI300X deployment -- run on real AMD Developer Cloud hardware
- [ ] Price alert notifications when price enters OB zone or sweeps liquidity
- [ ] Multi-panel chart view (two TFs side-by-side)
- [ ] Candle tap to inspect -- SMC context tooltip for selected bar
- [ ] Mobile-native app (Expo React Native)
- [ ] Public API with rate limiting

---

## Testing

The project has a comprehensive test suite -- **457 tests across 11 modules, 0 failures**.

### SMC Engine (326 assertions -- custom assert harness)
```bash
# Run all SMC tests
npx tsx artifacts/api-server/src/lib/smc/fvg.test.ts
npx tsx artifacts/api-server/src/lib/smc/structure.test.ts
npx tsx artifacts/api-server/src/lib/smc/liquidity.test.ts
npx tsx artifacts/api-server/src/lib/smc/order-blocks.test.ts
npx tsx artifacts/api-server/src/lib/smc/daily-bias.test.ts
npx tsx artifacts/api-server/src/lib/smc/pd-array.test.ts
npx tsx artifacts/api-server/src/lib/smc/smt.test.ts
```

| Module | Topic |
|---|---|
| `fvg.test.ts` | Bullish/bearish FVG, volume spikes, doji rejection, forex, fill tracking, inversion |
| `structure.test.ts` | Uptrend/downtrend bias, ranging, pivots (HH/HL/LH/LL), CHoCH/BOS reversal, confidence, phase, narratives |
| `liquidity.test.ts` | BSL/SSL pools, swept/unswept, probability scoring, nearest pool, session assignment |
| `order-blocks.test.ts` | Bullish/bearish OB, FVG confluence, mitigation, breaker blocks, confidence, strength |
| `daily-bias.test.ts` | HH/HL structure, LH/LL structure, SMA confirmation, strength tiers, empty/short data |
| `pd-array.test.ts` | Premium/discount/equilibrium bias, zone geometry, dealing range, labels |
| `smt.test.ts` | Bearish/bullish SMT, no-divergence sync, confidence bounds, timing proximity |

### API Zod + Strategy Evaluation (131 vitest tests)
```bash
pnpm --filter @workspace/api-zod test
```

| Module | Topic |
|---|---|
| `predicates.test.ts` | 21 predicate functions -- displacement, liquidity sweep, breaker blocks, session alignment, range expansion |
| `evaluator.test.ts` | Rule tree evaluation, predicate function registry, recursive AND/OR/NOT logic |
| `registry.test.ts` | 59-template detection, category filtering, priority ranking, multi-TF cascade |
| `smc-eval-scoring.test.ts` | 5-dimension scoring engine (structural accuracy, model alignment, confluence, trade precision, hallucination avoidance) |

---

## Contributing

Pull requests welcome. The codebase is deliberately modular -- each SMC concept lives in its own file under `artifacts/api-server/src/lib/smc/`. To add a new concept:

1. Create `artifacts/api-server/src/lib/smc/your-concept.ts`
2. Export a typed result interface from `types.ts`
3. Call your analyser in `report.ts -> buildReport()`
4. Extend `SmcReport` in `types.ts` and mirror the new field in `lib/api-zod/src/generated/`

---

## License

MIT

---

## Credits

- **ICT (Inner Circle Trader)** -- trading methodology and concept definitions
- **TradingView** -- Lightweight Charts v5 library and Desktop application
- **LuxAlgo** -- ICT Concepts Pine Script indicator used for comparison testing
- **Fireworks AI** -- LLM inference infrastructure (DeepSeek V4 Pro)
- **Groq** -- LLM provider option (Llama 3)
- **Binance** -- crypto OHLCV data
- **Yahoo Finance** -- forex OHLCV data
- **SMC Engine ICT audit** -- verified for conceptual correctness on July 20, 2026
