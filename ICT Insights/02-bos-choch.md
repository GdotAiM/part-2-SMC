# Break of Structure (BOS) & Change of Character (CHoCH/MSS)

## What ICT Teaches

A **Break of Structure (BOS)** is when price breaks a previous pivot in the direction of the trend — it confirms trend continuation. A bullish BOS is price breaking above a previous HH; a bearish BOS is price breaking below a previous LL. BOS events are the market saying "the trend is still valid."

A **Change of Character (CHoCH)** — also called Market Structure Shift (MSS) — is when price breaks a pivot *against* the trend. In an uptrend, a CHoCH is price breaking below the most recent HL. In a downtrend, it's price breaking above the most recent LH. This is the market saying "the trend might be over."

The psychological difference is critical: BOS = "more of the same" (institutions are still accumulating/distributing in the same direction), CHoCH = "something changed" (institutions are now doing the opposite). ICT teaches that the first CHoCH after a long trend is the highest-probability reversal signal — but only when confirmed by displacement (see `06-fair-value-gaps.md`).

## How SMC Pulse Implements It

- **Algorithm**: Tracks the last confirmed pivot. A break occurs when price closes beyond a prior pivot level. Classified as BOS if in the trend direction, CHoCH if counter-trend.
- **Key parameters**: `bosMinDistance` (minimum price distance to qualify), `chochRequiresDisplacement` (CHoCH only valid if accompanied by displacement)
- **Output**: `structure.breaks[]` with `{type: "BOS"|"CHoCH"|"MSS", price, time, direction}`
- **Key design**: BOS and CHoCH are detected independently on each timeframe — a 15m CHoCH might be just a 4H pullback

## How to Read It in the Cockpit

- **MssFormingView**: The main view for breaks. MSS/CHoCH breaks get a highlighted pulsing border. All breaks are shown chronologically as a "break sequence"
- **DisplacementView**: Structure breaks panel shows all recent breaks with type badges
- **LiquiditySweptView**: Sweep classification uses CHoCH presence to determine manipulation vs genuine break
- **DecisionFunnel → Structure Confirmation**: Shows displacement + MSS check marks

## Strengths

- Multi-TF break detection — a 15m CHoCH is contextualized against 4H structure
- Break classification is clean (BOS vs CHoCH) with clear directional attribution
- CHoCH requires displacement for validity (reduces false signals)

## Limitations

- Break detection is lagging — requires a close beyond the pivot level
- Does not distinguish between "induced" CHoCH (fake reversal to trap counter-trend traders) and genuine CHoCH
- BOS doesn't account for the distance from equilibrium — a BOS at premium is very different from a BOS at discount

## Configuration

```typescript
structure: {
  bosMinDistance: 0.001,     // minimum fraction of price to qualify
  chochRequiresDisplacement: true,
  maxBreaksToTrack: 20,
}
```

## Further Reading

- ICT Mentorship Core Content — Month 2: Breaks of Structure
- How displacement confirms CHoCH — see `06-fair-value-gaps.md`
- Market phase relationship to breaks — see `03-market-phase.md`
