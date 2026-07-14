# Learning & Validation Framework — Architectural Report

## Phase 1 — Repository Analysis Complete

### Current Architecture Overview

The SMC Pulse Predict system is a Node.js/Express 5 application with the following layers:

1. **Market Data Layer** — Binance WS (crypto) + Finnhub/Yahoo polling (forex) → `candleStore` (in-memory)
2. **SMC Engine** — `lib/smc/` — 7 pure detection modules (structure, liquidity, OB, FVG, PD Array, daily bias, SMT) orchestrated by `report.ts`
3. **AI Layer** — Fireworks AI (DeepSeek V4 Pro), SSE streaming, 3 modes: Q&A, Pipeline (4 agents), Agent Loop (7-step autonomous cycle)
4. **Memory Layer** — EpisodicMemory (trade outcomes), SemanticMemory (agent_memory table), Qdrant (vector similarity)
5. **Execution Layer** — MockBroker / AlpacaAdapter, SignalGenerator, TradeLedgerService
6. **Observability** — Langfuse tracing, LoopTracer/LoopEvaluator, agent_loop_runs/steps tables
7. **TradingView Integration** — CDP Puppeteer (legacy) + chrome-remote-interface (new) for Desktop control
8. **MCP Server** — FastMCP v4.3.2, 86 TV Desktop tools + 11 legacy SMC tools

### Current Strengths

- Pure functional SMC detection — no external dependencies, runs in <20ms
- Multi-TF cascade analysis with confluence scoring
- Agent Loop with guardrails, memory, and observability
- Trade ledger with 7-dimension performance matrix
- Sliding-window SMC backtest runner
- Battle-tested TV Desktop integration (86 tools)
- SSE real-time pipeline (candle close → report → broadcast in <100ms)

### Current Weaknesses (Gaps This Framework Fills)

1. **No comparison mechanism** — internal SMC engine and external TV indicators are never cross-referenced
2. **No outcome tracking** — signals logged to ledger but no systematic evaluation of whether the SMC levels actually held or failed
3. **No learning feedback loop** — engine parameters are static, no mechanism to improve from historical outcomes
4. **No reliability scoring** — confidence is per-report, not per-component accumulated over hundreds of examples
5. **No TV indicator data ingestion** — the 86 tools can read indicators but this is never done systematically
6. **No parameter evolution** — config.ts values (ATR period, lookback, thresholds) are manually tuned, never data-driven
7. **No post-trade reflection** — no structured "what did we learn" step after trade completion

### Integration Points

| Component | Where It Fits | Hooks Into |
|---|---|---|
| ComparisonEngine | `lib/comparison/` | TV Desktop CDP + SMC Engine + candleStore |
| EvidenceFusionLayer | `lib/fusion/` | ComparisonEngine + PerformanceMatrix + agent_memory |
| LearningService | `lib/learning/` | DetectionComparison table + trade outcomes |
| OutcomeEvaluationService | `lib/evaluation/` | TradeLedgerService + future candle data |
| ReliabilityEngine | `lib/reliability/` | DetectionComparison + DetectionOutcome tables |
| ReflectionEngine | `lib/reflection/` | Agent Loop completion + trades table |
| ParameterRecommendationService | `lib/optimization/` | DetectionComparison + ModelPerformance tables |
| KnowledgeBaseService | `lib/knowledge/` | LearningEvent + PatternStatistics tables |
| LearningDashboard | Frontend page | All new API endpoints |

### Database Schema Plan

New tables (all in existing Drizzle schema pattern):

| Table | Purpose |
|---|---|
| `detection_comparisons` | Per-event TV vs Engine comparison records |
| `detection_outcomes` | Market result of a detection (did price respect it?) |
| `model_performance` | Accumulated reliability by detection type |
| `parameter_history` | Versioned parameter snapshots |
| `learning_events` | Significant learning events |
| `pattern_statistics` | Recurring pattern analysis |
