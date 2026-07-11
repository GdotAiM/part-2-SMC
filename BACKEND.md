# Backend — SMC Pulse Predict

## Overview

The backend is a stateless Node.js/Express 5 server. Its responsibilities are:
1. Fetching real-time OHLCV data via WebSocket (crypto: Binance US, forex: Finnhub or Yahoo polling)
2. Fetching OHLCV market data from Yahoo Finance for initial/fallback data
3. Running the ICT/SMC algorithmic engine over that data
4. Caching results for 60 seconds
5. Broadcasting real-time candle updates and rebuilt SMC reports to browsers via SSE
6. Proxying requests to LLM providers (Fireworks, OpenAI, self-hosted vLLM, custom) and streaming responses via SSE
7. Serving an MCP (Model Context Protocol) server for external AI agent access
8. Executing trades through broker adapters (MockBroker for development, AlpacaAdapter for paper trading)

There is no hard dependency on a database. The server runs fully without PostgreSQL — the trade ledger and performance matrix endpoints return empty results when DATABASE_URL is unset.

---

## Entry Points

### `src/index.ts`
Process entry point. Reads `PORT` from environment, binds the Express app, starts HTTP server, and initialises real-time connections:
- `binanceWs.subscribe("BTCUSDT", [...all 7 TFs])` — Binance US WebSocket for crypto
- `forexWs.subscribe("EURUSD=X", [...all 7 TFs])` — Finnhub WS or Yahoo polling for forex
- **MCP server** on `MCP_PORT` (default 3002) using HTTP streaming transport at `/mcp`
- Graceful shutdown on SIGTERM/SIGINT: closes WebSockets, stops pollers, closes MCP server, closes Express

### `src/app.ts`
Express app factory. Configures:
- **Pino HTTP middleware** — structured JSON request/response logging
- **CORS** — allows all origins (development-friendly)
- **JSON body parser** — `express.json()` for POST bodies
- **Route mounting** — delegates all routes to `routes/index.ts`

---

## Routes

### `routes/index.ts`
Central router mount. Registers all sub-routers under the `/api` prefix:
```
/api/healthz          → routes/health.ts
/api/symbols          → routes/symbols.ts
/api/analysis/*       → routes/analysis.ts
/api/agents/*         → routes/agents.ts + agents-mcp.ts
/api/agent-loop/*     → routes/agent-loop.ts   ← NEW
/api/stream/*         → routes/stream.ts
/api/ledger/*         → routes/ledger.ts
/api/signals/*        → routes/ledger.ts
/api/broker/*         → routes/ledger.ts
/api/account          → routes/ledger.ts
/api/performance-matrix/* → routes/ledger.ts
```

---

### `routes/health.ts`
**GET /api/healthz**

Returns `{ status: "ok", timestamp }`. Used by monitoring, Docker healthchecks, and uptime checks.

**Inputs**: none
**Output**: `{ status: "ok", timestamp: number }`

---

### `routes/symbols.ts`
**GET /api/symbols**

Returns the hardcoded lists of supported crypto pairs and forex pairs.

**Inputs**: none
**Output**:
```json
{
  "crypto": [
    { "symbol": "BTCUSDT", "label": "BTC/USDT" },
    { "symbol": "ETHUSDT", "label": "ETH/USDT" },
    ...
  ],
  "forex": [
    { "symbol": "EURUSD=X", "label": "EUR/USD" },
    { "symbol": "GBPUSD=X", "label": "GBP/USD" },
    ...
  ]
}
```

---

### `routes/analysis.ts`
**GET /api/analysis/crypto** and **GET /api/analysis/forex**

The main analysis endpoints. Identical logic, different data fetchers.

**Query parameters**:
| Param | Required | Default | Description |
|---|---|---|---|
| `symbol` | Yes | — | Trading pair (e.g. `BTCUSDT`, `EURUSD=X`) |
| `timeframe` | No | `4h` | Candle timeframe (`1m`, `5m`, `15m`, `1h`, `4h`, `1d`, `1w`) |
| `correlatedSymbol` | No | — | Second symbol for SMT divergence analysis |

**In-Memory Cache**:
- Cache key: `"${market}|${symbol}|${timeframe}|${correlatedSymbol}"` (e.g. `"crypto|BTCUSDT|4h|ETHUSDT"`)
- TTL: 60 seconds
- Max entries: 500 (FIFO eviction)
- Implementation: `Map<string, { data: unknown, expiresAt: number }>`

**Request flow**:
1. Validate required params
2. Check cache → return immediately if hit
3. `Promise.all()` — fetch primary candles, daily candles, and (if requested) correlated candles in parallel
4. `buildReport()` — run the SMC engine
5. Cache result
6. Return JSON

