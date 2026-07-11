import type { Candle, SmcReport } from "../smc/types.js";
import { analyzeFVG } from "../smc/fvg.js";
import { analyzeOrderBlocks } from "../smc/order-blocks.js";
import { analyzeStructure } from "../smc/structure.js";
import { analyzeLiquidity } from "../smc/liquidity.js";
import { analyzePdArray } from "../smc/pd-array.js";
import { analyzeDailyBias } from "../smc/daily-bias.js";
import { buildReport } from "../smc/report.js";
import { fetchYahooCandles } from "../fetchers/yahoo.js";
import { fetchBinanceCandlesDirect } from "../fetchers/binance.js";
import {
  SignalGenerator,
  type UnifiedTradeSignal,
  AssetClass,
  SetupType,
  SetupSubtype,
} from "../services/SignalGenerator.js";
import { TradeLedgerService } from "../services/TradeLedgerService.js";
import { PerformanceMatrixService } from "../services/PerformanceMatrixService.js";

// ─── Types ───

export interface BacktestConfig {
  assetClass: AssetClass;
  symbol: string;         // Yahoo symbol (e.g. "AAPL", "EURUSD=X", "BTC-USD")
  displaySymbol: string;  // Display symbol (e.g. "AAPL", "EURUSD", "BTCUSDT")
  timeframe: string;      // "1m","5m","15m","1h","4h","1d","1w"
  /** Optional: candles per SMC analysis window (default 200) */
  windowSize?: number;
  /** Optional: bars after window to simulate outcome (default 20) */
  futureBarsNeeded?: number;
  /** Optional: advance window by this many candles each step (default 20) */
  stepSize?: number;
}

export interface BacktestResult {
  signals: UnifiedTradeSignal[];
  metrics: {
    win_rate: number;
    sharpe_ratio: number;
    profit_factor: number;
    avg_win: number;
    avg_loss: number;
    max_drawdown: number;
    total_signals: number;
    winning_signals: number;
    losing_signals: number;
  };
  candleCount: number;
}

// ─── Yahoo symbol helpers ───

function toYahooSymbol(symbol: string, assetClass: AssetClass): string {
  switch (assetClass) {
    case AssetClass.CRYPTO:
      return symbol.endsWith("-USD") ? symbol : `${symbol.replace(/USDT$/i, "")}-USD`;
    case AssetClass.FOREX:
      return symbol.endsWith("=X") ? symbol : `${symbol}=X`;
    case AssetClass.STOCK:
      return symbol; // AAPL, MSFT, etc.
    default:
      return symbol;
  }
}

// ─── Market type helper ───

function toMarket(assetClass: AssetClass): "crypto" | "forex" {
  return assetClass === AssetClass.CRYPTO ? "crypto" : "forex";
}

// ─── Backtest Runner ───

export class BacktestRunner {
  private signalGenerator: SignalGenerator;
  private ledgerService: TradeLedgerService;
  private matrixService: PerformanceMatrixService;

  constructor() {
    this.signalGenerator = new SignalGenerator();
    this.ledgerService = new TradeLedgerService();
    this.matrixService = new PerformanceMatrixService();
  }

  /**
   * Fetch real historical candles from Yahoo Finance.
   */
  async fetchHistoricalData(
    symbol: string,
    assetClass: AssetClass,
    timeframe: string
  ): Promise<Candle[]> {
    const yahooSymbol = toYahooSymbol(symbol, assetClass);
    console.log(`   Fetching ${yahooSymbol} ${timeframe}...`);
    let candles;
    try {
      if (assetClass === AssetClass.CRYPTO) {
        const bs = symbol.replace(/USDT$/i, '') + 'USDT';
        candles = await fetchBinanceCandlesDirect(bs, timeframe, 500);
        console.log(`   Got ${candles.length} candles from Binance Direct`);
      } else {
        candles = await fetchYahooCandles(yahooSymbol, timeframe);
        console.log(`   Got ${candles.length} candles from Yahoo`);
      }
    } catch {
      console.log(`Direct failed, Yahoo fallback...`);
      candles = await fetchYahooCandles(yahooSymbol, timeframe);
    }
    return candles;
  }

