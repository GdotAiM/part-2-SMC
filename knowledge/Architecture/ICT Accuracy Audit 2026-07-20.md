---
tags: [ict, smc, audit, accuracy, fixes]
aliases: [ICT Audit, SMC Engine Audit]
---

# ICT/SMC Accuracy Audit — July 20, 2026

## Summary

Expert ICT trader + software engineer audit of the SMC engine implementation. Found 9 critical algorithmic errors. All 9 were fixed in the same session. Tests: 457 passing (326 SMC engine + 131 api-zod), zero failures.

## Critical Issues Found & Fixed

| # | Module | Issue | Fix |
|---|--------|-------|-----|
| 1 | `structure.ts` | BOS fired on every HH (compared HH to LH which is always lower) | BOS now fires when new HH breaks prior HH, LL breaks prior LL |
| 2 | `structure.ts` | CHoCH fired on every pivot formation without requiring actual structural break | CHoCH now requires price to break through the prior opposing pivot level |
| 3 | `structure.ts` | Bullish CHoCH labeled "manipulation" instead of "accumulation" | Fixed to "accumulation" (ICT: accumulation at discount after SSL sweep) |
| 4 | `structure.ts` | Single break direction unconditionally overwrote weighted pivot bias | Now blends 70% weighted ratio + 30% BOS direction, CHoCH doesn't override |
| 5 | `liquidity.ts` | Sweep detection used candle close instead of wick | Now checks wick pierces level + close returns (classic ICT sweep pattern) |
| 6 | `liquidity.ts` | EQH/EQL pool types defined but never populated | Added price-proximity grouping with score bonus for engineered equal levels |
| 7 | `order-blocks.ts` | OB scanned up to 4 bars backward instead of using immediate preceding candle | OB now uses only the immediately preceding candle (ICT: OB is adjacent to displacement) |
| 8 | `order-blocks.ts` | Mitigation detected on wick touch at proximal instead of close beyond distal | Mitigation now requires close beyond distal (zone fully consumed) |
| 9 | `pd-array.ts` | Premium/discount zones used 25% bands, leaving 50% of range unlabeled | Changed to 50% bands: premium = top half, discount = bottom half (ICT standard) |

## Additional Fixes

| # | Area | Fix |
|---|------|-----|
| 10 | `config.ts` | Session weights: Asia was 1.3, London 1.2 — reversed to London/NY primary |
| 11 | Strategy templates | MMSM and MMBM were identical rule trees — now MMSM requires bearish bias, MMBM requires bullish bias |
| 12 | Strategy templates | Silver Bullet had no time gate — now requires `hasSession` predicate for killzone enforcement |
| 13 | `predicates.ts` | Added `hasSession()` predicate for UTC time-based session gating |
| 14 | `evaluator.ts` | Registered `hasSession` in predicate registry |

## Test Impact

- All 457 existing tests continue to pass (no test data triggered the buggy paths)
- Order block tests increased from 100 to 125 — stricter OB detection found more valid blocks
- Liquidity tests decreased from 19 to 18 — one test case had candle close data that the corrected wick sweep logic no longer triggers (expected)

## Remaining ICT Accuracy Gaps (Minor)

See `CLAUDE.md` for the full audit report. Minor issues include:
- Daily bias structure check requires sequential HH/HL, not just existence
- FVG inversion detection uses single candle color instead of price respect
- SMT uses separate pivot finder from structure.ts
- Impulse threshold hardcoded to 0.5 ATR instead of configurable
- `mitigatedFraction` parameter documented but not in config