**Error handling**: Wraps fetch and build in try/catch; returns `500` with the error message on failure.

**Performance**: Typical uncached response: 150–300ms (dominated by external API fetch). Cached response: < 2ms.

---

### `routes/agents.ts`
**POST /api/agents/ask** and **POST /api/agents/pipeline**

AI analyst endpoints. Both stream Server-Sent Events (SSE) back to the client.

**Authentication**: Reads `FIREWORKS_API_KEY` from environment. Returns 500 if not set.

**Model**: `accounts/fireworks/models/deepseek-v4-pro` via `https://api.fireworks.ai/inference/v1/chat/completions`

**`/agents/ask` request body**:
```json
{
  "question": "Where is the draw on liquidity?",
  "report": { ...SmcReport },
  "history": [{ "role": "user", "content": "..." }]
}
```

**`/agents/pipeline` request body**:
```json
{ "report": { ...SmcReport } }
```

**Streaming protocol**:
- Sets `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`
- Reads Fireworks SSE stream chunk by chunk
- Re-emits each `delta.content` token as a new SSE event
- Handles `[DONE]` sentinel and malformed JSON chunks gracefully

See `AI_SYSTEM.md` for the full agent pipeline design.

---

### `routes/agent-loop.ts` (NEW)

Agent Loop Engine — autonomous market analysis cycle with memory, guardrails, and observability.

**Endpoints**:

| Method | Path | Description |
|---|---|---|
| POST | `/api/agent-loop/run` | Execute one loop cycle (SSE stream — 7 steps) |
| POST | `/api/agent-loop/start-monitoring` | Start background candle-close monitor |
| POST | `/api/agent-loop/stop-monitoring` | Stop background monitor |
| GET | `/api/agent-loop/status` | Active monitors list |
| GET | `/api/agent-loop/runs` | Historical runs with symbol/status/limit filters |
| GET | `/api/agent-loop/runs/:id` | Detailed run trace (run record + all steps) |
| POST | `/api/agent-loop/runs/:id/evaluate` | Trigger post-run evaluation scoring |
| GET | `/api/agent-loop/memory` | Query semantic memory entries by tags/key |
| POST | `/api/agent-loop/memory` | Store a manual semantic memory entry |
| DELETE | `/api/agent-loop/memory/:id` | Delete a memory entry |
| GET | `/api/agent-loop/news?symbol=` | Fetch news articles |
| GET | `/api/agent-loop/news/macro` | Fetch upcoming macro events |
| POST | `/api/agent-loop/similar-setups` | Find similar past setups via Qdrant |
| GET | `/api/agent-loop/news-context?symbol=` | Formatted news for LLM |
| GET | `/api/agent-loop/qdrant-status` | Qdrant health check |
| POST | `/api/agent-loop/optimize` | Optimize an agent prompt |
| GET | `/api/agent-loop/langfuse-status` | Langfuse config status |

**Architecture**:
- `lib/loop/AgentLoop.ts` — Central orchestrator (extends EventEmitter). Runs the Observe→Interpret→Reason→Decide→Act→Evaluate→Update cycle
- `lib/loop/LoopContext.ts` — Working memory: current report, previous reports, iteration/step tracking
- `lib/loop/AgentGuardrails.ts` — Pre-flight and post-decision safety checks (confidence floor, risk limits, symbol blacklist)
- `lib/loop/MonitoringManager.ts` — Singleton that tracks active background monitors per symbol/timeframe
- `lib/memory/EpisodicMemory.ts` — Wraps TradeLedgerService for recall of past signals and outcomes
- `lib/memory/SemanticMemory.ts` — Wraps PerformanceMatrixService for pattern knowledge + agent_memory table
- `lib/memory/MemoryService.ts` — Facade combining all memory tiers
- `lib/harness/LoopTracer.ts` — Step-level tracing persisted to agent_loop_runs/agent_loop_steps tables
- `lib/harness/LoopEvaluator.ts` — Post-run scoring (0-100) and memory ingestion

**Background Monitoring Flow**:
1. `POST /api/agent-loop/start-monitoring` creates an AgentLoop + registers with MonitoringManager
2. The loop subscribes to `candleStore.on("candleClosed")` for its configured symbol/timeframe
3. Each candle close triggers the full 7-step cycle automatically
4. Results are persisted to `agent_loop_runs` and `agent_loop_steps` tables
5. `POST /api/agent-loop/stop-monitoring` unsubscribes and cleans up

