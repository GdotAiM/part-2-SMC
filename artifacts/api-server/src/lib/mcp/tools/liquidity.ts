import { z } from "zod";
import type { FastMCP } from "fastmcp";
import { candleStore } from "../../realtime/candle-store.js";
import { analyzeLiquidity } from "../../smc/liquidity.js";
import { logger } from "../../logger.js";
import type { Market } from "../../smc/types.js";

function detectMarket(symbol: string): Market {
  return symbol.includes("=X") ? "forex" : "crypto";
}

export function registerLiquidityTool(server: FastMCP): void {
  server.addTool({
    name: "analyze_liquidity",
    description:
      "Scan liquidity pools for a symbol. Detects Buy-Side Liquidity (BSL), " +
      "Sell-Side Liquidity (SSL), Equal Highs (EQH), and Equal Lows (EQL). " +
      "Each pool is scored with session-weighted probability of sweep (0-1). " +
      "Returns nearest BSL above price and nearest SSL below price.",
    parameters: z.object({
      symbol: z.string().describe("Trading symbol, e.g. BTCUSDT or EURUSD=X"),
      timeframe: z.enum(["1m","5m","15m","1h","4h","1d","1w"]),
    }),
    execute: async ({ symbol, timeframe }) => {
      const start = Date.now();
      try {
        const sym = symbol.toUpperCase();
        const candles = candleStore.getCandles(sym, timeframe);
        if (candles.length < 10) {
          return { content: [{ type: "text", text: `Insufficient candle data for ${sym} ${timeframe}` }] };
        }

        const market = detectMarket(sym);
        const result = analyzeLiquidity(candles, timeframe, market);
        const currentPrice = candles[candles.length - 1].close;

        logger.info({ tool: "analyze_liquidity", symbol, timeframe, durationMs: Date.now() - start }, "MCP tool executed");

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              symbol: sym,
              timeframe,
              currentPrice,
              nearestBSL: result.nearestBSL ? {
                price: result.nearestBSL.price,
                score: Math.round(result.nearestBSL.score * 100) / 100,
                touches: result.nearestBSL.touches,
                probabilityOfSweep: Math.round(result.nearestBSL.probabilityOfSweep * 100) / 100,
                session: result.nearestBSL.session,
              } : null,
              nearestSSL: result.nearestSSL ? {
                price: result.nearestSSL.price,
                score: Math.round(result.nearestSSL.score * 100) / 100,
                touches: result.nearestSSL.touches,
                probabilityOfSweep: Math.round(result.nearestSSL.probabilityOfSweep * 100) / 100,
                session: result.nearestSSL.session,
              } : null,
              activePools: result.pools
                .filter(p => !p.wasSwept)
                .slice(0, 10)
                .map(p => ({
                  type: p.type, price: p.price, touches: p.touches,
                  score: Math.round(p.score * 100) / 100,
                  probSweep: Math.round(p.probabilityOfSweep * 100) / 100,
                  session: p.session,
                })),
              sweptPools: result.pools.filter(p => p.wasSwept).length,
            }, null, 2),
          }],
        };
      } catch (err) {
        logger.error({ err, tool: "analyze_liquidity", symbol, timeframe }, "MCP tool failed");
        return {
          content: [{ type: "text", text: `Liquidity analysis failed: ${err instanceof Error ? err.message : "Unknown error"}` }],
          isError: true,
        };
      }
    },
  });
}
