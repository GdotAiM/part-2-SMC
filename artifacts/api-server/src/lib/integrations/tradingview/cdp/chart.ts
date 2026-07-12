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
 *
 * Supports both the web version (window.tvWidget) and the TV Desktop
 * (_exposed_chartWidgetCollection) APIs. Falls back gracefully if neither
 * is available.
 *
 * NOTE: All helper logic must be INLINED inside the evaluate callback
 * because it runs in the browser context, not Node.js.
 */
export async function getSymbol(): Promise<string | null> {
  return evaluate(() => {
    try {
      // Web version: tvWidget.chart().symbol()
      const sym = (window as any).tvWidget?.chart?.()?.symbol?.();
      if (sym) return sym;
    } catch { /* fall through */ }

    // TV Desktop: _exposed_chartWidgetCollection path
    try {
      const coll = (window as any)._exposed_chartWidgetCollection;
      if (!coll?.activeChartWidget?._value) return null;
      const pane = coll.activeChartWidget._value._paneWidgets?._value?.[0];
      if (!pane?._legendWidget?._mainSeriesViewModel?._source) return null;
      return pane._legendWidget._mainSeriesViewModel._source.symbol() ?? null;
    } catch { return null; }
  });
}

/**
 * Read the active timeframe from TradingView.
 *
 * Supports both web version (tvWidget.chart().resolution()) and TV Desktop
 * (_exposed_chartWidgetCollection._activeChartInterval) APIs.
 */
export async function getTimeframe(): Promise<string | null> {
  return evaluate(() => {
    try {
      // Web version: tvWidget.chart().resolution()
      const tf = (window as any).tvWidget?.chart?.()?.resolution?.();
      if (tf) return tf;
    } catch { /* fall through */ }

    // TV Desktop: _activeChartInterval path
    try {
      const coll = (window as any)._exposed_chartWidgetCollection;
      if (!coll?._activeChartInterval?._value) return null;
      const intv = coll._activeChartInterval._value;
      const kind = intv._kind;
      const mult = intv._multiplier ?? 1;
      if (kind === "minutes") return mult + "m";
      if (kind === "hours") return mult + "h";
      if (kind === "days") return "1d";
      if (kind === "weeks") return "1w";
      if (kind === "months") return "1M";
      return mult + kind;
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

/**
 * Read OHLCV bar data from the TradingView Desktop chart.
 *
 * Returns up to `limit` bars (default 500) from the chart's cached data,
 * formatted as { time, open, high, low, close, volume } objects.
 * Returns null if CDP is not connected or the chart has no data.
 */
export async function getBars(limit: number = 500): Promise<Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }> | null> {
  return evaluate((maxBars: number) => {
    try {
      const coll = (window as any)._exposed_chartWidgetCollection;
      if (!coll?.activeChartWidget?._value) return null;
      const pane = coll.activeChartWidget._value._paneWidgets?._value?.[0];
      if (!pane?._legendWidget?._mainSeriesViewModel?._source) return null;
      const src = pane._legendWidget._mainSeriesViewModel._source;
      const bars = src.bars();
      if (!bars?._items) return null;
      const len = bars._items.length;
      const start = Math.max(0, len - maxBars);
      return bars._items.slice(start).map((item: any) => ({
        time: item.value[0],
        open: item.value[1],
        high: item.value[2],
        low: item.value[3],
        close: item.value[4],
        volume: item.value[5],
      }));
    } catch { return null; }
  }, limit);
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
