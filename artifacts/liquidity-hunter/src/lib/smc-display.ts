import type { SmcReport } from "@workspace/api-client-react";

/** TF short labels used across all components. */
export const TF_LABEL_MAP: Record<string, string> = {
  "1m": "M1", "5m": "M5", "15m": "M15",
  "1h": "H1", "4h": "H4", "1d": "D1", "1w": "W1",
};

/** Higher number = higher timeframe — used for cascade sorting. */
export const TF_WEIGHT: Record<string, number> = {
  "1m": 1, "5m": 2, "15m": 3, "1h": 4, "4h": 5, "1d": 6, "1w": 7,
};

export type Market = "crypto" | "forex";
export type Bias = "bullish" | "bearish" | "neutral";

/**
 * Format a price for display.
 * - Forex → 5 decimal places
 * - Crypto ≥ 10,000 → comma-separated, 2dp
 * - Crypto ≥ 1 → 4dp
 * - Sub-dollar → 6dp
 */
export function fmtPrice(p: number, market: Market): string {
  if (market === "forex") return p.toFixed(5);
  if (p >= 10000) return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(4);
  return p.toFixed(6);
}

/**
 * Resolve the dominant directional bias for a report.
 * Prefers structure bias, falls back to daily bias.
 */
export function getBias(report: SmcReport): Bias {
  const sb = report.structure.bias;
  const db = report.dailyBias.bias;
  if (sb !== "neutral") return sb as "bullish" | "bearish";
  if (db !== "neutral") return db as "bullish" | "bearish";
  return "neutral";
}

/**
 * Composite confidence score (0–100) from structure + daily bias.
 */
export function getConfidence(report: SmcReport): number {
  return Math.round(((report.structure.confidence + report.dailyBias.strength) / 2) * 100);
}

/**
 * Return the correct number of decimal places for price axis labels.
 */
export function priceDecimals(price: number, market: Market): number {
  if (market === "forex") return 5;
  if (price >= 1000) return 2;
  if (price >= 1) return 4;
  return 6;
}
