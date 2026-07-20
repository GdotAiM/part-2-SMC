# Liquidity Pools (BSL/SSL/EQH/EQL)

## What ICT Teaches

Liquidity is the fuel that moves markets. Price is always seeking liquidity — it's drawn to where orders sit. The two main types:

- **Buy-side Liquidity (BSL)**: Sell stops and breakout buy orders sitting above swing highs. When price moves above a swing high, it triggers buy stops (covering shorts) and breakout entries. The level where these orders cluster is a BSL pool.
- **Sell-side Liquidity (SSL)**: Buy stops and breakout sell orders sitting below swing lows. When price moves below a swing low, it triggers sell stops (covering longs) and breakout sell entries. The level where these cluster is an SSL pool.
- **Equal Highs (EQH)**: Two or more swing highs at approximately the same price level. These are "double tops" — multiple traders placing stops at the same obvious level. Extremely attractive to institutions because they represent a dense cluster of orders.
- **Equal Lows (EQL)**: Same concept but at swing lows.

ICT teaches that price will almost always "sweep" (run through) a liquidity pool before making its real move. The logic: institutions need counterparties for their large orders. They push price into a pool of retail stops to fill their own position before reversing.

## How SMC Pulse Implements It

- **Algorithm**: Scans all pivot points within the dealing range. Each pivot high creates a BSL pool; each pivot low creates an SSL pool. Pools are scored by: (1) number of touches/bounces off that level, (2) recency, (3) session context weight
- **Key parameters**: `poolTouchWeight` (each touch adds 0.5 to score), `sessionWeights` (London=1.0, NY=1.0, Asian=0.5)
- **Output**: `liquidity.pools[]` with `{type, price, score, touches, wasSwept, sweptAt, probabilityOfSweep, session}`, plus `nearestBSL`, `nearestSSL`
- **Sweep detection**: A pool is "swept" when price trades through it and then closes back within range — confirmed by `wasSwept=true` and a `sweptAt` timestamp

## How to Read It in the Cockpit

- **ScanningView**: "Key Liquidity" card shows nearest BSL and SSL with type dots (green=BSL, red=SSL), prices, and sweep probability %
- **LiquiditySweptView**: Main focus — swept pools grid shows which pools were swept, when, and on which timeframe
- **DecisionFunnel → Liquidity Delivery**: Swept vs unswept pool counts, top 3 nearest pools
- **InTradeView**: SL is placed beyond the nearest liquidity pool in the trade direction

## Strengths

- Session-weighted scoring prioritizes pools formed during high-volume sessions
- Touch count increases score — repeatedly tested levels are more significant
- Sweep timestamp enables temporal analysis (how recently was this pool taken?)
- Probability of sweep provides forward-looking guidance

## Limitations

- EQH/EQL detection is not explicitly implemented (pools are individual pivot-based)
- Pool scoring doesn't account for volume profile (volume at the level)
- Sweep detection requires price to close back within range — intra-session sweeps that don't close back are missed
- Correlation between pools on different timeframes is not modeled (a 15m BSL might be nested inside a 4H BSL)

## Configuration

```typescript
liquidity: {
  poolTouchWeight: 0.5,
  maxPools: 20,
  sweepClosebackRequired: true,
  sessionWeights: { LONDON: 1.0, NY_AM: 1.0, NY_PM: 0.8, ASIAN: 0.5, LATE: 0.3 },
}
```

## Further Reading

- ICT Mentorship Core Content — Month 4: Liquidity Concepts
- Draw on Liquidity (why price moves toward pools) — see `11-draw-on-liquidity.md`
- How sweeps relate to market manipulation phase — see `03-market-phase.md`
