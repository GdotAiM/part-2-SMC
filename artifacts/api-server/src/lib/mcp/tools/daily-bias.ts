import { z } from "zod";
import type { FastMCP } from "fastmcp";
import { analyzeDailyBias } from "../../smc/daily-bias.js";
import { fetchBinanceDailyCandles } from "../../fetchers/binance.js";
import { fetchYahooDailyCandles } from "../../fetchers/yahoo.js";
import { logger } from "../../logger.js";
import type { Candle, Market } from "../../smc/types.js";

function detectMarket(symbol: string): Market {
  return symbol.includes("=X") ? "forex" : "crypto";
}

export function registerDailyBiasTool(server: FastMCP): void {
  server.addTool({
    name: "get_daily_bias",
    description:
      "Compute the higher-timeframe (1D) bias for a symbol. Uses structure-primary " +
      "bias detection on daily candles with SMA(20) fallback. Returns bias direction, " +
      "strength (0-1), consecutive aligned days, and evidence bullets.",
    parameters: z.object({
      symbol: z.string().describe("Trading symbol"),
    }),
    execute: async ({ symbol }) => {
      try {
        const sym = symbol.toUpperCase();
        const market = detectMarket(sym);
        let dailyCandles: Candle[];

        if (market === "crypto") {
          dailyCandles = await fetchBinanceDailyCandles(sym);
        } else {
          dailyCandles = await fetchYahooDailyCandles(sym);
        }

        const result = analyzeDailyBias(dailyCandles);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              symbol: sym,
              bias: result.bias,
              strength: Math.round(result.strength * 100) / 100,
              consecutiveDays: result.consecutiveDays,
              referencedSwing: result.referencedSwing,
              evidence: result.evidence,
            }, null, 2),
          }],
        };
      } catch (err) {
        logger.error({ err, tool: "get_daily_bias", symbol }, "MCP tool failed");
        return { content: [{ type: "text", text: `Daily bias failed: ${err instanceof Error ? err.message : "Unknown error"}` }], isError: true };
      }
    },
  });
}
