import { z } from "zod";
import type { FastMCP } from "fastmcp";
import { candleStore } from "../../realtime/candle-store.js";
import { analyzePdArray } from "../../smc/pd-array.js";
import { logger } from "../../logger.js";

export function registerPdArrayTool(server: FastMCP): void {
  server.addTool({
    name: "analyze_pd_array",
    description:
      "Analyze the Premium/Discount array for a symbol. Identifies the dealing " +
      "range, computes equilibrium, and classifies current price position as " +
      "premium, discount, or equilibrium. Returns PD zones with percentages.",
    parameters: z.object({
      symbol: z.string().describe("Trading symbol"),
      timeframe: z.enum(["1m","5m","15m","1h","4h","1d","1w"]),
    }),
    execute: async ({ symbol, timeframe }) => {
      try {
        const sym = symbol.toUpperCase();
        const candles = candleStore.getCandles(sym, timeframe);
        if (candles.length < 10) {
          return { content: [{ type: "text", text: `Insufficient candle data for ${sym} ${timeframe}` }] };
        }

        const result = analyzePdArray(candles, timeframe);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              symbol: sym, timeframe,
              currentBias: result.currentBias,
              equilibrium: result.equilibrium,
              dealingRange: {
                high: result.dealingRange.high,
                low: result.dealingRange.low,
                timeframe: result.dealingRange.timeframe,
              },
              zones: result.zones,
            }, null, 2),
          }],
        };
      } catch (err) {
        logger.error({ err, tool: "analyze_pd_array", symbol, timeframe }, "MCP tool failed");
        return { content: [{ type: "text", text: `PD array analysis failed: ${err instanceof Error ? err.message : "Unknown error"}` }], isError: true };
      }
    },
  });
}
