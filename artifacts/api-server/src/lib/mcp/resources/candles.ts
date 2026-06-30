import type { FastMCP } from "fastmcp";
import { candleStore } from "../../realtime/candle-store.js";

export function registerCandleResource(server: FastMCP): void {
  // Resource template: dynamic URI with market/symbol/timeframe params
  (server as Record<string, unknown>).addResourceTemplate?.({
    name: "Live Market Candles",
    uri: "smc://candles/{market}/{symbol}/{timeframe}",
    description:
      "Real-time OHLCV candles from the WebSocket pipeline. Data is live from " +
      "Binance (crypto) or Finnhub/Yahoo (forex).",
    mimeType: "application/json",
    arguments: [
      { name: "market", description: "Market: crypto or forex", required: true },
      { name: "symbol", description: "Trading symbol, e.g. BTCUSDT or EURUSD=X", required: true },
      { name: "timeframe", description: "Candle timeframe", required: true },
    ],
    async load(_uri: string, params: Record<string, string>) {
      const candles = candleStore.getCandles(
        (params.symbol ?? "").toUpperCase(),
        params.timeframe ?? "4h",
      );
      return {
        text: JSON.stringify({
          symbol: (params.symbol ?? "").toUpperCase(),
          market: params.market,
          timeframe: params.timeframe,
          candleCount: candles.length,
          firstCandle: candles[0] ?? null,
          lastCandle: candles[candles.length - 1] ?? null,
          candles,
        }),
      };
    },
    async complete(name: string, value: string) {
      if (name === "market") return { values: ["crypto", "forex"] };
      if (name === "symbol") {
        const allSymbols = candleStore.getActiveSymbols();
        return { values: allSymbols.length > 0 ? allSymbols : ["BTCUSDT", "EURUSD=X"] };
      }
      if (name === "timeframe") return { values: ["1m","5m","15m","1h","4h","1d","1w"] };
      return { values: [] };
    },
  });
}
