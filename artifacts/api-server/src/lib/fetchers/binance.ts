import { fetchYahooCandles, fetchYahooDailyCandles } from "./yahoo.js";
import type { Candle } from "../smc/types.js";
import { logger } from "../logger.js";

const BINANCE_TO_YAHOO: Record<string, string> = {
  BTCUSDT: "BTC-USD",
  ETHUSDT: "ETH-USD",
  SOLUSDT: "SOL-USD",
  BNBUSDT: "BNB-USD",
  XRPUSDT: "XRP-USD",
  ADAUSDT: "ADA-USD",
  DOGEUSDT: "DOGE-USD",
  AVAXUSDT: "AVAX-USD",
  DOTUSDT: "DOT-USD",
  LINKUSDT: "LINK-USD",
  MATICUSDT: "MATIC-USD",
  LTCUSDT: "LTC-USD",
  UNIUSDT: "UNI7083-USD",
  ATOMUSDT: "ATOM-USD",
};

function toYahooSymbol(symbol: string): string {
  return BINANCE_TO_YAHOO[symbol.toUpperCase()] ?? `${symbol.replace(/USDT$/i, "")}-USD`;
}

// ── Binance interval mapping ─────────────────────────────────────────────

const BINANCE_INTERVALS: Record<string, string> = {
  "1m": "1m", "5m": "5m", "15m": "15m",
  "1h": "1h", "4h": "4h", "1d": "1d", "1w": "1w",
};

/**
 * Fetch OHLCV candles directly from the Binance public REST API.
 * Unlike fetchBinanceCandles() which delegates to Yahoo Finance,
 * this function hits api.binance.com directly — no Yahoo dependency.
 */
export async function fetchBinanceCandlesDirect(
  symbol: string,
  timeframe: string,
  limit = 300,
): Promise<Candle[]> {
  const interval = BINANCE_INTERVALS[timeframe];
  if (!interval) throw new Error(`Unsupported Binance timeframe: ${timeframe}`);

  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

  if (!res.ok) {
    throw new Error(`Binance API HTTP ${res.status} for ${symbol} ${timeframe}`);
  }

  const data: unknown[][] = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`No data from Binance for ${symbol} ${timeframe}`);
  }

  return data.map((k) => ({
    time: Math.floor(Number(k[0]) / 1000), // Binance ms → seconds
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
  }));
}

export async function fetchBinanceCandles(symbol: string, timeframe: string): Promise<Candle[]> {
  return fetchYahooCandles(toYahooSymbol(symbol), timeframe);
}

export async function fetchBinanceDailyCandles(symbol: string): Promise<Candle[]> {
  return fetchYahooDailyCandles(toYahooSymbol(symbol));
}
