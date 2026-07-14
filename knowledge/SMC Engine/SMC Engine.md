---
tags: [smc, ict, engine, architecture]
aliases: [SMC Engine]
---

# SMC Engine — Detection Modules

**Location:** `artifacts/api-server/src/lib/smc/`  
**Entry:** `report.ts` — `buildReport()` orchestrates all 7 modules

## Module Dependency Graph

```
report.ts
├── structure.ts      { analyzeStructure }
│   ├── config.ts     { SMC_CONFIG }
│   └── types.ts      { All shared interfaces }
├── liquidity.ts      { analyzeLiquidity }
├── fvg.ts            { analyzeFVG }
├── order-blocks.ts   { analyzeOrderBlocks }
├── pd-array.ts       { analyzePdArray }
├── daily-bias.ts     { analyzeDailyBias }
└── smt.ts            { analyzeSMT }
```

## Detection Modules

### 1. Market Structure (`structure.ts`)
- **Input:** `Candle[]`, `timeframe`
- **Output:** `StructureResult` — trend, bias, confidence, pivots (HH/HL/LH/LL), breaks (BOS/CHoCH), phase
- **Algorithm:** ATR-normalised window pivot detection → HH/HL/LH/LL classification → BOS/CHoCH labelling → phase inference (accumulation/manipulation/expansion/distribution)
- **Key detail:** Pivots are **colour-independent** — a bearish candle can be a swing high

### 2. Liquidity Pools (`liquidity.ts`)
- **Input:** `Candle[]`, `timeframe`, `market`
- **Output:** `LiquidityResult` — pools (BSL/SSL/EQH/EQL) with scores + sweep probability
- **Scoring:** `touches × recency decay × session weight × displacement factor`
- **Sessions:** Asia (0.6), London (1.2), NY (1.2), Overlap (1.5), Off-hours (0.8)

### 3. Order Blocks (`order-blocks.ts`)
- **Input:** `Candle[]`, `FVG[]`
- **Output:** `OrderBlock[]` — type, proximal/distal, confidence, breaker flag
- **Confidence factors:** FVG confluence (+0.18), unmitigated (+0.15), breaker (-0.20), strong displacement (+0.10), recency (+0.10)

### 4. Fair Value Gaps (`fvg.ts`)
- **Input:** `Candle[]`, `market`
- **Output:** `FairValueGap[]` — top, bottom, fillFraction, isInversion
- **Detection:** 3-candle pattern — gap between candle[i-1] and candle[i+1] wicks
- **Fill tracking:** Forward scan computing fill fraction; inversion when price fills and closes beyond

### 5. PD Array (`pd-array.ts`)
- **Input:** `Candle[]`, `timeframe`
- **Output:** `PdArrayResult` — premium/discount/equilibrium zones, dealing range
- **Zones:** Session (recent 24 bars) + Swing (recent 60 bars) levels

### 6. Daily Bias (`daily-bias.ts`)
- **Input:** `Candle[]` (1D)
- **Output:** `DailyBiasResult` — bias, strength (0–1), consecutive days
- **Priority:** Structure-primary (pivot sequence) → PD zone → SMA tiebreaker
- **SMA-only signal capped at 0.20 strength**

### 7. SMT Divergence (`smt.ts`)
- **Input:** `Candle[]` (primary + correlated)
- **Output:** `SmtDivergence` — detected, type, confidence, time
- **Algorithm:** Aligned extremum finder → HH/LL divergence check → magnitude + timing confidence
- **Bearish SMT:** Primary makes HH, correlated makes LH

## Configuration (`config.ts`)
All tunable parameters centralized:
- `atrPeriod`: 14 (default), 6–14 per TF
- `pivotLookback`: 5 (default), 2–5 per TF
- `equalLevelThreshold`: 0.001 (0.1%)
- `fvgMinBodyRatio`: 0.5
- `obRequireFvg`: true
- `obLookForward`: 3

## Build Report Flow

```
analyzeStructure() ──→ structure ──┐
analyzeFVG()       ──→ fvg ───────┤
analyzeLiquidity() ──→ liquidity ─┤
analyzeOrderBlocks()→ obs ───────┼─→ confluenceBoost() → DrawTarget[]
analyzePdArray()   ──→ pdArray ──┤
analyzeDailyBias() ──→ dailyBias ┤
analyzeSMT()       ──→ smt ──────┘
                                   ↓
                         deriveSessionState()
                         buildMarketNarrative()
                                   ↓
                             SmcReport
```
