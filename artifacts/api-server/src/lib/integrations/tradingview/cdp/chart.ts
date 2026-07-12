/**
 * TradingView Chart Reader — read chart state via CDP.
 *
 * Uses the TradingView widget/chart API via page.evaluate() to extract
 * the current symbol, timeframe, visible range, crosshair price, and
 * drawings/indicators.
 */

import { evaluate, isConnected } from "./connection.js";
import { logger } from "../../../logger.js";
import type { ChartState, Drawing } from "../types.js";

// ─── Chart State ──────────────────────────────────────────────────────────

/**
 * Read the full chart state from TradingView.
 * Returns null if CDP is not connected.
 */
export async function getChartState(): Promise<ChartState | null> {
  if (!(await isConnected())) return null;

  const symbol = await getSymbol();
  const timeframe = await getTimeframe();
  const visibleRange = await getVisibleRange();
  const crosshairPrice = await getCrosshairPrice();
  const drawings = await getDrawings();
  const indicators = await getIndicators();

  if (!symbol) return null;

  return {
    symbol,
    timeframe: timeframe || "60",
    visibleRange,
    crosshairPrice,
    drawings,
    indicators,
  };
}

/**
 * Read the active symbol from TradingView.
 */
export async function getSymbol(): Promise<string | null> {
  return evaluate(() => {
    try {
      return (window as any).tvWidget?.chart?.()?.symbol?.() ?? null;
    } catch { return null; }
  });
}

/**
 * Read the active timeframe from TradingView.
 */
export async function getTimeframe(): Promise<string | null> {
  return evaluate(() => {
    try {
      return (window as any).tvWidget?.chart?.()?.resolution?.() ?? null;
    } catch { return null; }
  });
}

/**
 * Read the visible price range from the chart.
 */
export async function getVisibleRange(): Promise<{ from: number; to: number } | null> {
  return evaluate(() => {
    try {
      const range = (window as any).tvWidget?.chart?.()?.timeScale?.()?.getVisibleRange?.();
      return range ? { from: range.from, to: range.to } : null;
    } catch { return null; }
  });
}

/**
 * Read the crosshair (cursor) price position.
 */
export async function getCrosshairPrice(): Promise<number | null> {
  return evaluate(() => {
    try {
      const series = (window as any).tvWidget?.chart?.()?.activeChart?.();
      const price = series?.crosshairPosition?.()?.price ?? null;
      return price ?? null;
    } catch { return null; }
  });
}

/**
 * Read all drawings from the chart.
 * Returns an array of Drawing objects with type, price, text.
 */
export async function getDrawings(): Promise<Drawing[]> {
  const result = await evaluate(() => {
    try {
      const chart = (window as any).tvWidget?.chart?.();
      if (!chart) return [];
      const studies = chart.getAllStudies() ?? [];
      return studies
        .filter((s: any) => s?.type?.includes?.("Drawing") || s?.type?.includes?.("Shape"))
        .map((s: any) => ({
          id: s.id || String(Math.random()),
          type: mapTvType(s.type),
          price: s.price ?? 0,
          text: s.text ?? s.symbol ?? "",
          color: s.color ?? "",
        }));
    } catch { return []; }
  });
  return result ?? [];
}

/**
 * Get list of indicator names active on the chart.
 */
export async function getIndicators(): Promise<string[]> {
  const result = await evaluate(() => {
    try {
      const studies = (window as any).tvWidget?.chart?.()?.getAllStudies?.() ?? [];
      return studies
        .filter((s: any) => !s?.type?.includes?.("Drawing") && !s?.type?.includes?.("Shape"))
        .map((s: any) => s.name || s.type || "unknown");
    } catch { return []; }
  });
  return result ?? [];
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function mapTvType(type: string): Drawing["type"] {
  const t = type.toLowerCase();
  if (t.includes("horiz") || t.includes("price")) return "horizontal_line";
  if (t.includes("trend")) return "trend_line";
  if (t.includes("fib")) return "fib_retracement";
  if (t.includes("rect") || t.includes("box")) return "rectangle";
  if (t.includes("ray")) return "ray";
  return "text";
}
