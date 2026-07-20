# Configuration Reference

## What ICT Teaches

ICT emphasizes that no single set of parameters works for all instruments and timeframes. A scalper trading 1-minute ES futures needs different settings than a swing trader on daily BTC. The "art" of SMC trading is tuning these parameters to match your instrument, timeframe, and risk tolerance.

The SMC Pulse engine exposes all detection parameters through a central configuration object in `lib/smc/config.ts`. This allows systematic tuning and backtesting to find optimal parameters per instrument.

## Complete Configuration Table

### Structure Detection

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `pivotLookback` | 5 | 2-20 | Bars on each side for pivot detection |
| `atrPeriod` | 14 | 7-50 | ATR calculation period |
| `atrMultiplier` | 0.5 | 0.1-2.0 | Noise filter threshold |
| `bosMinDistance` | 0.001 | 0.0001-0.01 | Minimum price fraction for BOS |
| `chochRequiresDisplacement` | true | bool | Require displacement for CHoCH validity |

### Liquidity Detection

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `poolTouchWeight` | 0.5 | 0.1-2.0 | Score added per touch of a pool |
| `maxPools` | 20 | 5-50 | Max pools tracked per timeframe |
| `sweepClosebackRequired` | true | bool | Must close back within range |
| `sessionWeights.LONDON` | 1.0 | 0-2.0 | Weight for London session pools |
| `sessionWeights.NY_AM` | 1.0 | 0-2.0 | Weight for NY AM pools |
| `sessionWeights.NY_PM` | 0.8 | 0-2.0 | Weight for NY PM pools |
| `sessionWeights.ASIAN` | 0.5 | 0-2.0 | Weight for Asian session pools |

### Order Blocks

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `impulseThreshold` | 1.0 | 0.5-3.0 | ATR multiplier to qualify an impulse |
| `mitigatedFraction` | 1.0 | 0.5-1.0 | Fraction beyond distal to count as mitigated |
| `fvgConfluenceBonus` | 0.5 | 0-1.0 | Strength bonus for FVG-adjacent OBs |
| `maxOrderBlocks` | 20 | 5-50 | Max OBs tracked |

### Fair Value Gaps

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `minFvgSize` | 0.0002 | 0.00005-0.001 | Minimum gap as fraction of price |
| `bodyRatioFilter` | 0.3 | 0-0.5 | Minimum candle body ratio |
| `maxFvgs` | 20 | 5-50 | Max FVGs tracked |

### Daily Bias

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `smaPeriod` | 20 | 10-50 | SMA period for fallback bias |
| `structureMinBars` | 20 | 10-50 | Minimum bars for structural analysis |
| `structureStrengthRange` | [0.55, 0.88] | — | Strength when structure is clear |

### PD Array

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `swingRangePeriod` | 50 | 20-200 | Bars for swing dealing range |
| `sessionRangePeriod` | "auto" | — | Follows session clock boundaries |

### SMT Divergence

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `lookbackBars` | 20 | 10-50 | Bars for divergence detection window |
| `confidenceThreshold` | 0.5 | 0.3-0.8 | Minimum confidence to report SMT |

### Draw on Liquidity

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `proximityWeight` | 0.4 | 0-1.0 | Weight for pool proximity |
| `biasAlignmentWeight` | 0.35 | 0-1.0 | Weight for bias alignment |
| `confluenceWeight` | 0.25 | 0-1.0 | Weight for FVG/OB confluence |
| `maxTargets` | 5 | 1-10 | Max draw targets returned |

## Tuning Guidance by Trading Style

### Scalping (1m-5m)
- Lower `pivotLookback` (2-3) — faster pivot detection
- Lower `atrPeriod` (7-10) — more responsive to recent volatility
- Higher `minFvgSize` — only show significant gaps
- Lower `impulseThreshold` (0.5-0.7) — catch smaller impulses
- Only use NY_AM and LONDON sessions

### Intraday (15m-1H)
- Default parameters work well
- Enable all three high-probability sessions
- Use `smt.confidenceThreshold` at 0.5 for balanced sensitivity

### Swing (4H-Daily)
- Higher `pivotLookback` (7-10) — fewer, more significant pivots
- Higher `atrPeriod` (20-30) — smoother ATR
- Higher `swingRangePeriod` (100-200) — wider dealing range
- Lower `impulseThreshold` (0.7-0.8) — catch larger impulses
- Daily bias is the primary filter — ignore LTF noise

## Further Reading

- All concept files reference specific parameters relevant to their detection
- The `lib/smc/config.ts` file is the source of truth for all defaults
- Run backtests with different parameter sets using the BacktestRunner (see dashboard)
