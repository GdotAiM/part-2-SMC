# Draw on Liquidity (DOL)

## What ICT Teaches

**Draw on Liquidity (DOL)** is the concept that price is always magnetically drawn toward liquidity pools. Every price move has a purpose — it's going somewhere to fill institutional orders. The "draw" is the target — the price level that the current move is aimed at.

ICT teaches that after a manipulation (liquidity sweep + reversal), the draw is the liquidity pool in the opposite direction. If price sweeps BSL (above the range) and reverses down, the draw is the nearest SSL pool below. The market swept buy-side liquidity to fill sell orders, and now it's going to hunt sell-side liquidity to fill buy orders.

The DOL concept helps you set realistic profit targets. Instead of arbitrary take-profit levels based on R:R ratios, you target the next liquidity pool that price is naturally drawn to. This aligns your exits with institutional order flow rather than guessing.

**Draw targets** are ranked by score, which combines:
- Proximity (closer targets score higher — more likely to be hit first)
- Bias alignment (targets in the direction of the HTF bias score higher)
- Confluence (targets that also align with FVGs, OBs, or equilibrium levels score higher)

## How SMC Pulse Implements It

- **Algorithm**: Identifies all liquidity pools (BSL/SSL) on each timeframe. Scores each pool as a potential draw target based on proximity × bias alignment × confluence multiplier. Returns top-5 targets.
- **Key parameters**: `proximityWeight` (0.4), `biasAlignmentWeight` (0.35), `confluenceWeight` (0.25)
- **Output**: `draw[]` array with `{price, type, score, direction, label}` — top-5 highest-scoring draw targets
- **Integration**: EntryView uses draw targets for TP1 (confirmation TF draw) and TP2 (bias-setter TF draw)

## How to Read It in the Cockpit

- **EntryView**: TP levels are directly derived from draw targets — TP1 = nearest draw on confirmation TF, TP2 = nearest draw on bias-setter TF
- **ScanningView**: Liquidity pools displayed are essentially the draw target candidates
- **DecisionFunnel → Signal**: TP levels shown in the signal section come from draw targets
- **Narrative text**: "Price is drawing toward [BSL/SSL] at [price]" is generated from draw targets

## Strengths

- Multi-factor scoring (proximity + bias + confluence) produces more realistic target ranking than single-factor
- Draw targets are liquidity-based, not arbitrary R:R levels — aligns with ICT philosophy
- Top-5 ranking with scores allows traders to choose conservative (closest) or aggressive (farthest) targets
- Bidirectional targets (both long and short draws are scored) covers reversal scenarios

## Limitations

- Draw targets are static at calculation time — don't update as new pools form or old pools are swept
- Confluence scoring is binary-ish (presence/absence of FVG/OB) rather than continuous
- Doesn't account for economic event risk (e.g., a high-impact news event can override all draw targets)
- Market cap/volume considerations aren't factored (a draw target at a major option strike is more significant than a minor swing high)

## Configuration

```typescript
draw: {
  proximityWeight: 0.4,
  biasAlignmentWeight: 0.35,
  confluenceWeight: 0.25,
  maxTargets: 5,
}
```

## Further Reading

- ICT Mentorship Core Content — Month 10: Draw on Liquidity & Trade Management
- Draw targets vs order blocks (OB is entry, DOL is exit) — see `05-order-blocks.md`
- Setting TP/SL based on liquidity pools — the cockpit does this in EntryView
