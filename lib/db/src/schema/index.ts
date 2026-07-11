import {
  pgTable,
  uuid,
  varchar,
  decimal,
  integer,
  boolean,
  jsonb,
  timestamp,
  text,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// ═══════════════════════════════════════════════════════════
// Trades Ledger Table
// ═══════════════════════════════════════════════════════════

export const trades = pgTable(
  "trades",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Asset identification
    asset_class: varchar("asset_class", { length: 20 }).notNull(), // STOCK | FOREX | CRYPTO
    symbol: varchar("symbol", { length: 20 }).notNull(),

    // Setup identification (multi-dimensional)
    setup_type: varchar("setup_type", { length: 50 }).notNull(),
    setup_subtype: varchar("setup_subtype", { length: 50 }).notNull(),

    // Entry/exit
    entry_price: decimal("entry_price", { precision: 20, scale: 8 }).notNull(),
    stop_loss: decimal("stop_loss", { precision: 20, scale: 8 }).notNull(),
    take_profit: decimal("take_profit", { precision: 20, scale: 8 }).notNull(),
    confidence_score: integer("confidence_score").notNull(),

    // Context (jsonb for flexible querying)
    analysis_context: jsonb("analysis_context").notNull().$type<{
      timeframe_cascade: { macro: string; intermediate: string; execution: string };
      market_regime: string;
      session_context: string;
      htf_bias: string;
      confluence_factors: Record<string, boolean>;
    }>(),

    // Parameters used at signal time
    parameter_snapshot: jsonb("parameter_snapshot").notNull().$type<Record<string, any>>(),

    // Execution
    execution_mode: varchar("execution_mode", { length: 10 }).notNull().default("REVIEW"), // REVIEW | LIVE
    order_id: varchar("order_id", { length: 100 }),

    // Outcome (filled after trade closes)
    outcome: jsonb("outcome").$type<{
      actual_entry_price: number;
      actual_exit_price: number;
      pnl: number;
      pnl_percent: number;
      win: boolean;
      exit_reason: string;
      bars_to_exit: number;
      closed_at?: string;
    }>(),

    // Rationale
    rationale: jsonb("rationale").$type<{
      structure_confluence: string;
      liquidity_quality: string;
      session_context_reason?: string;
    }>(),

    // Setup quality
    structure_confluence: integer("structure_confluence").default(0),
    liquidity_quality: integer("liquidity_quality").default(0),
    confluence_count: integer("confluence_count").default(0),

    // Risk
    risk_reward_ratio: decimal("risk_reward_ratio", { precision: 8, scale: 4 }),

    // Timestamps
    signal_timestamp: timestamp("signal_timestamp").notNull().defaultNow(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    closed_at: timestamp("closed_at"),
  },
  (table) => ({
    idxAssetSetup: index("idx_trades_asset_setup").on(
      table.asset_class,
      table.setup_type
    ),
    idxSymbolSetup: index("idx_trades_symbol_setup").on(
      table.symbol,
      table.setup_type
    ),
    idxExecutionMode: index("idx_trades_execution_mode").on(
      table.execution_mode
    ),
    idxCreatedAt: index("idx_trades_created_at").on(table.created_at),
    idxAssetClass: index("idx_trades_asset_class").on(table.asset_class),
  })
);

export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  created_at: true,
});
export type InsertTrade = typeof trades.$inferInsert;
export type Trade = typeof trades.$inferSelect;

// ═══════════════════════════════════════════════════════════
// Performance Matrix Table (pre-computed metrics per dimension combo)
// ═══════════════════════════════════════════════════════════

export const performanceMatrix = pgTable(
  "performance_matrix",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Dimensions (the combination key)
    asset_class: varchar("asset_class", { length: 20 }).notNull(),
    symbol: varchar("symbol", { length: 20 }).notNull(),
    setup_type: varchar("setup_type", { length: 50 }).notNull(),
    setup_subtype: varchar("setup_subtype", { length: 50 }).notNull(),
    timeframe_cascade: varchar("timeframe_cascade", { length: 50 }).notNull(),
    market_regime: varchar("market_regime", { length: 50 }).notNull(),
    session_context: varchar("session_context", { length: 50 }).notNull(),

    // Metrics
    win_rate: decimal("win_rate", { precision: 5, scale: 4 }).notNull(),
    sharpe_ratio: decimal("sharpe_ratio", { precision: 8, scale: 4 }).notNull(),
    profit_factor: decimal("profit_factor", { precision: 8, scale: 4 }).notNull(),
    avg_win: decimal("avg_win", { precision: 16, scale: 4 }).notNull().default("0"),
    avg_loss: decimal("avg_loss", { precision: 16, scale: 4 }).notNull().default("0"),
    max_drawdown: decimal("max_drawdown", { precision: 5, scale: 4 }).notNull().default("0"),
    trials: integer("trials").notNull().default(0),
    is_significant: boolean("is_significant").notNull().default(false),

    // Best parameters for this combination
    parameters: jsonb("parameters").$type<Record<string, any>>(),

    // Meta
    last_calculated: timestamp("last_calculated").notNull().defaultNow(),
    last_optimized: timestamp("last_optimized"),
  },
  (table) => ({
    // Unique constraint on the dimension combination
    idxDimensionUnique: uniqueIndex("idx_perf_matrix_dimensions").on(
      table.asset_class,
      table.symbol,
      table.setup_type,
      table.setup_subtype,
      table.timeframe_cascade,
      table.market_regime,
      table.session_context
    ),
    idxSignificant: index("idx_perf_matrix_significant").on(
      table.is_significant,
      table.sharpe_ratio
    ),
    idxAssetClass: index("idx_perf_matrix_asset").on(table.asset_class),
    idxSetupType: index("idx_perf_matrix_setup").on(table.setup_type),
    idxSharpe: index("idx_perf_matrix_sharpe").on(table.sharpe_ratio),
  })
);

