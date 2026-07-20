# SMC Pulse OS — User Guide

> *An evidence-driven trading cockpit for ICT/SMC traders. Algorithmic detection of institutional order flow, presented through a narrative stage machine that mirrors how a professional trader thinks.*

---

## What This App Is Trying to Achieve

Most retail traders lose money because they trade against institutions without knowing it. The banks and funds don't buy at support and sell at resistance — they **hunt liquidity**, create **imbalances**, and deliver price into **equilibrium**. The Inner Circle Trader (ICT) methodology teaches you to read these footprints, but doing it manually across 7 timeframes on multiple symbols is impossible.

SMC Pulse OS automates the entire ICT analysis pipeline:

1. **Ingest** live OHLCV data from Binance/Yahoo/TV Desktop
2. **Detect** institutional footprints — liquidity sweeps, structure breaks, order blocks, fair value gaps, PD arrays, SMT divergence
3. **Derive** a narrative stage that mirrors a trader's decision process
4. **Present** the evidence through a cockpit that reveals *why* something is happening, not just *what*
5. **Execute** trades through broker integration or TV Desktop
6. **Learn** from outcomes via SMC-EVAL scoring and vector memory

The cockpit is not a dashboard. It's a **narrative machine**. It doesn't show you 50 indicators and wish you luck — it walks you through the ICT workflow: Watch → Scan → Sweep → Displacement → MSS → FVG → Entry → Trade → Review.

---

## The Shell Layout

```
┌──────────────────────────────────────────────────────────────────┐
│                         TOP BAR (always visible)                  │
│ [C/F] [BTCUSDT▼] [Scalp|Intra|Swing] [All W1 D1 H4 H1 M15 M5 M1] │
│ 🕐 NY AM 23:15 ████░░  LIVE  API  📺TV  💬Agent  📊  ⌘K Cap      │
├──────────┬───────────────────────────────────────┬───────────────┤
│ TIMELINE │          STAGE VIEW (center)           │ FUNNEL/TOOLS  │
│  Sweep   │                                        │  [Funnel|Tools]│
│ Scanner  │   Stage Badge  SessionFlow  Score      │  ▸ HTF Narr   │
│          │   SYMBOL                                │  ▸ Liquidity  │
│ Filters  │   Reasoning text                        │  ▸ Structure  │
│  All     │                                        │  ▸ Entry Model│
│  Sweeps  │   ┌─────────────────────────┐          │  ▸ Signal     │
│  Struct  │   │   Stage-specific data    │          │               │
│  FVGs    │   │   (changes per stage)    │          │  or           │
│  Entries │   │                          │          │  QuickTools   │
│          │   └─────────────────────────┘          │  9 widgets    │
│ Events   │                                        │               │
│  🟢 BTC  │   Available Capabilities               │               │
│  🔴 ETH  │   [icon] [icon] [icon] ...             │               │
│          │                                        │               │
│ 0 events │   [Action Buttons]                     │               │
└──────────┴───────────────────────────────────────┴───────────────┘
│ OVERLAYS: EvidencePanel | AgentChat | CapabilityExplorer | Chart │
└──────────────────────────────────────────────────────────────────┘
```

### Three Columns

| Column | Width | Purpose |
|--------|-------|---------|
| **Left — LiveTimeline** | 260px | Real-time event feed + Sweep Scanner. What just happened? |
| **Center — Stage View** | flex | Progressive disclosure based on narrative stage. What should I do now? |
| **Right — DecisionFunnel / QuickTools** | 320px | Decision support and utilities. Why is this happening? |

---

## The TopBar (Always Visible)

The TopBar is your command center. Everything you need to navigate markets is here.

### Left Section: Market Selection

| Element | Appearance | What It Does |
|---------|-----------|--------------|
| **Crypto/Forex toggle** | `[C] [F]` segmented buttons | Switches between crypto (BTCUSDT, ETHUSDT...) and forex (EURUSD, GBPUSD...) markets. The active market is highlighted in primary color. |
| **Symbol selector** | Dropdown showing current symbol | Select from your watchlist (first section) or hardcoded defaults (second section). Changing symbol resets reports and refetches all timeframes. |
| **Timeframe presets** | `[SCALP] [INTRADAY] [SWING]` | One-click switching between trading styles. Scalp queries 1m/5m/15m, Intraday queries 15m/1h/4h, Swing queries 4h/1d/1w. Active preset is highlighted. Changes which TFs the API fetches. |
| **Per-TF chips** | `[All] [🟢W1] [🟢D1] [🟢H4] [🟢H1] [🟢M15] [🔴M5] [🟢M1]` | Click any TF chip to drill into a full single-timeframe breakdown in ScanningView. Green dot = bullish bias, red dot = bearish bias, white = neutral. Click "All" to see the cascade grid. |
| **Session badge** | `🟢 NY AM 23:15` with progress bar | Shows current ICT trading session (Asian, London, NY AM, NY PM, Late). Countdown timer shows minutes remaining. The gradient progress bar depletes as the session window closes. |

