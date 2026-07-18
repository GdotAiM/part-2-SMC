/**
 * Narrative Generator — deterministic, template-based market commentary.
 *
 * Takes strategy detection results and a multi-timeframe report map,
 * returns a plain-English institutional narrative string covering:
 *   - Market direction (HTF bias + daily bias alignment)
 *   - Session context and structural phase
 *   - Liquidity direction (BSL / SSL sweeps)
 *   - Key levels (draw targets, dealing range, equilibrium)
 *   - Strategy overlay (matched strategies and conviction)
 *
 * No LLM involved — pure template instantiation from structured data.
 */

import type { SmcReport } from "../smc/types.js";

// ─── Input types ─────────────────────────────────────────────────────────────

export interface StrategyDetectionSummary {
  strategyId: string;
  strategyName: string;
  score: number;
  evidence: string[];
}

export interface NarrativeInput {
  /** Matched strategy detections (already filtered to status === "matched"). */
  detectedStrategies: StrategyDetectionSummary[];
  /** Timeframe-keyed SMC reports. At least one report must be present. */
  reportMap: Map<string, SmcReport>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtPrice(p: number, market: string): string {
  const m = market as "crypto" | "forex";
  if (m === "forex") return p.toFixed(5);
  if (p >= 10_000) return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(4);
  return p.toFixed(6);
}

function biasLabel(bias: string): string {
  switch (bias) {
    case "bullish": return "bullish";
    case "bearish": return "bearish";
    default: return "neutral / mixed";
  }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Templates ───────────────────────────────────────────────────────────────

interface NarrativeParts {
  direction: string;
  session: string;
  liquidity: string;
  levels: string;
  strategy: string;
}

function buildDirection(report: SmcReport): string {
  const sb = report.structure.bias;
  const db = report.dailyBias.bias;
  const conf = report.structure.confidence;
  const parts: string[] = [];

  if (sb !== "neutral") {
    parts.push(
      `Market structure is ${sb} with ${Math.round(conf * 100)}% confidence`,
    );
    parts.push(`trending ${report.structure.trend}`);
    if (report.structure.phase && report.structure.phase !== "unknown") {
      parts.push(`in ${report.structure.phase} phase`);
    }
  }

  if (db !== "neutral") {
    const align = sb === db ? "aligning with" : "diverging from";
    const days = report.dailyBias.consecutiveDays;
    parts.push(
      `daily bias is ${db} (${Math.round(report.dailyBias.strength * 100)}% strength, ${days}-day${days > 1 ? "s" : ""} consecutive) ${align} structure`,
    );
  }

  if (sb === "neutral" && db === "neutral") {
    parts.push("No clear directional bias — structure is ranging and daily bias is neutral");
  }

  return parts.join("; ") + ".";
}

function buildSession(report: SmcReport): string {
  const parts: string[] = [];
  if (report.sessionState && report.sessionState !== "Unknown" && report.sessionState !== "No data") {
    parts.push(report.sessionState);
  }
  const pdBias = report.pdArray.currentBias;
  if (pdBias && pdBias !== "equilibrium") {
    parts.push(`price is in ${pdBias} zone of the dealing range`);
  }
  if (report.dailyBias.referencedSwing) {
    parts.push(`referencing swing: ${report.dailyBias.referencedSwing}`);
  }
  return parts.length > 0
    ? cap(parts.join("; ")) + "."
    : "No session context available.";
}

function buildLiquidity(report: SmcReport): string {
  const liq = report.liquidity;
  const ev: string[] = [];

  const unswept = liq.pools.filter((p) => !p.wasSwept);

  if (liq.nearestBSL) {
    const pool = liq.nearestBSL;
    ev.push(
      `nearest buy-side liquidity (BSL) at ${fmtPrice(pool.price, report.market)} ` +
        `(score ${pool.score.toFixed(2)}, ${pool.touches} touch${pool.touches > 1 ? "es" : ""})`,
    );
  }
  if (liq.nearestSSL) {
    const pool = liq.nearestSSL;
    ev.push(
      `nearest sell-side liquidity (SSL) at ${fmtPrice(pool.price, report.market)} ` +
        `(score ${pool.score.toFixed(2)}, ${pool.touches} touch${pool.touches > 1 ? "es" : ""})`,
    );
  }

  if (ev.length === 0 && unswept.length > 0) {
    ev.push(
      `${unswept.length} unswept liquidity pool${unswept.length > 1 ? "s" : ""} identified`,
    );
  }

  // Directional inference
  if (liq.nearestBSL && liq.nearestSSL) {
    const bslDist = Math.abs(liq.nearestBSL.price - report.currentPrice);
    const sslDist = Math.abs(liq.nearestSSL.price - report.currentPrice);
    if (bslDist < sslDist) {
      ev.push("buy-side target is nearer — upward liquidity draw expected");
    } else {
      ev.push("sell-side target is nearer — downward liquidity draw expected");
    }
  } else if (liq.nearestBSL) {
    ev.push("only buy-side liquidity identified — upside target");
  } else if (liq.nearestSSL) {
    ev.push("only sell-side liquidity identified — downside target");
  }

  if (ev.length === 0) {
    return "No actionable liquidity pools identified — waiting for price to establish a clean level.";
  }

  return cap(ev.join("; ")) + ".";
}

function buildLevels(report: SmcReport): string {
  const ev: string[] = [];

  // Draw targets
  const topDraws = report.draw.slice(0, 3);
  if (topDraws.length > 0) {
    const levelStr = topDraws
      .map(
        (d) =>
          `${d.type} at ${fmtPrice(d.price, report.market)} (score ${d.score.toFixed(2)})`,
      )
      .join("; ");
    ev.push(`Primary draw targets: ${levelStr}`);
  }

  // Dealing range + equilibrium
  const dr = report.pdArray.dealingRange;
  const eq = report.pdArray.equilibrium;
  if (dr.high > dr.low) {
    ev.push(
      `Dealing range ${fmtPrice(dr.low, report.market)}–${fmtPrice(dr.high, report.market)} ` +
        `on ${dr.timeframe}`,
    );
    if (eq > 0) {
      ev.push(`equilibrium at ${fmtPrice(eq, report.market)}`);
    }
  }

  // Current price reference
  const price = report.currentPrice;
  if (price > 0) {
    ev.push(
      `Current price ${fmtPrice(price, report.market)} is ` +
        `${price > eq ? "above" : price < eq ? "below" : "at"} equilibrium`,
    );
  }

  if (ev.length === 0) {
    return "No key levels available.";
  }

  return cap(ev.join("; ")) + ".";
}

function buildStrategyOverlay(
  strategies: StrategyDetectionSummary[],
  primaryTf: string,
): string {
  if (strategies.length === 0) {
    return "";
  }
  // Sort by score descending
  const sorted = [...strategies].sort((a, b) => b.score - a.score);
  const top = sorted[0];

  const parts: string[] = [
    `Strategy overlay — ${top.strategyName} at ${Math.round(top.score * 100)}% confidence on ${primaryTf}`,
  ];

  if (sorted.length > 1) {
    const altStr = sorted
      .slice(1, 3)
      .map((s) => `${s.strategyName} (${Math.round(s.score * 100)}%)`)
      .join(", ");
    parts.push(`alternative setups: ${altStr}`);
  }

  return cap(parts.join("; ")) + ".";
}

// ─── Main generator ──────────────────────────────────────────────────────────

/**
 * Generate a deterministic institutional narrative from strategy detections
 * and multi-timeframe SMC reports.
 *
 * The narrative is assembled from five sections:
 *   1. Market direction — HTF bias, daily bias alignment, structural phase
 *   2. Session context — current ICT session state, PD Array position
 *   3. Liquidity direction — nearest BSL/SSL pools and directional inference
 *   4. Key levels — draw targets, dealing range, equilibrium, current price
 *   5. Strategy overlay — primary matched strategy and alternatives
 *
 * Sections 2–5 use the primary report (highest-weighted timeframe with data).
 * When no strategies are detected, the strategy overlay is omitted.
 *
 * @returns A multi-sentence narrative string.
 */
export function generateNarrative(input: NarrativeInput): string {
  const { detectedStrategies, reportMap } = input;

  if (reportMap.size === 0) {
    return "No SMC reports available for analysis.";
  }

  // Determine primary report: highest TF weight wins
  const TF_ORDER = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"];
  const sortedTfs = [...reportMap.keys()].sort(
    (a, b) => TF_ORDER.indexOf(b) - TF_ORDER.indexOf(a),
  );
  const primaryTf = sortedTfs[0];
  const primary = reportMap.get(primaryTf)!;

  const sections: NarrativeParts = {
    direction: buildDirection(primary),
    session: buildSession(primary),
    liquidity: buildLiquidity(primary),
    levels: buildLevels(primary),
    strategy: buildStrategyOverlay(detectedStrategies, primaryTf),
  };

  const lines: string[] = [];
  lines.push(sections.direction);
  lines.push(sections.session);
  lines.push(sections.liquidity);
  lines.push(sections.levels);
  if (sections.strategy) {
    lines.push(sections.strategy);
  }

  return lines.join("\n\n");
}