**Configuration** (can be overridden per request via `config` body field):
```json
{
  "maxIterations": 3,
  "confidenceFloor": 60,
  "maxRiskPerTrade": 0.02,
  "allowedActions": ["generate_signal", "analysis_report", "monitor"],
  "guardrails": {
    "requireConfluenceMin": 2,
    "confidenceThreshold": 50,
    "prohibitSymbols": []
  }
}
```

---

### `routes/stream.ts`

**GET /api/stream/:symbol** and **GET /api/stream/status**

Real-time SSE streaming endpoint for live candle data and SMC report updates.

**Query parameters**:
| Param | Required | Default | Description |
|---|---|---|---|
| `timeframes` | No | All 7 | Comma-separated list (e.g. `1m,5m,15m`) |

**Flow**:
1. Subscribe the symbol to the appropriate real-time source (Binance WS for crypto, Finnhub/Yahoo for forex)
2. Register an SSE client with the SSE manager
3. SSE events stream to the browser: `connected` (initial snapshots), `candle_update`, `candle_closed`, `report_update`

**`/api/stream/status`**: Returns debug information — connected client count, per-symbol candle counts, active symbols.

---

## Real-Time Infrastructure (`lib/realtime/`)

### `binance-ws.ts` — Crypto WebSocket Manager

Connects to Binance US WebSocket (`wss://stream.binance.us:9443/ws`) for real-time kline data. Supports multiple symbols on a single shared connection via combined streams.

**Key features**:
- Multi-symbol shared WebSocket connection (e.g. `btcusdt@kline_1m/ethusdt@kline_4h`)
- Binance US → Binance global auto-fallback on geo-restriction (HTTP 451)
- Exponential backoff reconnect: 1s → 2s → 4s → 16s → 30s (capped)
- REST historical backfill on first subscribe (299 closed candles from `GET /api/v3/klines`)
- Maps Binance kline events to `CandleUpdate` and feeds into `candleStore`

### `forex-ws.ts` — Forex Real-Time Manager

Two-mode forex data pipeline. Detects mode based on `FINNHUB_API_KEY` environment variable:

| Mode | Trigger | Behavior |
|---|---|---|
| **Finnhub** | `FINNHUB_API_KEY` set | Finnhub WebSocket for live tick prices + Finnhub REST polling for candle data |
| **Yahoo fallback** | No key | Enhanced Yahoo polling every 15 seconds for all subscribed TFs |

**Symbol mapping** (Yahoo → Finnhub):
| Yahoo | Finnhub |
|---|---|
| `EURUSD=X` | `OANDA:EUR_USD` |
| `GBPUSD=X` | `OANDA:GBP_USD` |
| `USDJPY=X` | `OANDA:USD_JPY` |

Both modes feed into the same `candleStore → analysis-bridge → cache + SSE report_update` pipeline.

### `candle-store.ts` — In-Memory Candle Accumulator

Thread-safe `Map<"SYMBOL|TF", Candle[]>` store. Emits events via Node.js `EventEmitter`:
- `candleUpdate` — when a forming candle's price changes (1/sec for crypto 1m)
- `candleClosed` — when a candle finalises and moves to the closed list

Key methods: `applyUpdate()`, `seedCandles()` (bulk-load from REST backfill), `getCandles()`, `getSnapshot()`, `getStatus()`.

### `sse-manager.ts` — SSE Broadcast Manager

Manages browser SSE client connections. Listens to `candleStore` events and broadcasts to all clients subscribed to the matching symbol. Filters by timeframe when specified.

Key methods: `addClient()`, `broadcast()`, `broadcastReport()` (for `report_update` events).

### `analysis-bridge.ts` — Candle Close → SMC Report Rebuild

Wires the real-time candle pipeline into the SMC engine. On `candleClosed`:
1. Grabs the updated candle array from `candleStore`
2. Runs the full SMC engine (`buildReport`) — <50ms
3. Pre-warms the REST analysis cache via `updateCachedReport()`
4. Pushes the fresh `SmcReport` to browsers via SSE `report_update`

The `AgentLoop` background monitor also subscribes to `candleClosed` — when active, it receives the same event and runs its full 7-step cycle (Observe→Interpret→Reason→Decide→Act→Evaluate→Update) on every candle close for its configured symbol/timeframe.

Market-aware: detects crypto vs forex from symbol naming convention and calls the appropriate daily-candle fetcher.

---

## Database Tables (Drizzle ORM / PostgreSQL)

Three new tables added for the Agent Loop system:

