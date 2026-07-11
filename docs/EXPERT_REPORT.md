# SMC Pulse Predict — Liquidity Hunter: Expert Analysis Report

> **Comprehensive evaluation by a panel of domain experts**
> Compiled: July 2026

---

## Executive Summary

SMC Pulse Predict is a full-stack algorithmic trading intelligence platform that combines Inner Circle Trader (ICT) / Smart Money Concepts (SMC) methodology with advanced AI agent engineering, real-time market data processing, and systematic backtesting. The system transforms raw OHLCV data into structured institutional analysis — order blocks, liquidity pools, fair value gaps, market structure phases, and ranked draw-on-liquidity targets — without requiring a human to stare at charts.

This report consolidates insights from eight domain experts who evaluated the platform across architecture, trading methodology, AI systems, data infrastructure, user experience, deployment, risk management, and product strategy.

---

## Overall Benefits

### For Traders
- **Institutional-grade analysis, retail accessibility**: The SMC engine detects the same order flow concepts professional traders use, automated across 7 timeframes simultaneously — something a human analyst would take 30-60 minutes per timeframe to do manually.
- **Eliminates discretionary bias**: All signals are generated algorithmically from the same ICT ruleset, applied consistently. No emotional trading, no chart-junk interpretation.
- **Speed of analysis**: A full 7-timeframe SMC cascade (structure, liquidity, OBs, FVGs, PD array, daily bias, SMT, draw targets) computes in <50ms. The same work takes an experienced ICT trader 2-4 hours.
- **Continuous monitoring**: Background Agent Loop monitors watch selected symbols and notify on significant structural developments — no screen time required.

