# Market Structure — Pivot Detection

## What ICT Teaches

Market structure is the foundation of all Smart Money Concepts. The market moves in sequences of higher highs (HH) and higher lows (HL) during uptrends, and lower lows (LL) and lower highs (LH) during downtrends. Pivot points are where the market "turns" — they represent decisions by institutional traders to either continue or reverse the trend. ICT teaches that you should never trade against the higher timeframe structure: if the daily chart is making HH-HL, you only look for longs on lower timeframes.

The psychology: each pivot represents a moment where shorts got trapped (HH/HL) or longs got trapped (LL/LH). The next pivot is where those trapped traders' stops sit.

## How SMC Pulse Implements It

- **Algorithm**: Rolling window pivot detection using ATR-based noise filtering. A pivot high is the highest bar within `lookback` bars on each side. A pivot low is the lowest bar within `lookback` bars on each side. The lookback is configurable per timeframe.
- **Key parameters**: `pivotLookback` (default 5 for 15m, varies per TF), `atrPeriod` (14), `atrMultiplier` (0.5 noise threshold)
- **Output**: `StructureResult` with `bias` (bullish/bearish/neutral), `confidence` (0-1), `pivots[]` array of `{type, price, time}`, `breaks[]` array
- **Key fix**: Pivots are identified from price action alone, independent of candle color — a pivot high on a red candle is still a pivot high

## How to Read It in the Cockpit

- **ScanningView**: Each timeframe card shows its bias (▲ BULLISH / ▼ BEARISH / — NEUTRAL) with confidence bar
- **DecisionFunnel → HTF Narrative**: Anchor timeframe bias sets the directional context
- **MssFormingView**: Pivot points are shown as HH/HL/LH/LL badges with prices — you can verify the structure shift visually
- **EntryView**: HTF bias badge confirms the setup direction matches higher timeframe structure

## Strengths

- Multi-timeframe pivot detection (1m through 1W) provides layered structure context
- ATR-based noise filter prevents minor wicks from creating false pivots
- Confidence scoring combines structure quality with daily bias alignment
- Pivots are independent of candle color (fix from ICT v1 implementation)

## Limitations

- Pivot detection is backward-looking — a pivot is only confirmed after `lookback` bars pass
- In low-volatility environments, the ATR noise filter may miss subtle pivots
- Does not detect "induced" pivots (fake breaks designed to trap breakout traders)
- Ranging markets produce ambiguous HH/LL sequences that can flip bias rapidly

## Configuration

```typescript
// lib/smc/config.ts
pivotDetection: {
  lookback: 5,        // bars on each side (varies by TF)
  atrPeriod: 14,      // ATR calculation window
  atrMultiplier: 0.5, // noise threshold multiplier
}
```

## Further Reading

- ICT Mentorship Core Content — Month 1: Market Structure Series
- The concept of "break of structure" (BOS) — see `02-bos-choch.md`
- Pivot confirmation within session killzones — see `12-session-analysis.md`