### `agent_loop_runs`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `symbol` | `varchar(20)` | e.g. BTCUSDT |
| `timeframe` | `varchar(5)` | e.g. 4h |
| `market` | `varchar(10)` | crypto / forex |
| `config_snapshot` | `jsonb` | Full LoopConfig at start |
| `status` | `varchar(20)` | running / completed / error / stopped |
| `triggered_by` | `varchar(20)` | candle_close / api / scheduled / manual |
| `total_iterations` | `integer` | Count of completed iterations |
| `total_tokens` | `integer` | Approximate LLM tokens used |
| `result` | `jsonb` | LoopResult (action, confidence, narrative) |
| `error` | `varchar(500)` | Error message if failed |
| `evaluation_score` | `integer` | 0–100 post-run score |
| `evaluation` | `jsonb` | Full RunEvaluation object |
| `started_at` / `completed_at` | `timestamp` | Timing |
Indexes: symbol, status, started_at, triggered_by

### `agent_loop_steps`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `run_id` | `uuid` | FK → agent_loop_runs (cascade delete) |
| `iteration_sequence` | `integer` | Which iteration this step belongs to |
| `step_type` | `varchar(30)` | observe / interpret / reason / decide / act / evaluate / update_memory |
| `started_at` / `completed_at` | `timestamp` | Timing |
| `duration_ms` | `integer` | Auto-calculated |
| `input_snapshot` / `output_snapshot` | `jsonb` | What went in and came out |
| `tool_calls` | `jsonb` | Array of { name, args, result } |
| `error` | `varchar(500)` | Per-step error |
Indexes: run_id, step_type

### `agent_memory`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `memory_key` | `varchar(200)` | Unique — deduplication key |
| `content` | `text` | Natural language rule or insight |
| `source` | `varchar(30)` | matrix / episode / manual / evaluation |
| `score` | `decimal(5,4)` | 0–1 relevance factor |
| `tags` | `varchar(50)[]` | PostgreSQL text array for multi-dimensional tagging |
| `is_durable` | `boolean` | True if survives restarts |
| `source_run_id` | `varchar(100)` | Link back to generating run |
| `created_at` / `last_accessed_at` | `timestamp` | Lifecycle |
Indexes: memory_key (unique), tags (GIN), score

---

## Fetchers

### `lib/fetchers/binance.ts`

Fetches OHLCV data from the Binance public REST API (no API key required for market data).

**`fetchBinanceCandles(symbol, timeframe)`**
- URL: `https://api.binance.com/api/v3/klines?symbol={symbol}&interval={tf}&limit=300`
- Maps Binance kline arrays `[openTime, open, high, low, close, volume, ...]` to `Candle` objects
- `time` field is Unix timestamp in **seconds** (divided by 1000 from Binance milliseconds)
- Returns up to 300 candles

**`fetchBinanceDailyCandles(symbol)`**
- Same endpoint with `interval=1d&limit=60`
- Used exclusively for daily bias computation

**Timeframe mapping**:
| App TF | Binance interval |
|---|---|
| `1m` | `1m` |
| `5m` | `5m` |
| `15m` | `15m` |
| `1h` | `1h` |
| `4h` | `4h` |
| `1d` | `1d` |
| `1w` | `1w` |

**Error handling**: Throws with the Binance error message if the response is not `ok`.

---

### `lib/fetchers/yahoo.ts`

Fetches OHLCV data from the Yahoo Finance REST API (no API key required).

**`fetchYahooCandles(symbol, timeframe)`**
- URL: `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval={yf_interval}&range={range}`
- Maps Yahoo's `timestamp[]`, `quote.open[]`, `quote.high[]`, `quote.low[]`, `quote.close[]`, `quote.volume[]` parallel arrays to `Candle` objects
- Filters out null/undefined values (Yahoo frequently returns nulls in extended hours)

**Yahoo interval mapping**:
| App TF | Yahoo interval | Range |
|---|---|---|
| `1m` | `1m` | `1d` |
| `5m` | `5m` | `5d` |
| `15m` | `15m` | `5d` |
| `1h` | `60m` | `60d` |
| `4h` | `4h` | `60d` |
| `1d` | `1d` | `1y` |
| `1w` | `1wk` | `5y` |

**Limitation**: Yahoo Finance's API is unofficial and can return HTTP 429 during high-traffic periods. The 60s cache mitigates repeated hits.

---

## SMC Engine

### `lib/smc/config.ts`

Centralised configuration constants used across all SMC modules. Changing a value here affects the entire engine consistently. Key parameters:

| Constant | Value | Effect |
|---|---|---|
| `pivotLookbackPerTf` | 2–5 per TF | More bars = fewer but more significant pivots |
| `atrPeriodPerTf` | 6–14 per TF | Shorter = more reactive noise filter |
| `equalLevelThreshold` | 0.001 | 0.1% — how close two levels must be to become EQH/EQL |
| `obLookForward` | 3 | How many bars ahead of a displacement to search for the OB candle |
| `sessionWeights` | see config | Session multipliers for liquidity scoring |
| `maxCandles` | 300 | Maximum bars fetched |
| `maxDailyCandles` | 60 | Daily bars for HTF bias |

