# Frontend — SMC Pulse Predict

## Overview

The frontend is a React 18 SPA built with Vite and TypeScript. It connects to the backend over HTTP and renders a high-density, real-time market intelligence dashboard. There is no global state manager — all state lives in `dashboard.tsx` (server state via TanStack Query, UI state via `useState`).

**Design philosophy**: Information density over whitespace. Every pixel earns its place. Font is monospace throughout to align numbers in tabular contexts.

---

## Technology Stack

| Library | Purpose |
|---|---|
| React 18 | Component framework |
| Vite | Build tool and dev server |
| Tailwind CSS | Utility-first styling |
| shadcn/ui | Primitive components (dialog, sheet, select, etc.) |
| TanStack Query v5 | Server state management + caching |
| Lightweight Charts v5 | Candlestick chart rendering |
| Framer Motion | Animations |
| Wouter | Lightweight client-side router |
| Lucide React | Icon set |
| Fetch API (SSE) | Real-time streaming client |

---

## Pages

The app's primary interface is the **Session Cockpit** (`/`) -- a narrative-driven shell with 10 dedicated stage views, 3-column layout, and Zustand state management. Legacy pages remain accessible: **Analytics** (`/analytics`), **Broker** (`/broker`), **Agent Loop** (`/agent-loop`), and **Not Found** (`*`).

### `pages/dashboard.tsx` (Legacy)

The original single-page dashboard. Retained for reference; the Session Cockpit (documented below) is now the primary interface. Contains all application state and orchestrates all components.

**State**:
| State variable | Type | Purpose |
|---|---|---|
| `market` | `"crypto" \| "forex"` | Selected market |
| `symbol` | `string` | Primary trading pair |
| `corrSym` | `string` | Correlated symbol for SMT |
| `smtOn` | `boolean` | Whether SMT is enabled |
| `styleIdx` | `number` | Active trading style (Scalp/Intraday/Swing/All) |
| `sheet` | `{ tf, report } \| null` | Which Intelligence Sheet is open |
| `confluenceSheetOpen` | `boolean` | Whether ConfluenceSheet is open |
| `chartOpen` | `boolean` | Whether ChartView is open |
| `countdown` | `number` | Seconds until next auto-refresh |
| `refreshing` | `boolean` | Whether a manual refresh is in progress |
| `wsConnected` | `boolean` | Real-time WebSocket connection status (from `useRealtimeStream`) |
| `liveData` | `Record<string, LiveTfData>` | Per-TF live price and candle data |
| `liveCandles` | `Record<string, CandleData[]>` | Live candle arrays passed to ChartView |

