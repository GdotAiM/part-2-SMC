# Inversion Fair Value Gaps

## What ICT Teaches

An **Inversion FVG** is a Fair Value Gap that has been completely filled by price, and then price reverses back through the same zone from the opposite direction. The zone "inverts" its polarity — a former bullish FVG (which previously acted as support) now acts as resistance, and vice versa.

Think of it this way: a bullish FVG attracts buyers (who want to fill the gap and continue up). Once those buyers are satisfied and price fills the gap, the buying pressure is exhausted. If price then drops back through the zone, it means sellers have overwhelmed the remaining buyers — the zone is now controlled by sellers.

ICT teaches that inversion FVGs are powerful reversal confirmation signals. When you see:
1. A bullish FVG form
2. Price return and fill it
3. Price then break below the FVG zone

This is a "failed support" — the market has changed character. The former support zone is now a resistance zone. Trading the retest of an inversion FVG is a high-probability entry.

## How SMC Pulse Implements It

- **Algorithm**: An FVG becomes "inverted" when `fillFraction >= 1.0` (completely filled) AND price reverses back through the zone AND closes beyond it. The FVG is then retained in the dataset with `isInversion = true`.
- **Key behavior**: Inversion FVGs are NOT shown as entry trigger zones — they've already served their purpose. They ARE retained for structure analysis and as resistance/support reference.
- **Output**: Same `fvg[]` array entries but with `isInversion: true`. These are filtered out by entry-level checks (`!f.isInversion` in all stage views).

## How to Read It in the Cockpit

- **DisplacementView**: Inversion FVGs are NOT shown (filtered by `!f.isInversion`). Only active, unfilled FVGs are displayed as displacement evidence.
- **DecisionFunnel → Structure Confirmation**: Inversion FVGs are excluded from the entry trigger check
- **EvidencePanel**: Per-TF report evidence includes total FVG count (including inversions) vs active FVG count
- **EntryView**: Entry zone derivation specifically excludes inversion FVGs (`f.fillFraction < 0.3 && !f.isInversion`)

## Strengths

- Clean separation between active FVGs (tradeable) and inversion FVGs (historical reference)
- Inversion detection is automatic — no manual marking needed
- Provides additional context for why a level might act as resistance/support
- Aligns with ICT teachings about "polarity flip" zones

## Limitations

- Inversion is binary (yes/no) — no measure of how "strong" the inversion is
- Doesn't track which side caused the inversion (buyers overwhelming vs sellers overwhelming)
- The inversion zone's new polarity (as resistance or support) doesn't have a confidence score
- Inversion detection requires a close beyond the zone — intra-zone reversals are not classified as inversions

## Configuration

```typescript
fvg: {
  retainInversions: true,     // keep inverted FVGs in dataset
  inversionRequiresClose: true, // must close beyond zone to qualify
}
```

## Further Reading

- ICT Mentorship Core Content — Month 6: FVG Inversions
- Relationship to breaker blocks — see `05-order-blocks.md`
- Polarity flip psychology — the market remembers where it reversed