export const insertPerformanceMatrixSchema = createInsertSchema(
  performanceMatrix
).omit({ id: true, last_calculated: true });
export type InsertPerformanceMatrix = typeof performanceMatrix.$inferInsert;
export type PerformanceMatrixRow = typeof performanceMatrix.$inferSelect;

// ═══════════════════════════════════════════════════════════
// Agent Loop Runs Table
// ═══════════════════════════════════════════════════════════

export const agentLoopRuns = pgTable(
  "agent_loop_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // What was configured
    symbol: varchar("symbol", { length: 20 }).notNull(),
    timeframe: varchar("timeframe", { length: 5 }).notNull(),
    market: varchar("market", { length: 10 }).notNull(),

    // Config snapshot (store the full JSON config)
    config_snapshot: jsonb("config_snapshot").notNull(),

    // Status
    status: varchar("status", { length: 20 }).notNull().default("running"), // running | completed | error | stopped

    // Trigger
    triggered_by: varchar("triggered_by", { length: 20 }).notNull(), // candle_close | api | scheduled | manual

    // Iterations
    total_iterations: integer("total_iterations").default(0),
    total_tokens: integer("total_tokens").default(0),

    // Result
    result: jsonb("result"),
    error: varchar("error", { length: 500 }),

    // Evaluation scores (filled when evaluation runs)
    evaluation_score: integer("evaluation_score"), // 0-100
    evaluation: jsonb("evaluation"),

    // Timestamps
    started_at: timestamp("started_at").notNull().defaultNow(),
    completed_at: timestamp("completed_at"),
  },
  (table) => ({
    idxLoopSymbol: index("idx_loop_symbol").on(table.symbol),
    idxLoopStatus: index("idx_loop_status").on(table.status),
    idxLoopStarted: index("idx_loop_started").on(table.started_at),
    idxLoopTrigger: index("idx_loop_trigger").on(table.triggered_by),
  })
);

// ═══════════════════════════════════════════════════════════
// Agent Loop Steps Table (trace data)
// ═══════════════════════════════════════════════════════════

export const agentLoopSteps = pgTable(
  "agent_loop_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    run_id: uuid("run_id").notNull().references(() => agentLoopRuns.id, { onDelete: "cascade" }),

    // Hierarchy
    iteration_sequence: integer("iteration_sequence").notNull(),
    step_type: varchar("step_type", { length: 30 }).notNull(), // observe | interpret | reason | decide | act | evaluate | update_memory

    // Timing
    started_at: timestamp("started_at").notNull(),
    completed_at: timestamp("completed_at"),
    duration_ms: integer("duration_ms"),

    // Payload
    input_snapshot: jsonb("input_snapshot"), // what went in
    output_snapshot: jsonb("output_snapshot"), // what came out
    tool_calls: jsonb("tool_calls"),

    // Errors
    error: varchar("error", { length: 500 }),
  },
  (table) => ({
    idxStepRun: index("idx_step_run").on(table.run_id),
    idxStepType: index("idx_step_type").on(table.step_type),
  })
);

// ═══════════════════════════════════════════════════════════
// Agent Memory Table (semantic/procedural knowledge)
// ═══════════════════════════════════════════════════════════

export const agentMemory = pgTable(
  "agent_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Key-value with tags
    memory_key: varchar("memory_key", { length: 200 }).notNull(),
    content: text("content").notNull(),
    source: varchar("source", { length: 30 }).notNull().default("episode"), // matrix | episode | manual | evaluation

    // Relevance scoring
    score: decimal("score", { precision: 5, scale: 4 }).notNull().default("0"),
    tags: varchar("tags", { length: 50 }).array().notNull().default([]),

    // Ephemeral/session-bound or durable
    is_durable: boolean("is_durable").notNull().default(true),

    // Meta
    source_run_id: varchar("source_run_id", { length: 100 }),
    created_at: timestamp("created_at").notNull().defaultNow(),
    last_accessed_at: timestamp("last_accessed_at"),
  },
  (table) => ({
    idxMemoryKey: uniqueIndex("idx_memory_key").on(table.memory_key),
    idxMemoryTags: index("idx_memory_tags").on(table.tags),
    idxMemoryScore: index("idx_memory_score").on(table.score),
  })
);
