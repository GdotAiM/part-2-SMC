/**
 * TradingView CDP Actions — write operations on the TV chart.
 *
 * Change symbol/timeframe, create/delete drawings, set alerts.
 * All operations gracefully return false if CDP is disconnected.
 */

import { evaluateWithArgs, evaluate, isConnected } from "./connection.js";
import { toTvSymbol, toTvTimeframe, fromTvSymbol, fromTvTimeframe } from "../types.js";
import type { Drawing } from "../types.js";
import { logger } from "../../../logger.js";
import { isConnected as checkHealth } from "./connection.js";

// ─── Symbol / Timeframe ───────────────────────────────────────────────────

/**
 * Change the active symbol on TradingView chart.
 */
export async function changeSymbol(symbol: string): Promise<boolean> {
  if (!(await isConnected())) return false;
  const tvSym = toTvSymbol(symbol);
  return (await evaluateWithArgs((sym: string) => {
    try {
      const chart = (window as any).tvWidget?.chart?.();
      if (!chart) return false;
      chart.setSymbol(sym, () => {});
      return true;
    } catch { return false; }
  }, tvSym)) ?? false;
}

/**
 * Change the active timeframe on TradingView chart.
 */
export async function changeTimeframe(timeframe: string): Promise<boolean> {
  if (!(await isConnected())) return false;
  const tvTf = toTvTimeframe(timeframe);
  return (await evaluateWithArgs((tf: string) => {
    try {
      const chart = (window as any).tvWidget?.chart?.();
      if (!chart) return false;
      chart.setResolution(tf, () => {});
      return true;
    } catch { return false; }
  }, tvTf)) ?? false;
}

// ─── Drawings ─────────────────────────────────────────────────────────────

/**
 * Draw a horizontal line on the TradingView chart at a specific price.
 */
export async function drawHorizontalLine(
  price: number,
  text?: string,
  color?: string,
): Promise<boolean> {
  if (!(await isConnected())) return false;
  return (await evaluateWithArgs(
    (p: number, t: string | undefined, c: string | undefined) => {
      try {
        const chart = (window as any).tvWidget?.chart?.();
        if (!chart) return false;
        chart.createStudy("Horizontal Line", false, false, [p], null, {
          text: t ?? "",
          color: c ?? "#888888",
        });
        return true;
      } catch { return false; }
    },
    price, text ?? "", color ?? "#888888",
  )) ?? false;
}

/**
 * Draw a Fibonacci retracement on the chart.
 */
export async function drawFibRetracement(
  high: number,
  low: number,
  levels?: number[],
): Promise<boolean> {
  if (!(await isConnected())) return false;
  return (await evaluateWithArgs(
    (h: number, l: number) => {
      try {
        const chart = (window as any).tvWidget?.chart?.();
        if (!chart) return false;
        chart.createStudy("Fibonacci Retracement", false, false, [h, l], null, {});
        return true;
      } catch { return false; }
    },
    high, low,
  )) ?? false;
}

/**
 * Draw a text label on the chart at a specific time/price.
 */
export async function drawLabel(
  price: number,
  text: string,
  color?: string,
): Promise<boolean> {
  if (!(await isConnected())) return false;
  return (await evaluateWithArgs(
    (p: number, t: string, c: string | undefined) => {
      try {
        const chart = (window as any).tvWidget?.chart?.();
        if (!chart) return false;
        chart.createStudy("Text", false, false, [p], null, {
          text: t,
          color: c ?? "#888888",
        });
        return true;
      } catch { return false; }
    },
    price, text, color ?? "#888888",
  )) ?? false;
}

/**
 * Delete all drawings, or filter by type.
 */
export async function deleteDrawings(type?: string): Promise<boolean> {
  if (!(await isConnected())) return false;
  return (await evaluateWithArgs((filterType: string | undefined) => {
    try {
      const chart = (window as any).tvWidget?.chart?.();
      if (!chart) return false;
      const studies = chart.getAllStudies() ?? [];
      for (const s of studies) {
        if (!filterType || s.type?.includes(filterType)) {
          chart.removeEntity(s.id);
        }
      }
      return true;
    } catch { return false; }
  }, type)) ?? false;
}

// ─── Alerts ───────────────────────────────────────────────────────────────

/**
 * Create an alert at a specific price level.
 */
export async function setAlert(
  price: number,
  direction: "above" | "below" | "both",
  message?: string,
): Promise<boolean> {
  if (!(await isConnected())) return false;
  return (await evaluateWithArgs(
    (p: number, _dir: string, msg: string | undefined) => {
      try {
        const chart = (window as any).tvWidget?.chart?.();
        if (!chart) return false;
        // TradingView's alert API varies by version
        // This is a best-effort implementation
        chart.createStudy("Alert", false, false, [p], null, {
          text: msg ?? "SMC Alert",
          alertOn: _dir,
        });
        return true;
      } catch { return false; }
    },
    price, direction, message,
  )) ?? false;
}

// ─── Sync SMC Levels ──────────────────────────────────────────────────────

/**
 * Sync all SMC levels as TradingView drawings.
 * Draws: bullish OB zones, bearish OB zones, FVG zones, draw targets.
 */
export async function syncSmcLevels(report: {
  orderBlocks: Array<{ type: string; proximal: number; distal: number; confidence: number }>;
  fvg: Array<{ type: string; top: number; bottom: number }>;
  draw: Array<{ price: number; type: string; direction: string; label: string }>;
}): Promise<number> {
  if (!(await isConnected())) return 0;
  let count = 0;

  // Clear existing SMC drawings first
  await deleteDrawings("SMC");

  // Draw order blocks
  for (const ob of report.orderBlocks.slice(0, 5)) {
    const mid = (ob.proximal + ob.distal) / 2;
    const color = ob.type === "bullish" ? "#22c55e" : "#ef4444";
    await drawHorizontalLine(mid, `OB ${ob.type}`, color);
    count++;
  }

  // Draw FVGs
  for (const g of report.fvg.slice(0, 5)) {
    const mid = (g.top + g.bottom) / 2;
    await drawHorizontalLine(mid, `FVG ${g.type}`, "#a855f7");
    count++;
  }

  // Draw targets
  for (const d of report.draw.slice(0, 3)) {
    const color = d.direction === "long" ? "#22c55e" : "#ef4444";
    await drawHorizontalLine(d.price, d.label, color);
    count++;
  }

  logger.info({ count }, "Synced SMC levels to TradingView");
  return count;
}
