# Order Blocks (OB)

## What ICT Teaches

An **Order Block** is the last opposing candle before a significant move. It represents the price level where institutions placed their orders before pushing price in the opposite direction. Think of it as the "last decoy candle" — the final attempt to get retail traders to take the wrong side before the real move begins.

A **bullish OB** is the last red (bearish) candle before an impulsive bullish move up. Its body marks the zone where institutions accumulated long positions. A **bearish OB** is the last green (bullish) candle before an impulsive bearish move down. Its body marks where institutions distributed short positions.

The OB's **proximal** (closest to current price) and **distal** (farthest) boundaries define the entry zone. Price returning to the OB zone is a high-probability entry — institutions often "defend" their order blocks by adding to positions.

**Mitigation**: An OB is "mitigated" when price trades through its entire zone (beyond distal). Once mitigated, the OB is no longer valid as support/resistance — it has served its purpose.

**Breaker Block**: A special case where a mitigated bullish OB becomes a bearish OB (or vice versa) — the zone inverts its polarity. This is the "breaker" pattern ICT teaches.

## How SMC Pulse Implements It

- **Algorithm**: Scans candles for impulse moves (close-to-close change exceeding ATR threshold). The candle immediately before the impulse is the OB. Bullish OBs form below current price, bearish OBs above.
- **Key parameters**: `impulseThreshold` (1.0 ATR), `mitigatedFraction` (price must trade beyond distal to count as mitigated), `fvgConfluenceBonus` (OB gets strength bonus for nearby FVG)
- **Output**: `orderBlocks[]` with `{type, proximal, distal, time, index, valid, strength, hasFvg, isMitigated, isBreaker}`
- **Strength scoring**: 0-3 scale based on impulse size, FVG confluence, and whether OB is the most recent unmitigated block

## How to Read It in the Cockpit

- **EntryView**: OB is used as an alternative entry zone when no FVG is available — shown alongside FVG levels
- **DecisionFunnel → Entry Model**: OBs count is shown alongside FVGs for entry zone detection
- **EvidencePanel**: Per-TF evidence includes OB count and validity
- **InTradeView**: Structure integrity check monitors whether the OB that triggered entry has been mitigated

## Strengths

- Proximal/distal boundary system provides clear entry zone definition
- Strength scoring (0-3) enables ranking of OBs within a timeframe
- Breaker block detection captures polarity inversion pattern
- FVG confluence bonus aligns OB detection with imbalance detection

## Limitations

- OB detection requires an identifiable "impulse" — subtle institutional accumulation without a clear impulse candle is missed
- Single-candle OB definition is a simplification — ICT sometimes references multi-candle OB zones
- Mitigation detection is binary (mitigated or not) — partial mitigation behavior is not tracked
- Breaker detection is simple (mitigated OB + continued trend) — complex breaker patterns (breaker-of-breaker) are not modeled

## Configuration

```typescript
orderBlocks: {
  impulseThreshold: 1.0,       // ATR multiplier for impulse detection
  mitigatedFraction: 1.0,      // fraction beyond distal to be mitigated
  fvgConfluenceBonus: 0.5,     // strength bonus
  maxOrderBlocks: 20,
}
```

## Further Reading

- ICT Mentorship Core Content — Month 5: Order Blocks
- OB + FVG confluence pattern — see `06-fair-value-gaps.md`
- Breaker block inversion — see `07-inversion-fvg.md`
