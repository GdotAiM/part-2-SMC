# Daily Bias

## What ICT Teaches

The **Daily Bias** is the higher timeframe "anchor" that grounds all lower timeframe trading decisions. ICT teaches that you should only trade in the direction of the daily bias — it's the institutional order flow direction for the day. The daily bias answers one question: "Are institutions buying or selling today?"

If the daily bias is bullish, you only look for long setups on lower timeframes (15m, 1H, 4H). Short setups are ignored regardless of how good they look. If the daily bias is bearish, you only look for shorts. This single rule eliminates roughly half of all losing trades.

ICT teaches that daily bias comes from multiple sources: the prior day's structure (did we close above/below yesterday's high/low?), the weekly profile (are we in a weekly expansion or contraction?), the opening range, and the London/NY session behavior.

## How SMC Pulse Implements It

- **Primary method: Structure-based**. Analyzes HH-HL / LL-LH sequences on the daily timeframe. Strength score 0.55-0.88 when structure is clear. Evidence bullets include referenced swings (e.g., "HH @ 115.00 / HL @ 110.50").
- **Fallback method: SMA-based**. When the dataset is too short for structural analysis (< 20 bars), falls back to price vs SMA(20). Capped at strength 0.20 (weak signal). Evidence bullet: "SMA confirms structure."
- **Key parameters**: `smaPeriod` (20), `structureStrength` (0.55-0.88 range), `smaFallbackCap` (0.20)
- **Output**: `dailyBias.bias` ("bullish"|"bearish"|"neutral"), `dailyBias.strength` (0-1), `dailyBias.consecutiveDays`, `dailyBias.referencedSwing` (text), `dailyBias.evidence[]`
- **Integration**: Daily bias is used as a filter in strategy evaluation — models that conflict with daily bias are deprioritized or invalidated

## How to Read It in the Cockpit

- **ScanningView → Market Context**: "Daily Bias" row shows bias (BULLISH/BEARISH/NEUTRAL) with strength and consecutive days
- **DecisionFunnel → HTF Narrative**: Daily bias is the first and most prominent item
- **EntryView → Setup Quality Checklist**: "Daily Bias Confirms" check — passes if daily bias matches HTF bias direction
- **TopBar**: Session badge implicitly relates to daily bias (London/NY sessions have different daily bias characteristics)

## Strengths

- Two-tier system (structure primary, SMA fallback) handles both mature and new datasets
- Strength scoring is calibrated (structure: 0.55-0.88, SMA: 0.20 max) to reflect confidence
- Referenced swing text provides transparent reasoning
- Consecutive days counter shows bias persistence

## Limitations

- Structure-based method requires minimum 20 bars — doesn't work mid-session on new symbols
- SMA fallback is intentionally weak (0.20) — system admits "we don't really know" rather than overconfidently predicting
- Weekly profile / opening range analysis is not included
- Doesn't distinguish between "strong daily bias" (all TFs aligned) and "fragile daily bias" (HTF only)

## Configuration

```typescript
dailyBias: {
  smaPeriod: 20,
  structureMinBars: 20,
  structureStrengthRange: [0.55, 0.88],
  smaFallbackCap: 0.20,
}
```

## Further Reading

- ICT Mentorship Core Content — Month 8: Daily Bias & Weekly Profile
- Daily Bias + PD Array confluence for entries — see `08-pd-array.md`
- Strategic alignment with HTF bias in the cascade — the cockpit shows this in ConfluenceCard
