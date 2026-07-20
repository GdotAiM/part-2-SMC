# Fair Value Gaps (FVG)

## What ICT Teaches

A **Fair Value Gap (FVG)** is a 3-candle pattern where price moves so fast that orders are left unfilled — there's a gap between the first and third candle that the second candle doesn't overlap. This gap represents "imbalance" — more aggressive traders (buyers or sellers) overwhelmed the other side, and the market didn't transact at those intermediate prices.

A **bullish FVG** forms when candle 3's low is above candle 1's high. The gap between candle 1's high and candle 3's low is the FVG zone. Price tends to return to this zone to "fill" the imbalance before continuing higher.

A **bearish FVG** forms when candle 3's high is below candle 1's low. The gap is between candle 1's low and candle 3's high. Price tends to return to fill this gap before continuing lower.

ICT teaches that FVGs are the most reliable entry pattern in the SMC toolkit. An unfilled FVG after a displacement move is the "entry trigger" — it signals that the market still has unfinished business at those prices. The best FVGs form during high-volume sessions (London/NY) and after a liquidity sweep.

**Fill Fraction**: As price trades through the FVG zone, it's "filling" the gap. The `fillFraction` tracks what percentage of the gap has been traded — 0.0 is completely unfilled (strongest), 1.0 is completely filled (no longer an imbalance).

## How SMC Pulse Implements It

- **Algorithm**: Scans every three consecutive candles. If candle 2's range doesn't overlap candle 1 and candle 3's gap (in price terms), an FVG is detected. The gap dimension is `[min(top, bottom), max(top, bottom)]`.
- **Key parameters**: `minFvgSize` (minimum gap size as fraction of price), `bodyRatioFilter` (rejects FVGs where the impulse candle has doji-like body < 30% of range — avoids weak signals)
- **Output**: `fvg[]` with `{type, top, bottom, time, fillFraction, isInversion}`
- **Fill tracking**: Fill fraction is continuously updated as price trades through the zone
- **Inversion**: When an FVG is fully filled and price then reverses back through it from the other side, it becomes an inversion FVG (see `07-inversion-fvg.md`)

## How to Read It in the Cockpit

- **FvgFormedView**: The main view. Entry FVG is displayed as an imbalance zone bar with top/bottom boundaries, fill percentage, and directional arrow
- **DisplacementView**: FVGs with `fillFraction < 0.3` are flagged as displacement evidence — shown per timeframe with fill bars
- **EntryView**: Entry zone prioritizes FVGs over OBs — unmitigated FVG on entry TF becomes the primary entry zone
- **DecisionFunnel → Structure Confirmation**: FVG counts feed into the displacement check

## Strengths

- Clean 3-candle pattern detection with mathematical precision
- Fill fraction tracking provides continuous zone validity measurement
- Doji filter prevents weak/indecisive candles from generating false FVGs
- Multi-TF FVG detection enables confluence (HTF FVG + LTF FVG = stronger signal)

## Limitations

- Minimum size filter may miss small but significant FVGs in low-volatility forex pairs
- Fill fraction is a simple overlap measure — doesn't account for volume within the FVG
- FVG detection only within the visible lookback — gaps formed before the data window are invisible
- Inversion detection is reactive (only after full fill and reverse)

## Configuration

```typescript
fvg: {
  minFvgSize: 0.0002,         // minimum gap as fraction of price
  bodyRatioFilter: 0.3,       // candle body must be >30% of range
  maxFvgs: 20,
}
```

## Further Reading

- ICT Mentorship Core Content — Month 6: Fair Value Gaps
- Inversion FVGs — see `07-inversion-fvg.md`
- FVG + OB confluence — see `05-order-blocks.md`
