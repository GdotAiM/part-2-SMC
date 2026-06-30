import { z } from "zod";
import type { FastMCP } from "fastmcp";
import { candleStore } from "../../realtime/candle-store.js";
import { analyzeFVG } from "../../smc/fvg.js";
import { logger } from "../../logger.js";
import type { Market } from "../../smc/types.js";

function detectMarket(symbol: string): Market {
  return symbol.includes("=X") ? "forex" : "crypto";
}

export function registerFvgTool(server: FastMCP): void {
  server.addTool({
    name: "analyze_fvg",
    description:
      "Detect Fair Value Gaps (FVGs) — 3-candle imbalance patterns where " +
      "price leaves a gap unfilled. Tracks fill fraction (0-1) and identifies " +
      "inversion FVGs. Returns all unfilled gaps sorted by recency.",
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

        const market = detectMarket(sym);
        const fvgs = analyzeFVG(candles, market);
        const unfilled = fvgs.filter(g => g.fillFraction < 0.5);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              symbol: sym, timeframe,
              totalFVGs: fvgs.length,
              unfilledGaps: unfilled.slice(-10).map(g => ({
                type: g.type, top: g.top, bottom: g.bottom,
                fillPercent: Math.round(g.fillFraction * 100),
                isInversion: g.isInversion,
              })),
              inversions: fvgs.filter(g => g.isInversion).length,
            }, null, 2),
          }],
        };
      } catch (err) {
        logger.error({ err, tool: "analyze_fvg", symbol, timeframe }, "MCP tool failed");
        return { content: [{ type: "text", text: `FVG analysis failed: ${err instanceof Error ? err.message : "Unknown error"}` }], isError: true };
      }
    },
  });
}