---

### `lib/smc/types.ts`

All shared TypeScript interfaces. This is the **single source of truth** for the data contract between the SMC engine and the API response. Any new field added here must also be mirrored in `lib/api-client-react/src/generated/api.schemas.ts`.

Key interfaces:
- `Candle` — OHLCV bar
- `StructureResult` — pivots, breaks, trend, bias, phase, narrative, evidence
- `LiquidityPool` — BSL/SSL/EQH/EQL with scoring and sweep probability
- `OrderBlock` — with confidence, confidenceFactors, breaker flag
- `FairValueGap` — with fill fraction and inversion flag
- `PdArrayResult` — premium/discount/equilibrium zones
- `DailyBiasResult` — HTF bias with evidence
- `SmtDivergence` — detected divergence with confidence and timestamp
- `DrawTarget` — scored price objective with evidence
- `SmcReport` — the complete assembled report

---

### `lib/smc/structure.ts`

**Input**: `Candle[]`, `timeframe: string`
**Output**: `StructureResult`

**Key functions**:

`calcATR(candles, period)` — Wilder's ATR smoothing (EMA-based). Used for noise filtering in pivot detection and as a scaling reference throughout the engine.

`findPivots(candles, atr, lookback)` — Scans every candle and tests whether its high/low is the dominant value within a ±lookback window, with ATR-scaled noise tolerance. Returns arrays of high-index and low-index positions. **Does not filter by candle colour** — ICT-correct.

`detectPhase(breaks, bias)` — Reads the last 5 structure breaks and classifies the current market phase.

`analyzeStructure(candles, tf)` — Orchestrates pivot detection and break scanning. Builds `StructurePoint[]` (classified as HH/HL/LH/LL) and `StructureBreak[]` (BOS/CHoCH). Computes `confidence` from the ratio of aligned breaks to total breaks. Derives `bias` from the dominant pivot sequence. Calls `detectPhase()`. Generates `narrative` and `evidence[]` strings.

**Algorithm for bias confidence**:
```
alignedBreaks = breaks where direction matches structure.bias
confidence = alignedBreaks.length / max(1, breaks.length)
confidence clamped to [0.25, 0.92]
```

---

### `lib/smc/liquidity.ts`

**Input**: `Candle[]`, `timeframe: string`, `market: Market`
**Output**: `LiquidityResult`

**`analyzeLiquidity(candles, tf, market)`**:
1. Runs pivot detection (same ATR + lookback as structure.ts, via shared config)
2. Converts each swing high → BSL pool, each swing low → SSL pool
3. Groups pools within `equalLevelThreshold` → EQH/EQL
4. Scores each pool: base = session weight × touches × recency decay
5. Computes `probabilityOfSweep` with exponential distance decay + session + bias boosts
6. Sorts by score descending
7. Returns `nearestBSL` = closest unswept pool **above** current price, `nearestSSL` = closest unswept pool **below**

**Session detection for pools**:
UTC hour of the pool's candle:
- 0–6 → "asia"
- 6–12 → "london"
- 12–17 → "newYork"
- 17–20 → "overlap" (gets 1.5× weight)

---

### `lib/smc/order-blocks.ts`

**Input**: `Candle[]`, `FairValueGap[]`
**Output**: `OrderBlock[]`

**`analyzeOrderBlocks(candles, fvg)`**:
1. Computes ATR for displacement detection
2. Scans for displacement moves (large candles exceeding 1.5× ATR body size)
3. For each displacement, looks backward `obLookForward` bars for the last opposite-colour candle
4. Assigns proximal (entry zone boundary) and distal (invalidation) levels
5. Checks FVG confluence within 0.5% proximity
6. Scores confidence from multiple factors (see ICT_IMPLEMENTATION.md)
7. Checks subsequent candles for mitigation (close beyond distal)
8. Identifies breaker blocks from mitigated OBs that price has passed through

**OB boundary assignment (ICT-correct)**:
```
Bullish OB (bearish displacement candle before a bullish move):
  proximal = candle.open   ← top of bearish body
  distal   = candle.low    ← bottom wick

Bearish OB (bullish displacement candle before a bearish move):
  proximal = candle.open   ← bottom of bullish body
  distal   = candle.high   ← top wick
```

---

### `lib/smc/fvg.ts`

**Input**: `Candle[]`, `market: Market`
**Output**: `FairValueGap[]`

**`analyzeFVG(candles, market)`**:
Scans every candle triplet `[i-1, i, i+1]`:
- Bullish FVG: `candles[i-1].high < candles[i+1].low` → gap between those two wicks
- Bearish FVG: `candles[i-1].low > candles[i+1].high` → gap between those two wicks

