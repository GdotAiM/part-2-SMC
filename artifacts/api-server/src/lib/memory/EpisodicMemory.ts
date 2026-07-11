/**
 * Episodic Memory — wraps TradeLedgerService for past signal/outcome recall.
 *
 * Provides the AgentLoop's episodic memory tier: recent signals, win rates,
 * and formatted context strings for LLM prompt injection.
 */

import type { TradeLedgerEntry } from "../services/TradeLedgerService.js";
import { TradeLedgerService } from "../services/TradeLedgerService.js";

export interface EpisodicRecall {
  symbol: string;
  signals: TradeLedgerEntry[];
  winRate: number;
  totalTrades: number;
}

export class EpisodicMemory {
  private ledger: TradeLedgerService;

  constructor() {
    this.ledger = new TradeLedgerService();
  }

  /**
   * Get recent signals with outcomes for a symbol.
   */
  async getRecentBySymbol(symbol: string, limit = 10): Promise<TradeLedgerEntry[]> {
    const signals = await this.ledger.getSignalsBySymbol(symbol, limit);
    return signals as unknown as TradeLedgerEntry[];
  }

  /**
   * Get recent signals with a specific setup type.
   */
  async getBySetupType(setupType: string, limit = 10): Promise<TradeLedgerEntry[]> {
    const signals = await this.ledger.getSignalsBySetup(setupType, limit);
    return signals as unknown as TradeLedgerEntry[];
  }

  /**
   * Get recent signals for a symbol in a market regime.
   */
  async getByRegime(regime: string, limit = 10): Promise<TradeLedgerEntry[]> {
    const signals = await this.ledger.getSignalsByRegime(regime, limit);
    return signals as unknown as TradeLedgerEntry[];
  }

  /**
   * Count wins, losses, and total trades for a symbol.
   */
  async getWinRate(symbol: string, setupType?: string): Promise<{ wins: number; losses: number; total: number }> {
    const filters: Record<string, string | undefined> = { symbol };
    if (setupType) filters.setup = setupType;

    const signals = await this.ledger.querySignals({
      symbol,
      asset: undefined,
      setup: setupType,
      mode: undefined,
      limit: 1000,
    });

    const trades = signals as unknown as TradeLedgerEntry[];
    const withOutcome = trades.filter((t) => t.outcome != null);
    const wins = withOutcome.filter((t) => {
      const o = typeof t.outcome === "string" ? JSON.parse(t.outcome) : t.outcome;
      return o?.win === true;
    }).length;
    const losses = withOutcome.filter((t) => {
      const o = typeof t.outcome === "string" ? JSON.parse(t.outcome) : t.outcome;
      return o?.win === false;
    }).length;

    return { wins, losses, total: withOutcome.length };
  }

  /**
   * Format episodic data as a context string for LLM prompts.
   */
  async formatForPrompt(symbol: string, maxEntries = 5): Promise<string> {
    const signals = await this.getRecentBySymbol(symbol, maxEntries);
    if (signals.length === 0) return "No recent trade signals for this symbol.";

    const { wins, losses, total } = await this.getWinRate(symbol);
    const winRateStr = total > 0 ? `${Math.round((wins / total) * 100)}%` : "N/A";

    const lines = signals.map((s, i) => {
      const o = s.outcome ? (typeof s.outcome === "string" ? JSON.parse(s.outcome) : s.outcome) : null;
      const outcomeStr = o ? (o.win ? "WIN" : "LOSS") : "PENDING";
      return `  ${i + 1}. ${s.symbol} ${s.setup_type}/${s.setup_subtype} | Confidence: ${s.confidence_score} | Outcome: ${outcomeStr}`;
    });

    return `Recent signals for ${symbol} (Win rate: ${winRateStr}, ${wins}W/${losses}L of ${total}):\n${lines.join("\n")}`;
  }
}
