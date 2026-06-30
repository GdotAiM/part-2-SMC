import { z } from "zod";
import type { FastMCP } from "fastmcp";
import { candleStore } from "../../realtime/candle-store.js";
import { analyzeOrderBlocks } from "../../smc/order-blocks.js";
import { analyzeFVG } from "../../smc/fvg.js";
import { logger } from "../../logger.js";
import type { Market } from "../../smc/types.js";

function detectMarket(symbol: string): Market {
  return symbol.includes("=X") ? "forex" : "crypto";
}

export function registerOrderBlocksTool(server: FastMCP): void {
  server.addTool({
    name: "analyze_order_blocks",
    description:
      "Detect institutional Order Blocks (OBs) and Breaker Blocks. An OB is " +
      "the last opposite-direction candle before a displacement move. Each OB " +
      "includes proximal/distal price levels, confidence score (0-1), mitigation " +
      "status, breaker flag, FVG confluence, and confidence factors.",
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
        const fvg = analyzeFVG(candles, market);
        const obs = analyzeOrderBlocks(candles, fvg);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              symbol: sym, timeframe,
              totalOBs: obs.length,
              activeOBs: obs.filter(o => o.valid && !o.isMitigated).map(o => ({
                type: o.type, proximal: o.proximal, distal: o.distal,
                confidence: Math.round(o.confidence * 100) / 100,
                strength: Math.round(o.strength * 100) / 100,
                isBreaker: o.isBreaker, hasFvg: o.hasFvg,
                factors: o.confidenceFactors,
              })),
              mitigatedOBs: obs.filter(o => o.isMitigated).length,
              breakerBlocks: obs.filter(o => o.isBreaker).length,
            }, null, 2),
          }],
        };
      } catch (err) {
        logger.error({ err, tool: "analyze_order_blocks", symbol, timeframe }, "MCP tool failed");
        return { content: [{ type: "text", text: `Order block analysis failed: ${err instanceof Error ? err.message : "Unknown error"}` }], isError: true };
      }
    },
  });
}
