/**
 * Map Binance-style crypto symbols to Alpaca and TradingView chart formats.
 * The paper trading URL is always used (AlpacaAdapter is paper-only).
 */

const CRYPTO_SYMBOL_MAP: Record<string, { alpaca: string; tradingview: string }> = {
  BTCUSDT: { alpaca: "BTC/USD", tradingview: "BINANCE:BTCUSDT" },
  BTCUSD:  { alpaca: "BTC/USD", tradingview: "BINANCE:BTCUSDT" },
  ETHUSDT: { alpaca: "ETH/USD", tradingview: "BINANCE:ETHUSDT" },
  ETHUSD:  { alpaca: "ETH/USD", tradingview: "BINANCE:ETHUSDT" },
  SOLUSDT: { alpaca: "SOL/USD", tradingview: "BINANCE:SOLUSDT" },
  SOLUSD:  { alpaca: "SOL/USD", tradingview: "BINANCE:SOLUSDT" },
  BNBUSDT: { alpaca: "BNB/USD", tradingview: "BINANCE:BNBUSDT" },
  BNBUSD:  { alpaca: "BNB/USD", tradingview: "BINANCE:BNBUSDT" },
  XRPUSDT: { alpaca: "XRP/USD", tradingview: "BINANCE:XRPUSDT" },
  XRPUSD:  { alpaca: "XRP/USD", tradingview: "BINANCE:XRPUSDT" },
  ADAUSDT: { alpaca: "ADA/USD", tradingview: "BINANCE:ADAUSDT" },
  ADAUSD:  { alpaca: "ADA/USD", tradingview: "BINANCE:ADAUSDT" },
  DOGEUSDT:{ alpaca: "DOGE/USD", tradingview: "BINANCE:DOGEUSDT" },
  DOGEUSD: { alpaca: "DOGE/USD", tradingview: "BINANCE:DOGEUSDT" },
};

/** Map a Binance-style symbol to Alpaca's BTC/USD format, or null if unmapped. */
export function toAlpacaSymbol(symbol: string): string | null {
  return CRYPTO_SYMBOL_MAP[symbol.toUpperCase()]?.alpaca ?? null;
}

/** Map to TradingView symbol format (e.g. BINANCE:BTCUSDT), or null if unmapped. */
export function toTradingViewSymbol(symbol: string): string | null {
  return CRYPTO_SYMBOL_MAP[symbol.toUpperCase()]?.tradingview ?? null;
}

/** Build the Alpaca paper TradingView chart URL for a given symbol. */
export function alpacaChartUrl(symbol: string): string | null {
  const alpacaSymbol = toAlpacaSymbol(symbol);
  if (!alpacaSymbol) return null;
  return `https://app.alpaca.markets/trade/${alpacaSymbol}`;
}

/** Check whether this symbol can be charted (either Alpaca or TradingView). */
export function isChartable(symbol: string): boolean {
  return toAlpacaSymbol(symbol) !== null;
}
