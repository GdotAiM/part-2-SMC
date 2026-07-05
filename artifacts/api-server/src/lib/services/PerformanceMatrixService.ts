import { db } from "@workspace/db";
import { trades, performanceMatrix } from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export interface PerformanceMetrics {
  win_rate: number;
  sharpe_ratio: number;
  profit_factor: number;
  avg_win: number;
  avg_loss: number;
  max_drawdown: number;
}

export class PerformanceMatrixService {
  /**
   * Calculate performance metrics from a list of trade records.
   */
  calculateMetrics(tradeList: any[]): PerformanceMetrics {
    if (!tradeList || tradeList.length === 0) {
      return {
        win_rate: 0,
        sharpe_ratio: 0,
        profit_factor: 0,
        avg_win: 0,
        avg_loss: 0,
        max_drawdown: 0,
      };
    }

    const closedTrades = tradeList.filter((t) => t.outcome != null);

    if (closedTrades.length === 0) {
      return {
        win_rate: 0,
        sharpe_ratio: 0,
        profit_factor: 0,
        avg_win: 0,
        avg_loss: 0,
        max_drawdown: 0,
      };
    }

    // Win rate
    const wins = closedTrades.filter((t) => {
      const outcome = typeof t.outcome === "string" ? JSON.parse(t.outcome) : t.outcome;
      return outcome?.win === true;
    }).length;
    const losses = closedTrades.filter((t) => {
      const outcome = typeof t.outcome === "string" ? JSON.parse(t.outcome) : t.outcome;
      return outcome?.win === false;
    }).length;
    const win_rate = closedTrades.length > 0 ? wins / closedTrades.length : 0;

    // P&L extraction
    const pnls: number[] = closedTrades.map((t) => {
      const outcome = typeof t.outcome === "string" ? JSON.parse(t.outcome) : t.outcome;
      return parseFloat(outcome?.pnl ?? "0");
    });

    const winPnls = closedTrades
      .filter((t) => {
        const outcome = typeof t.outcome === "string" ? JSON.parse(t.outcome) : t.outcome;
        return outcome?.win === true;
      })
      .map((t) => {
        const outcome = typeof t.outcome === "string" ? JSON.parse(t.outcome) : t.outcome;
        return parseFloat(outcome?.pnl ?? "0");
      });

    const lossPnls = closedTrades
      .filter((t) => {
        const outcome = typeof t.outcome === "string" ? JSON.parse(t.outcome) : t.outcome;
        return outcome?.win === false;
      })
      .map((t) => {
        const outcome = typeof t.outcome === "string" ? JSON.parse(t.outcome) : t.outcome;
        return Math.abs(parseFloat(outcome?.pnl ?? "0"));
      });

    // Avg win / avg loss
    const avg_win = winPnls.length > 0 ? winPnls.reduce((a, b) => a + b, 0) / winPnls.length : 0;
    const avg_loss =
      lossPnls.length > 0 ? lossPnls.reduce((a, b) => a + b, 0) / lossPnls.length : 0;
    const profit_factor = avg_loss > 0 ? avg_win / avg_loss : avg_win > 0 ? 999 : 0;

    // Sharpe ratio (simplified)
    const mean = pnls.reduce((a, b) => a + b, 0) / pnls.length;
    const variance =
      pnls.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / pnls.length;
    const stdDev = Math.sqrt(variance);
    const sharpe_ratio = stdDev > 0 ? mean / stdDev : 0;

    // Max drawdown
    let peak = 0;
    let max_drawdown = 0;
    let cumulativePnl = 0;
    for (const pnl of pnls) {
      cumulativePnl += pnl;
      if (cumulativePnl > peak) peak = cumulativePnl;
      if (peak > 0) {
        const drawdown = (peak - cumulativePnl) / peak;
        if (drawdown > max_drawdown) max_drawdown = drawdown;
      }
    }

    return {
      win_rate: Math.round(win_rate * 10000) / 10000,
      sharpe_ratio: Math.round(sharpe_ratio * 10000) / 10000,
      profit_factor: Math.round(profit_factor * 100) / 100,
      avg_win: Math.round(avg_win * 100) / 100,
      avg_loss: Math.round(avg_loss * 100) / 100,
      max_drawdown: Math.round(max_drawdown * 10000) / 10000,
    };
  }

