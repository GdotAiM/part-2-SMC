# Market Phase Detection

## What ICT Teaches

Every market moves through four phases in a repeating cycle:

1. **Accumulation** — Smart money buys at discount, price ranges sideways, volume is quiet. Retail sees "boring" price action. Institutions are building positions.
2. **Manipulation** — A fake move to run stops — often a sweep of equal highs or equal lows. This is the " Judas swing" or "turtle soup" pattern. Price briefly breaks out of the range, then reverses sharply.
3. **Distribution / Expansion** — The real move. Price trends strongly in the direction of the accumulation. This is where retail finally enters — and where institutions are already exiting.
4. **Continuation / Repeat** — Price returns to equilibrium or enters a new accumulation phase.

ICT teaches that 90% of retail losses happen during **manipulation** — they buy the breakout that was designed to trap them. The edge comes from identifying accumulation, waiting through manipulation, and entering during early distribution/expansion.

## How SMC Pulse Implements It

- **Algorithm**: Analyzes the last 5 structure breaks. If breaks are mixed (BOS in both directions), it's accumulation or distribution. A cluster of breaks in one direction signals expansion.
- **Key parameters**: `phaseLookbackBreaks` (5), `expansionThreshold` (3+ breaks in same direction)
- **Output**: `structure.phase` string — "accumulation", "manipulation", "distribution", "expansion", "continuation", or "neutral"
- **Key integration**: The phase feeds into the narrative generator and the `SessionFlowIndicator` visual

## How to Read It in the Cockpit

- **SessionFlowIndicator**: The 4-dot sequence (ACC→MAN→DIST→CONT) appears in every stage view header. Current phase is highlighted with a glow effect
- **DecisionFunnel → HTF Narrative**: Current phase is displayed alongside daily bias
- **NoTradeView**: If phase is "manipulation", the system may recommend waiting
- **ReviewView**: Post-trade analysis checks if you entered during the right phase

## Strengths

- Simple heuristic (5-break analysis) that captures the ICT phase cycle without overfitting
- Visual phase indicator (SessionFlowIndicator) is embedded in every view for constant awareness
- Phase feeds into quality scoring and narrative generation

## Limitations

- 5-break window may be too short on very low timeframes (1m/5m) — consider longer lookback for sub-15m
- Phase detection is reactive — a phase change is only detected after breaks accumulate
- "Manipulation" phase is inferred rather than directly detected (no Judas swing pattern matching yet)
- Phase labels are qualitative — no numeric phase strength or transition probability

## Configuration

```typescript
phase: {
  lookbackBreaks: 5,
  expansionThreshold: 3,
  accumulationBreaksMixed: true,
}
```

## Further Reading

- ICT Mentorship Core Content — Month 3: Accumulation, Manipulation, Distribution
- Relationship to liquidity sweeps (manipulation = sweep + reversal) — see `04-liquidity-pools.md`
- Phase within session context — see `12-session-analysis.md`
