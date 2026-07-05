/**
 * Demo data generation script — fetches REAL historical data from Yahoo Finance
 * and backtests SMC setups across stocks, forex, and crypto.
 *
 * Usage: npx tsx src/scripts/generate-demo-backtest.ts
 */

import { BacktestRunner } from "../lib/backtest/BacktestRunner.js";
import {
  AssetClass,
  SetupType,
} from "../lib/services/SignalGenerator.js";
import { PerformanceMatrixService } from "../lib/services/PerformanceMatrixService.js";

async function main() {
  console.log("🚀 SMC Liquidity Hunter — Real-Data Backtest Generator\n");
  console.log("=".repeat(60));

  const runner = new BacktestRunner();
  const matrixService = new PerformanceMatrixService();

  // Run across multiple timeframes for richer multi-dimensional data.
  // Yahoo ranges: 15m=45d, 1h=60d, 4h=120d — all with up to 500 candles.
  const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h"];

  const testCases: Array<{
    assetClass: AssetClass;
    symbol: string;
    displaySymbol: string;
    timeframe: string;
  }> = [];

  for (const tf of TIMEFRAMES) {
    testCases.push(
      {
        assetClass: AssetClass.STOCK,
        symbol: "AAPL",
        displaySymbol: "AAPL",
        timeframe: tf,
      },
      {
        assetClass: AssetClass.FOREX,
        symbol: "EURUSD=X",
        displaySymbol: "EURUSD",
        timeframe: tf,
      },
      {
        assetClass: AssetClass.CRYPTO,
        symbol: "BTC-USD",
        displaySymbol: "BTCUSDT",
        timeframe: tf,
      }
    );
  }

  console.log(`\n⏱  Timeframes: ${TIMEFRAMES.join(", ")}`);
  console.log(`📋 Assets: AAPL (stock), EURUSD (forex), BTC-USD (crypto)`);
  console.log(`🔢 Total test cases: ${testCases.length}\n`);

  const results = await runner.runMultiAssetBacktest(testCases);

  // ── Summary ──
  console.log(`\n${"=".repeat(60)}`);
  console.log(`\n📈 BACKTEST SUMMARY\n`);

  let totalSignals = 0;
  let totalWins = 0;
  let totalLosses = 0;

  for (const [key, result] of results) {
    totalSignals += result.metrics.total_signals;
    totalWins += result.metrics.winning_signals;
    totalLosses += result.metrics.losing_signals;

    console.log(`   ${key.padEnd(20)} | ${String(result.metrics.total_signals).padStart(3)} signals | ` +
      `Win: ${(result.metrics.win_rate * 100).toFixed(1)}% | ` +
      `Sharpe: ${result.metrics.sharpe_ratio.toFixed(2)} | ` +
      `PF: ${result.metrics.profit_factor.toFixed(2)}`);
  }

  console.log(`\n   📊 Total: ${totalSignals} signals (${totalWins}W / ${totalLosses}L)`);

  // ── Rebuild performance matrix ──
  console.log(`\n🔄 Rebuilding performance matrix...`);
  const matrixCount = await matrixService.rebuildFullMatrix();
  console.log(`✅ Performance matrix updated: ${matrixCount} combinations`);

  console.log(`\n🎉 Done! Start the API server and open /ledger to view results.`);
}

main().catch((err) => {
  console.error("Demo backtest failed:", err);
  process.exit(1);
});
