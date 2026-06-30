import type { FastMCP } from "fastmcp";

export function registerSmcAnalysisPrompt(server: FastMCP): void {
  (server as Record<string, unknown>).addPrompt?.({
    name: "smc-analysis",
    description:
      "Reusable prompt template for SMC market analysis. Instructs the AI to " +
      "perform structured ICT/SMC analysis using the available tools.",
    arguments: [
      { name: "symbol", description: "Trading symbol (e.g. BTCUSDT, EURUSD=X)", required: true },
      { name: "timeframe", description: "Candle timeframe", required: false },
    ],
    async load(args: Record<string, string>) {
      const symbol = args.symbol || "{symbol}";
      const tf = args.timeframe || "4h";
      return `Analyze ${symbol} on the ${tf} timeframe using ICT/SMC methodology.

Step 1: Call analyze_structure for ${symbol} on ${tf}. Determine who controls the market, the current bias, confidence level, and market phase.

Step 2: Call analyze_liquidity for ${symbol} on ${tf}. Identify where BSL and SSL rest. Which is more likely to be hunted next?

Step 3: Call analyze_order_blocks for ${symbol} on ${tf}. Note any unmitigated OBs and breaker blocks near current price.

Step 4: Call analyze_fvg for ${symbol} on ${tf}. Identify unfilled gaps that price may seek to rebalance.

Step 5: Call get_daily_bias for ${symbol}. Check if the higher timeframe bias aligns with or contradicts the ${tf} structure.

Step 6: Synthesize all findings into a concise institutional narrative. State the highest-probability draw on liquidity, what confirms the thesis, and what would invalidate it.

Be specific with price levels. Do not give financial advice or buy/sell signals.`;
    },
  });
}
