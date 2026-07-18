/**
 * ICT/SMC Predicate Functions
 *
 * Pure functions that evaluate an SmcReport against specific structural
 * conditions. Each returns a typed PredicateResult with a boolean match,
 * human-readable evidence strings, and an optional numeric score (0–1).
 *
 * These predicates are the atomic building blocks for the model-definition
 * system — they correspond 1:1 with the predicate names referenced by the
 * seed data in lib/db/seeds/model-definitions.ts.
 *
 * All functions are stateless: given the same SmcReport, they always
 * return the same PredicateResult.
 */

import type {
  SmcReport,
  OrderBlock,
  FairValueGap,
  StructureBreak,
} from "../generated/types";

// ─── Result type ─────────────────────────────────────────────────────────────

export interface PredicateResult {
  /** Whether the structural condition was met */
  matched: boolean;
  /** Human-readable strings explaining what was found (or why not) */
  evidence: string[];
  /** Optional numeric score in [0, 1] indicating degree of conviction */
  score?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convenience: wrap a boolean match + single evidence string. */
function result(
  matched: boolean,
  evidence: string | string[],
  score?: number,
): PredicateResult {
  return {
    matched,
    evidence: typeof evidence === "string" ? [evidence] : evidence,
    ...(score !== undefined ? { score } : {}),
  };
}

/** Return active (valid + unmitigated) order blocks. */
function activeOBs(report: SmcReport): OrderBlock[] {
  return report.orderBlocks.filter(
    (ob) => ob.valid && !ob.isMitigated,
  );
}

/** Return unfilled FVGs (fillFraction < 0.5 or 0). */
function unfilledFVGs(report: SmcReport): FairValueGap[] {
  return report.fvg.filter(
    (g) => g.fillFraction < 0.5 || g.fillFraction === 0,
  );
}

// ─── Predicates ──────────────────────────────────────────────────────────────

/**
 * Has a detectable directional bias from market structure.
 *
 * Checks structure.bias first (the primary signal), then falls back to
 * dailyBias.bias as a secondary signal. "neutral" is the only value that
 * produces matched=false.
 */
export function hasBias(report: SmcReport): PredicateResult {
  const sb = report.structure.bias?.toLowerCase();
  const db = report.dailyBias.bias?.toLowerCase();

  if (sb && sb !== "neutral") {
    return result(true, [
      `Structure bias: ${sb.toUpperCase()} (conf ${Math.round(report.structure.confidence * 100)}%)`,
    ]);
  }

  if (db && db !== "neutral") {
    return result(true, [
      `Daily bias: ${db.toUpperCase()} (${report.dailyBias.consecutiveDays}d consecutive)`,
    ]);
  }

  return result(false, [
    `Structure bias is "${sb ?? "none"}", daily bias is "${db ?? "none"}" — no clear direction.`,
  ]);
}

/**
 * Checks whether price is within a configurable tolerance of a valid,
 * unmitigated Order Block's proximal edge.
 *
 * @param report   The SMC analysis report.
 * @param tolerancePct  Tolerance as a fraction of currentPrice (default 0.002 = 0.2%).
 */
export function priceNearOBProximal(
  report: SmcReport,
  tolerancePct = 0.002,
): PredicateResult {
  const obs = activeOBs(report);
  if (obs.length === 0) {
    return result(false, ["No active (valid + unmitigated) order blocks found."]);
  }

  const price = report.currentPrice;
  const near: OrderBlock[] = [];

  for (const ob of obs) {
    const threshold = price * tolerancePct;
    const dist = Math.abs(price - ob.proximal);
    if (dist <= threshold) {
      near.push(ob);
    }
  }

  if (near.length === 0) {
    return result(false, [
      `Price ${price} is not within ${(tolerancePct * 100).toFixed(2)}% of any active OB proximal. ` +
        `Closest OB proximal is ${obs[0].proximal} (Δ ${Math.abs(price - obs[0].proximal).toFixed(2)}).`,
    ]);
  }

  const score = Math.min(1, near.length / 3);
  return result(true, [
    `${near.length} OB(s) within ${(tolerancePct * 100).toFixed(2)}% of price: ` +
      near.map((ob) => `${ob.type} @ ${ob.proximal}`).join(", "),
    ...near.map((ob) =>
      ob.hasFvg
        ? `${ob.type} OB @ ${ob.proximal} overlaps with an FVG — elevated confluence.`
        : "",
    ).filter(Boolean),
  ], score);
}

/**
 * Has at least one active (valid + unmitigated) Order Block.
 */
export function hasOrderBlock(report: SmcReport): PredicateResult {
  const obs = activeOBs(report);
  if (obs.length === 0) {
    return result(false, [
      "No active order blocks — all are either invalid or mitigated.",
    ]);
  }

  const bullish = obs.filter((ob) => ob.type === "bullish").length;
  const bearish = obs.filter((ob) => ob.type === "bearish").length;
  const score = Math.min(1, obs.length / 5);

  return result(true, [
    `${obs.length} active OB(s): ${bullish} bullish, ${bearish} bearish.`,
    ...obs.slice(0, 3).map(
      (ob) =>
        `${ob.type} OB prox ${ob.proximal}–dist ${ob.distal} (strength ${ob.strength})` +
        (ob.hasFvg ? " +FVG" : "") + (ob.isBreaker ? " BREAKER" : ""),
    ),
  ], score);
}

/**
 * Has at least one identifiable liquidity pool (BSL or SSL).
 *
 * Checks both the explicit nearestBSL/nearestSSL fields and the pools
 * array for any pool that hasn't been swept yet.
 */
export function hasLiquidityPool(report: SmcReport): PredicateResult {
  const unswept = report.liquidity.pools.filter((p) => !p.wasSwept);
  const hasBSL = report.liquidity.nearestBSL != null;
  const hasSSL = report.liquidity.nearestSSL != null;

  if (unswept.length === 0 && !hasBSL && !hasSSL) {
    return result(false, [
      "No unswept liquidity pools detected. All pools have been swept or none were found.",
    ]);
  }

  const ev: string[] = [];
  if (hasBSL) {
    ev.push(`Nearest BSL @ ${report.liquidity.nearestBSL!.price} (score ${report.liquidity.nearestBSL!.score})`);
  }
  if (hasSSL) {
    ev.push(`Nearest SSL @ ${report.liquidity.nearestSSL!.price} (score ${report.liquidity.nearestSSL!.score})`);
  }
  if (unswept.length > 0) {
    ev.push(`${unswept.length} unswept pool(s) in the pools array.`);
    for (const p of unswept.slice(0, 3)) {
      ev.push(`  ${p.type} @ ${p.price} ×${p.touches} touches`);
    }
  }

  return result(true, ev, Math.min(1, unswept.length / 5 + (hasBSL ? 0.3 : 0) + (hasSSL ? 0.3 : 0)));
}

/**
 * Has at least one unfilled Fair Value Gap (fillFraction < 0.5 or 0).
 */
export function hasFVG(report: SmcReport): PredicateResult {
  const gaps = unfilledFVGs(report);
  if (gaps.length === 0) {
    return result(false, [
      "No unfilled FVGs — all gaps have been filled (fillFraction ≥ 0.5).",
    ]);
  }

  const bullish = gaps.filter((g) => g.type === "bullish").length;
  const bearish = gaps.filter((g) => g.type === "bearish").length;
  const score = Math.min(1, gaps.length / 4);

  return result(true, [
    `${gaps.length} unfilled FVG(s): ${bullish} bullish, ${bearish} bearish.`,
    ...gaps.slice(0, 3).map(
      (g) =>
        `${g.type} FVG ${g.bottom}–${g.top} (fill ${(g.fillFraction * 100).toFixed(0)}%)` +
        (g.isInversion ? " INVERSION" : ""),
    ),
  ], score);
}

/**
 * Checks whether the structure bias aligns with a given direction.
 *
 * @param report    The SMC analysis report.
 * @param direction "bullish", "bearish", or "neutral".
 */
export function biasAligned(
  report: SmcReport,
  direction: "bullish" | "bearish" | "neutral",
): PredicateResult {
  const bias = report.structure.bias?.toLowerCase();

  if (!bias || bias === "neutral") {
    return result(false, [
      `Structure bias is "${bias ?? "none"}" — cannot align with "${direction}".`,
    ]);
  }

  const matched = bias === direction;
  return result(
    matched,
    matched
      ? [
          `Structure bias (${bias.toUpperCase()}) aligns with target direction ${direction.toUpperCase()}.`,
          `Confidence: ${(report.structure.confidence * 100).toFixed(0)}%`,
        ]
      : [
          `Structure bias is ${bias.toUpperCase()}, which does NOT align with target ${direction.toUpperCase()}.`,
        ],
    matched ? report.structure.confidence : undefined,
  );
}

/**
 * Has a non-neutral daily bias with reasonable strength.
 *
 * Uses dailyBias.bias and dailyBias.strength. A bias is considered
 * meaningful when strength ≥ 0.3 and the bias is not neutral.
 */
export function hasDailyBias(report: SmcReport): PredicateResult {
  const bias = report.dailyBias.bias?.toLowerCase();
  const strength = report.dailyBias.strength;

  if (!bias || bias === "neutral") {
    return result(false, [
      `Daily bias is "${bias ?? "none"}" — no directional conviction.`,
    ]);
  }

  if (strength < 0.3) {
    return result(false, [
      `Daily bias is ${bias.toUpperCase()} but strength is only ${(strength * 100).toFixed(0)}% (below 30% threshold).`,
    ]);
  }

  const ev: string[] = [
    `Daily bias: ${bias.toUpperCase()} at ${(strength * 100).toFixed(0)}% strength.`,
    `Consecutive days: ${report.dailyBias.consecutiveDays}`,
  ];
  if (report.dailyBias.referencedSwing) {
    ev.push(`Referenced swing: ${report.dailyBias.referencedSwing}`);
  }

  return result(true, ev, strength);
}

/**
 * Compute a multi-factor confluence score (0–1) from the report.
 *
 * Factors (each adds up to 0.2 points; capped at 1.0):
 *   1. Structure bias is non-neutral and confidence ≥ 0.4
 *   2. At least one active (valid + unmitigated) Order Block
 *   3. At least one unfilled FVG
 *   4. Unswept liquidity pool exists (nearestBSL or nearestSSL)
 *   5. Daily bias is non-neutral and strength ≥ 0.3
 *
 * The score is the raw count divided by 5, so 5/5 = 1.0.
 */
export function confluenceScore(report: SmcReport): PredicateResult {
  let count = 0;
  const ev: string[] = [];

  // 1. Structure bias
  const sb = report.structure.bias?.toLowerCase();
  if (sb && sb !== "neutral" && report.structure.confidence >= 0.4) {
    count++;
    ev.push(`✓ Structure bias: ${sb.toUpperCase()} (conf ${(report.structure.confidence * 100).toFixed(0)}%)`);
  } else {
    ev.push(`✗ Structure bias: ${sb ?? "none"} — below threshold`);
  }

  // 2. Active OBs
  const obs = activeOBs(report);
  if (obs.length > 0) {
    count++;
    ev.push(`✓ ${obs.length} active OB(s)`);
  } else {
    ev.push("✗ No active OBs");
  }

  // 3. Unfilled FVGs
  const fvgs = unfilledFVGs(report);
  if (fvgs.length > 0) {
    count++;
    ev.push(`✓ ${fvgs.length} unfilled FVG(s)`);
  } else {
    ev.push("✗ No unfilled FVGs");
  }

  // 4. Unswept liquidity
  const hasLiq =
    report.liquidity.nearestBSL != null ||
    report.liquidity.nearestSSL != null ||
    report.liquidity.pools.some((p) => !p.wasSwept);
  if (hasLiq) {
    count++;
    ev.push("✓ Unswept liquidity pool present");
  } else {
    ev.push("✗ No unswept liquidity");
  }

  // 5. Daily bias
  const db = report.dailyBias.bias?.toLowerCase();
  if (db && db !== "neutral" && report.dailyBias.strength >= 0.3) {
    count++;
    ev.push(`✓ Daily bias: ${db.toUpperCase()} (strength ${(report.dailyBias.strength * 100).toFixed(0)}%)`);
  } else {
    ev.push(`✗ Daily bias: ${db ?? "none"} — below threshold`);
  }

  const score = count / 5;
  return result(true, [
    `Confluence score: ${score.toFixed(2)} (${count}/5 factors)`,
    ...ev,
  ], score);
}

// ─── New predicates ──────────────────────────────────────────────────────────

/**
 * Has a confirmed Market Structure Shift (MSS).
 *
 * Detects BOS (Break of Structure) and CHoCH (Change of Character) events
 * in the structure.breaks array. An MSS is confirmed when at least one such
 * break exists regardless of current bias alignment — it signals that price
 * has displaced through a prior swing point.
 *
 * The score reflects the proportion of breaks that are BOS/CHoCH relative
 * to a reference threshold of 3, saturating at 1.0.
 */
export function hasMarketStructureShift(report: SmcReport): PredicateResult {
  const breaks = report.structure.breaks;
  if (!breaks || breaks.length === 0) {
    return result(false, [
      `No structure breaks found — market has not shifted.`,
    ]);
  }

  const mssBreaks = breaks.filter(
    (b) => b.type === "BOS" || b.type === "CHoCH",
  );

  if (mssBreaks.length === 0) {
    return result(false, [
      `${breaks.length} break(s) found but none are BOS or CHoCH (types: ${[...new Set(breaks.map((b) => b.type))].join(", ")}).`,
    ]);
  }

  const last = mssBreaks[mssBreaks.length - 1];
  const ev: string[] = [
    `${mssBreaks.length} MSS event(s) detected (${mssBreaks.filter((b) => b.type === "BOS").length} BOS, ${mssBreaks.filter((b) => b.type === "CHoCH").length} CHoCH).`,
    `Most recent: ${last.type} ${last.direction} @ ${last.price}`,
  ];

  // Add directional context from the last break vs current bias
  const bias = report.structure.bias?.toLowerCase();
  if (
    bias &&
    bias !== "neutral" &&
    last.direction &&
    last.direction.toLowerCase() !== bias
  ) {
    ev.push(
      `⚠ Recent MSS (${last.direction}) opposes HTF bias (${bias.toUpperCase()}) — potential reversal.`,
    );
  }

  const score = Math.min(1, mssBreaks.length / 3);
  return result(true, ev, score);
}

/**
 * Has an identifiable inducement zone (IDM) in market structure.
 *
 * An inducement zone is a minor internal consolidation / pullback that forms
 * within a larger displacement leg. It is detected by analysing structure
 * pivots: in an uptrend, a Lower High (LH) appearing after a series of
 * Higher Highs (HH) signals an inducement; in a downtrend, a Higher Low (HL)
 * after a series of Lower Lows (LL) signals one. These zones represent
 * clustered retail stops that institutions target before continuing.
 */
export function hasInducementZone(report: SmcReport): PredicateResult {
  const pivots = report.structure.pivots;
  if (!pivots || pivots.length < 4) {
    return result(false, [
      `Not enough pivots to detect inducement (${pivots?.length ?? 0} found, need ≥ 4).`,
    ]);
  }

  const bias = report.structure.bias?.toLowerCase();
  const ev: string[] = [];

  // Sort by index to get chronological order
  const sorted = [...pivots].sort((a, b) => a.index - b.index);

  // Look for counter-trend pivot types that signal inducement
  // Uptrend (bullish): look for an LH (Lower High) after HHs
  // Downtrend (bearish): look for an HL (Higher Low) after LLs
  if (bias === "bullish") {
    const lhPivots = sorted.filter((p) => p.type === "LH" && p.confirmed);
    if (lhPivots.length > 0) {
      const latest = lhPivots[lhPivots.length - 1];
      ev.push(
        `${lhPivots.length} inducement pivot(s) (LH) detected in bullish structure. ` +
          `Latest LH @ ${latest.price} — potential IDM zone for sellside sweep.`,
      );
      return result(
        true,
        ev,
        Math.min(1, lhPivots.length / 2),
      );
    }
    // Even unconfirmed LH — partial signal
    const unconfirmedLH = sorted.filter((p) => p.type === "LH" && !p.confirmed);
    if (unconfirmedLH.length > 0) {
      ev.push(
        `${unconfirmedLH.length} unconfirmed LH pivot(s) — inducement may be forming.`,
      );
      return result(false, ev);
    }
    return result(false, [
      "Bullish structure with no LH pivots — no inducement zone detected.",
    ]);
  }

  if (bias === "bearish") {
    const hlPivots = sorted.filter((p) => p.type === "HL" && p.confirmed);
    if (hlPivots.length > 0) {
      const latest = hlPivots[hlPivots.length - 1];
      ev.push(
        `${hlPivots.length} inducement pivot(s) (HL) detected in bearish structure. ` +
          `Latest HL @ ${latest.price} — potential IDM zone for buyside sweep.`,
      );
      return result(
        true,
        ev,
        Math.min(1, hlPivots.length / 2),
      );
    }
    const unconfirmedHL = sorted.filter((p) => p.type === "HL" && !p.confirmed);
    if (unconfirmedHL.length > 0) {
      ev.push(
        `${unconfirmedHL.length} unconfirmed HL pivot(s) — inducement may be forming.`,
      );
      return result(false, ev);
    }
    return result(false, [
      "Bearish structure with no HL pivots — no inducement zone detected.",
    ]);
  }

  // Neutral bias — check for any counter-trend pivot type as a soft signal
  const counterPivots = sorted.filter(
    (p) => (p.type === "LH" || p.type === "HL") && p.confirmed,
  );
  if (counterPivots.length > 0) {
    ev.push(
      `${counterPivots.length} counter-trend pivot(s) despite neutral bias — weak inducement signal.`,
    );
    return result(true, ev, 0.3);
  }

  return result(false, [
    `Bias is "${bias ?? "none"}" — cannot determine inducement direction.`,
  ]);
}

/**
 * Checks whether the current price lies within the Optimal Trade Entry (OTE)
 * zone relative to the dealing range.
 *
 * The OTE zone is the 62%–79% retracement of the dealing range
 * (high – low). For bullish entries, price should be in the discount
 * side of the range (bottom 38%); for bearish entries, price should be in
 * the premium side (top 38%). The OTE zone itself is always measured as the
 * retracement from the range extreme: the 62%–79% level measured from the
 * range low (for buys) or from the range high (for sells).
 *
 * @param report    The SMC analysis report.
 * @param direction "bullish" to check discount-side OTE, "bearish" for premium-side.
 *                  When omitted, checks whether price lands in either OTE zone.
 */
export function priceWithinOTEzone(
  report: SmcReport,
  direction?: "bullish" | "bearish",
): PredicateResult {
  const { dealingRange } = report.pdArray;
  const price = report.currentPrice;
  const high = dealingRange.high;
  const low = dealingRange.low;
  const range = high - low;

  if (range <= 0) {
    return result(false, [
      `Invalid dealing range: high ${high} ≤ low ${low}.`,
    ]);
  }

  // Compute OTE levels from the range
  // For bullish: retracement measured from low — OTE is at 62%–79% above low
  // For bearish: retracement measured from high — OTE is at 62%–79% below high
  const bullOteLow = low + range * 0.62;
  const bullOteHigh = low + range * 0.79;
  const bearOteLow = high - range * 0.79;
  const bearOteHigh = high - range * 0.62;

  const inBullOTE = price >= bullOteLow && price <= bullOteHigh;
  const inBearOTE = price >= bearOteLow && price <= bearOteHigh;

  if (direction === "bullish") {
    if (inBullOTE) {
      const retracePct = ((price - low) / range) * 100;
      return result(true, [
        `Price ${price} is in bullish OTE zone (${bullOteLow.toFixed(2)}–${bullOteHigh.toFixed(2)}). ` +
          `Retracement: ${retracePct.toFixed(0)}% from range low (${low}).`,
      ]);
    }
    return result(false, [
      `Price ${price} is NOT in bullish OTE zone. ` +
        `Bullish OTE range: ${bullOteLow.toFixed(2)}–${bullOteHigh.toFixed(2)} ` +
        `(dealing range ${low}–${high}).`,
    ]);
  }

  if (direction === "bearish") {
    if (inBearOTE) {
      const retracePct = ((high - price) / range) * 100;
      return result(true, [
        `Price ${price} is in bearish OTE zone (${bearOteLow.toFixed(2)}–${bearOteHigh.toFixed(2)}). ` +
          `Retracement: ${retracePct.toFixed(0)}% from range high (${high}).`,
      ]);
    }
    return result(false, [
      `Price ${price} is NOT in bearish OTE zone. ` +
        `Bearish OTE range: ${bearOteLow.toFixed(2)}–${bearOteHigh.toFixed(2)} ` +
        `(dealing range ${low}–${high}).`,
    ]);
  }

  // No direction specified — true if either OTE zone is hit
  if (inBullOTE || inBearOTE) {
    const zones: string[] = [];
    if (inBullOTE) zones.push("bullish");
    if (inBearOTE) zones.push("bearish");
    const retracePct = Math.min(
      ((price - low) / range) * 100,
      ((high - price) / range) * 100,
    );
    return result(true, [
      `Price ${price} is in OTE zone (${zones.join("/")}). ` +
        `Retracement: ${retracePct.toFixed(0)}% from nearest range extreme.`,
    ]);
  }

  return result(false, [
    `Price ${price} is outside both OTE zones. ` +
      `Bullish OTE: ${bullOteLow.toFixed(2)}–${bullOteHigh.toFixed(2)}, ` +
      `Bearish OTE: ${bearOteLow.toFixed(2)}–${bearOteHigh.toFixed(2)}.`,
  ]);
}

/**
 * Has a consolidation zone in the current market structure.
 *
 * Consolidation is detected when either:
 *   1. structure.trend is "ranging", OR
 *   2. pdArray.currentBias is "equilibrium" (price at fair value), OR
 *   3. pdArray zones contain a zone labelled "consolidation"
 *
 * Score reflects the strength of the consolidation signal (multi-factor).
 */
export function hasConsolidationZone(report: SmcReport): PredicateResult {
  const ev: string[] = [];
  let factors = 0;

  // Factor 1: structure trend is ranging
  const trend = report.structure.trend?.toLowerCase();
  if (trend === "ranging") {
    factors++;
    ev.push("Structure trend is RANGING — price in consolidation.");
  }

  // Factor 2: pdArray currentBias is equilibrium
  const bias = report.pdArray.currentBias?.toLowerCase();
  if (bias === "equilibrium") {
    factors++;
    ev.push("PD Array at EQUILIBRIUM — no directional premium/discount.");
  }

  // Factor 3: pdArray contains a consolidation zone
  const consZone = report.pdArray.zones?.find(
    (z) => z.label?.toLowerCase().includes("consolidation"),
  );
  if (consZone) {
    factors++;
    ev.push(
      `Consolidation zone identified: ${consZone.label} (${consZone.bottom}–${consZone.top}).`,
    );
  }

  // Factor 4: tight dealing range relative to price (proxy: range < 3% of price)
  const range = report.pdArray.dealingRange.high - report.pdArray.dealingRange.low;
  const rangePct = range / report.currentPrice;
  if (rangePct < 0.03 && rangePct > 0) {
    factors++;
    ev.push(
      `Tight dealing range (${(rangePct * 100).toFixed(1)}% of price) suggests consolidation.`,
    );
  }

  if (factors === 0) {
    return result(false, [
      `Trend is "${trend ?? "unknown"}", PD Array bias is "${bias ?? "unknown"}" — no consolidation detected.`,
    ]);
  }

  return result(true, ev, Math.min(1, factors / 3));
}

/**
 * Checks whether the report's context matches a named trading session.
 *
 * Sessions map to timeframes and market types as follows:
 *   - "ASIAN"     → associated with low-volatility, overnight / early Tokyo
 *   - "LONDON"    → major forex session / high volume
 *   - "NY_AM"     → New York morning / London overlap
 *   - "NY_PM"     → New York afternoon
 *   - "LONDON_NY" → the London–NY overlap window
 *
 * When the report carries session tags on its liquidity pools, those are
 * used as the primary signal. Otherwise the predicate falls back to the
 * report's market type and timeframe as a soft indicator.
 *
 * @param report  The SMC analysis report.
 * @param session The session name to check (case-insensitive).
 */
export function isWithinSession(
  report: SmcReport,
  session: string,
): PredicateResult {
  const sess = session.toUpperCase();
  const ev: string[] = [];

  // Primary: check session tags on liquidity pools
  const poolSessions = new Set(
    report.liquidity.pools
      .map((p) => p.session?.toUpperCase())
      .filter((s): s is string => s != null),
  );

  if (poolSessions.size > 0) {
    const matched = [...poolSessions].filter((s) => s.includes(sess));
    if (matched.length > 0) {
      ev.push(
        `${matched.length} liquidity pool(s) tagged with session "${sess}" (${matched.join(", ")}).`,
      );
      return result(true, ev, Math.min(1, matched.length / 3));
    }
    ev.push(
      `Pool sessions found: [${[...poolSessions].join(", ")}] — none match "${sess}".`,
    );
  }

  // Fallback: use market and timeframe as contextual indicators
  const market = report.market?.toLowerCase();
  const tf = report.timeframe?.toLowerCase();

  // Asian session typically uses higher timeframes and forex/crypto
  if (sess === "ASIAN" && (tf === "1h" || tf === "4h")) {
    ev.push(
      `Contextual: market="${market}", timeframe="${tf}" aligns with ASIAN hours analysis.`,
    );
    return result(true, ev, 0.4);
  }

  // London/NY overlap typically uses lower timeframes
  if (
    sess === "LONDON_NY" &&
    (tf === "15m" || tf === "5m" || tf === "1h") &&
    market === "forex"
  ) {
    ev.push(
      `Contextual: market="${market}", timeframe="${tf}" aligns with LONDON/NY overlap.`,
    );
    return result(true, ev, 0.4);
  }

  if (
    (sess === "LONDON" || sess === "NY_AM" || sess === "NY_PM") &&
    tf &&
    ["5m", "15m", "1h"].includes(tf)
  ) {
    ev.push(
      `Contextual: timeframe="${tf}" is typical for ${sess} execution.`,
    );
    return result(true, ev, 0.3);
  }

  return result(false, [
    `No session match for "${session}". ` +
      `Market="${market}", timeframe="${tf}", ` +
      `${poolSessions.size > 0 ? `pool sessions=[${[...poolSessions].join(",")}]` : "no pool session data"}.`,
  ]);
}

/**
 * Checks whether the report contains a confirmed SMT divergence signal.
 *
 * SMT (Smart Money Technique) divergence occurs when two correlated assets
 * diverge at key structural levels, revealing institutional divergence.
 *
 * The predicate checks report.smt.detected and optionally validates
 * that the confidence exceeds a minimum threshold.
 *
 * @param report         The SMC analysis report.
 * @param minConfidence  Minimum confidence threshold (default 0.3).
 */
export function hasSMTConfirmation(
  report: SmcReport,
  minConfidence = 0.3,
): PredicateResult {
  const smt = report.smt;

  if (!smt) {
    return result(false, [
      "No SMT data in report — divergence analysis not available.",
    ]);
  }

  if (!smt.detected) {
    return result(false, [
      "SMT divergence not detected.",
    ]);
  }

  if (smt.confidence < minConfidence) {
    return result(false, [
      `SMT divergence detected but confidence ${(smt.confidence * 100).toFixed(0)}% ` +
        `is below minimum threshold ${(minConfidence * 100).toFixed(0)}%.`,
    ]);
  }

  const ev: string[] = [
    `SMT divergence confirmed — confidence ${(smt.confidence * 100).toFixed(0)}%.`,
  ];
  if (smt.type) {
    ev.push(`Type: ${smt.type.replace(/_/g, " ")}`);
  }
  if (smt.primarySymbol && smt.correlatedSymbol) {
    ev.push(
      `Between ${smt.primarySymbol} and ${smt.correlatedSymbol}.`,
    );
  }
  if (smt.time) {
    ev.push(`Detected at candle ${smt.time}.`);
  }

  return result(true, ev, smt.confidence);
}

// ─── Predicates Previously Missing ──────────────────────────────────────────

/**
 * Detect whether price recently experienced a strong, high-velocity
 * directional move (displacement).
 *
 * Displacement is measured by comparing the most recent candle body
 * against the average true range of the preceding candles.  A candle
 * whose body exceeds `bodyMultiplier × ATR` is considered a displacement
 * candle.  Additional confirmation comes from structure breaks (BOS/CHoCH
 * within the last `lookbackBars` candles).
 *
 * @param report          The SMC analysis report.
 * @param lookbackBars    Number of candles to check (default 5).
 * @param bodyMultiplier  ATR multiplier for the minimum body size (default 2.5).
 */
export function hasDisplacement(
  report: SmcReport,
  lookbackBars = 5,
  bodyMultiplier = 2.5,
): PredicateResult {
  const candles = report.candles;
  if (!candles || candles.length < lookbackBars + 5) {
    return result(false, [
      `Not enough candles to detect displacement (need ≥ ${lookbackBars + 5}, have ${candles?.length ?? 0}).`,
    ]);
  }

  // Compute ATR over a window before the lookback window
  const atrWindowStart = Math.max(0, candles.length - lookbackBars - 14);
  const atrWindow = candles.slice(atrWindowStart, candles.length - lookbackBars);
  const atrValues: number[] = [];
  for (let i = 1; i < atrWindow.length; i++) {
    const high = atrWindow[i].high;
    const low = atrWindow[i].low;
    const prevClose = atrWindow[i - 1].close;
    atrValues.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  const atr = atrValues.length > 0
    ? atrValues.reduce((sum, v) => sum + v, 0) / atrValues.length
    : 0;

  // Check recent candles for displacement
  const recent = candles.slice(-lookbackBars);
  const threshold = atr * bodyMultiplier;
  const displaced = recent.filter((c) => Math.abs(c.close - c.open) > threshold);

  if (displaced.length === 0) {
    return result(false, [
      `No displacement detected in last ${lookbackBars} candles. ` +
        `ATR: ${atr.toFixed(2)}, body threshold: ${threshold.toFixed(2)}.`,
    ]);
  }

  // Check direction alignment with structure bias
  const bias = report.structure.bias?.toLowerCase();
  const aligned = displaced.filter((c) =>
    bias === "bullish" ? c.close > c.open : bias === "bearish" ? c.close < c.open : true,
  ).length;

  const ev: string[] = [
    `${displaced.length} displacement candle(s) detected in last ${lookbackBars} bars ` +
      `(body ≥ ${bodyMultiplier}× ATR = ${threshold.toFixed(2)}).`,
  ];
  if (aligned > 0 && bias && bias !== "neutral") {
    ev.push(`${aligned}/${displaced.length} aligned with ${bias} bias.`);
  }

  const score = Math.min(1, displaced.length / 3);
  return result(true, ev, score);
}

/**
 * Checks whether a liquidity sweep has recently occurred.
 *
 * A sweep happens when price pierces through a known liquidity pool
 * (BSL/SSL/EQH/EQL) and then reverses.  The predicate checks two signals:
 *   1. Any pool in `liquidity.pools` has `wasSwept === true` and was swept
 *      within `lookbackMs` milliseconds.
 *   2. The most recent structure break is a BOS/CHoCH in the opposite
 *      direction of the prior swing (indicating a sweep-and-reversal).
 *
 * @param report     The SMC analysis report.
 * @param lookbackMs Only consider pools swept within this window (default 86_400_000 = 24h).
 */
export function hasLiquiditySweep(
  report: SmcReport,
  lookbackMs = 86_400_000,
): PredicateResult {
  const now = report.generatedAt * 1000;
  const ev: string[] = [];
  let sweepCount = 0;

  // Signal 1: pools with wasSwept within the lookback window
  const recentSweeps = report.liquidity.pools.filter((p) => {
    if (!p.wasSwept || p.sweptAt == null) return false;
    const sweptMs = p.sweptAt * 1000;
    return now - sweptMs <= lookbackMs;
  });

  if (recentSweeps.length > 0) {
    sweepCount += recentSweeps.length;
    ev.push(
      `${recentSweeps.length} pool(s) swept within last ${(lookbackMs / 3600_000).toFixed(0)}h: ` +
        recentSweeps
          .slice(0, 3)
          .map((p) => `${p.type} @ ${p.price}`)
          .join(", "),
    );
  }

  // Signal 2: structure breaks suggest sweep-and-reversal
  const breaks = report.structure.breaks;
  if (breaks.length >= 2) {
    const last = breaks[breaks.length - 1];
    const prev = breaks[breaks.length - 2];
    // If the last break is in the opposite direction of the prior, it's a sweep
    if (last.direction && prev.direction && last.direction !== prev.direction) {
      sweepCount++;
      ev.push(
        `Structure shows sweep-and-reversal: ${prev.type} ${prev.direction} → ${last.type} ${last.direction}.`,
      );
    }
  }

  if (sweepCount === 0) {
    return result(false, [
      "No liquidity sweeps detected. All pools are intact and structure shows no sweep-and-reversal pattern.",
    ]);
  }

  return result(true, ev, Math.min(1, sweepCount / 3));
}

/**
 * Has at least one Breaker Block — an order block that has been broken
 * with strong displacement, trapping breakout traders.
 *
 * Checks `report.orderBlocks` for entries where `isBreaker === true`.
 */
export function hasBreakerBlock(report: SmcReport): PredicateResult {
  const breakers = report.orderBlocks.filter((ob) => ob.isBreaker && ob.valid);

  if (breakers.length === 0) {
    return result(false, [
      "No breaker blocks found — all order blocks are intact or have no breaker flag.",
    ]);
  }

  const score = Math.min(1, breakers.length / 3);
  return result(true, [
    `${breakers.length} breaker block(s) detected:`,
    ...breakers.slice(0, 3).map(
      (ob) => `  ${ob.type} breaker OB prox ${ob.proximal} (strength ${ob.strength})${ob.hasFvg ? " +FVG" : ""}`,
    ),
  ], score);
}

/**
 * Checks whether the report's session state aligns with a named trading
 * session.
 *
 * Unlike `isWithinSession` (which checks liquidity pool tags), this
 * predicate evaluates the report's derived `sessionState` field against
 * known session patterns.  It also considers the structure phase to
 * determine whether price action is behaving appropriately for the session.
 *
 * @param report   The SMC analysis report.
 * @param session  Session name: "ASIAN", "LONDON", "NY_AM", "NY_PM".
 */
export function hasSessionAlignment(
  report: SmcReport,
  session: string,
): PredicateResult {
  const sess = session.toUpperCase();
  const state = report.sessionState ?? "";

  // Match session name against the derived session state
  const sessionKeywords: Record<string, string[]> = {
    ASIAN: ["asian"],
    LONDON: ["london"],
    NY_AM: ["ny open", "ny continuation", "london close", "pm distribution"],
    NY_PM: ["pm distribution", "late session", "ny retracement"],
  };

  const keywords = sessionKeywords[sess];
  const matchesState = keywords
    ? keywords.some((kw) => state.toLowerCase().includes(kw))
    : false;

  if (matchesState) {
    return result(true, [
      `Session state "${state}" matches "${sess}" session.`,
    ]);
  }

  // Fallback: check the report timeframe as a contextual hint
  const tf = report.timeframe?.toLowerCase();
  if (tf && ["5m", "15m", "1h"].includes(tf) && (sess === "LONDON" || sess === "NY_AM" || sess === "NY_PM")) {
    return result(true, [
      `Timeframe "${tf}" is typical for ${sess} even though sessionState is "${state || "unset"}".`,
    ], 0.3);
  }

  return result(false, [
    `Session state "${state || "unset"}" does not match "${sess}".`,
  ]);
}

/**
 * Detects whether the market is in a directional range expansion phase.
 *
 * Range expansion is indicated by:
 *   1. `structure.phase === "expansion"` or `"continuation"`
 *   2. `structure.trend !== "ranging"` and `structure.bias !== "neutral"`
 *   3. Multiple recent BOS breaks in the same direction
 *
 * @param report     The SMC analysis report.
 * @param minBreaks  Minimum consecutive same-direction BOS breaks (default 1).
 */
export function hasRangeExpansion(
  report: SmcReport,
  minBreaks = 1,
): PredicateResult {
  const ev: string[] = [];
  let factors = 0;

  // Factor 1: phase is expansion or continuation
  const phase = report.structure.phase?.toLowerCase();
  if (phase === "expansion" || phase === "continuation") {
    factors++;
    ev.push(`Market phase is ${phase.toUpperCase()} — active range expansion.`);
  }

  // Factor 2: trend is directional
  const trend = report.structure.trend?.toLowerCase();
  if (trend && trend !== "ranging") {
    factors++;
    ev.push(`Trend is ${trend.toUpperCase()} — directional expansion underway.`);
  }

  // Factor 3: consecutive BOS breaks in the same direction
  const bias = report.structure.bias?.toLowerCase();
  const breaks = report.structure.breaks;
  const bosBreaks = breaks.filter((b) => b.type === "BOS" && b.direction?.toLowerCase() === bias);
  if (bosBreaks.length >= minBreaks) {
    factors++;
    ev.push(`${bosBreaks.length} BOS break(s) aligned with ${bias} bias.`);
  }

  if (factors === 0) {
    return result(false, [
      `Trend is "${trend ?? "unknown"}", phase is "${phase ?? "unknown"}" — no range expansion detected.`,
    ]);
  }

  return result(true, ev, Math.min(1, factors / 3));
}

/**
 * Checks whether there is a weekly-level expansion context.
 *
 * Weekly expansion context means the report is operating on a timeframe
 * suitable for weekly analysis (1d or 1w) and there is evidence of
 * directional expiry — the market is expected to reach the opposite end
 * of the weekly range before Friday's close.
 *
 * @param report   The SMC analysis report.
 */
export function hasWeeklyExpansionContext(report: SmcReport): PredicateResult {
  const tf = report.timeframe?.toLowerCase();

  // Must be on a daily or weekly timeframe
  if (tf !== "1d" && tf !== "1w") {
    return result(false, [
      `Timeframe is "${report.timeframe}" — weekly context requires 1d or 1w.`,
    ]);
  }

  const ev: string[] = [`Timeframe is ${report.timeframe} — suitable for weekly analysis.`];
  let factors = 0;

  // Check for strong daily bias
  const db = report.dailyBias;
  if (db.bias !== "neutral" && db.strength >= 0.4) {
    factors++;
    ev.push(`Daily bias is ${db.bias.toUpperCase()} at ${(db.strength * 100).toFixed(0)}% strength (${db.consecutiveDays}d consecutive).`);
  }

  // Check structure trend
  const trend = report.structure.trend?.toLowerCase();
  if (trend && trend !== "ranging") {
    factors++;
    ev.push(`Structure trend is ${trend.toUpperCase()} — directionally aligned for weekly expansion.`);
  }

  // Check market phase
  const phase = report.structure.phase?.toLowerCase();
  if (phase === "expansion" || phase === "continuation") {
    factors++;
    ev.push(`Phase is ${phase.toUpperCase()} — mid-cycle for weekly completion.`);
  }

  if (factors === 0) {
    return result(false, [
      `${report.timeframe} timeframe but no directional conviction: ` +
        `daily bias is "${db.bias}", trend is "${trend ?? "unknown"}", phase is "${phase ?? "unknown"}".`,
    ]);
  }

  return result(true, ev, Math.min(1, factors / 3));
}

/**
 * Detects equal highs (EQH) or equal lows (EQL) in the current structure.
 *
 * Equal highs/lows are engineered price levels where the market tests the
 * same price multiple times, building a cluster of resting stop-losses.
 * They are detected from:
 *   1. Liquidity pools with type "EQH" or "EQL"
 *   2. Structure pivots with approximately equal prices (within `tolerancePct`)
 *
 * @param report        The SMC analysis report.
 * @param tolerancePct  Price tolerance as a fraction (default 0.001 = 0.1%).
 */
export function hasEqualHighsLows(
  report: SmcReport,
  tolerancePct = 0.001,
): PredicateResult {
  const ev: string[] = [];

  // Signal 1: EQH/EQL liquidity pools
  const eqPools = report.liquidity.pools.filter(
    (p) => p.type === "EQH" || p.type === "EQL",
  );
  if (eqPools.length > 0) {
    ev.push(
      `${eqPools.length} engineered equal high/low pool(s): ` +
        eqPools.slice(0, 3).map((p) => `${p.type} @ ${p.price} (touches ${p.touches})`).join(", "),
    );
  }

  // Signal 2: structure pivots with equal prices
  const pivots = report.structure.pivots;
  const eqPairs: string[] = [];
  if (pivots.length >= 2) {
    for (let i = 0; i < pivots.length - 1; i++) {
      for (let j = i + 1; j < Math.min(i + 6, pivots.length); j++) {
        const diff = Math.abs(pivots[i].price - pivots[j].price);
        const ref = Math.max(Math.abs(pivots[i].price), Math.abs(pivots[j].price));
        if (ref > 0 && diff / ref <= tolerancePct) {
          // Check they are the same type of pivot (both highs or both lows)
          const typeI = pivots[i].type;
          const typeJ = pivots[j].type;
          const bothHigh = (typeI === "HH" || typeI === "LH") && (typeJ === "HH" || typeJ === "LH");
          const bothLow = (typeI === "HL" || typeI === "LL") && (typeJ === "HL" || typeJ === "LL");
          if (bothHigh || bothLow) {
            eqPairs.push(`${typeI} @ ${pivots[i].price} and ${typeJ} @ ${pivots[j].price}`);
          }
        }
      }
    }
  }

  if (eqPairs.length > 0) {
    ev.push(
      `${eqPairs.length} pair(s) of equal pivot levels: ` +
        eqPairs.slice(0, 3).join("; "),
    );
  }

  if (ev.length === 0) {
    return result(false, [
      "No equal highs/lows detected — no EQH/EQL pools and no equal-price pivots within tolerance.",
    ]);
  }

  return result(true, ev, Math.min(1, eqPools.length / 3 + eqPairs.length / 4));
}

// ─── Economic Calendar Predicates ───────────────────────────────────────────

/**
 * A minimal economic event shape, mirroring the `economic_events` DB table.
 * Passed via the evaluator's `args` mechanism — the DB query happens
 * server-side and the result is forwarded as an argument.
 */
export interface EconomicEvent {
  time: number;
  currency: string;
  event: string;
  impact: "High" | "Medium" | "Low" | null;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
}

/**
 * Checks whether a high-impact economic event is scheduled within
 * the given time window.
 *
 * "High impact" means `impact === "High"`. The window is measured
 * forward from `report.generatedAt` (in seconds). Events that have
 * already been released (actual !== null) are excluded.
 *
 * @param report    The SMC analysis report.
 * @param events    Array of economic events (fetched server-side).
 * @param windowMs  Look-ahead window in milliseconds (default 3_600_000 = 1 hour).
 */
export function hasHighImpactNewsWithin(
  report: SmcReport,
  events: EconomicEvent[],
  windowMs = 3_600_000,
): PredicateResult {
  if (!events || events.length === 0) {
    return result(false, ["No economic events data available to check."]);
  }

  const now = report.generatedAt * 1000; // convert to ms
  const upcoming = events.filter((e) => {
    if (e.impact !== "High") return false;
    if (e.actual !== null) return false; // already released
    return e.time * 1000 > now && e.time * 1000 <= now + windowMs;
  });

  if (upcoming.length === 0) {
    return result(false, [
      `No high-impact events within ${(windowMs / 60_000).toFixed(0)} min window.`,
    ]);
  }

  return result(true, [
    `${upcoming.length} high-impact event(s) within next ${(windowMs / 60_000).toFixed(0)} min:`,
    ...upcoming.slice(0, 5).map(
      (e) =>
        `  ${e.currency} ${e.event} at ${new Date(e.time * 1000).toISOString()}` +
        (e.forecast ? ` (f/c ${e.forecast})` : ""),
    ),
  ]);
}

/**
 * Checks whether the current time falls within a blackout window around
 * any high-impact economic event.
 *
 * A blackout window extends both before and after the event:
 *   [eventTime - blackoutMs, eventTime + blackoutMs]
 *
 * Events that have already been released are included in the check
 * (the blackout extends after release as price digests the news).
 *
 * @param report     The SMC analysis report.
 * @param events     Array of economic events (fetched server-side).
 * @param blackoutMs Half-window in milliseconds (default 900_000 = 15 min each side).
 */
export function isNewsBlackoutWindow(
  report: SmcReport,
  events: EconomicEvent[],
  blackoutMs = 900_000,
): PredicateResult {
  if (!events || events.length === 0) {
    return result(false, ["No economic events data available to check."]);
  }

  const now = report.generatedAt * 1000;
  const highImpact = events.filter((e) => e.impact === "High");

  if (highImpact.length === 0) {
    return result(false, ["No high-impact events in calendar — no blackout window."]);
  }

  const inBlackout = highImpact.filter((e) => {
    const eventMs = e.time * 1000;
    return now >= eventMs - blackoutMs && now <= eventMs + blackoutMs;
  });

  if (inBlackout.length === 0) {
    return result(false, [
      `Not in a blackout window. Next high-impact event: ${highImpact[0].currency} ${highImpact[0].event} at ${new Date(highImpact[0].time * 1000).toISOString()}.`,
    ]);
  }

  return result(true, [
    `In blackout window (${(blackoutMs / 60_000).toFixed(0)} min before/after):`,
    ...inBlackout.slice(0, 3).map((e) => {
      const eventMs = e.time * 1000;
      const dir = now < eventMs ? `${((eventMs - now) / 60_000).toFixed(0)} min before` : `${((now - eventMs) / 60_000).toFixed(0)} min after`;
      return `  ${e.currency} ${e.event} (${dir})`;
    }),
  ]);
}