After initial detection, scans subsequent candles to compute `fillFraction` — the proportion of the FVG that price has entered. Marks `isInversion = true` when fill reaches 1.0 and price closes through the far side.

Filters out FVGs smaller than `fvgMinBodyRatio × ATR` (noise filter).

---

### `lib/smc/pd-array.ts`

**Input**: `Candle[]`, `timeframe: string`
**Output**: `PdArrayResult`

**`analyzePdArray(candles, tf)`**:
1. Identifies the dealing range: the most recent significant swing high and swing low from pivot detection
2. Computes `equilibrium = (high + low) / 2`
3. Classifies `currentBias`:
   - `currentPrice > equilibrium × 1.01` → "premium"
   - `currentPrice < equilibrium × 0.99` → "discount"
   - Otherwise → "equilibrium"
4. Creates 5 PD zones: deep premium (75–100%), premium (50–75%), equilibrium (45–55%), discount (25–50%), deep discount (0–25%)

---

### `lib/smc/daily-bias.ts`

**Input**: `Candle[]` (1D timeframe candles)
**Output**: `DailyBiasResult`

**`analyzeDailyBias(dailyCandles)`**:
- Runs pivot detection on the daily candles
- If the last 3+ pivots form a clear HH/HL or LH/LL sequence → structure-based bias (strength 0.55–0.88)
- A confirming BOS on the daily → strength boosted to 0.88
- Fallback: SMA(20) position → weak bias signal (strength capped at 0.20)
- Generates `evidence[]` strings explaining the bias
- Tracks `consecutiveDays` of the same bias by counting aligned daily candles

---

### `lib/smc/smt.ts`

**Input**: `Candle[]` (primary), `Candle[]` (correlated), `primarySymbol`, `correlatedSymbol`
**Output**: `SmtDivergence`

**`analyzeSMT(primary, correlated, primarySym, corrSym)`**:
1. Aligns both candle arrays by `time` field (drops bars without a corresponding bar in the other series)
2. Finds recent swing highs in both series
3. Detects divergence:
   - **Bearish SMT**: Primary makes a new HH; correlated makes a LH at approximately the same bar
   - **Bullish SMT**: Primary makes a new LL; correlated makes a HL at the same bar
4. Computes confidence:
   - Magnitude: `|log(primarySwing / corrSwing)|` — log-scale divergence
   - Timing: `1 / (1 + barDifference)` — how many bars apart the two pivots are
   - Rejects divergences < 0.1% magnitude

---

### `lib/smc/report.ts`

The orchestrator. Calls every module in sequence, applies cross-module adjustments, and assembles the final `SmcReport`.

**`buildReport(candles, symbol, market, timeframe, options)`**:

```
1. analyzeStructure()    → structure
2. analyzeFVG()          → fvg
3. analyzeLiquidity()    → liquidity
4. analyzeOrderBlocks()  → orderBlocks
5. analyzePdArray()      → pdArray
6. analyzeDailyBias()    → dailyBias
7. analyzeSMT()          → smt          (if correlated candles provided)

8. HTF bias → OB confidence adjustment:
   - Bias-aligned OBs: confidence += 0.12, prepend "✓ HTF bias aligned"
   - Counter-trend OBs: confidence -= 0.15, append "✗ Counter-trend OB"

9. confluenceBoost() per draw target → scored DrawTarget[]

10. deriveSessionState() → sessionState string

11. candles.slice(-100)  → recentCandles (chart data)

12. buildMarketNarrative() → narrative string

13. Return assembled SmcReport
```

**`confluenceBoost(price, orderBlocks, fvgs, bias, pdBias, smt)`**:
Returns a `multiplier` (starts at 1.0) applied to a draw target's base score:
- Near unmitigated OB within 0.5% → `+0.35 × ob.confidence`
- Price inside unfilled FVG → `+0.20`
- Bias-aligned PD zone → `+0.10`
- SMT detected → `+0.08`

**`buildMarketNarrative(report)`**:
Constructs a 1–4 sentence string in reading order:
1. Daily bias direction
2. London sweep event (if within last 4 hours and in 06:00–08:00 window)
3. Last BOS/CHoCH event
4. OB + PD zone context
5. SMT confirmation (if detected)
6. Top draw target

---

## Logging

### `lib/logger.ts`

Exports a Pino logger instance. The HTTP middleware (`pino-http`) automatically logs:
- Every request: method, URL, request ID
- Every response: status code, response time

Structured JSON output makes logs easy to search in production log aggregators.

---

## Performance Characteristics

