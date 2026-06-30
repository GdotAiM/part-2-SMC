import { z } from "zod";
import type { FastMCP } from "fastmcp";
import { candleStore } from "../../realtime/candle-store.js";
import { analyzeStructure } from "../../smc/structure.js";
import { logger } from "../../logger.js";

export function registerStructureTool(server: FastMCP): void {
  server.addTool({
    name: "analyze_structure",
    description:
      "Analyze ICT market structure for a symbol. Detects swing pivots " +
      "(HH/HL/LH/LL), BOS/CHoCH breaks, trend direction, bias with confidence " +
      "score (0-1), and ICT market phase (accumulation/manipulation/expansion/" +
      "distribution/continuation). Uses ATR-normalized pivot detection from " +
      "live WebSocket candle data.",
    parameters: z.object({
      symbol: z.string().describe("Trading symbol, e.g. BTCUSDT or EURUSD=X"),
      timeframe: z.enum(["1m","5m","15m","1h","4h","1d","1w"]),
    }),
    execute: async ({ symbol, timeframe }) => {
      const start = Date.now();
      try {
        const candles = candleStore.getCandles(symbol.toUpperCase(), timeframe);
        if (candles.length < 10) {
          return {
            content: [{
              type: "text",
              text: `Insufficient data: ${symbol} ${timeframe} has only ${candles.length} candles (need ≥10). Wait for WebSocket data to accumulate.`,
            }],
          };
        }

        const result = analyzeStructure(candles, timeframe);
        logger.info({ tool: "analyze_structure", symbol, timeframe, durationMs: Date.now() - start }, "MCP tool executed");

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              symbol: symbol.toUpperCase(),
              timeframe,
              trend: result.trend,
              bias: result.bias,
              confidence: Math.round(result.confidence * 100) / 100,
              phase: result.phase,
              recentPivots: result.pivots.slice(-10),
              recentBreaks: result.breaks.slice(-8).map(b => ({
                type: b.type, direction: b.direction, price: b.price,
              })),
              narrative: result.narrative,
              evidence: result.evidence,
            }, null, 2),
          }],
        };
      } catch (err) {
        logger.error({ err, tool: "analyze_structure", symbol, timeframe }, "MCP tool failed");
        return {
          content: [{ type: "text", text: `Structure analysis failed: ${err instanceof Error ? err.message : "Unknown error"}` }],
          isError: true,
        };
      }
    },
  });
}