### Right Section: Status & Actions

| Element | Appearance | What It Does |
|---------|-----------|--------------|
| **Stream status** | `LIVE` green / `OFFLINE` amber | Whether real-time Binance WebSocket data is flowing. Green pulsing dot = connected. |
| **API health** | `API` with dot | Green dot = backend healthy. Red = degraded. |
| **TV Desktop status** | `TV` button, green pulsing when connected | Opens the TV Desktop Control modal. Green = CDP connected, can draw on chart. |
| **Agent Chat** | `💬 Agent` button | Opens a 420px right slide-over AI chat panel. The agent has access to 73+ MCP tools and can read charts, draw levels, set alerts, and analyze setups. |
| **Chart toggle** | `📊` button | Opens a full-screen TradingView Lightweight Charts overlay with candlesticks and SMC overlays. |
| **Capability Explorer** | `⌘K Capabilities` button | Opens a modal showing all 54 system capabilities organized by ICT workflow stage. Shows UI coverage percentage. Keyboard shortcut: Ctrl+K / ⌘K. |

---

## The 10 Narrative Stages

The heart of the cockpit. The stage machine automatically progresses and regresses based on what the SMC engine detects in the market data.

### Stage Flow

```
WATCHING → SCANNING → LIQUIDITY_SWEPT → DISPLACEMENT → MSS_FORMING → FVG_FORMED → ENTRY_READY → IN_TRADE → REVIEW
                                                      ↕ (regression possible)
                                              NO_TRADE (outside killzones)
```

Each stage has a dedicated view that shows **only what matters for that decision point**.

### WATCHING / NO_TRADE — `NoTradeView`

**When**: No symbol selected, no data loaded, OR outside London/NY killzone windows.

**What you see**:
- A centered, calm "zen" screen with 🧘
- Stage badge (amber/yellow for NO_TRADE, muted for WATCHING)
- Session flow indicator showing market phase
- Reason why no trade is recommended (session label)
- Suggested capabilities to explore while waiting
- Quick action buttons: "Open Decision Funnel", "Browse Capabilities"

**ICT purpose**: Don't force trades. The market is either closed (no data) or the current session isn't high-probability. Wait.

### SCANNING — `ScanningView`

**When**: Session is active, data is loaded, no liquidity event yet.

**What you see**:
- Stage badge: green pulsing dot + "Scanning"
- Session flow indicator + quality score (0-100)
- Current symbol and reasoning text
- **Timeframe bias cards** (2-6 column grid): Each TF shows its bias (▲ BULLISH / ▼ BEARISH / — NEUTRAL), colored text, and a confidence bar. Click a card to open the Evidence Panel for that TF.
- **Single-TF detail panel** (when a TF chip is selected in TopBar): Full breakdown of structure, liquidity, OBs, FVGs, PD array, recent breaks, active FVGs with "Full Evidence" and "Open Chart" buttons.
- **Key Liquidity** card: Nearest BSL (green) and SSL (red) pools with sweep probabilities
- **Market Context** card: Daily bias, PD array zone, equilibrium price, SMT divergence status, current session
- **Available Capabilities**: Filtered to SCANNING stage, shown as clickable chips
- Action buttons: Open Chart, Decision Funnel, Structure Evidence

**ICT purpose**: Gather information. What's the higher timeframe bias? Where are the liquidity pools? Is there any divergence? Don't act yet — just observe.

### LIQUIDITY_SWEPT — `LiquiditySweptView`

**When**: A liquidity pool was swept (price wicked through and rejected).

