# Backend — SMC Pulse Predict

## Overview

The backend is a stateless Node.js/Express 5 server. Its sole responsibilities are:
1. Fetching OHLCV market data from Binance (crypto) or Yahoo Finance (forex)
2. Running the ICT/SMC algorithmic engine over that data
3. Caching results for 60 seconds
4. Serving the result as JSON
5. Proxying requests to Fireworks AI and streaming the responses back to the browser

There is no database. Every request is fully recomputed from live market data (or served from cache).

---

## Entry Points

### `src/index.ts`
Process entry point. Reads `PORT` from environment (default 3001), binds the Express app, and starts the HTTP server. No logic lives here — it purely mounts the app.

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
/api/health        → routes/health.ts
/api/symbols       → routes/symbols.ts
/api/analysis/*    → routes/analysis.ts
/api/agents/*      → routes/agents.ts
```

---

### `routes/health.ts`
**GET /api/health**

Returns `{ status: "ok", timestamp }`. Used by monitoring and uptime checks.

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

**Model**: `accounts/fireworks/models/llama-v3p3-70b-instruct` via `https://api.fireworks.ai/inference/v1/chat/completions`

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
| Cache hit | < 2ms |
| Binance candle fetch | 80–200ms |
| Yahoo Finance fetch | 100–300ms |
| SMC engine computation | 5–20ms |
| Full uncached crypto request | 150–300ms |
| Full uncached forex request | 200–400ms |
| AI ask stream (first token) | 300–800ms |
| AI pipeline (all 4 agents) | 8–15s |

The cache is the primary performance lever. With 3 TF cards loaded simultaneously (Intraday mode), the dashboard makes 3 parallel API calls. All 3 hit the cache on the 60s auto-refresh cycle, so the UI refresh is near-instant.

---

## Scalability Considerations

The current architecture is intentionally simple and stateless:

- **Horizontal scaling**: Multiple server instances work without shared state because the cache is in-process (each instance builds its own cache). For true shared caching, replace the Map with Redis.
- **Data provider limits**: Binance allows high request rates on public endpoints. Yahoo Finance is unofficial and rate-limited — the 60s cache is critical for forex users.
- **AI costs**: Fireworks AI charges per token. The system prompt is ~400 tokens and max response is 1024 tokens. Cost per analysis pipeline: ~$0.003–0.005.
- **Memory**: The cache Map holds at most 500 entries × ~20KB average report = ~10MB. Well within any server's limits.