**Hooks — unconditional**:
All 7 timeframe hooks are called regardless of the active trading style (React's rules of hooks). Each hook is `enabled` based on whether its TF is in the active style's timeframe list. This pattern avoids conditional hook calls while still preventing unnecessary fetches.

```ts
const r1m  = useTfData(market, symbol, "1m",  corrParam, activeStyle.timeframes.includes("1m"));
const r5m  = useTfData(market, symbol, "5m",  corrParam, activeStyle.timeframes.includes("5m"));
// ... etc for all 7 TFs
```

**`useTfData` helper**:
Wraps `useAnalyzeCrypto` or `useAnalyzeForex` based on the market toggle. Passes a `staleTime: 60_000` so TanStack Query won't refetch more often than once per minute.

**Cascade computation**:
```ts
const cascade = useMemo(() => {
  // Anchor = highest-weight TF with loaded data
  const anchorTf = sorted.find(tf => tfMap[tf].data) ?? sorted[0];
  const anchorBias = getBias(anchorReport);
  return { roles, anchorTf, anchorBias };
}, [all 7 report data dependencies, activeStyle]);
```

The cascade determines:
- Which TF is the "Bias Setter" (highest weight with data)
- Which TFs are "Confirmation" (middle)
- Which TF is "Entry Trigger" (lowest weight)

**Real-time WebSocket stream** (`useRealtimeStream` hook):
```ts
const { liveData, connected: wsConnected, candles: liveCandles } = useRealtimeStream({
  symbol,
  timeframes: activeStyle.timeframes,
  // When server rebuilds SMC report after candle close, inject directly into query cache
  onReportUpdate: (tf, report) => {
    queryClient.setQueryData(queryKey, report);
  },
  // Fallback: trigger REST refetch if server-side rebuild isn't ready
  onCandleClosed: (_sym, tf) => {
    queryClient.invalidateQueries({ queryKey });
  },
});
```

The hook connects to `GET /api/stream/:symbol` (SSE) and maintains:
- `liveData` — per-timeframe current price + candle state (for the LIVE badge)
- `candles` — per-timeframe candle arrays (passed to ChartView for in-place updates)
- `connected` — WebSocket status (green pulsing dot indicator)

**Live price badge** (header):
When the real-time stream is connected, a green pulsing `Radio` icon and "LIVE" badge appears next to the price. The price updates in real-time from the SSE `candle_update` events. The price renders in emerald green when live, falling back to the REST-sourced price when disconnected.

**Auto-refresh**:
A `setInterval` decrements `countdown` every second. When it hits 0, it calls `queryClient.refetchQueries({ type: "active" })` to refresh all loaded TF reports simultaneously. The countdown ring in the header is a pure SVG `strokeDashoffset` animation.

**Trading styles**:
```ts
const TRADING_STYLES = [
  { label: "Scalp",    timeframes: ["1m",  "5m",  "15m"] },
  { label: "Intraday", timeframes: ["15m", "1h",  "4h"]  },
  { label: "Swing",    timeframes: ["4h",  "1d",  "1w"]  },
  { label: "All",      timeframes: ["1m", "5m", "15m", "1h", "4h", "1d", "1w"] },
];
```

---

## Components

### `ConfluenceCard.tsx`

**Purpose**: Multi-timeframe cascade summary at the top of the dashboard. Shows the directional alignment of all active TFs at a glance.

**Props**:
- `reports: Array<{ tf: string; report: SmcReport }>`
- `cascade: { roles, anchorTf, anchorBias }`
- `onOpenConfluence: () => void` — opens ConfluenceSheet
- `onSelect: (tf) => void` — opens that TF's IntelligenceSheet

**Layout**:
```
MULTI-TF CONFLUENCE                         [BREAK AT M15]  Intelligence Sheet →
BEARISH DRAW
2 aligned · 1 counter-trend · anchor H4
TOP-DOWN CASCADE · H4 SETS THE DIRECTION

[H4 → BEARISH] → [H1 → BEARISH] → [M15 → BULLISH ⚠]
```

**Cascade summary logic**:
- Counts how many TFs are aligned with the anchor bias
- "Counter-trend" count = TFs with the opposite bias
- Builds a horizontal flow showing each TF as a pill with its bias
- Counter-trend TFs are highlighted in yellow with a warning

**Interactions**:
- Click any TF pill → `onSelect(tf)` → opens IntelligenceSheet for that TF
- Click "Intelligence Sheet →" → `onOpenConfluence()` → opens ConfluenceSheet

---

### `ConfluenceSheet.tsx`

**Purpose**: Full-screen overlay with all active TFs displayed side-by-side for top-down analysis.

**Props**:
- `reports: Array<{ tf, report }>`
- `cascade`
- `market`
- `onClose: () => void`

**Layout**: Horizontal scroll with one column per TF. Each column shows the full Intelligence Sheet content for that timeframe — bias, draw target, OBs, FVGs, structure, liquidity — all visible simultaneously.

**Use case**: Swing traders who need to see how all TFs align in a single view before committing to a direction.

---

### `IntelligenceSheet.tsx`

**Purpose**: The primary deep-analysis overlay for a single timeframe. Opens as a full-screen sheet when a TfAgentCard is tapped.

**Props**:
- `report: SmcReport`
- `market: Market`
- `anchorTf: string`
- `anchorBias: string`
- `role: string`
- `onClose: () => void`

**Sections**:

1. **Header bar**: Symbol, TF label, bias badge, role badge, narrative string, session state badge, close button

2. **Narrative banner**: Full market narrative string displayed in a highlighted banner

3. **Structure panel**:
   - Phase badge (Accumulation / Manipulation / Expansion / etc.)
   - Trend, bias, confidence %
   - Evidence bullets
   - Last 5 BOS/CHoCH breaks in a table (type, direction, price)

4. **Draw Targets panel**:
   - Top 3 ranked targets with score, direction, price, type label
   - Evidence tags shown as small chips
   - Confidence progress bar

5. **Order Blocks panel**:
   - All valid, unmitigated OBs
   - Type (Bull/Bear), proximal, distal, confidence %, strength
   - Confidence factor chips
   - Breaker and FVG badges

6. **Liquidity panel**:
   - BSL / SSL with price and `probabilityOfSweep %`
   - All pools list with type, price, touches, session, swept flag

7. **FVG panel**:
   - All unfilled FVGs with type, top, bottom, fill fraction bar
   - Inversion badge if applicable

8. **Daily Bias panel**:
   - Bias direction, strength %, consecutive days
   - Evidence bullets

9. **AI Analyst section**:
   - `AgentPipeline` — trigger and view the 4-agent sequential analysis
   - `AgentChat` — freeform Q&A with the AI analyst

**Styling**: Uses the same color scheme as the dashboard:
- Bullish = `hsl(var(--bullish))` — teal
- Bearish = `text-destructive` — red
- Primary = system primary color (cyan-ish)

---

### `TfAgentCard` (inline in `dashboard.tsx`)

**Purpose**: Summary card for a single timeframe, shown in the agent grid.

**Props**:
- `tf`, `report`, `market`, `isLoading`, `error`
- `role`, `anchorTf`, `anchorBias`, `isAnchor`
- `onOpen: () => void`

**Content**:
- Row 1: TF label + role badge + bias badge
- Row 2: Alignment badge ("Aligned with H4 · BEARISH" or "⚠ Counter-trend")
- Row 3: "NEXT DRAW ON LIQUIDITY" + price
- Row 4: Confidence % + confidence bar + SMT indicator
- Row 5: Alt target price
- Footer: "Tap for Intelligence Sheet →"

**Loading state**: Skeleton placeholder with `animate-pulse`
**Error state**: Red alert box with context-aware error message

---

### `ChartView.tsx`

**Purpose**: Full-screen interactive chart overlay. Shows candlestick data with all SMC overlays rendered on a `<canvas>` element positioned over the chart.

**Props**:
- `reports: Array<{ tf, report }>`
- `market`
- `initialTf?: string`
- `onClose: () => void`
- `liveCandles?: Record<string, CandleData[]>` — per-TF live candles from real-time stream

**Live candle updates** (`useEffect` on `[liveCandles, activeTf, activeReport]`):
When live candles arrive for the active timeframe, the chart series is updated in-place:
1. Tries `series.update()` for the latest candle (fast, in-place)
2. Falls back to `series.setData()` if the candle is new (appends + sorts)
This means the chart shows real-time price movement without full re-renders — only the last candle's OHLCV changes.

**Internal state**:
- `activeTf: string` — which TF is currently displayed

**Refs**:
- `containerRef` — the div that Lightweight Charts mounts into
- `canvasRef` — the overlay canvas for OB/FVG/session boxes
- `chartRef` — the `IChartApi` instance
- `seriesRef` — the `ISeriesApi<'Candlestick'>` instance
- `reportRef` — always-current report (avoids stale closure in canvas callbacks)

**Chart initialization** (`useEffect` on `[activeReport, market, redraw]`):
1. Create chart with dark theme (`#0d0d0d` background)
2. `chart.addSeries(CandlestickSeries, {...})` — v5 API
3. `series.setData(candles.sort by time)`
4. Add BSL/SSL price lines (dashed, labelled, with touch count)
5. Add EQ price line (dotted)
6. Build markers array: pivot HH/HL/LH/LL (circles) + BOS/CHoCH (arrows) + SMT (purple arrow)
7. `createSeriesMarkers(series, allMarkers)` — v5 API
8. Subscribe to `timeScale().subscribeVisibleTimeRangeChange` → `redraw()`
9. `ResizeObserver` → resize chart and canvas on container size change
10. Return cleanup: `ro.disconnect()`, `chart.remove()`

**Canvas overlay** (`drawOverlay()`):
Runs after every chart scroll/zoom/resize. Uses `ctx.save()` / `ctx.scale(dpr, dpr)` for correct DPR rendering.

Draw order (painter's algorithm — back to front):
1. **Session backgrounds** — coloured bands: Asian (blue), London (orange), NY AM (green), NY PM (purple)
2. **FVG rectangles** — extend from FVG candle to right edge; dashed border
3. **OB rectangles** — extend from OB candle to right edge; solid border + KZO dashed proximal line + label
4. **BOS/CHoCH dashed lines** — horizontal dashed line at the break price + "CHoCH" text label

All shapes use `timeToCoordinate()` and `priceToCoordinate()` for pixel mapping. Returns `null` if the time/price is outside the visible range — handled with a null guard to skip invisible shapes.

**TF selector**: Pill buttons for each loaded TF. Switching TF destroys and recreates the chart via the `useEffect` dependency on `activeReport`.

**Legend bar**: Shows colour swatches for Bull OB / Bear OB / FVG and text labels for BSL / SSL / BOS / CHoCH / SMT / EQ.

---

### `AgentPipeline.tsx`

**Purpose**: Triggers and streams the 4-agent sequential analysis pipeline.

**State**:
- `results: Record<string, string>` — accumulated text per agent
- `status: "idle" | "running" | "done" | "error"`
- `activeAgent: string | null`

**Trigger**: A "Run Analysis" button. On click, opens an `EventSource`-like fetch stream to `POST /api/agents/pipeline`.

**SSE parsing**:
Reads the raw SSE stream using `ReadableStream` + `TextDecoder`. Parses each `data: {...}` line:
- `type: "start"` → set `activeAgent`, clear that agent's accumulated text
- `type: "delta"` → append `content` to the agent's result text
- `type: "done"` → mark agent complete
- `type: "pipeline_done"` → set `status: "done"`, clear `activeAgent`

**Rendering**: Four labelled panels — "Structure Agent", "Liquidity Agent", "FVG Agent", "Confluence Agent". The active panel has a pulsing indicator. Text appears token by token using accumulated state.

---

### `TradeActions.tsx`

**Purpose**: Execute Now and Monitor with Agent buttons in the IntelligenceSheet.

- **Execute Now**: Calls POST /api/signals/execute with derived entry/SL/TP levels
- **Monitor with Agent**: Calls startLoopMonitor() for symbol/timeframe
- **Broker status bar**: Inline mode switcher with typed-LIVE confirmation

---

### `AgentLoopSection.tsx`

**Purpose**: Embedded Agent Loop trigger inside IntelligenceSheet.

- "Run Full Agent Loop" button triggers 7-step cycle via SSE
- Streaming timeline with step durations
- Decision/signal/result cards

---

### `MarketIntelligence.tsx`

**Purpose**: News, Similar Setups, RAG context panel.

- **News**: Headlines with impact badges, macro events calendar
- **Similar**: Vector search past setups with setup type dropdown
- **RAG**: Formatted news context for LLM injection
- Graceful degradation when NEWS_ENABLED=false or Qdrant not running

---

### `BacktestRunnerUI.tsx`

**Purpose**: Backtest runner integrated into Performance Matrix tab.

- Asset class toggle, symbol dropdown, all 7 TFs
- 4 lookback presets: Aggressive / Normal / Cautious / Deep dive
- Results: Win Rate, Sharpe, PF, Max DD, Avg Win/Loss
- "Refresh Matrix" button after completion

---

### `AgentChat.tsx`

**Purpose**: Freeform Q&A with the AI analyst, scoped to the current timeframe's report.

**State**:
- `messages: Array<{ role, content }>` — conversation history
- `inputValue: string` — current input field content
- `streaming: boolean` — whether a response is in flight

**Flow**:
1. User types question and submits
2. Adds user message to `messages`
3. Opens fetch stream to `POST /api/agents/ask` with question + report + last 8 messages
4. Reads SSE deltas → appends to current assistant message in real-time
5. On `done: true` → finalises the message, sets `streaming: false`

**UX details**:
- Auto-scrolls to bottom on each new token
- Input is disabled while streaming
- Shows a pulsing cursor `█` while streaming

---

## Session Cockpit Architecture (New -- Jul 19-20, 2026)

The Session Cockpit replaces the old single-page Dashboard with a narrative-driven, multi-stage shell. It is the primary interface for the application.

### Design Philosophy

- **Narrative stages** -- The interface follows a trader's natural workflow: scan the market, analyze structure, evaluate strategies, execute trades, review performance
- **Information hierarchy** -- 3-column layout separates navigation, main content, and contextual detail
- **Real-time data pipeline** -- API → React Query → Zustand → UI, typed and traceable at every layer
- **Capability-aware** -- Every feature tracks its UI coverage so the system knows what is built vs claimed

### `components/layout/SessionCockpitShell.tsx`

The root shell component that wraps all stage views. Mounted at `/`.

**Layout**:
```
┌──────────────┬──────────────────────────────┬──────────────────────┐
│  LiveTimeline│      Main Stage Area         │  DecisionFunnel     │
│  (260px)     │                              │  + QuickTools       │
│              │                              │  (320px)            │
│  Chronological│  Active stage component     │                     │
│  log of:     │  rendered by StateRouter     │  Actionable         │
│  - structure │                              │  decisions based    │
│    breaks    │                              │  on current stage   │
│  - sweeps    │                              │                     │
│  - FVG fills │                              │  9 collapsible      │
│  - signals   │                              │  tool widgets       │
│  - events    │                              │                     │
└──────────────┴──────────────────────────────┴──────────────────────┘
```

**Overlays** (triggered from TopBar or stage context):
- **EvidencePanel** (right slide-over) -- evidence chain for the current stage
- **AgentChat** (right, 420px fixed panel) -- AI agent conversation, toggled from TopBar
- **CapabilityExplorer** (modal, Ctrl+K) -- searchable capability grid
- **ChartView** (fullscreen overlay) -- candlestick chart deep-dive

**State management**: Uses 4 Zustand stores instead of the old ad-hoc `useState` approach:

| Store | File | Purpose |
|---|---|---|
| `market-store` | `stores/market-store.ts` | Symbol, market, timeframe preset, correlated symbol, SMT toggle, derived bias/cascade |
| `profile-store` | `stores/profile-store.ts` | User preferences, layout density, theme, default symbol |
| `narrative` | `stores/narrative.ts` | Current stage, session state, market context string, stage history |
| `capabilities` | `stores/capabilities.ts` | Capability registry, `uiCoverage` tracking per capability, gap analysis |

**Data pipeline**:
```
API Server (port 3001)
    ↓  GET /api/analysis/crypto?symbol=BTCUSDT&timeframe=4h
TanStack Query v5 (cache layer, staleTime: 60s)
    ↓  onSuccess → store update
Zustand Stores (market, narrative, capabilities)
    ↓  selector subscriptions
UI Components (TopBar, stage views, detail panels)
```

### 10 Narrative Stage Views (`src/stages/`)

Each stage is a dedicated component rendered by `StateRouter`. The active stage is derived by `deriveNarrativeStage()` in `src/state/narrative.ts` from market state inputs (structure breaks, FVGs, liquidity sweeps, OBs, model detections, active positions).

| # | Stage | Component | Purpose |
|---|---|---|---|
| 1 | **Watching** | `NoTradeView.tsx` | Idle -- no symbol selected or no session active |
| 2 | **Scanning** | `ScanningView.tsx` | Session active, waiting for a liquidity event |
| 3 | **Liquidity Swept** | `LiquiditySweptView.tsx` | A pool was swept -- evaluate structural response |
| 4 | **Displacement** | `DisplacementView.tsx` | Displacement detected -- structure confirming |
| 5 | **MSS Forming** | `MssFormingView.tsx` | Market structure shift in progress |
| 6 | **FVG Formed** | `FvgFormedView.tsx` | Entry-level imbalance formed |
| 7 | **Entry Ready** | `EntryView.tsx` | Model prerequisites met -- actionable |
| 8 | **In Trade** | `InTradeView.tsx` | Position open -- monitoring risk |
| 9 | **Review** | `ReviewView.tsx` | Post-trade analysis and evidence reconstruction |
| 10 | **No Trade** | `NoTradeView.tsx` | System rule: conditions not met for active models |

Supporting functional views accessible from sidebar: Strategy Atlas (browse 59 models), Agent Workspace (chat + loop), Evaluate (SMC-EVAL), Learn (Truth Engine), Settings.

### `components/layout/TopBar.tsx` (at `src/shell/TopBar.tsx`)

Always-visible top bar across all stage views. Reads from `market-store` and `narrative` Zustand stores.

**Controls** (left to right):
- **Symbol selector** -- Searchable dropdown, updates `market-store.symbol`
- **Crypto/Forex toggle** -- Switches asset class
- **Timeframe presets** -- Scalp (1m/5m/15m), Intraday (1h/4h), Swing (1D/1W)
- **Per-TF chips** -- Clickable timeframe pills for the active preset with bias dots
- **Session clock** -- Countdown timer for the current trading session
- **TV status indicator** -- Green/red dot for CDP connection state; click opens `TvStatus` modal
- **Agent chat button** -- Toggles the AgentChat overlay
- **Chart view button** -- Toggles the fullscreen ChartView overlay

### `components/tf/TimeframeChips.tsx`

Per-timeframe interaction component used primarily in ScanningView. Replaces the old TfAgentCard grid with a more compact, interactive chip design.

**Each chip displays**:
- TF label (e.g., "H4", "M15", "1m")
- Colored bias dot: green = bullish, red = bearish, gray = neutral
- Confidence percentage from SMC report
- Role badge (Bias Setter / Confirmation / Entry Trigger)
- Loading skeleton or error indicator

**Timeframe presets** (selected via TopBar):

| Preset | Timeframes | Use Case |
|---|---|---|
| Scalp | 1m, 5m, 15m | Day traders, scalping entries |
| Intraday | 15m, 1h, 4h | Swing entries, intraday bias |
| Swing | 4h, 1d, 1w | Position traders, HTF context |
| All | 1m, 5m, 15m, 1h, 4h, 1d, 1w | Full cascade view |

**Interaction**:
- Click a chip → opens single-TF detail in the right detail panel
- The detail panel shows the full IntelligenceSheet content for that TF: structure, OBs, FVGs, liquidity, draw targets
- If TV Desktop is connected, a "Mark on TV" button draws the levels directly on the TV chart

### `components/panels/QuickTools.tsx` (at `src/panels/QuickTools.tsx`)

9 collapsible tool widgets in the right column, each in a `ToolSection` wrapper.

| # | Widget | Purpose |
|---|---|---|
| 1 | **Killzone Timer** | London, NY AM, NY PM window countdowns with active/inactive badges |
| 2 | **Silver Bullet Timer** | Next Silver Bullet window (NY AM, London, NY PM) with countdown |
| 3 | **Breaker Blocks** | Lists breaker blocks from the current report with price, direction, and strength |
| 4 | **Displacement Gauge** | Visual gauge of displacement strength vs average range (0-100%) |
| 5 | **Range Expansion** | Current candle expansion vs average true range, with percentile |
| 6 | **OTE Zone Calculator** | Optimal Trade Entry zone (62-79% retracement) from swing to current price |
| 7 | **Risk Calculator** | Position size calculator: account size, risk %, SL distance -> units/lots |
| 8 | **Daily Trade Counter** | Trades taken today vs configured daily max limit |
| 9 | **LuxAlgo Comparison** | Compare SMC engine output vs LuxAlgo ICT levels from TV (`POST /api/learning/comparisons/analyze`) |

Each widget is a standalone component in `src/panels/`. They share no internal state -- all coordination goes through the Zustand stores.

### `components/panels/AgentChatPanel.tsx`

420px fixed panel overlay, AI Agent Chat accessible from the TopBar chat icon on any stage. Two modes:

| Mode | Behavior |
|---|---|
| **MCP Tool-Calling** | Agent receives full tool list (TV draw, data fetch, backtest, etc.). Can invoke tools autonomously. Results rendered inline as tool-call cards. |
| **Classic** | Text-only Q&A. Agent analyzes current SMC state (report, cascade, market context) and answers questions about structure, liquidity, strategy. |

**Implementation**:
- Streaming SSE responses with auto-scroll and pulsing cursor
- Context injection: current symbol, timeframe, SMC report, cascade state, market context string
- Conversation history: last 8 messages retained
- Auto-scroll on new tokens, pulsing cursor while streaming
- Quick-access toggle: opens as slide-over panel from right side

### Capability Coverage Tracking

Defined in `src/state/capabilities.ts`. Every `CapabilityDef` carries a `uiCoverage: boolean` field.

- **96% coverage** -- 52 of 54 capabilities exposed in the Session Cockpit UI
- `getUiCoveragePercent()` -- returns rounded percentage
- `countCapabilities()` -- returns per-stage breakdowns
- **2 uncovered capabilities:**
  - `similar-setups` -- vector search for similar past setups (requires Qdrant)
  - `account-detail` -- account balance and open positions (requires Alpaca API keys)

**Coverage dashboard** accessible via the CapabilityExplorer modal (Ctrl+K): searchable grid of all 54 capabilities with coverage status, component paths, and gap analysis.

### Trader Workflow Features

- **Editable position levels** (Entry/SL/TP) in EntryView with derived defaults and manual overrides stored in market-store
- **Stage regression**: setup invalidation auto-resets the narrative stage -- filled FVG → regress to SCANNING, opposite CHoCH → LIQUIDITY_SWEPT, structure breakdown → SCANNING
- **Killzone gating**: entries gated to London/NY sessions, enforced before progressive stages
- **Sweep Scanner**: LiveTimeline sidebar polls watchlist every 2 min for liquidity sweeps
- **Trade management buttons** in InTradeView: "TP1 Hit (SL→BE)" and "Close Half"
- **Zone alerts**: "Alert on Zone" button in EntryView creates TV Desktop price alerts
- **TV chart visualization**: "Show in TV" button sends levels to TV Desktop chart

### ICT Accuracy (brief note)

- Backend SMC engine audited July 20, 2026 -- 9 critical ICT errors found and fixed (BOS, CHoCH, sweep detection, OB, PD Array, session weights, MMSM/MMBM, Silver Bullet)
- 457 tests passing (326 SMC engine + 131 api-zod)

---

## Data Flow

### Legacy Dashboard Flow

```
Dashboard mounts
    ↓
useTfData() × 7 → useAnalyzeCrypto() / useAnalyzeForex()
    ↓
GET /api/analysis/crypto?symbol=BTCUSDT&timeframe=4h → SmcReport JSON
    ↓
TanStack Query stores in cache (staleTime: 60s)
    ↓
React renders TfAgentCard components with report data
    ↓
User taps card → setSheet({ tf, report }) → IntelligenceSheet mounts
    ↓
User taps "SMT" → AgentPipeline runs → POST /api/agents/pipeline (SSE)
    ↓
User asks question → AgentChat runs → POST /api/agents/ask (SSE)
    ↓
User taps CHART → setChartOpen(true) → ChartView mounts
    ↓
ChartView creates Lightweight Charts instance + canvas overlay
    ↓
User switches TF pill → setActiveTf → chart recreated with new report
```

### Session Cockpit Flow

```
SessionCockpitShell mounts
    ↓
Zustand stores initialize (market, profile, narrative, capabilities)
    ↓
useTfData() × N (based on active timeframe preset) → React Query
    ↓
onSuccess → market-store.setReport(tf, report)
    ↓
market-store derives: cascade, anchor TF, bias alignment
    ↓
narrative store updates: session state, market context string
    ↓
Active stage view renders with selector subscriptions
    ↓
User switches stage → narrative.setStage(stageId) → new view renders
    ↓
User clicks TF chip → detail panel opens with single-TF data
    ↓
User opens Agent Chat → AgentChatPanel mounts with context injection
    ↓
User opens QuickTools → QuickToolsPanel mounts with 9 widgets
```

---

## Routing

`App.tsx` uses Wouter for client-side routing with four routes:
- `/` → `<Dashboard />`
- `/analytics` → `<Analytics />`
- `/broker` → `<Broker />`
- `/agent-loop` → `<AgentLoop />`
- `*` → `<NotFound />`

The Broker and Analytics pages are navigated via header buttons in Dashboard, styled identically to the CHART button (border, bg-muted, hover:text-primary pattern).

---

### `pages/Broker.tsx`

The broker management dashboard at `/broker`. Polls `/api/broker/status`, `/api/account`, and `/api/ledger` every 15 seconds.

**Sections:**

1. **Connection status card**: Broker name, connected Badge (green), PAPER Badge (blue), LIVE/REVIEW mode Badge — the most visually dominant element, with a pulsing `Radio` icon for LIVE mode matching the dashboard's live price indicator pattern.

2. **Mode switch**: REVIEW/LIVE toggle using shadcn `Switch`. Flipping to LIVE opens an `AlertDialog` requiring the user to type "LIVE" into an `Input` before the confirm button enables — matches the backend's `{ confirm: "LIVE" }` requirement. Flipping to REVIEW requires no dialog (kill-switch behavior).

3. **Account overview**: 4 `Card` components showing Total Value, Cash (emerald), Buying Power (blue), and Positions Value. Currency-formatted via `fmtDollar()`.

4. **Open orders table**: Uses the same `Table`/`TableHeader`/`TableRow` patterns as `TradeLedgerDashboard`. Columns: Order ID (truncated), Symbol, Side (green BUY / red SELL Badge), Qty, Price, Status (color-coded: FILLED green, PENDING amber, REJECTED red, CANCELLED gray), Created time.

5. **Execution log**: Recent entries from `/api/ledger` filtered to REVIEW/LIVE modes. LIVE entries show a `Radio` icon badge distinguishing them from REVIEW previews. Outcome column shows WIN/LOSS/PENDING badges.

6. **Not-connected state**: When `is_ready: false`, shows a centered `Card` with `AlertTriangle` icon explaining that `ALPACA_API_KEY_ID` and `ALPACA_API_SECRET_KEY` need to be set on the server, plus a "Back to Dashboard" button.

### `pages/AgentLoop.tsx` (NEW)

The Agent Loop page at `/agent-loop` wraps the `AgentLoopDashboard` component. It provides a standalone interface for running the AI Agent Loop system — one-shot analysis cycles, background monitors, run history, and memory inspection.

```
AgentLoop (page)
└── AgentLoopDashboard
    ├── Loop Runner (Run Loop tab)
    │   ├── Symbol + timeframe inputs
    │   ├── Run Loop button → SSE event stream
    │   └── Real-time step/decision/signal/result display
    ├── Monitor Manager (Monitors tab)
    │   ├── Start monitor form
    │   ├── Active monitors list with status indicators
    │   └── Stop button per monitor
    ├── Run History (History tab)
    │   ├── Refresh button
    │   ├── Runs list with score/status badges
    │   └── Expandable step-level trace detail
    └── Memory Viewer (Memory tab)
        ├── Load memory button
        └── Entries list with tags, source, score
```

**State management**: All state is local via `useState` — fetched from REST endpoints on demand (no TanStack Query needed for this admin-style page).

---

### `pages/Analytics.tsx`

Trade ledger and performance analytics at `/analytics`. Three-tab layout using shadcn `Tabs`:

- **Ledger tab**: `TradeLedgerDashboard` component — filterable signal table with asset/setup/symbol/mode selectors, metric cards (win rate, Sharpe, profit factor, trade count), clickable rows opening `SignalDetailSheet`
- **Matrix tab**: `PerformanceMatrixHeatmap` — setup rankings by Sharpe ratio with colored bars
- **Generate tab**: Signal generator UI — market toggle, symbol/timeframe selectors, generate button. Shows resulting signal with Entry/SL/TP prices, R:R ratio, confidence bar

---

## API Communication

All communication with the backend goes through wrappers in `lib/api-client-react`:

```ts
// TanStack Query hook (generated, manually maintained)
const { data, isLoading, error } = useAnalyzeCrypto({
  symbol: "BTCUSDT",
  timeframe: "4h",
  correlatedSymbol: "ETHUSDT",
});
```

AI endpoints use raw `fetch()` with `ReadableStream` for SSE, since TanStack Query does not support streaming.

Real-time streaming uses the same SSE pattern via `lib/realtime.ts`:
```ts
// Hook wraps fetch() + ReadableStream SSE parsing
import { useRealtimeStream } from "@/lib/realtime";
const { liveData, connected, candles } = useRealtimeStream({ symbol, timeframes, ... });
```

### Frontend File Layout (with real-time additions)

```
artifacts/liquidity-hunter/src/
├── lib/
│   ├── api.ts              # REST + AI SSE helpers + agent loop API functions
│   ├── realtime.ts          # useRealtimeStream hook (NEW)
│   ├── format.ts
│   └── utils.ts
├── pages/
│   └── dashboard.tsx        # +useRealtimeStream, +live price badge, +liveCandles prop
└── components/
    └── ChartView.tsx         # +liveCandles prop, +useEffect for in-place updates
```

---

## Type Safety

The frontend types in `lib/api-client-react/src/generated/api.schemas.ts` are **manually maintained** (not auto-generated from the OpenAPI spec at build time). This was a deliberate choice to avoid codegen complexity in the monorepo. All new backend fields are added as `optional` to maintain backward compatibility.

The `SmcReport` interface on the frontend mirrors the backend's `SmcReport` in `artifacts/api-server/src/lib/smc/types.ts`. Any new field added to the backend type must be manually added to the frontend type as optional.
