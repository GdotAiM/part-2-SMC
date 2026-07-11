/**
 * Memory Service — facade over all memory tiers.
 *
 * Combines EpisodicMemory (past signals/outcomes) and SemanticMemory
 * (patterns, rules, knowledge) into one interface for the AgentLoop.
 */

import { EpisodicMemory } from "./EpisodicMemory.js";
import { SemanticMemory } from "./SemanticMemory.js";
import type { UnifiedTradeSignal } from "../services/SignalGenerator.js";

export class MemoryService {
  public episodic: EpisodicMemory;
  public semantic: SemanticMemory;

  constructor() {
    this.episodic = new EpisodicMemory();
    this.semantic = new SemanticMemory();
  }

  /**
   * Build a single formatted prompt context from all memory tiers.
   */
  async buildPromptContext(symbol: string, regime: string): Promise<string> {
    const [episodicStr, semanticStr] = await Promise.all([
      this.episodic.formatForPrompt(symbol),
      this.semantic.formatForPrompt(symbol, regime),
    ]);

    return [
      "=== EPISODIC MEMORY (Recent Signals & Outcomes) ===",
      episodicStr,
      "",
      "=== SEMANTIC MEMORY (Patterns & Rules) ===",
      semanticStr,
    ].join("\n");
  }

  /**
   * Record outcome of a loop cycle into relevant memory stores.
   */
  async recordOutcome(
    _loopId: string,
    signal: UnifiedTradeSignal,
    win: boolean,
  ): Promise<void> {
    // Store as a semantic memory entry for pattern learning
    const key = `result|${signal.symbol}|${signal.setup_type}|${signal.setup_subtype}|${signal.analysis_context.market_regime}`;
    const outcomeText = win ? "WIN" : "LOSS";

    await this.semantic.storeEntry({
      key,
      content: `${signal.setup_type}/${signal.setup_subtype} on ${signal.symbol} → ${outcomeText} (confidence: ${signal.confidence_score}, R:R: ${signal.risk_reward_ratio})`,
      source: "episode",
      score: win ? 0.8 : 0.2,
      tags: [signal.setup_type, signal.symbol, signal.analysis_context.market_regime],
      isDurable: true,
      sourceRunId: _loopId,
    });
  }
}