  /**
   * Run a backtest on real historical data.
   *
   * Strategy:
   *  1. Fetch all historical candles from Yahoo Finance
   *  2. For each sliding window of the data, run the SMC engine as if we
   *     were at that point in time
   *  3. Generate signals from setups detected in each window
   *  4. Simulate outcomes using the candles that come AFTER the window
   *  5. Log everything to the trade ledger
   */
  async runBacktest(config: BacktestConfig): Promise<BacktestResult> {
    const candles = await this.fetchHistoricalData(
      config.symbol,
      config.assetClass,
      config.timeframe
    );

    if (candles.length < 60) {
      console.log(`   ⚠️  Only ${candles.length} candles — need at least 60 for backtest`);
      return {
        signals: [],
        metrics: { win_rate: 0, sharpe_ratio: 0, profit_factor: 0, avg_win: 0, avg_loss: 0, max_drawdown: 0, total_signals: 0, winning_signals: 0, losing_signals: 0 },
        candleCount: candles.length,
      };
    }

    const signals: UnifiedTradeSignal[] = [];
    const windowSize = config.windowSize ?? 200;
    const futureBarsNeeded = config.futureBarsNeeded ?? 20;
    const stepSize = config.stepSize ?? 20;

    const market = toMarket(config.assetClass);
    const totalWindows = Math.floor((candles.length - windowSize - futureBarsNeeded) / stepSize);

    console.log(`   Running ${totalWindows} analysis windows...`);

    let windowCount = 0;
    for (let i = 0; i <= candles.length - windowSize - futureBarsNeeded; i += stepSize) {
      windowCount++;
      const window = candles.slice(i, i + windowSize);
      const futureBars = candles.slice(i + windowSize, i + windowSize + futureBarsNeeded);

      // ── Run SMC engine on this window ──
      const report = buildReport(
        window,
        config.displaySymbol,
        market,
        config.timeframe,
        { dailyCandles: window.slice(-60) }
      );

      // ── Generate signal from the report ──
      const signal = this.signalGenerator.generateFromReport(report, market, {
        source: "BACKTEST",
      });

      if (!signal) continue;

      // ── Simulate outcome from future bars ──
      const entryPrice = signal.entry_price;
      const stopLoss = signal.stop_loss;
      const takeProfit = signal.take_profit;
      let outcome: typeof signal.outcome = undefined;

      // Determine direction: if take_profit > entry_price, it's a long
      const isLong = takeProfit > entryPrice;

      for (let j = 0; j < futureBars.length; j++) {
        const bar = futureBars[j];

        if (isLong) {
          if (bar.low <= stopLoss) {
            outcome = {
              actual_entry_price: entryPrice,
              actual_exit_price: stopLoss,
              pnl: stopLoss - entryPrice,
              pnl_percent: ((stopLoss - entryPrice) / entryPrice) * 100,
              win: false,
              exit_reason: "SL_HIT",
              bars_to_exit: j + 1,
              closed_at: new Date(bar.time * 1000).toISOString(),
            };
            break;
          }
          if (bar.high >= takeProfit) {
            outcome = {
              actual_entry_price: entryPrice,
              actual_exit_price: takeProfit,
              pnl: takeProfit - entryPrice,
              pnl_percent: ((takeProfit - entryPrice) / entryPrice) * 100,
              win: true,
              exit_reason: "TP_HIT",
              bars_to_exit: j + 1,
              closed_at: new Date(bar.time * 1000).toISOString(),
            };
            break;
          }
        } else {
          // Short trade: stop_loss is above entry, take_profit is below
          if (bar.high >= stopLoss) {
            outcome = {
              actual_entry_price: entryPrice,
              actual_exit_price: stopLoss,
              pnl: entryPrice - stopLoss,
              pnl_percent: ((entryPrice - stopLoss) / entryPrice) * 100,
              win: false,
              exit_reason: "SL_HIT",
              bars_to_exit: j + 1,
              closed_at: new Date(bar.time * 1000).toISOString(),
            };
            break;
          }
          if (bar.low <= takeProfit) {
            outcome = {
              actual_entry_price: entryPrice,
              actual_exit_price: takeProfit,
              pnl: entryPrice - takeProfit,
              pnl_percent: ((entryPrice - takeProfit) / entryPrice) * 100,
              win: true,
              exit_reason: "TP_HIT",
              bars_to_exit: j + 1,
              closed_at: new Date(bar.time * 1000).toISOString(),
            };
            break;
          }
        }
      }

      // If no SL/TP hit, use last bar close
      if (!outcome) {
        const lastBar = futureBars[futureBars.length - 1];
        const pnl = isLong ? lastBar.close - entryPrice : entryPrice - lastBar.close;
        outcome = {
          actual_entry_price: entryPrice,
          actual_exit_price: lastBar.close,
          pnl,
          pnl_percent: (pnl / entryPrice) * 100,
          win: pnl > 0,
          exit_reason: "TIMEOUT",
          bars_to_exit: futureBars.length,
          closed_at: new Date(lastBar.time * 1000).toISOString(),
        };
      }

      signal.outcome = outcome;
      signals.push(signal);
    }

    // ── Log all signals ──
    console.log(`   Logging ${signals.length} signals to ledger...`);
    for (const signal of signals) {
      await this.ledgerService.logSignal(signal, "REVIEW");
    }

    // ── Calculate metrics ──
    const winningSignals = signals.filter((s) => s.outcome?.win).length;
    const losingSignals = signals.filter((s) => s.outcome && !s.outcome.win).length;
    const metrics = this.matrixService.calculateMetrics(
      signals.map((s) => ({ outcome: s.outcome }))
    );

    return {
      signals,
      metrics: {
        ...metrics,
        total_signals: signals.length,
        winning_signals: winningSignals,
        losing_signals: losingSignals,
      },
      candleCount: candles.length,
    };
  }

  /**
   * Run backtests across multiple assets/timeframes and rebuild the matrix.
   */
  async runMultiAssetBacktest(
    testCases: BacktestConfig[]
  ): Promise<Map<string, BacktestResult>> {
    const results = new Map<string, BacktestResult>();

    for (const config of testCases) {
      console.log(`\n📊 ${config.displaySymbol} (${config.assetClass}) @ ${config.timeframe}`);
      try {
        const result = await this.runBacktest(config);
        results.set(`${config.displaySymbol}_${config.timeframe}`, result);

        console.log(`   ✅ ${result.signals.length} signals | ` +
          `Win: ${(result.metrics.win_rate * 100).toFixed(1)}% | ` +
          `Sharpe: ${result.metrics.sharpe_ratio.toFixed(2)} | ` +
          `PF: ${result.metrics.profit_factor.toFixed(2)} | ` +
          `${result.candleCount} candles`);
      } catch (err: any) {
        console.log(`   ❌ Failed: ${err.message}`);
      }
    }

    return results;
  }
}
