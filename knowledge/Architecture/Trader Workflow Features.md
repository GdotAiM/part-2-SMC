---
tags: [trader-workflow, ux, cockpit, features]
aliases: [Workflow Gaps, Trader UX Improvements]
---

# Trader Workflow Features — July 20, 2026

## Summary

Seven workflow gap closures implemented on July 20, 2026 to bring the Session Cockpit from a passive analysis tool to an active trading interface. These features address the gap between algorithmic detection and trader action -- the cockpit now supports the full trade lifecycle: zone identification, entry preparation, position management, and exit.

## Features

### 1. Editable SL/TP in EntryView

Manual override for stop-loss and take-profit levels in the EntryView stage. When the engine proposes SL/TP based on nearest liquidity pools and OBs, the trader can drag or type custom levels. Overrides are persisted to the active position and respected by the risk calculator and partial TP workflow.

**Files:** `src/stages/EntryView.tsx`, `src/state/narrative.ts`

### 2. Stage Regression in `deriveNarrativeStage`

Setup invalidation auto-resets the narrative stage. If a confirmed displacement reverses (structure break in the opposite direction) or an FVG gets fully filled before entry, the stage regresses -- e.g., EntryReady drops back to Scanning, Displacement drops back to Watching. This prevents the trader from acting on stale signals after market structure has changed.

**Files:** `src/state/narrative.ts` (`deriveNarrativeStage` function)

### 3. Killzone-Gated Entries

Session check enforced before progressive stages advance. The stage machine will not advance beyond Scanning unless the current time falls within an active killzone (London, NY AM, or NY PM). Outside killzones, the cockpit displays a "Waiting for session" banner and holds at Watching/Scanning regardless of detected structure. This aligns with ICT methodology: high-probability entries only occur during institutional activity windows.

**Files:** `src/state/narrative.ts`, `src/stages/ScanningView.tsx`

### 4. Sweep Scanner in LiveTimeline Sidebar

Multi-symbol watchlist screening embedded in the left-column LiveTimeline. Instead of only showing events for the active symbol, the Sweep Scanner polls a configurable watchlist of symbols (default: BTC, ETH, SOL, XAU, ES, NQ) and surfaces liquidity sweeps, BOS events, and FVG formations across all tracked instruments. Each event is clickable -- selecting it switches the cockpit to that symbol.

**Files:** `src/shell/LiveTimeline.tsx`, `src/state/market-store.ts`

### 5. TV Desktop Visualization Integration

"Show in TV" buttons added to EntryView, InTradeView, and the Sweep Scanner. Clicking sends the current symbol, timeframe, and all drawn levels (OBs, FVGs, BSL/SSL, entry, SL, TP) to TradingView Desktop via CDP. The chart auto-switches to the correct symbol and timeframe, then draws all levels with labeled rays and rectangles. This closes the visualization gap -- the cockpit does the analysis, TV Desktop does the chart visualization.

**Files:** `src/components/TvStatus.tsx`, `src/stages/EntryView.tsx`, `src/stages/InTradeView.tsx`

### 6. Partial TP / Scale-In Workflow

The InTradeView now supports partial take-profit execution. When price reaches TP1 (first defined target), a "TP1 Hit -- Close Half" button appears. Clicking it executes a partial close (50% of position), moves SL to breakeven, and leaves the remaining position running toward TP2. The position tracker updates to show the reduced size and adjusted risk profile. This implements the ICT scale-out methodology: take partial profits at the first liquidity target, let the remainder run.

**Files:** `src/stages/InTradeView.tsx`, `src/state/narrative.ts`

### 7. Price Zone Approach Alerts

"Alert on Zone" button on every detected OB, FVG, and liquidity pool card. Clicking sets a price alert at the zone boundary (proximal for OBs, top/bottom for FVGs, pool level for BSL/SSL) with a configurable approach distance (default: 0.5% for crypto, 20 pips for forex). When price enters the approach zone, the cockpit shows a notification banner and optionally triggers a browser notification. Alerts persist in `localStorage` across sessions.

**Files:** `src/components/ConfluenceCard.tsx`, `src/stages/ScanningView.tsx`, `src/state/market-store.ts`

## Workflow Gap Coverage

These seven features close the following gaps in the trading workflow:

| Gap | Feature | Status |
|-----|---------|--------|
| No manual level adjustment | Editable SL/TP | Closed |
| Stale signals after invalidation | Stage Regression | Closed |
| Entries outside active sessions | Killzone Gating | Closed |
| Single-symbol tunnel vision | Sweep Scanner | Closed |
| Analysis without chart visualization | TV Desktop Integration | Closed |
| All-or-nothing exits | Partial TP Workflow | Closed |
| Missed zone approaches | Zone Alerts | Closed |