**What you see**:
- Stage badge: amber pulsing dot + "Liquidity Swept"
- Progress bar: Sweep ✓ → Displacement ○ → MSS ○ → FVG ○
- **Swept Pools grid**: Each swept pool shows type (BSL green / SSL red), price, timeframe it was detected on, how long ago, and session context
- **Sweep Classification card**: "MANIPULATION" (amber) if CHoCH/MSS detected — institutions ran stops. "GENUINE BREAK" (green) if BOS confirmed — trend continuation.
- **Next Liquidity Target** card: Nearest unswept pool with distance from current price and sweep probability
- **Displacement status**: DETECTED (green) or PENDING (amber)
- **Session context** card
- Available capabilities + action buttons

**ICT purpose**: A sweep just happened. Is it manipulation (fake breakout to grab liquidity) or a genuine break (trend continuation)? Watch for displacement to confirm.

### DISPLACEMENT — `DisplacementView`

**When**: Unfilled FVGs detected (displacement = aggressive institutional buying/selling).

**What you see**:
- Stage badge: primary/blue pulsing dot + "Displacement"
- Progress bar: Sweep ✓ → Displacement ✓ → MSS ○ → FVG ○
- **Displacement FVGs by TF**: Cards showing count of unfilled FVGs, price gap range, bullish/bearish direction, and fill percentage bar. Anchor TF's displacement gets a highlighted card.
- **Displacement Strength**: "Strong" (green, 5+ FVGs), "Moderate" (blue, 2-4), or "Weak" (amber, 1)
- **Directional Bias** card: Large ▲ BULLISH or ▼ BEARISH with source TF
- **Structure Breaks panel**: All recent BOS/CHoCH breaks by TF with type badges
- **MSS Status**: CONFIRMED (green) or PENDING (amber)
- Context stats: pools swept, total FVGs, session

**ICT purpose**: Displacement confirms institutional activity. The strength tells you conviction. Now wait for a market structure shift (MSS/CHoCH) to confirm direction.

### MSS_FORMING — `MssFormingView`

**When**: Market structure shift (MSS/CHoCH) detected.

**What you see**:
- Stage badge: primary/blue pulsing dot + "Structure Shift"
- Progress bar: Sweep ✓ → Displacement ✓ → MSS ✓ → FVG ○
- **Structure Shift Active** spotlight: Each MSS/CHoCH break with type badge (MSS vs CHoCH), timeframe, directional arrow, and price. Active breaks have a pulsing border.
- **Recent Pivots** card: Last 8 swing points (HH, HL, LH, LL) with type badges and prices. Color-coded: green for HH/HL, red for LL/LH.
- **Break Sequence**: Timeline of all breaks as colored chips (MSS/CHoCH highlighted in primary)
- **TF Alignment** card: HTF bias vs LTF bias comparison. "✓ ALIGNED" (green) if same direction, "⚠ DIVERGENT" (amber) if opposite.
- **Entry FVG Status**: DETECTED (green) or MISSING (amber) — gates progression to next stage
- HTF bias + session cards

**ICT purpose**: Structure is shifting. Is the HTF aligned with this shift? Is there an entry-level FVG forming? Almost there.

### FVG_FORMED — `FvgFormedView`

**When**: Entry-level unmitigated FVG formed on the entry timeframe.

**What you see**:
- Stage badge: emerald pulsing dot + "FVG Formed"
- Progress bar: All 4 segments green ✓
- **Entry Imbalance Zone** spotlight: Visual bar showing the FVG zone boundaries, current price marker, gap size, fill percentage progress bar. Multiple FVGs shown if available.
- **"Almost Ready" indicator**: "ENTRY ZONE ACTIVE" (green, all checks pass) or "X CHECKS REMAINING" (amber). Large pulsing dot.
- **Setup Prerequisites checklist**: 6 items (Sweep, Displacement, MSS, FVG, Session, Model Match) with pass/fail status, detail text, and X/Y count badge
- **HTF Bias** card + Session card
- "Detect Strategy Models" button (runs the 59-model strategy registry)
- Available capabilities + action buttons

**ICT purpose**: The entry trigger is here. One final check — does a strategy model match? If yes, you're at ENTRY_READY.

### ENTRY_READY — `EntryView`

**When**: All prerequisites met — sweep, displacement, MSS, unmitigated FVG, session OK, model matched.

