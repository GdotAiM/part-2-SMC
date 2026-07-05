import { db } from "@workspace/db";
import { trades } from "@workspace/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import type { UnifiedTradeSignal } from "./SignalGenerator.js";

export interface TradeLedgerEntry {
  id: string;
  signal_id: string;
  symbol: string;
  asset_class: string;
  setup_type: string;
  setup_subtype: string;
  confidence_score: number;
  entry_price: string;
  stop_loss: string;
  take_profit: string;
  timeframe_cascade: string;
  market_regime: string;
  session_context: string;
  parameter_snapshot: string;
  execution_mode: "REVIEW" | "LIVE";
  execution_timestamp: Date;
  order_id?: string;
  outcome?: string;
  created_at: Date;
}

export class TradeLedgerService {
  /**
   * Log a trade signal to the database.
   */
  async logSignal(
    signal: UnifiedTradeSignal,
    executionMode: "REVIEW" | "LIVE",
    orderId?: string
  ): Promise<string> {
    const result = await db
      .insert(trades)
      .values({
        asset_class: signal.asset_class,
        symbol: signal.symbol,
        setup_type: signal.setup_type,
        setup_subtype: signal.setup_subtype,
        entry_price: signal.entry_price.toString(),
        stop_loss: signal.stop_loss.toString(),
        take_profit: signal.take_profit.toString(),
        confidence_score: signal.confidence_score,
        analysis_context: signal.analysis_context as any,
        parameter_snapshot: signal.parameter_snapshot,
        execution_mode: executionMode,
        order_id: orderId ?? null,
        outcome: signal.outcome ? (signal.outcome as any) : null,
        rationale: signal.rationale as any,
        structure_confluence: signal.setup_quality_factors.structure_confluence,
        liquidity_quality: signal.setup_quality_factors.liquidity_quality,
        confluence_count: signal.setup_quality_factors.confluence_count,
        risk_reward_ratio: signal.risk_reward_ratio.toString(),
        signal_timestamp: new Date(signal.timestamp),
        closed_at: signal.outcome?.closed_at ? new Date(signal.outcome.closed_at) : null,
      })
      .returning({ signal_id: trades.id });

    return result[0]?.signal_id ?? signal.id;
  }

  /**
   * Record an outcome for a previously logged signal.
   */
  async recordOutcome(
    signalId: string,
    outcome: {
      actual_entry_price: number;
      actual_exit_price: number;
      pnl: number;
      pnl_percent: number;
      win: boolean;
      exit_reason: string;
      bars_to_exit: number;
      closed_at?: string;
    }
  ): Promise<void> {
    await db
      .update(trades)
      .set({
        outcome: outcome as any,
        closed_at: outcome.closed_at ? new Date(outcome.closed_at) : new Date(),
      })
      .where(eq(trades.id, signalId));
  }

  /**
   * Get signals by asset class.
   */
  async getSignalsByAsset(assetClass: string, limit = 50) {
    return db
      .select()
      .from(trades)
      .where(eq(trades.asset_class, assetClass))
      .orderBy(desc(trades.created_at))
      .limit(limit);
  }

  /**
   * Get signals by setup type.
   */
  async getSignalsBySetup(setupType: string, limit = 50) {
    return db
      .select()
      .from(trades)
      .where(eq(trades.setup_type, setupType))
      .orderBy(desc(trades.created_at))
      .limit(limit);
  }

  /**
   * Get signals by symbol.
   */
  async getSignalsBySymbol(symbol: string, limit = 50) {
    return db
      .select()
      .from(trades)
      .where(eq(trades.symbol, symbol))
      .orderBy(desc(trades.created_at))
      .limit(limit);
  }

  /**
   * Get signals by market regime.
   */
  async getSignalsByRegime(regime: string, limit = 50) {
    return db
      .select()
      .from(trades)
      .where(
        sql`${trades.analysis_context}->>'market_regime' = ${regime}`
      )
      .orderBy(desc(trades.created_at))
      .limit(limit);
  }

  /**
   * Get signals without an outcome (pending).
   */
  async getPendingSignals(limit = 50) {
    return db
      .select()
      .from(trades)
      .where(sql`${trades.outcome} IS NULL`)
      .orderBy(desc(trades.created_at))
      .limit(limit);
  }

  /**
   * Get all signals with optional filters.
   */
  async querySignals(filters: {
    asset?: string;
    setup?: string;
    symbol?: string;
    mode?: string;
    limit?: number;
  }) {
    const conditions = [];

    if (filters.asset && filters.asset !== "ALL") {
      conditions.push(eq(trades.asset_class, filters.asset));
    }
    if (filters.setup && filters.setup !== "ALL") {
      conditions.push(eq(trades.setup_type, filters.setup));
    }
    if (filters.symbol) {
      conditions.push(eq(trades.symbol, filters.symbol));
    }
    if (filters.mode) {
      conditions.push(eq(trades.execution_mode, filters.mode));
    }

    const query = db.select().from(trades).$dynamic();

    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    return query
      .orderBy(desc(trades.created_at))
      .limit(filters.limit ?? 50);
  }
}
