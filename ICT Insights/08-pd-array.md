# Premium, Discount & Equilibrium (PD Array)

## What ICT Teaches

Every trading range has three zones:

- **Premium**: The upper portion of the range (above the 50% equilibrium level). In this zone, price is "expensive" — selling pressure is dominant. ICT traders look for shorts here.
- **Discount**: The lower portion of the range (below the 50% equilibrium level). In this zone, price is "cheap" — buying pressure is dominant. ICT traders look for longs here.
- **Equilibrium**: The 50% midpoint of the range. This is the "fair value" level where price is neither expensive nor cheap. Price oscillates around equilibrium — ICT teaches that price always returns to equilibrium before making its next directional decision.

The **PD Array** (Premium/Discount Array) is the framework that contextualizes every trade within the dealing range. A bullish OB at discount is a stronger signal than a bullish OB at premium (where institutions are selling, not buying).

ICT teaches the "OTE" (Optimal Trade Entry) concept — the best entries are in the discount zone for longs (buying at wholesale) and in the premium zone for shorts (selling at retail). The OTE zone is typically the 62-79% retracement within the discount or premium zone.

## How SMC Pulse Implements It

- **Algorithm**: Calculates the dealing range from session high/low and swing high/low. Equilibrium = (high + low) / 2. Zones are defined as: Premium (equilibrium to high), Discount (low to equilibrium).
- **Key parameters**: `sessionRangePeriod`, `swingRangePeriod` (configurable lookback)
- **Output**: `pdArray.currentBias` ("premium"|"discount"|"equilibrium"), `pdArray.zones[]` (6 zones: Session Premium/Discount/Equilibrium + Swing Premium/Discount/Equilibrium), `pdArray.dealingRange`, `pdArray.equilibrium`
- **Integration**: PD Array bias feeds into daily bias calculation and OB confidence scoring (OB in discount during bullish daily bias = extra confidence)

## How to Read It in the Cockpit

- **ScanningView → Market Context**: "PD Array" row shows current bias (PREMIUM / DISCOUNT / EQUILIBRIUM)
- **DecisionFunnel → HTF Narrative**: Equilibrium price is displayed alongside the dealing range
- **EntryView**: Entry zone is validated against PD Array (longs in discount, shorts in premium get implicit confidence)
- **Narrative text**: Generated narrative mentions whether price is "above equilibrium" (premium) or "below equilibrium" (discount)

## Strengths

- Dual zone system (Session + Swing) provides both tactical and strategic context
- Equilibrium calculation is straightforward and unambiguous
- PD Array bias integrates with OB confidence scoring for multi-signal confluence
- Dealing range is continuously updated as new session/swing highs/lows form

## Limitations

- Session and swing ranges can diverge significantly — no hierarchical resolution logic
- PD Array doesn't account for range expansion/contraction velocity
- OTE zone (62-79% retracement) is not explicitly calculated — uses binary premium/discount
- Range boundaries are absolute (break above high = no longer in premium) rather than fuzzy

## Configuration

```typescript
pdArray: {
  sessionRangePeriod: "auto",   // follows session clock
  swingRangePeriod: 50,         // bars for swing range
  equilibriumRecalc: "onRangeChange",
}
```

## Further Reading

- ICT Mentorship Core Content — Month 7: PD Array & OTE
- PD Array + Daily Bias confluence — see `09-daily-bias.md`
- Session context for PD Array ranges — see `12-session-analysis.md`
