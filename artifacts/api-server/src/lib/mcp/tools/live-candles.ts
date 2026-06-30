import { z } from "zod";
import type { FastMCP } from "fastmcp";
import { candleStore } from "../../realtime/candle-store.js";
import { logger } from "../../logger.js";

export function registerLiveCandlesTool(server: FastMCP): void {
  server.addTool({
    name: "get_live_candles",
    description:
      "Get the latest OHLCV candles for a symbol from the real-time WebSocket " +
      "pipeline. Includes historical backfill (299 candles) + the current forming " +
      "candle. Data is live from Binance (crypto) or Finnhub/Yahoo (forex).",
    parameters: z.object({
      symbol: z.string().describe("Trading symbol"),
      timeframe: z.enum(["1m","5m","15m","1h","4h","1d","1w"]),
      limit: z.number().min(1).max(300).default(20).describe("Number of recent candles to return"),
    }),
    execute: async ({ symbol, timeframe, limit }) => {
      try {
        const sym = symbol.toUpperCase();
        const candles = candleStore.getCandles(sym, timeframe);

        if (candles.length === 0) {
          return { content: [{ type: "text", text: `No candle data for ${sym} ${timeframe}. Wait for WebSocket data to accumulate.` }] };
        }

        const recent = candles.slice(-limit);
        const current = candleStore.getSnapshot(sym, timeframe).currentCandle;

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              symbol: sym,
              timeframe,
              totalCandles: candles.length,
              returnedCandles: recent.length,
              currentFormingCandle: current ? {
                time: current.time, open: current.open, high: current.high,
                low: current.low, close: current.close, volume: current.volume,
              } : null,
              candles: recent.map(c => ({
                time: c.time, open: c.open, high: c.high,
                low: c.low, close: c.close, volume: c.volume,
              })),
            }, null, 2),
          }],
        };
      } catch (err) {
        logger.error({ err, tool: "get_live_candles" }, "MCP tool failed");
        return { content: [{ type: "text", text: "Failed to get candles" }], isError: true };
      }
    },
  });
}
