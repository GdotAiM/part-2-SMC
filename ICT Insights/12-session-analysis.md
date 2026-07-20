# Session Analysis & Killzones

## What ICT Teaches

The forex/derivatives market operates in distinct sessions, each with its own "personality":

1. **Asian Session (00:00-07:00 UTC)** — Range formation. Low volatility, low volume. Price tends to establish a range that will be tested later. ICT teaches to avoid trading during Asian — it's for observation, not entry.

2. **London Session (07:00-12:00 UTC)** — Liquidity hunting. The most aggressive session. London opens and immediately hunts for stops — sweeping Asian range highs and lows. The "London Killzone" (07:00-09:00) is where most liquidity sweeps occur. ICT teaches that the best entries come after the London sweep, during the "Silver Bullet" window (10:00-11:00).

3. **NY AM Session (12:00-15:00 UTC)** — Expansion. New York opens and overlaps with London. Highest volume of the day. The "NY Killzone" (12:00-14:00) is where the real trend of the day usually establishes. The "Silver Bullet" window is 13:00-14:00 during NY.

4. **NY PM Session (15:00-20:00 UTC)** — Distribution / reversal. London closes, NY continues alone. The afternoon often reverses the morning's move. ICT's "Silver Bullet" here is 15:00-16:00.

5. **Late / Transition (20:00-00:00 UTC)** — Thin market. Low liquidity, erratic moves. Best to avoid.

ICT teaches that the highest-probability trades occur during **session overlaps** (London-NY overlap, 12:00-15:00) and during **Silver Bullet windows** (one hour within each active session). Trading outside these windows dramatically reduces win rate.

## How SMC Pulse Implements It

- **Algorithm**: Pure UTC clock-based detection. Maps current hour to session slot. Calculates time remaining within the current session for countdown display.
- **Key parameters**: Session boundaries are hardcoded (ICT standard times)
- **Output**: `SessionInfo` with `{name, label, utcStart, utcEnd, timeRemaining (ms), isActive}`
- **Integration**: Session is displayed in TopBar, all stage views, and DecisionFunnel. Session quality check (LONDON/NY_AM/NY_PM = OK) gates the NO_TRADE stage.

## How to Read It in the Cockpit

- **TopBar**: Session badge with name + live countdown timer (MM:SS) + progress bar — always visible
- **All stage views**: Session name and remaining time shown in a dedicated card
- **NoTradeView**: Triggered when not in LONDON/NY_AM/NY_PM — "not a high-probability session window" reasoning
- **DecisionFunnel → Structure Confirmation**: "Session alignment" check validates the trade against session context
- **Profile Store**: 5 sessions can be individually enabled/disabled and set as primary

## Strengths

- Clean UTC-based session definitions — unambiguous and timezone-independent
- Countdown timer creates urgency awareness (how much time is left in this window?)
- Session quality filter prevents trading during low-probability windows (Asian, Late)
- Profile customization allows traders to match their own session preferences
- TopBar always shows session context — no need to remember which session is active

## Limitations

- Session boundaries are fixed UTC — doesn't account for daylight saving transitions in local time
- Session personality is qualitative — the system knows WHICH session is active, not how it's behaving
- No differentiation between session open (high volatility) and session middle (consolidation)
- Killzone windows (Silver Bullet hours) are not explicitly highlighted — session is all-or-nothing
- Doesn't detect "session hijack" — when one session's character bleeds into the next

## Configuration

```typescript
sessions: {
  boundaries: {
    ASIAN:  [0, 420],      // 00:00-07:00 UTC (minutes)
    LONDON: [420, 720],    // 07:00-12:00
    NY_AM:  [720, 900],    // 12:00-15:00
    NY_PM:  [900, 1200],   // 15:00-20:00
    LATE:   [1200, 1440],  // 20:00-24:00
  },
  highProbabilitySessions: ["LONDON", "NY_AM", "NY_PM"],
}
```

## Further Reading

- ICT Mentorship Core Content — Month 11: Sessions, Killzones & Time-Based Setups
- Silver Bullet model (time-based entry within killzones) — in profile store as temporal-silver-bullet-*
- Session + Market Phase relationship — see `03-market-phase.md`
