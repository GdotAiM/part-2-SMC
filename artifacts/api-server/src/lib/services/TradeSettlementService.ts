import { TradeLedgerService } from "./TradeLedgerService.js";
import { fetchBinanceCandles } from "../fetchers/binance.js";
import { fetchYahooCandles } from "../fetchers/yahoo.js";
import { logger } from "../logger.js";

const SETTLE_INTERVAL_MS = 30_000; // check every 30 seconds
const BARS_TO_EXIT_DEFAULT = 1;

interface PendingTrade {
  id: string;
  symbol: string;
  asset_class: string;
  entry_price: string;
  stop_loss: string;
  take_profit: string;
  setup_type: string;
}

export class TradeSettlementService {
  private ledger = new TradeLedgerService();
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    logger.info({ intervalMs: SETTLE_INTERVAL_MS }, "TradeSettlementService started");
    // Run immediately on start, then on interval
    this.settlePending();
    this.timer = setInterval(() => this.settlePending(), SETTLE_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info("TradeSettlementService stopped");
    }
  }

  private async settlePending(): Promise<void> {
    try {
      const pending = (await this.ledger.getPendingSignals(100)) as unknown as PendingTrade[];
      if (pending.length === 0) return;

      // Group by symbol for batched price fetches
      const bySymbol = new Map<string, PendingTrade[]>();
      for (const trade of pending) {
        const existing = bySymbol.get(trade.symbol);
        if (existing) {
          existing.push(trade);
        } else {
          bySymbol.set(trade.symbol, [trade]);
        }
      }

      for (const [symbol, trades] of bySymbol) {
        const sampleTrade = trades[0];
        const isCrypto = sampleTrade.asset_class === "CRYPTO";

        try {
          // Fetch latest 1m candles for current price
          const candles = isCrypto
            ? await fetchBinanceCandles(symbol, "1m")
            : await fetchYahooCandles(symbol, "1m");

          if (!candles || candles.length === 0) continue;

          // Use the most recent candle for current price range
          const latestCandle = candles[candles.length - 1];
          const high = latestCandle.high;
          const low = latestCandle.low;
          const close = latestCandle.close;

          for (const trade of trades) {
            const entry = parseFloat(trade.entry_price);
            const tp = parseFloat(trade.take_profit);
            const sl = parseFloat(trade.stop_loss);

            let outcome: {
              actual_entry_price: number;
              actual_exit_price: number;
              pnl: number;
              pnl_percent: number;
              win: boolean;
              exit_reason: string;
              bars_to_exit: number;
              closed_at: string;
            } | null = null;

            // Check if TP was hit (price crossed above for longs, below for shorts)
            if (tp > entry) {
              // Long trade: TP above entry
              if (high >= tp) {
                const pnl = tp - entry;
                outcome = {
                  actual_entry_price: entry,
                  actual_exit_price: tp,
                  pnl,
                  pnl_percent: (pnl / entry) * 100,
                  win: true,
                  exit_reason: "TP_HIT",
                  bars_to_exit: BARS_TO_EXIT_DEFAULT,
                  closed_at: new Date().toISOString(),
                };
              } else if (low <= sl) {
                const pnl = sl - entry;
                outcome = {
                  actual_entry_price: entry,
                  actual_exit_price: sl,
                  pnl,
                  pnl_percent: (pnl / entry) * 100,
                  win: false,
                  exit_reason: "SL_HIT",
                  bars_to_exit: BARS_TO_EXIT_DEFAULT,
                  closed_at: new Date().toISOString(),
                };
              }
            } else {
              // Short trade: TP below entry
              if (low <= tp) {
                const pnl = entry - tp;
                outcome = {
                  actual_entry_price: entry,
                  actual_exit_price: tp,
                  pnl,
                  pnl_percent: (pnl / entry) * 100,
                  win: true,
                  exit_reason: "TP_HIT",
                  bars_to_exit: BARS_TO_EXIT_DEFAULT,
                  closed_at: new Date().toISOString(),
                };
              } else if (high >= sl) {
                const pnl = entry - sl;
                outcome = {
                  actual_entry_price: entry,
                  actual_exit_price: sl,
                  pnl,
                  pnl_percent: (pnl / entry) * 100,
                  win: false,
                  exit_reason: "SL_HIT",
                  bars_to_exit: BARS_TO_EXIT_DEFAULT,
                  closed_at: new Date().toISOString(),
                };
              }
            }

            if (outcome) {
              await this.ledger.recordOutcome(trade.id, outcome);
              logger.info(
                {
                  tradeId: trade.id,
                  symbol: trade.symbol,
                  setup: trade.setup_type,
                  win: outcome.win,
                  pnl: outcome.pnl.toFixed(2),
                  exitReason: outcome.exit_reason,
                },
                "Trade settled",
              );
            }
          }
        } catch (err) {
          logger.warn({ err, symbol }, "Failed to fetch prices for settlement");
        }
      }
    } catch (err) {
      logger.error({ err }, "TradeSettlementService error");
    }
  }
}
