# SMT Divergence

## What ICT Teaches

**SMT Divergence** (Smart Money Technique Divergence) is a correlation-based signal. When two correlated instruments (e.g., ES and NQ, or BTC and ETH) diverge — one makes a higher high while the other fails to — it reveals institutional manipulation.

The classic SMT pattern: ES makes a higher high but NQ doesn't. This tells you that the "market" (represented by ES) is showing strength, but the "tech sector" (represented by NQ) is not participating. The ES move is a manipulation — institutions are driving ES up to run stops, while quietly distributing NQ. The divergence signals an impending reversal.

ICT teaches to use SMT divergence as a **confirmation** signal, not a standalone entry trigger. When you see SMT divergence + a liquidity sweep + a CHoCH, the reversal probability is very high.

The psychology: correlated instruments are traded by the same institutions. When they behave differently, it means one is being manipulated to provide liquidity for positions in the other.

## How SMC Pulse Implements It

- **Algorithm**: Compares the last N bars (default 20) of the primary symbol against a correlated symbol. Detects when primary makes a new HH/LL but correlated doesn't (or vice versa). Combines price magnitude difference + timing proximity into a confidence score.
- **Key parameters**: `correlatedSymbols` (e.g., ES↔NQ, BTCUSDT↔ETHUSDT), `lookbackBars` (20), `confidenceThreshold` (0.5)
- **Output**: `smt.detected` (boolean), `smt.type` ("bullish_smt"|"bearish_smt"), `smt.confidence` (0-1), `smt.primarySymbol`, `smt.correlatedSymbol`, `smt.time`
- **Bullish SMT**: Primary makes LL, correlated holds — bearish manipulation, bullish reversal incoming
- **Bearish SMT**: Primary makes HH, correlated fails — bullish manipulation, bearish reversal incoming

## How to Read It in the Cockpit

- **ScanningView → Market Context**: "SMT" row shows divergence status (DETECTED / NONE)
- **DisplacementView**: SMT divergence is one of the signal checks alongside displacement
- **EvidencePanel**: Per-TF evidence includes SMT divergence status
- **Agent Workspace**: SMT divergence is included in the agent's signal reasoning context

## Strengths

- Cross-instrument correlation provides an objectivity check that single-instrument analysis can't
- Magnitude + timing scoring combination avoids false positives from random divergence
- Confidence scoring (0-1) allows threshold tuning for sensitivity
- Directional classification (bullish_smt vs bearish_smt) maps cleanly to trade direction

## Limitations

- Requires two correlated instruments with active data feeds — if one feed is delayed, SMT is unreliable
- Correlation is static (hardcoded pairs) — doesn't adapt to changing market correlation regimes
- Only detects divergence at swing points (HH/LL) — subtle mid-trend divergence is missed
- Confidence score is influenced by the lookback window — different window sizes can give different signals

## Configuration

```typescript
smt: {
  lookbackBars: 20,
  confidenceThreshold: 0.5,
  correlatedPairs: {
    BTCUSDT: "ETHUSDT",
    ES: "NQ",
  },
}
```

## Further Reading

- ICT Mentorship Core Content — Month 9: SMT Divergence & Intermarket Analysis
- SMT + Liquidity Sweep confluence — see `04-liquidity-pools.md`
- The psychology of correlated instrument manipulation — institutions use one market to fill orders in another