**What you see**:
- Stage badge: emerald pulsing dot + "Entry Ready"
- Quality score badge with color coding (green ≥70, blue ≥40, amber <40)
- Killzone warning banner (amber) if triggered outside London/NY sessions
- **Entry Setup** card (left 2/3):
  - Direction badge: ▲ LONG (green) or ▼ SHORT (red)
  - Timeframe indicators: entry TF (e.g. M15) and bias TF (e.g. H4)
  - **Editable price levels grid**: Entry price (editable number input), Stop Loss (editable, red), Take Profit (editable, green), R:R ratio (auto-calculated, color-coded: green ≥2, amber ≥1, gray <1). Each shows a "↩ reset" link when manually overridden.
  - **Price range visualizer**: Colored bar from SL through Entry to TP, with a cyan current-price marker
  - **TradeActions component**: "Execute Now" button (sends to broker), "Monitor with Agent" toggle
  - Quick action buttons: ✏️ Show in TV, 📡 Generate Signal, 📊 Open Chart, 📋 Model Spec, 🔔 Alert on Zone
- **Right column**:
  - **Matched Model card**: Strategy name, match score %, evidence list (✓/✗/◐ markers), alternative models dropdown
  - **Setup Quality checklist**: 7 items (HTF Bias, Daily Bias, Sweep, Displacement+MSS, Entry Level, Session, Active Models) with pass/fail color coding
  - **Narrative card**: Natural language AI narrative of current setup with collapsible AI reasoning
  - **Session card**: Current session with remaining time

**ICT purpose**: This is the moment. Entry zone, stop loss, and take profit are calculated from SMC data. Adjust levels if your structural analysis differs. Execute or send to TV for manual entry.

### IN_TRADE — `InTradeView`

**When**: Position is open (hasPosition = true).

**What you see**:
- Stage badge: emerald pulsing dot + "In Trade"
- Direction badge: ▲ LONG or ▼ SHORT
- **P&L Card** (large, dominant): Unrealized P&L percentage in large font (green +X.XX% or red -X.XX%) with dollar amount. Entry and current prices.
- **Position Levels monitor**: Visual bar from SL through Entry through TP1 with cyan current-price dot. Price labels for each level.
- **Level details grid**: Entry, Stop Loss (with distance), TP1 (with distance to go), R:R Locked
- **Structure Integrity** card: INTACT (green), WEAKENING (amber), or BROKEN (red) based on whether HTF structure still supports the trade direction
- **Trail Stop Suggestion** (auto-calculated): Suggested trail price based on recent pivots. "Move SL" button.
- **Trade Management** buttons:
  - 🎯 **TP1 Hit (SL→BE)**: Moves stop loss to entry price (breakeven). Timeline event logged. TP2 becomes the remaining target.
  - 📉 **Close Half**: Records 50% position close at current price.
- **Position Summary** card: Symbol, direction, entry, current price, trailed SL
- **Entry Model** card: Which strategy model triggered this trade
- **Risk Parameters**: Position size %, min R:R, daily trade max
- **Close Position** button (red/destructive): Two-step confirmation — first click shows "⚠ Confirm Close Position", second click executes. 5-second auto-cancel.

**ICT purpose**: Manage the trade. Is structure still intact? Should you trail your stop? TP1 hit — move to breakeven. Don't let a winner turn into a loser.

### REVIEW — `ReviewView`

**When**: Trade closed. Post-trade analysis phase.

**What you see**:
- Stage badge: muted dot + "Review"
- **Outcome Card** (large, centered): WIN 🏆 or LOSS ⚠️ with percentage, R:R achieved (1:0.75, 1:2.30, etc.)
- **Trade Timeline**: Chronological event reconstruction from trade_opened to trade_closed. Each event with icon, title, description, timestamp.
- **Evidence Chain**: All strategy evidence items that matched, with pass/fail markers
- **Model Alignment** card: Strategy name, match score %, "✓ Trade aligned" / "⚠ Trade deviated"
- **Trade Summary**: Symbol, entry, exit, R:R achieved, event count
- **Lessons** card: Contextual suggestions — for wins ("Model alignment reinforced"), for losses ("Which prerequisite failed?")
- **Journal Entry**: Pre-filled textarea with trade date, symbol, direction, entry/exit, R:R, and prompts. "Save to Journal" button.
- Available capabilities + action buttons

**ICT purpose**: Learn from every trade. Was the model followed? What went right/wrong? Journal it. The vector memory learns from this for future similar setups.

---

## The Right Column: DecisionFunnel & QuickTools

### DecisionFunnel Tab

The DecisionFunnel is a **5-stage collapsible analysis funnel** that mirrors the ICT decision process. Each stage has a colored status dot (green=pass, amber=pending, red=fail) and inline action buttons.