| Operation | Typical latency |
|---|---|
| Cache hit (REST analysis) | < 2ms |
| SMC engine computation | 5–20ms |
| Candle close → report rebuild → SSE push | < 100ms |
| Binance REST kline fetch | 80–200ms |
| Yahoo Finance fetch | 100–300ms |
| Full uncached crypto request | 150–300ms |
| Full uncached forex request | 200–400ms |
| AI ask stream (first token) | 300–800ms |
| AI pipeline (all 4 agents) | 8–15s |
| Agent Loop — SMC tool execution (interpret step, 8 tools) | 300–800ms |
| Agent Loop — LLM reasoning (reason step) | 2–5s |
| Agent Loop — full cycle (no signal generated) | 3–7s |
| Agent Loop — full cycle (with signal + persistence) | 4–8s |
| Binance WebSocket latency | < 100ms from exchange |
| Forex Yahoo polling interval | 15s (or 60s with Finnhub REST) |

The real-time pipeline eliminates the need for the 60s cache on live data — when a candle closes, the SMC report is rebuilt server-side and pushed to all browsers within 100ms, bypassing the REST API entirely.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | HTTP server port |
| `MCP_PORT` | No | MCP server port (default: 3002) |
| `FIREWORKS_API_KEY` | Yes (AI) | Fireworks AI API key for the analyst agent |
| `LLM_PROVIDER` | No | LLM provider: `fireworks` (default), `amd`, `openai`, `custom` |
| `LLM_MODEL` | No | Override the model name per provider |
| `LLM_BASE_URL` | No | Override the LLM base URL |
| `LLM_API_KEY` | No | Override the LLM API key |
| `FINNHUB_API_KEY` | No | Finnhub API key for forex real-time WebSocket. Without it, Yahoo polling is used as fallback (free, no key needed) |
| `ALPACA_API_KEY_ID` | No | Alpaca Paper Trading API key ID. Sets both to enable AlpacaAdapter |
| `ALPACA_API_SECRET_KEY` | No | Alpaca Paper Trading API secret key |
| `CORS_ORIGINS` | No | Comma-separated allowed origins (default: `*`) |
| `LANGFUSE_PUBLIC_KEY` | No | Langfuse project public key (LLM tracing) |
| `LANGFUSE_SECRET_KEY` | No | Langfuse project secret key |
| `LANGFUSE_HOST` | No | Langfuse server URL (default: https://us.cloud.langfuse.com) |
| `NEWS_ENABLED` | No | Enable news fetching for agent reasoning (default: false) |
| `COINMARKETCAP_API_KEY` | No | CoinMarketCap API key for crypto news |
| `QDRANT_URL` | No | Qdrant vector database URL (default: http://localhost:6333) |
| `DATABASE_URL` | No | PostgreSQL connection for trade persistence (optional) |
| `LOG_LEVEL` | No | Pino log level (default: `info`) |
| `NODE_ENV` | No | `development` or `production` |

---

## Execution Engine (`lib/execution/`)

### BrokerAdapter Interface (`BrokerAbstraction.ts`)

Abstract broker interface defining `name`, `isReady`, `executeOrder(signal, mode)`, `getBalance()`, `getOpenOrders()`, `closeOrder(orderId)`, `getOrderStatus(orderId)`. Also exports `deriveSide(signal)` — a shared helper that determines BUY/SELL from take_profit relative to entry_price.

### MockBrokerAdapter

File-based mock broker for development. Stores orders in `data/mock_broker/` as JSONL files (pending_orders.jsonl, executed_orders.jsonl) with account_balance.json. Default balance: $100,000. No external API calls.

### AlpacaAdapter (`AlpacaAdapter.ts`)

Real paper trading via Alpaca Markets API (`paper-api.alpaca.markets` — hardcoded, never the live endpoint). Requires `ALPACA_API_KEY_ID` + `ALPACA_API_SECRET_KEY`.

- **Symbol translation**: maps 8 Binance-style pairs (BTCUSDT→BTC/USD, ETHUSDT→ETH/USD, etc.) to Alpaca's format. Unmapped symbols and forex pairs return clean rejections.
- **REVIEW mode**: returns a dry-run preview — never calls the Alpaca API.
- **LIVE mode**: POSTs market orders to `/v2/orders`. Auth via `APCA-API-KEY-ID` and `APCA-API-SECRET-KEY` headers (not Bearer).
- **Status mapping**: 14 Alpaca status strings mapped to the 4-status union (PENDING/FILLED/CANCELLED/REJECTED). Unrecognized statuses default to PENDING with a logged warning.
- Constructor degrades gracefully — `isReady = false` when credentials are missing.

### ExecutionManager

Wraps a BrokerAdapter with a mode (REVIEW/LIVE). Mode switching requires `{ confirm: "LIVE" }` for LIVE, is immediate for REVIEW (kill-switch). Picked at module load: AlpacaAdapter if both API key env vars are set, otherwise MockBrokerAdapter.

### Broker Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/broker/status` | GET | Returns `{ broker_name, is_ready, mode, is_paper }` |
| `/api/broker/mode` | POST | Set execution mode. LIVE requires `{ confirm: "LIVE" }`. REVIEW is immediate. |
| `/api/account` | GET | Returns `{ balance, open_orders }` from the active broker |
| `/api/signals/execute` | POST | Execute signal at server's current mode (mode NOT accepted from body) |
| `/api/signals/generate` | POST | Fetch candles, run SMC, generate signal, log to ledger |
| `/api/ledger` | GET | Query signals with filters (asset, setup, symbol, mode, limit) |
| `/api/ledger/pending` | GET | Signals awaiting outcome |
| `/api/performance-matrix` | GET | Performance metrics by dimension combination |
| `/api/performance-matrix/rebuild` | POST | Trigger full matrix rebuild |
| `/api/backtest/run` | POST | Run sliding-window SMC backtest |
| `/api/backtest/run-multi` | POST | Run multi-asset cascade backtest |

### Signal Generator (`lib/services/SignalGenerator.ts`)

Converts SmcReport into a UnifiedTradeSignal (single-TF and multi-TF cascade modes). Entry from nearest aligned OB or FVG, SL from opposite liquidity pool, TP from top DOL target. Confidence = 30% structure + 40% confluence + 30% top OB.

### Trade Ledger + Performance Matrix

Drizzle ORM over PostgreSQL (`lib/db`). `trades` table (31 columns, jsonb for analysis_context, 5 indexes) and `performanceMatrix` table (19 columns, 7-dimension unique index). Lazy-init pool — no crash when DATABASE_URL is unset.

---

## MCP Server (`lib/mcp/`)

A FastMCP v4.3.2 server runs alongside Express on port 3002 at `/mcp` (HTTP streaming transport). External AI agents (Claude Desktop, etc.) connect and use 11 SMC analysis tools, 2 resources, and 1 prompt template.

### MCP Tools (11)

| Tool | Parameters | Data Source |
|---|---|---|
| `analyze_structure` | symbol, timeframe | Live WebSocket candle store |
| `analyze_liquidity` | symbol, timeframe | Live WebSocket candle store |
| `analyze_order_blocks` | symbol, timeframe | Live WebSocket candle store |
| `analyze_fvg` | symbol, timeframe | Live WebSocket candle store |
| `analyze_pd_array` | symbol, timeframe | Live WebSocket candle store |
| `get_daily_bias` | symbol | Binance/Yahoo REST daily candles |
| `detect_smt` | primarySymbol, correlatedSymbol, timeframe | Live WebSocket candle store |
| `get_draw_targets` | symbol, timeframe | Live WebSocket candle store |
| `build_full_report` | symbol, timeframe | WebSocket + REST daily candles |
| `get_live_candles` | symbol, timeframe, limit | Live WebSocket candle store |
| `scan_all_timeframes` | symbol | Live WebSocket candle store |

### MCP-Aware Agent (`routes/agents-mcp.ts`)

`POST /api/agents/ask-mcp` — Uses the MCP tool registry for in-process tool execution (bypasses FastMCP internals). LLM receives OpenAI-style function definitions for all 11 tools, autonomously decides which to call, can chain up to 3 tool-calling rounds iteratively.

---

## LLM Provider Abstraction (`lib/llm/provider.ts`)

Four providers via `LLM_PROVIDER` env var: `fireworks` (default, DeepSeek V4 Pro), `openai` (GPT-4o), `custom` (any OpenAI-compatible endpoint), `amd` (self-hosted vLLM on AMD GPU, Gemma 4 26B). All LLM calls go through the same `/chat/completions` OpenAI-compatible pattern. Streaming and non-streaming both supported.

---

## Scalability Considerations

The current architecture is intentionally simple and stateless:

- **Horizontal scaling**: Multiple server instances work without shared state because the cache is in-process (each instance builds its own cache). For true shared caching, replace the Map with Redis.
- **Data provider limits**: Binance allows high request rates on public endpoints. Yahoo Finance is unofficial and rate-limited — the 60s cache is critical for forex users.
- **AI costs**: Fireworks AI charges per token. The system prompt is ~400 tokens and max response is 1024 tokens. Cost per analysis pipeline: ~$0.003–0.005.
- **Memory**: The cache Map holds at most 500 entries × ~20KB average report = ~10MB. Well within any server's limits.