  /**
   * Update (or insert) the performance matrix row for a specific dimension combination.
   */
  async updateMatrixForCombination(
    assetClass: string,
    symbol: string,
    setupType: string,
    setupSubtype: string,
    timeframeCascade: string,
    marketRegime: string,
    sessionContext: string
  ): Promise<void> {
    // Fetch all trades matching this combination
    const matchingTrades = await db
      .select()
      .from(trades)
      .where(
        and(
          eq(trades.asset_class, assetClass),
          eq(trades.symbol, symbol),
          eq(trades.setup_type, setupType),
          eq(trades.setup_subtype, setupSubtype)
        )
      );

    // Further filter on JSONB fields
    const filtered = matchingTrades.filter((t) => {
      const ctx = t.analysis_context as any;
      const tfCascade = `${ctx?.timeframe_cascade?.macro ?? ""}_${ctx?.timeframe_cascade?.intermediate ?? ""}_${ctx?.timeframe_cascade?.execution ?? ""}`;
      const regime = ctx?.market_regime ?? "";
      const session = ctx?.session_context ?? "";

      const tfMatch = !timeframeCascade || tfCascade === timeframeCascade;
      const regimeMatch = !marketRegime || regime === marketRegime;
      const sessionMatch = !sessionContext || session === sessionContext;

      return tfMatch && regimeMatch && sessionMatch;
    });

    if (filtered.length < 5) {
      // Need at least 5 trades for a meaningful matrix entry
      return;
    }

    const metrics = this.calculateMetrics(filtered);

    // Check if a row already exists for this combination
    const existing = await db
      .select()
      .from(performanceMatrix)
      .where(
        and(
          eq(performanceMatrix.asset_class, assetClass),
          eq(performanceMatrix.symbol, symbol),
          eq(performanceMatrix.setup_type, setupType),
          eq(performanceMatrix.setup_subtype, setupSubtype),
          eq(performanceMatrix.timeframe_cascade, timeframeCascade),
          eq(performanceMatrix.market_regime, marketRegime),
          eq(performanceMatrix.session_context, sessionContext)
        )
      )
      .limit(1);

    const matrixData = {
      asset_class: assetClass,
      symbol,
      setup_type: setupType,
      setup_subtype: setupSubtype,
      timeframe_cascade: timeframeCascade,
      market_regime: marketRegime,
      session_context: sessionContext,
      win_rate: metrics.win_rate.toString(),
      sharpe_ratio: metrics.sharpe_ratio.toString(),
      profit_factor: metrics.profit_factor.toString(),
      avg_win: metrics.avg_win.toString(),
      avg_loss: metrics.avg_loss.toString(),
      max_drawdown: metrics.max_drawdown.toString(),
      trials: filtered.length,
      is_significant: filtered.length >= 20,
      last_calculated: new Date(),
    };

    if (existing.length > 0) {
      await db
        .update(performanceMatrix)
        .set(matrixData)
        .where(eq(performanceMatrix.id, existing[0].id));
    } else {
      await db.insert(performanceMatrix).values(matrixData);
    }
  }

  /**
   * Recompute the entire performance matrix from all trades.
   */
  async rebuildFullMatrix(): Promise<number> {
    const allTrades = await db.select().from(trades);
    const combos = new Map<string, any[]>();

    // Group trades by dimension combination
    for (const t of allTrades) {
      const ctx = t.analysis_context as any;
      const tfCascade = `${ctx?.timeframe_cascade?.macro ?? ""}_${ctx?.timeframe_cascade?.intermediate ?? ""}_${ctx?.timeframe_cascade?.execution ?? ""}`;
      const regime = ctx?.market_regime ?? "UNKNOWN";
      const session = ctx?.session_context ?? "UNKNOWN";

      const key = `${t.asset_class}|${t.symbol}|${t.setup_type}|${t.setup_subtype}|${tfCascade}|${regime}|${session}`;

      if (!combos.has(key)) combos.set(key, []);
      combos.get(key)!.push(t);
    }

    let count = 0;
    for (const [key, tradeList] of combos) {
      const [assetClass, symbol, setupType, setupSubtype, tfCascade, regime, session] =
        key.split("|");

      if (tradeList.length < 5) continue;

      const metrics = this.calculateMetrics(tradeList);

      const existing = await db
        .select()
        .from(performanceMatrix)
        .where(
          and(
            eq(performanceMatrix.asset_class, assetClass),
            eq(performanceMatrix.symbol, symbol),
            eq(performanceMatrix.setup_type, setupType),
            eq(performanceMatrix.setup_subtype, setupSubtype),
            eq(performanceMatrix.timeframe_cascade, tfCascade),
            eq(performanceMatrix.market_regime, regime),
            eq(performanceMatrix.session_context, session)
          )
        )
        .limit(1);

      const matrixData = {
        asset_class: assetClass,
        symbol,
        setup_type: setupType,
        setup_subtype: setupSubtype,
        timeframe_cascade: tfCascade,
        market_regime: regime,
        session_context: session,
        win_rate: metrics.win_rate.toString(),
        sharpe_ratio: metrics.sharpe_ratio.toString(),
        profit_factor: metrics.profit_factor.toString(),
        avg_win: metrics.avg_win.toString(),
        avg_loss: metrics.avg_loss.toString(),
        max_drawdown: metrics.max_drawdown.toString(),
        trials: tradeList.length,
        is_significant: tradeList.length >= 20,
        last_calculated: new Date(),
      };

      if (existing.length > 0) {
        await db
          .update(performanceMatrix)
          .set(matrixData)
          .where(eq(performanceMatrix.id, existing[0].id));
      } else {
        await db.insert(performanceMatrix).values(matrixData);
      }

      count++;
    }

    return count;
  }

  /**
   * Get top-performing setups for a given asset class, ranked by Sharpe ratio.
   */
  async getTopSetupsByAsset(assetClass: string, limit = 10) {
    return db
      .select()
      .from(performanceMatrix)
      .where(eq(performanceMatrix.asset_class, assetClass))
      .orderBy(desc(performanceMatrix.sharpe_ratio))
      .limit(limit);
  }

  /**
   * Get all matrix rows with optional filters.
   */
  async queryMatrix(filters: { asset?: string; detailed?: boolean; limit?: number }) {
    const conditions = [];

    if (filters.asset && filters.asset !== "ALL") {
      conditions.push(eq(performanceMatrix.asset_class, filters.asset));
    }

    const query = db.select().from(performanceMatrix).$dynamic();

    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    return query
      .orderBy(desc(performanceMatrix.sharpe_ratio))
      .limit(filters.limit ?? (filters.detailed ? 100 : 10));
  }

  /**
   * Get underperforming setups below a minimum Sharpe threshold.
   */
  async getUnderperformingSetups(minSharpe = 1.0) {
    return db
      .select()
      .from(performanceMatrix)
      .where(
        sql`${performanceMatrix.sharpe_ratio}::numeric < ${minSharpe}`
      );
  }
}