| Funnel Stage | What It Shows | Status Criteria |
|-------------|---------------|-----------------|
| **1. HTF Narrative** | Daily bias direction + strength, market phase, per-TF bias bars for top 3 TFs. Actions: View Structure, Chart. | Green if HTF bias is clear |
| **2. Liquidity Delivery** | Swept vs unswept pool counts, top 3 nearest pools with prices. Actions: Verify Pools, Draw on TV. | Green if sweep detected |
| **3. Structure Confirmation** | Displacement checkmark, MSS checkmark, last structure break. Actions: Detect SMT, Check Session. | Green if both displacement + MSS |
| **4. Entry Model** | Primary matched strategy name + score, entry FVG status, alternative model count. Actions: Model Spec, Alternatives. | Green if model matched |
| **5. Signal** | Setup quality score. Actions: Generate Signal, Execute. | Green if quality ≥70 |

### QuickTools Tab

Nine collapsible utility widgets for deeper analysis. Each expands independently with a `▸`/`▾` chevron.

| Widget | What It Shows | Trading Purpose |
|--------|---------------|-----------------|
| **⏱ Killzone Timers** | London/NY AM/NY PM killzone windows with active states and countdowns | Know exactly when to be at the screen |
| **🔫 Silver Bullet Timers** | SB window countdowns (London 08-09, NY AM 13-14, NY PM 15-16 UTC) | ICT's highest-probability entry windows |
| **🔨 Breaker Blocks** | List of `ob.isBreaker` blocks by TF with price and type | Failed OBs that flipped polarity — strong S/R |
| **📏 Displacement Gauge** | Per-TF displacement magnitude vs ATR with ratio bars | How strong is the institutional move? |
| **📈 Range Expansion** | Recent candle range vs 14-period ATR ratio | Is price expanding (institutional) or contracting (retail)? |
| **🎯 OTE Zone Calculator** | Select swing low + swing high from dropdowns → shows 62-79% Fib retracement zone | Optimal Trade Entry zone for limit orders |
| **🛡 Risk Calculator** | Account balance input, auto-populated entry/SL → position size, max loss, position % | Know your risk before you click execute |
| **📊 Daily Trade Counter** | Trades taken today vs max daily limit with progress bar | Don't overtrade. ICT: 1-3 trades per day max |
| **⚖️ LuxAlgo Comparison** | "Compare SMC Engine vs TV LuxAlgo" button with agreement rate result | Cross-reference engine detections against TradingView indicators |

---

## The Left Column: LiveTimeline + Sweep Scanner

### Sweep Scanner

A collapsible section at the top of the sidebar. Polls your watchlist every 2 minutes for liquidity sweeps.

- Each watchlist symbol shown with: sweep status dot (green pulsing = active sweep, gray = none), symbol name, sweep type (BSL/SSL), bias, and current price
- Active symbol highlighted with primary background
- Click any row to switch the cockpit to that symbol
- "2 active sweeps" count badge in the header

### Timeline Filters

Filter the event feed: `[All] [Sweeps] [Structure] [FVGs] [Entries]`

### Event Cards

Each event shows: icon, title, description, price, time ago, and action buttons when actionable. Events include: session_open, liquidity_sweep, structure_break, fvg_formed, displacement, mss_confirmed, entry_ready, signal_generated, trade_opened, trade_closed, alert, system.

---

## Overlays

### EvidencePanel (420px right slide-over)

Opened by clicking "Full Evidence" buttons or TF cards. Shows three evidence chains:
- **Strategy Detection**: What the strategy engine matched
- **SMC Report**: Per-TF evidence from the anchor report
- **System Health**: API server, MCP server, TV Desktop, database, broker, LLM status

### AgentChat (420px right slide-over)

Opened by the `💬 Agent` TopBar button. Two modes:
- **MCP mode** (default): The agent has 73+ tools — can read charts, run analysis, draw levels, set alerts. Shows tool call cards with results.
- **Classic mode**: Full SMC report injected into prompt. Text-only responses.

Suggested questions appear when the chat is empty. The agent receives the currently-selected TF's report as context.

### CapabilityExplorer (⌘K modal)

A centered modal showing all 54 system capabilities organized by ICT workflow category (NARRATIVE, LIQUIDITY, TIME, STRUCTURE, DISPLACEMENT, ENTRY, RISK, REVIEW). Each capability shown as a clickable card. Coverage percentage displayed in the footer.

### ChartView (full-screen overlay)

TradingView Lightweight Charts v5 with:
- Candlestick chart with session killzone backgrounds
- OB rectangles (green/red)
- FVG rectangles (purple)
- BOS/CHoCH markers
- KZO lines
- Multi-timeframe support

