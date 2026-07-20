---
tags: [frontend, cockpit, architecture, ui]
aliases: [Session Cockpit, Cockpit Shell]
---

# Session Cockpit

The **Session Cockpit** is the primary frontend interface for SMC Pulse Predict. It replaces the old `OsDashboard` as the default route (`/`) with a narrative-driven, evidence-first trading UI.

## Architecture

### Shell Layout

```
┌─────────────────────────────────────────────────────────┐
│ TopBar (symbol, presets, TF chips, session, TV, agent)  │
├──────────┬──────────────────────────────┬───────────────┤
│ Timeline │    Stage View (center)       │ DecisionFunnel│
│  260px   │    flex-1                    │ / QuickTools  │
│          │                              │    320px      │
└──────────┴──────────────────────────────┴───────────────┘
│ Overlays: EvidencePanel | AgentChat | CapabilityExplorer │
└─────────────────────────────────────────────────────────┘
```

### State Management (Zustand)

| Store | File | Purpose |
|-------|------|---------|
| `useMarketStore` | `src/state/market-store.ts` | Symbol, reports, live data, timeline, strategy, system health, trade levels, UI panel state, stage derivation |
| `useProfileStore` | `src/state/profile-store.ts` | 15 models, 5 sessions, risk rules, watchlist, preferred TFs (persisted to localStorage) |
| `narrative.ts` | `src/state/narrative.ts` | `deriveNarrativeStage()` pure function, 10-stage state machine, session detection, market phase |
| `capabilities.ts` | `src/state/capabilities.ts` | 54 capabilities across 8 categories with `uiCoverage` tracking |

### Data Pipeline

```
Binance WS → API Server → React Query (TanStack)
                              ↓
                    useSessionCockpitData()
                              ↓
                    Zustand useMarketStore
                              ↓
                    Stage Views (React components)
```

## 10 Narrative Stages

| Stage | Component | When |
|-------|-----------|------|
| WATCHING | `NoTradeView` | No symbol selected, idle |
| SCANNING | `ScanningView` | Session active, waiting for liquidity event |
| LIQUIDITY_SWEPT | `LiquiditySweptView` | Pool swept — classify manipulation vs genuine |
| DISPLACEMENT | `DisplacementView` | Unfilled FVGs detected |
| MSS_FORMING | `MssFormingView` | Structure shift in progress |
| FVG_FORMED | `FvgFormedView` | Entry-level imbalance identified |
| ENTRY_READY | `EntryView` | All prerequisites met |
| IN_TRADE | `InTradeView` | Position open |
| REVIEW | `ReviewView` | Post-trade analysis |
| NO_TRADE | `NoTradeView` | Session window not high-probability |

Stages are derived by `deriveNarrativeStage()` in `src/state/narrative.ts` — a pure function of SMC report data across all timeframes.

## Key Components

### TopBar (`src/shell/TopBar.tsx`)
- Crypto/Forex toggle
- Symbol selector (from watchlist)
- Timeframe presets: Scalp (1m/5m/15m), Intraday (15m/1h/4h), Swing (4h/1d/1w)
- Per-TF chips with bias dots (click to drill down)
- Session clock with countdown + progress bar
- Stream status, API health, TV Desktop status
- Agent Chat toggle button
- ⌘K Capability Explorer button

### TimeframeChips (`src/components/TimeframeChips.tsx`)
- Clickable TF buttons: [All] [🟢 D1] [🟢 H4] [🟢 H1] [🟢 M15] ...
- Selecting a TF shows a full single-TF breakdown panel in ScanningView
- Bias dots: 🟢 bullish, 🔴 bearish, ⚪ neutral

### QuickTools (`src/panels/QuickTools.tsx`)
9 collapsible tool widgets:
1. **Killzone Timer** — London, NY AM, NY PM countdowns
2. **Silver Bullet Timer** — SB window countdowns
3. **Breaker Blocks** — List of `ob.isBreaker` blocks
4. **Displacement Gauge** — Per-TF FVG gap vs ATR
5. **Range Expansion** — Recent candle range vs 14-period ATR
6. **OTE Zone Calculator** — 62-79% Fib retracement from pivot selection
7. **Risk Calculator** — Position size from account balance + SL
8. **Daily Trade Counter** — Trades taken today vs max limit
9. **LuxAlgo Comparison** — SMC Engine vs TV indicator comparison

### AgentChat (`src/components/AgentChat.tsx`)
- 420px right slide-over panel
- MCP tool-calling mode (73+ tools available to agent)
- Classic prompt mode (full SmcReport context)
- Receives currently-selected TF's report as context

### TvStatus (`src/components/TvStatus.tsx`)
Modal with drawing tools and alert creation:
- Draw actions: BSL/SSL Levels, FVG Boxes, Killzones, Mark BOS/CHoCH, Draw All, Clear All
- Set Alert form: price input + condition (crossing/above/below)
- Connection status, chart info, action logs

## TV Desktop Integration

| Endpoint | Purpose |
|----------|---------|
| `POST /api/agent-loop/tv-connect` | Connect to TV Desktop via CDP |
| `GET /api/agent-loop/tv-status` | Connection + chart state |
| `GET /api/agent-loop/tv-read` | Read current chart data |
| `POST /api/agent-loop/tv-draw` | Draw `levels`, `fvgs`, `killzones`, `bos`, `clear`, `all` |
| `POST /api/agent-loop/tv-alert-create` | Create price alert on TV Desktop |

## Capability Coverage

- **96% UI coverage** — 52 of 54 capabilities exposed in the cockpit
- Tracking via `uiCoverage: boolean` on each `CapabilityDef`
- Coverage percentage displayed in CapabilityExplorer (⌘K) footer
- Only 2 uncovered: `similar-setups` (needs Qdrant), `account-detail` (needs Alpaca keys)

## Build Notes

- **Must build from PowerShell on Windows** — Git Bash leaks `BASE_PATH=/Program Files/Git/`
- Correct: `$env:BASE_PATH="/"; $env:PORT="3000"; pnpm --filter @workspace/liquidity-hunter run build`
- Serve: `node serve-frontend.mjs` (static files + `/api/*` proxy to `:3001`)
- API: `pnpm --filter @workspace/api-server run start` (loads `.env` via `--env-file`)
