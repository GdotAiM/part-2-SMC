import { z } from "zod";
import type { FastMCP } from "fastmcp";
import { candleStore } from "../../realtime/candle-store.js";
import { analyzeSMT } from "../../smc/smt.js";
import { analyzeFVG } from "../../smc/fvg.js";
import { logger } from "../../logger.js";
import type { Market } from "../../smc/types.js";

function detectMarket(symbol: string): Market {
  return symbol.includes("=X") ? "forex" : "crypto";
}

export function registerSmtTool(server: FastMCP): void {
  server.addTool({
    name: "detect_smt",
    description:
      "Detect SMT (Smart Money Technique) divergence between two correlated symbols. " +
      "SMT occurs when one symbol makes a higher high while the correlated symbol makes " +
      "a lower high (bearish SMT), or vice versa (bullish SMT). Common pairs: " +
      "BTC/ETH, EUR/GBP, AUD/NZD.",
    parameters: z.object({
      primarySymbol: z.string().describe("Primary symbol, e.g. BTCUSDT"),
      correlatedSymbol: z.string().describe("Correlated symbol, e.g. ETHUSDT"),
      timeframe: z.enum(["1m","5m","15m","1h","4h","1d","1w"]),
    }),
    execute: async ({ primarySymbol, correlatedSymbol, timeframe }) => {
      try {
        const primary = primarySymbol.toUpperCase();
        const corr = correlatedSymbol.toUpperCase();
        const primaryCandles = candleStore.getCandles(primary, timeframe);
        const corrCandles = candleStore.getCandles(corr, timeframe);

        if (primaryCandles.length < 10 || corrCandles.length < 10) {
          return { content: [{ type: "text", text: `Insufficient data. ${primary}: ${primaryCandles.length} candles, ${corr}: ${corrCandles.length} candles.` }] };
        }

        const result = analyzeSMT(primaryCandles, corrCandles, primary, corr);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              primarySymbol: primary,
              correlatedSymbol: corr,
              timeframe,
              detected: result.detected,
              type: result.type,
              confidence: result.detected ? Math.round(result.confidence * 100) / 100 : 0,
            }, null, 2),
          }],
        };
      } catch (err) {
        logger.error({ err, tool: "detect_smt" }, "MCP tool failed");
        return { content: [{ type: "text", text: `SMT detection failed: ${err instanceof Error ? err.message : "Unknown error"}` }], isError: true };
      }
    },
  });
}