---

## Design Philosophy

### Why Everything Is Small

The 7-10px typography isn't a mistake — it's intentional. A trading cockpit needs information density, not whitespace. The trader needs to see: bias, liquidity, structure, FVGs, and session context all at once without scrolling. The small text allows 6 timeframe cards, 4 price levels, a checklist, and a model card to fit on screen simultaneously.

### Why Color Coding Is Consistent

| Color | Meaning | Where Used |
|-------|---------|------------|
| **Emerald (green)** | Bullish, passing, confirmed, profitable | Bullish bias, checklist pass, P&L positive, R:R ≥2, session active |
| **Destructive (red)** | Bearish, failing, invalidated, losing | Bearish bias, checklist fail, P&L negative, structure broken, SL breach |
| **Amber (yellow)** | Pending, warning, manipulation, attention needed | Sweep detected, MSS pending, outside killzone, R:R 1-2 |
| **Primary (blue)** | Active, selected, informational, displacement | Active tab, selected TF, displacement stage, MSS forming |
| **Muted (gray)** | Neutral, inactive, historical, no data | Neutral bias, idle state, capability chips, timeline events |
| **Cyan** | Current price marker | Price position bar in Entry/InTrade views |

### Why Monospace for Prices

All prices, percentages, and numerical data use `font-mono`. This ensures perfect vertical alignment — columns of numbers line up exactly. Critical for scanning prices quickly.

### Why Cards Not Tables

Cards allow progressive disclosure — each card can show different data shapes (a bar, a list, a grid) without forcing everything into rigid columns. Cards can be color-coded by status. Cards can be clicked for deeper evidence.

### Why the Stage Machine

A trader's decision process is sequential: observe → detect sweep → confirm displacement → verify structure shift → find entry → execute → review. The stage machine encodes this sequence as program logic. It prevents premature action (can't see EntryView until all prerequisites are met) and forces re-evaluation (regression when the setup breaks down).

---

## Quick Start

1. **Open** `http://localhost:3000`
2. **Select** a symbol from the dropdown (default: BTCUSDT)
3. **Choose** a timeframe preset: Scalp / Intraday / Swing
4. **Wait** for the stage to progress from WATCHING → SCANNING
5. **Watch** the LiveTimeline for sweep events
6. **Click** TF chips to drill into single-timeframe detail
7. **When** stage reaches ENTRY_READY, adjust SL/TP if needed
8. **Click** "Show in TV" to draw levels on your TradingView Desktop chart
9. **Execute** via the Execute button, or manually on TV Desktop
10. **Manage** the trade in InTradeView (trail stops, TP1 hit, close half)
11. **Review** in ReviewView (journal entry, model alignment check)

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` / `Ctrl+K` | Open Capability Explorer |
| `Esc` | Close any overlay/modal |

---

## Glossary

| Term | Definition |
|------|-----------|
| **BOS** | Break of Structure — price breaks prior HH/LL, confirming trend continuation |
| **CHoCH / MSS** | Change of Character / Market Structure Shift — price breaks prior HL/LH, signaling potential reversal |
| **BSL** | Buy-Side Liquidity — sell stops and breakout buy orders above swing highs |
| **SSL** | Sell-Side Liquidity — buy stops and breakout sell orders below swing lows |
| **EQH / EQL** | Equal Highs / Equal Lows — multiple swing points at the same price level (engineered liquidity) |
| **OB** | Order Block — the last opposing candle before an impulsive move (institutional entry zone) |
| **FVG** | Fair Value Gap — a 3-candle imbalance where the middle candle doesn't overlap the outer two |
| **PD Array** | Premium/Discount Array — price contextualized within the dealing range (premium=top half, discount=bottom half) |
| **SMT** | Smart Money Technique — divergence between correlated instruments (e.g., BTC makes HH but ETH doesn't) |
| **DOL** | Draw on Liquidity — price's natural target (the next untapped liquidity pool) |
| **OTE** | Optimal Trade Entry — 62-79% Fibonacci retracement zone within premium/discount |
| **Killzone** | High-probability time windows: London 07-09 UTC, NY AM 12-14 UTC, NY PM 15-16 UTC |
| **Silver Bullet** | ICT's time-based entry model within killzone windows |
| **Breaker Block** | A mitigated OB that has flipped polarity — former support becomes resistance (or vice versa) |