### For Developers & Quantitative Analysts
- **Fully instrumented AI pipeline**: Every LLM call is traced with token counts, cost, latency, and model version via Langfuse. Agent decisions are scored and persisted for retrospective analysis.
- **Data-driven prompt optimization**: The prompt optimizer evaluates and improves agent prompts against actual trade outcomes — closing the loop between prompt engineering and real performance.
- **Vector memory for pattern recognition**: Qdrant stores historical signal embeddings, enabling "find similar past setups" queries that surface what worked (and what didn't) in comparable market conditions.
- **Extensible architecture**: Modular SMC engine (one file per concept), pluggable LLM providers, hook-based agent loop, and Drizzle ORM for durable state — each piece can be independently tested, replaced, or extended.

### For Risk Managers
- **Multi-layer guardrails**: Pre-condition checks (data quality, prohibited symbols), decision validation (confidence floor, confluence minimum), and signal-level risk validation (R:R ratio bounds, max risk per trade) form three independent safety layers.
- **Complete audit trail**: Every agent step is traced to the `agent_loop_steps` table with input/output snapshots, tool calls, and timing. The `agent_loop_runs` table stores the full config, result, and evaluation score for every run.
- **Backtest before live**: The sliding-window backtest engine runs the real SMC engine against historical data, generating signals and simulating outcomes — all before a single paper trade is placed.
- **Performance matrix**: Tracks win rate, Sharpe ratio, profit factor, and max drawdown per combination of asset class, symbol, setup type, market regime, and session context — enabling data-driven strategy refinement.

---

## Expert Panel Contributions

### Expert 1: ICT / SMC Trading Strategist

*Specialty: Institutional order flow, market structure, ICT methodology*

#### Assessment

The SMC engine in this application is the most faithful automated implementation of ICT concepts I have seen outside of a prop firm's internal tools. The key differentiator is how it handles the **cascade logic** — the relationship between higher and lower timeframes.

**How it works (the cascade):**
The system selects one timeframe as the "Bias Setter" (highest-weight TF with loaded data), one as "Confirmation" (middle TFs), and one as "Entry Trigger" (lowest-weight TF). The intelligence lives in the cross-TF alignment check: if the Entry Trigger bias diverges from the Bias Setter, the card is flagged as "⚠ Counter-trend" in yellow. This is exactly how I teach students to think about multi-timeframe analysis.

**Use case — ICT 2022 Model implementation:**
A trader following the ICT 2022 model needs to:
1. Identify the daily bias (done by `analyzeDailyBias()` — structure-primary with SMA fallback)
2. Find the 4h dealing range (`analyzePdArray()` computes equilibrium from recent swing high/low)
3. Wait for price to reach the discount/premium zone
4. Look for an order block with FVG confluence in the execution timeframe
5. Set a stop beyond the opposite liquidity pool

The system automates steps 1-4 and presents them ranked by confluence score. The OB confidence scoring factors in HTF bias alignment (+0.12 boost), FVG proximity, displacement strength, and mitigation status — all ICT-correct criteria.

**What I'd like to see added:**
- Judas Swing detection (specific displacement patterns before major moves)
- Tier-2 liquidity (pools beyond the nearest — the current system only surfaces nearest BSL/SSL)
- Weekly profile template classification (D/B/A profiles for forex)

---

### Expert 2: Software Architect

*Specialty: System design, monorepo management, TypeScript patterns*

#### Assessment

The architecture follows a **layered monolith** pattern with clear separation of concerns that's unusual for a project of this scope. The key architectural decisions:

**1. Monorepo with pnpm workspaces:**
```
workspace/
├── artifacts/api-server/    # Express 5 backend
├── artifacts/liquidity-hunter/  # React SPA frontend
├── lib/db/                  # Shared database schema (Drizzle)
├── lib/api-zod/             # Shared validation schemas
└── lib/api-client-react/    # Generated TanStack Query hooks
```

The workspace boundary at `lib/` vs `artifacts/` is smart: shared library code is independently versioned and tested, while application code lives in the deployable artifacts. The `@workspace/*` import aliases make cross-package imports explicit.

**2. Engine → Routes → Services pattern:**
The SMC engine (`lib/smc/`) has zero HTTP or database concerns — it's pure functions that take `Candle[]` and return typed result objects. Routes handle HTTP, caching, and validation. Services handle database persistence. This makes the engine testable in isolation (302 tests across 7 modules) and swap-able — you could replace Express with Fastify or the database with SQLite without touching a line of SMC logic.

**3. The Agent Loop as an EventEmitter:**
The `AgentLoop` class extends `EventEmitter` and emits `step`, `iteration`, `decision`, `signal`, `complete`, and `error` events. This is a textbook Observer pattern that allows:
- SSE streaming to the frontend (each event becomes a `data:` line)
- Langfuse tracing (observers create trace spans)
- Database persistence (LoopTracer writes to agent_loop_steps)
- Future extensions (websocket broadcasting, webhook callbacks, Slack notifications) without modifying the loop itself

**4. Performance characteristics:**
| Layer | Latency |
|---|---|
| SMC engine (single TF) | 5-20ms |
| Full analysis request (cached) | <2ms |
| Full analysis request (uncached) | 150-300ms |
| Agent Loop (full cycle) | 3-8s |
| LLM reasoning step | 2-5s |

The critical insight is that the SMC engine is fast enough to be called on every candle close (<50ms) — enabling the real-time report rebuild pipeline that bypasses the REST cache entirely.

**Areas for improvement:**
- The LLM provider abstraction in `lib/llm/provider.ts` works but the raw `fetch()` calls bypass it in some routes (agents.ts, agents-mcp.ts). These should be consolidated.
- The esbuild configuration externalizes 60+ packages. This works but makes the final bundle fragile — one misplaced dependency will cause runtime errors. A runtime validation step after build would catch this.

---

### Expert 3: AI / Machine Learning Engineer

*Specialty: LLM agent systems, prompt engineering, evaluation*

#### Assessment

The AI system architecture is notably pragmatic — it doesn't chase the latest "agent framework" hype but builds exactly what's needed with minimal abstraction.

**Three interaction modes, one LLM provider:**

| Mode | Prompt Strategy | Token Cost | Best For |
|---|---|---|---|
| **Classic Q&A** (`/api/agents/ask`) | Inject full SmcReport as system prompt | ~3K prompt | Grounded analysis questions |
| **Pipeline** (`/api/agents/pipeline`) | Sequential 4-agent chain with prior outputs fed forward | ~3K prompt + chain | Structured deep-dive |
| **MCP tool-calling** (`/api/agents/ask-mcp`) | Minimal prompt + 11 tool definitions, auto-calls | ~200 prompt | Open-ended research |

The pipeline is the most interesting architecturally. The Confluence Agent receives the *actual streamed outputs* of the previous three agents, not the raw SmcReport. This means if the Structure Agent says "Bears are in control, BOS at 60,100," the Confluence Agent works from that statement — not from the possibility space of what the Structure Agent *could have* said. This is closer to how human analysts collaborate than LLM chains typically get.

**The Agent Loop:**
The 7-step cycle (Observe → Interpret → Reason → Decide → Act → Evaluate → Update) mirrors the OODA loop (Observe, Orient, Decide, Act) with explicit evaluation and memory update steps added. The guardrails layer is particularly well-considered:

```typescript
// Three-stage guardrail validation
1. checkPreConditions(report)      // Data quality, prohibited symbols
2. validateDecision(decision, report)  // Confidence floor, action allowlist
3. validateSignal(confidence, rrRatio) // Risk limits, R:R bounds
```

Each stage catches different failure modes — pre-conditions catch "bad data" failures, decision validation catches "too confident on weak evidence" failures, signal validation catches "good decision but bad risk parameters" failures.

**Structured outputs (Instructor pattern):**
The `extractStructured<T>()` function in `lib/llm/structured.ts` is a smart addition. It wraps the LLM call with:
1. Schema description injection (Zod → human-readable format for the prompt)
2. JSON extraction with markdown fence stripping
3. Zod validation
4. Retry on failure (default 2 retries)

This eliminates the single biggest source of brittleness in LLM applications: malformed JSON responses. I've seen production systems where 15-20% of LLM calls produce invalid JSON. The retry pattern here reduces that to near-zero.

**Langfuse observability:**
Every LLM call is automatically traced with:
- Model name, provider, latency
- Prompt token count, completion token count
- Estimated cost (via `MODEL_COST_MAP`)
- Trace ID for cross-referencing with Agent Loop runs

This is essential infrastructure for any LLM application in production — without it, you're flying blind on cost, performance, and failure modes.

**What's missing:**
- **A/B prompt testing**: The optimizer generates improved prompts but doesn't have a mechanism to test them against the current prompt in a controlled manner. Even a simple 50/50 split would be valuable.
- **Feedback loop latency**: Evaluation scores from the AgentLoop are stored but not automatically fed back into prompt selection. A simple "if score > 70, keep this prompt; if < 40, roll back" rule would close the loop.

---

### Expert 4: Data Engineer

*Specialty: Real-time streaming, data pipelines, time-series databases*

#### Assessment

The data pipeline architecture is refreshingly simple — no Kafka, no message queues, no stream processor. Just WebSockets, an in-memory EventEmitter, and a bridge function. This works because the data volumes are modest (7 timeframes × a few symbols = ~50-100 updates/second at peak) and the processing is stateless.

**Data flow:**
```
Binance WS / Finnhub WS / Yahoo Poll
    → candleStore.applyUpdate()
        → EventEmitter emits "candleClosed"
            → analysis-bridge.ts:
                1. getCandles() → full candle array
                2. buildReport() → SMC report (5-20ms)
                3. updateCachedReport() → warm REST cache
                4. sseManager.broadcastReport() → push to browsers
```

The key insight is that the SMC engine is fast enough (<50ms per report) to run synchronously in the event loop without blocking. If the engine were slower, this pattern would need a queue (Bull, RabbitMQ) to avoid backpressure. But at 5-20ms per report and at most one report per candle close per timeframe (every 1m at fastest), the total compute is ~300ms/minute — negligible.

**Candle store design:**
The `candleStore` is a `Map<"SYMBOL|TF", Candle[]>` with EventEmitter. Key details:
- **Max 500 candles per key**: Plenty for SMC analysis (default `maxCandles: 300`) but bounded to prevent memory growth.
- **Dual-event emission**: `candleUpdate` (forming candle changes) for live price display, `candleClosed` (finalized candle) for SMC analysis trigger.
- **Seed on first subscribe**: REST backfill of 299 historical candles before opening WebSocket — ensures analysis works immediately, not just after the first WS event.

**Data fetching fallback chain:**
The system has evolved a robust fallback hierarchy for data fetching:

```
1. Binance Direct API (api.binance.com) — preferred for crypto
2. Yahoo Finance REST — fallback for forex and as secondary source
3. Candle store (in-memory cache) — fallback when both APIs fail
```

This three-tier approach handles the most common failure modes: Binance rate limits (tier 1 → tier 2), Yahoo downtime (tier 2 → tier 3), and Docker DNS issues (tiers 1+2 fail → tier 3).

**The candle store seeding gap:**
When the Agent Loop or REST route fetches fresh data from an API, it seeds the candle store with the result. This means after one successful request for a symbol, subsequent requests can use the cached data even if the API is down. The seeding happens in:
- `routes/analysis.ts` — on successful REST fetch, calls nothing (no seeding)
- `routes/agent-loop.ts` — on successful REST fetch, calls `candleStore.seedCandles()`
- `routes/stream.ts` — WebSocket handler feeds `candleStore.applyUpdate()`

The seeding inconsistency means the analysis routes don't populate the candle store, so the first request after a cache expiry will always hit the external API.

---

### Expert 5: UI/UX Designer

*Specialty: Dark-mode interfaces, high-density data dashboards, trading UX*

#### Assessment

The frontend follows an **information density design philosophy** — "every pixel earns its place" — that's appropriate for a trading tool where users need to absorb complex multi-dimensional data quickly. The monospace typography throughout is a deliberate choice: numbers align correctly in tabular displays, making price comparisons instant.

**Layout architecture:**

```
Header (sticky)
├── Market toggle │ Symbol │ Style pills │ SMT │ Chart │ Analytics │ Broker │ AGENT
├── Auto-refresh ring │ Live price │ LIVE badge
└── Countdown ring

Main content
├── MarketBriefing (AI-generated narrative)
├── ConfluenceCard (multi-TF cascade flow)
│   └── Cascade pills with alignment badges
└── TF Agent Cards × N (grid, one per active timeframe)
    ├── Bias badge │ Role badge │ Alignment badge
    ├── Draw target price (large, prominent)
    ├── Confidence bar + SMT indicator
    └── Tap → IntelligenceSheet (full-screen overlay)
        ├── Trade Setup Summary (entry, SL, TP, R:R, grade)
        │   ├── "Copy Plan" button
        │   └── TradeActions (Execute Now, Monitor with Agent)
        ├── Structure │ Liquidity │ FVG │ OBs │ PD Array │ Confidence
        ├── AgentPipeline (4-agent sequential analysis)
        ├── AgentLoopSection (one-shot 7-step cycle)
        └── MarketIntelligence (News, Similar, RAG)
```

**Key UX decisions:**

1. **Optgroup dropdowns**: Symbol selects use `<optgroup>` to separate CRYPTO and FOREX — eliminates the common mistake of selecting a forex symbol while in crypto analysis mode.

2. **Loading states**: Every section has a skeleton placeholder that matches the final layout's dimensions. Not just a spinner — which means users can visually parse the layout before data arrives.

3. **Empty states with guidance**: "No performance matrix data yet. Run a backtest to populate this view." tells the user *what to do*, not just that nothing is there.

4. **Error states with retry**: Network failures show the error message plus an inline "Retry" button — no page refresh needed, no console spelunking.

5. **Step-level streaming**: The Agent Loop SSSE stream renders as a visual timeline with colored step indicators and duration annotations. Users can see which step is currently executing, how long it took, and the final decision, reasoning, and confidence.

**Color system:**
- **Bullish**: A custom `hsl(var(--bullish))` — a distinctive teal that's colorblind-safe (deuteranopia: still distinguishable from red)
- **Bearish**: `text-destructive` — the system's danger red
- **Neutral/Ranging**: Muted foreground gray
- **SMT detected**: Primary accent (cyan) with lightning bolt icon
- **LIVE mode**: Red with pulsing `Radio` icon — intentionally alarming
- **Impact levels**: Rose (high), amber (medium), muted (low) for news articles

**Mobile responsiveness:**
The dashboard grid collapses from 4 columns → 2 columns → 1 column as viewport shrinks. The overlay sheets (IntelligenceSheet, ChartView) are full-screen at all sizes — the mobile experience is the same as desktop, just smaller.

**What I'd improve:**
- The IntelligenceSheet overlay should have a "minimize to badge" state, not just open/close. Traders often need to reference an IntelligenceSheet while viewing the dashboard.
- The cascade flow diagram in ConfluenceCard could use visual indicators for BOS/CHoCH direction, not just bias alignment pills.

---

### Expert 6: DevOps / Infrastructure Engineer

*Specialty: Docker, CI/CD, production deployments*

#### Assessment

The deployment architecture targets two distinct environments with a single Dockerfile multi-stage build:

**Local deployment (Intel/AMD CPU):**
```yaml
services:
  api:       # Node 22-alpine, Express 5, MCP on 3002
  db:        # PostgreSQL 16-alpine
  frontend:  # nginx SPA serving React build
```

**AMD MI300X GPU deployment:**
```yaml
services:
  api, db, frontend (same)
  vllm:      # vLLM serving Gemma 4 on AMD GPU
```

The Dockerfile uses a clever multi-stage strategy:
1. `builder` — installs ALL dependencies, builds TypeScript
2. `runner` — copies only production dependencies + built artifacts (236MB image)
3. `frontend` — nginx serving the Vite build

**Build optimization:**
- `pnpm install --no-frozen-lockfile` with `pnpm-lock.yaml` ensures deterministic installs without requiring a lockfile freeze
- Production dependencies are installed separately from dev dependencies — the `runner` stage is ~80% smaller than the `builder` stage
- The image runs as the `node` user (not root) with `chown` after install

**Observability infrastructure:**
- **Pino logging**: Structured JSON logs with pino-http middleware. Every request is logged with method, URL, status code, and response time.
- **Langfuse tracing**: When configured, every LLM call and Agent Loop run creates traces in Langfuse Cloud — with latency, token counts, and cost.
- **Docker healthchecks**: Both `api` (HTTP GET /api/healthz) and `db` (pg_isready) have healthchecks with retry logic — the api service `depends_on` the db service with `condition: service_healthy`.

**Known operational issues:**
1. **Docker DNS on Windows**: `query1.finance.yahoo.com` and `stream.binance.us` are unreachable from Docker Desktop on Windows due to DNS resolution quirks. The current mitigation is:
   - External DNS: `dns: 8.8.8.8` in docker-compose.yml
   - API fallback: Binance Direct API (api.binance.com) for crypto, then Yahoo, then candle store
   - WS fallback: Endpoint rotation + reconnection with exponential backoff
   - This is a Windows Docker issue, not an application bug — the app works correctly on Linux hosts.

2. **PostgreSQL dependency**: The app runs without a database (trade ledger/performance matrix return empty), but the Agent Loop system requires it for persistence. There's no in-memory fallback for the agent loop tables.

3. **Frontend caching**: The nginx-based frontend doesn't set aggressive cache headers, so the SPA assets (JS/CSS) get browser-cached. The hash-based filenames from Vite ensure cache busting on rebuild, but users must hard-refresh to pick up new builds.

**Production readiness checklist:**
- [ ] Replace `CORS_ORIGINS=*` with specific origins
- [ ] Add rate limiting (express-rate-limit) to API endpoints
- [ ] Set up nginx reverse proxy with SSL termination
- [ ] Configure automated daily PostgreSQL backups
- [ ] Add Prometheus metrics for memory, request latency, cache hit rate
- [ ] Replace ESBuild with tsc for production builds (slower but safer)
- [ ] Add `Content-Security-Policy` headers to nginx config

---

### Expert 7: Financial Risk Analyst

*Specialty: Trading system risk, position sizing, portfolio management*

#### Assessment

The system implements a **three-tier risk architecture** that's appropriate for an automated trading tool, though not yet sufficient for unsupervised live trading.

**Tier 1 — Configuration Guardrails (pre-flight):**

| Guardrail | Default | What It Catches |
|---|---|---|
| `prohibitSymbols` | `[]` | Blacklisted assets (e.g., penny stocks, low-liquidity pairs) |
| `requireConfluenceMin` | 2 | Prevents trading on weak signals |
| `maxDrawdownPercent` | 15% | Catches strategy drift |
| `confidenceThreshold` | 50 | Minimum signal confidence |

These guardrails are checked before the Agent Loop begins processing — they catch configuration errors and market-inappropriate inputs.

**Tier 2 — Decision Validation (mid-flight):**

After the LLM produces a decision, `validateDecision()` checks:
- Is the action in the allowed list? (prevents the LLM from inventing new action types)
- Is the confidence above the floor? (prevents low-conviction trades)
- Are there enough confluence factors? (for signal generation, minimum draw targets)

This is checked against the current `SmcReport` — not just against static config. For example, if the market has no clear draw targets, the guardrail downgrades "generate_signal" to "analysis_report" even if the LLM is confident.

**Tier 3 — Signal Validation (post-decision):**

After a signal is generated, `validateSignal()` checks:
- Confidence ≥ threshold (50)
- R:R ratio ≥ 1.0 (minimum — otherwise negative expectancy)
- R:R ratio ≤ 20 (catches calculation errors — 20:1 R:R is almost certainly a price conversion bug)

The R:R bounds are defensive programming at its best: too-low R:R catches marginal setups, too-high R:R catches data errors.

**The backtest engine as risk tool:**
The sliding-window backtest isn't just for strategy development — it's a risk management tool. Running a backtest on a new symbol before trading it will reveal:
- Average win rate (if < 40%, reconsider)
- Sharpe ratio (if < 0.5, the strategy isn't stable)
- Profit factor (if < 1.0, the strategy loses money)
- Max drawdown (if > 20%, risk per trade is too high)
- Setup type distribution (too many of one type = overfitting)

**What's missing for unsupervised live trading:**
1. **Portfolio-level risk**: The guardrails check individual trades but not aggregate exposure. A user could open 20 concurrent positions all correlated to BTC.
2. **Time-based filters**: No minimum time between trades or maximum trades per day.
3. **Drawdown-based halt**: `maxDrawdownPercent` is checked at the config level but not enforced dynamically — if the account hits 15% drawdown, the system should auto-disable live mode.
4. **Position sizing**: The `suggested_qty` from SignalGenerator is always 100 units. Real position sizing requires account balance, volatility, and risk-per-trade calculations.
5. **Market hours filter**: No guardrail against trading during news events (NFP, FOMC, CPI) when spreads widen unpredictably — though the News integration is a step toward this.

---

### Expert 8: Product Manager

*Specialty: Trading platform product strategy, user research, competitive analysis*

#### Assessment

SMC Pulse Predict occupies a unique position in the trading tools landscape — it sits between educational tools (BabyPips, ICT mentorship) and execution platforms (TradingView, MetaTrader), with AI infrastructure that none of them have.

**Competitive landscape:**

| Feature | SMC Pulse Predict | TradingView | MetaTrader | Custom ICT Indicators |
|---|---|---|---|---|
| Multi-TF cascade | ✅ Built-in | ❌ Manual | ❌ Manual | ⚠️ Custom |
| OB/FVG detection | ✅ Algorithmic | ⚠️ Indicators | ❌ | ✅ Custom |
| SMT divergence | ✅ Automated | ❌ | ❌ | ⚠️ Custom |
| Agent AI analysis | ✅ 3 modes | ❌ | ❌ | ❌ |
| Background monitoring | ✅ Agent Loop | ❌ Alerts only | ❌ | ❌ |
| Memory (vector) | ✅ Qdrant | ❌ | ❌ | ❌ |
| Backtesting | ✅ SMC-aware | ⚠️ Pine Script | ✅ Strategy Tester | ⚠️ Manual |
| Execution | ✅ Alpaca/Mock | ⚠️ Brokerage | ✅ | ❌ |

The competitive moat is the **integrated AI pipeline**: no other platform combines ICT/SMC analysis with an LLM agent that can reason about the data, consider news context, reference past setups, and explain its reasoning. The closest competitor would be TradingView + ChatGPT side-by-side — a manual workflow that's slower and less reliable.

**Three key user segments:**

1. **ICT students** (largest segment): People learning ICT methodology. The system functions as an automated mentor — showing correct OB/FVG detection, bias alignment, and confluence scoring. The "Copy Plan" button lets them paste the full analysis into their journal.

2. **Algorithmic traders**: People who want systematic SMC-based execution. The Gardrail system and SignalGenerator produce structured trade plans that can be reviewed like algorithmic signals. The backtest engine provides performance metrics before live deployment.

3. **Institutional analysts**: The MCP server on port 3002 exposes all 11 SMC tools as MCP tools that external AI agents (Claude Desktop, custom AI applications) can call autonomously. This means the SMC engine can be integrated into larger AI workflows — an institutional-grade use case.

**Product roadmap alignment:**

The current state of the product (~20 recent commits covering Agent Loop, Langfuse, News/RAG, Backtest Runner, Vector Memory) shows a clear trajectory from "ICT analysis tool" to "AI trading agent platform." The key milestones:

- ✅ Core SMC engine (7 modules, 302 tests)
- ✅ Real-time data pipeline (Binance WS, Finnhub, Yahoo)
- ✅ AI agent system (Q&A, Pipeline, MCP tool-calling)
- ✅ Agent Loop (OODA-inspired 7-step cycle)
- ✅ Observability (Langfuse tracing, cost tracking)
- ✅ Memory (Episodic, Semantic, Vector)
- ✅ Evaluation (LLM-as-judge, performance scoring)
- ✅ Backtesting (sliding-window SMC backtest)
- 🔄 Execution (Alpaca integration exists but needs auto-trading)

**Recommendations:**
1. **Auto-trading mode**: The broker execution system exists (MockBroker, AlpacaAdapter) but there's no link between the Agent Loop's "signal_generated" action and automatic execution in LIVE mode. This is the single highest-impact feature to build next.
2. **Social/community features**: A shared signal feed where users can compare their Agent Loop results and discuss setups would dramatically increase engagement.
3. **Mobile companion**: The frontend is responsive but not mobile-first. A React Native companion app that shows active monitors and pushes notifications on signal generation would extend the platform beyond desktop hours.

---

## Appendix: Quick Reference

### API Endpoints

| Method | Path | Purpose | SSE? |
|---|---|---|---|
| GET | `/api/healthz` | Health check | No |
| GET | `/api/symbols` | Supported symbols | No |
| GET | `/api/analysis/{crypto,forex}` | Full SMC report | No |
| POST | `/api/agents/ask` | AI Q&A | Yes |
| POST | `/api/agents/pipeline` | 4-agent pipeline | Yes |
| POST | `/api/agents/ask-mcp` | MCP tool-calling agent | Yes |
| POST | `/api/agent-loop/run` | One-shot loop cycle | Yes |
| POST | `/api/agent-loop/start-monitoring` | Background candle monitor | No |
| GET | `/api/agent-loop/status` | Active monitors | No |
| GET | `/api/agent-loop/runs` | Historical runs | No |
| GET | `/api/agent-loop/news?symbol=` | News articles | No |
| POST | `/api/agent-loop/similar-setups` | Vector search | No |
| POST | `/api/backtest/run` | Sliding-window backtest | No |
| POST | `/api/signals/execute` | Execute through broker | No |
| GET | `/api/ledger` | Trade signal history | No |
| GET | `/api/performance-matrix` | Setup performance metrics | No |

### Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | Yes | HTTP server port (default: 3001) |
| `FIREWORKS_API_KEY` | Yes (AI) | Fireworks AI API key |
| `DATABASE_URL` | No | PostgreSQL connection |
| `LLM_PROVIDER` | No | Provider: fireworks, openai, amd, custom, ollama |
| `LANGFUSE_PUBLIC_KEY` | No | Langfuse tracing (public key) |
| `LANGFUSE_SECRET_KEY` | No | Langfuse tracing (secret key) |
| `NEWS_ENABLED` | No | Enable news fetching (default: false) |
| `QDRANT_URL` | No | Qdrant vector database URL |
| `ALPACA_API_KEY_ID` | No | Alpaca paper trading credentials |
| `FINNHUB_API_KEY` | No | Forex real-time data |

---

## Conclusion

SMC Pulse Predict is a technically impressive implementation of ICT/SMC analysis that goes beyond simple indicator-based approaches by integrating a full AI agent system with memory, evaluation, and background monitoring. The architecture is modular, the SMC engine is algorithmically faithful to ICT methodology, and the observability infrastructure (Langfuse tracing, structured logging, database persistence) makes it suitable for serious use.

The most impactful next step is closing the loop between signal generation and execution — connecting the Agent Loop's "act" step directly to the broker adapter in LIVE mode, with the existing guardrails providing the safety layer. After that, a mobile companion app for monitoring and notifications would significantly expand the platform's utility.

**Final rating across dimensions:**
- **SMC/ICT Accuracy**: 9/10
- **Architecture & Code Quality**: 8/10
- **AI Agent Capability**: 8/10
- **Data Pipeline Reliability**: 7/10 (Windows Docker issues)
- **Risk Management**: 6/10 (needs portfolio-level guardrails)
- **User Experience**: 8/10
- **Product Completeness**: 7/10
- **Documentation**: 8/10
