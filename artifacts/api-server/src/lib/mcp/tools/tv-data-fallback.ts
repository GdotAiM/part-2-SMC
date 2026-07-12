/**
 * TV Desktop data fallback for SMC tools.
 *
 * When the candle store doesn't have data for a symbol/timeframe, tries to
 * read it from the TradingView Desktop chart via CDP.  This makes the
 * agent pipeline work without a working Binance/Yahoo connection.
 */
import { logger } from "../../logger.js";
import { candleStore } from "../../realtime/candle-store.js";

let _tvModule: any = null;
async function getTv() {
  if (!_tvModule) {
    try {
      _tvModule = await import("../../integrations/tradingview/index.js");
    } catch { return null; }
  }
  return _tvModule;
}

/**
 * Get candles for the given symbol/timeframe, falling back to TV Desktop
 * when the candle store is empty and external APIs are unreachable.
 *
 * Returns candles as Candle[] objects ({time, open, high, low, close, volume}),
 * matching the candle store format that all SMC tools expect.
 */
export async function getCandlesWithFallback(
  symbol: string,
  timeframe: string,
): Promise<any[]> {
  // Try candle store first
  const cached = candleStore.getCandles(symbol, timeframe);
  if (cached && cached.length >= 10) return cached;

  // Try TV Desktop fallback
  try {
    const tv = await getTv();
    if (!tv?.isTvEnabled?.()) return cached;

    if (!(await tv.isConnected())) {
      await tv.connect();
    }

    const bars = await tv.getBars(500);
    if (!bars || bars.length < 10) return cached;

    // bars are already in Candle[] format ({time, open, high, low, close, volume})
    // Seed the candle store so subsequent calls hit cache
    try {
      candleStore.seedCandles(symbol, timeframe, bars);
    } catch { /* ok */ }

    logger.info({ symbol, timeframe, count: bars.length, source: "tv_desktop_fallback" }, "TV Desktop data fallback used");
    return bars;
  } catch (err: any) {
    logger.warn({ err: err.message, symbol, timeframe }, "TV Desktop fallback failed");
    return cached;
  }
}
