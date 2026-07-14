/**
 * Learning & Validation Framework — Database Schema
 *
 * Tables for the evidence-driven feedback system that compares
 * internal SMC Engine outputs against TradingView/Pine indicators
 * and accumulates reliability data from market outcomes.
 */

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

// ═══════════════════════════════════════════════════════════════════════════
// Detection Comparisons
// Per-event record comparing TV/Pine vs Internal Engine for a detection point
// ═══════════════════════════════════════════════════════════════════════════

export const detectionComparisons = pgTable(
  "detection_comparisons",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Market context
    symbol: varchar("symbol", { length: 20 }).notNull(),
    timeframe: varchar("timeframe", { length: 5 }).notNull(),
    market: varchar("market", { length: 10 }).notNull(),

    // What was detected
    detection_type: varchar("detection_type", { length: 30 }).notNull(),
    // OB, FVG, BOS, CHoCH, MSS, LIQUIDITY_SWEEP, EQH, EQL,
    // PREMIUM, DISCOUNT, SMT, SESSION_BREAKOUT, DISPLACEMENT, BIAS

    // Price level of detection
    price_level: decimal("price_level", { precision: 20, scale: 8 }).notNull(),

    // TradingView side (null = TV didn't detect)
    tv_detected: boolean("tv_detected").notNull().default(false),
    tv_confidence: decimal("tv_confidence", { precision: 5, scale: 4 }),
    tv_price: decimal("tv_price", { precision: 20, scale: 8 }),
    tv_metadata: jsonb("tv_metadata").$type<Record<string, any>>(),

    // Internal engine side (null = Engine didn't detect)
    engine_detected: boolean("engine_detected").notNull().default(false),
    engine_confidence: decimal("engine_confidence", { precision: 5, scale: 4 }),
    engine_price: decimal("engine_price", { precision: 20, scale: 8 }),
    engine_metadata: jsonb("engine_metadata").$type<Record<string, any>>(),

    // Agreement analysis
    agreement: varchar("agreement", { length: 20 }).notNull(),
    // BOTH_DETECTED, TV_ONLY, ENGINE_ONLY, NEITHER

    price_discrepancy_pct: decimal("price_discrepancy_pct", { precision: 10, scale: 4 }),
    confidence_gap: decimal("confidence_gap", { precision: 5, scale: 4 }),

    // Comparison metadata
    candle_time: timestamp("candle_time").notNull(),
    compared_at: timestamp("compared_at").notNull().defaultNow(),
    comparison_version: varchar("comparison_version", { length: 20 }).notNull().default("1.0"),

    // Link to signal that used this detection
    signal_id: varchar("signal_id", { length: 100 }),
  },
  (table) => ({
    idxDetectionType: index("idx_dc_type").on(table.detection_type),
    idxDetectionSymbol: index("idx_dc_symbol").on(table.symbol),
    idxDetectionAgreement: index("idx_dc_agreement").on(table.agreement),
    idxDetectionCandle: index("idx_dc_candle").on(table.candle_time),
    idxDetectionSignal: index("idx_dc_signal").on(table.signal_id),
    idxDetectionTypeSymbol: index("idx_dc_type_sym").on(table.detection_type, table.symbol),
  })
);

// ═══════════════════════════════════════════════════════════════════════════
// Detection Outcomes
// Market result for a detection — did price respect it, sweep it, or ignore it?
// ═══════════════════════════════════════════════════════════════════════════

export const detectionOutcomes = pgTable(
  "detection_outcomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    comparison_id: uuid("comparison_id").notNull().references(() => detectionComparisons.id, { onDelete: "cascade" }),

    // Outcome determined by looking forward N candles
    outcome: varchar("outcome", { length: 30 }).notNull(),
    // RESPECTED — price held the level, reversed or bounced
    // SWEPT — price pierced through then reversed
    // IGNORED — price blew through with no reaction
    // FILLED — FVG was filled
    // PARTIAL_FILL — FVG partially filled
    // REVERSAL — price reversed at the level
    // CONTINUATION — price continued through (BOS continued)
    // PENDING — not enough candles yet to determine
    // INCONCLUSIVE — mixed signals

    // Price action context
    touched_at: timestamp("touched_at"),
    touch_price: decimal("touch_price", { precision: 20, scale: 8 }),
    max_extension: decimal("max_extension", { precision: 10, scale: 4 }),
    // How far past the level price went (as % of ATR)

    bars_until_touch: integer("bars_until_touch"),
    bars_until_resolution: integer("bars_until_resolution"),

    // Which source was correct (determined by outcome)
    correct_source: varchar("correct_source", { length: 20 }),
    // TV, ENGINE, BOTH, NEITHER

    // Was the detection profitable if traded?
    would_win: boolean("would_win"),
    hypothetical_pnl_pct: decimal("hypothetical_pnl_pct", { precision: 10, scale: 4 }),

    // Context
    market_regime_at_touch: varchar("market_regime_at_touch", { length: 30 }),
    session_at_touch: varchar("session_at_touch", { length: 20 }),

    evaluated_at: timestamp("evaluated_at").notNull().defaultNow(),
    evaluation_version: varchar("evaluation_version", { length: 20 }).notNull().default("1.0"),
  },
  (table) => ({
    idxOutcomeComparison: index("idx_do_comparison").on(table.comparison_id),
    idxOutcomeResult: index("idx_do_outcome").on(table.outcome),
    idxOutcomeSource: index("idx_do_source").on(table.correct_source),
    idxOutcomeEval: index("idx_do_eval").on(table.evaluated_at),
  })
);

// ═══════════════════════════════════════════════════════════════════════════
// Model Performance — Per-detection-type accumulated reliability
// ═══════════════════════════════════════════════════════════════════════════

export const modelPerformance = pgTable(
  "model_performance",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    source: varchar("source", { length: 10 }).notNull(), // TV or ENGINE
    detection_type: varchar("detection_type", { length: 30 }).notNull(),

    // Accumulated stats
    total_detections: integer("total_detections").notNull().default(0),
    correct_detections: integer("correct_detections").notNull().default(0),
    false_positives: integer("false_positives").notNull().default(0),
    false_negatives: integer("false_negatives").notNull().default(0),

    // Reliability score (0–1)
    reliability_score: decimal("reliability_score", { precision: 5, scale: 4 }).notNull().default("0"),

    // Per-market breakdown
    symbol_reliability: jsonb("symbol_reliability").$type<Record<string, number>>(),
    timeframe_reliability: jsonb("timeframe_reliability").$type<Record<string, number>>(),
    session_reliability: jsonb("session_reliability").$type<Record<string, number>>(),
    regime_reliability: jsonb("regime_reliability").$type<Record<string, number>>(),

    // Trend
    rolling_30d_accuracy: decimal("rolling_30d_accuracy", { precision: 5, scale: 4 }),
    improvement_trend: decimal("improvement_trend", { precision: 6, scale: 4 }),
    // Positive = improving, negative = declining

    last_updated: timestamp("last_updated").notNull().defaultNow(),
  },
  (table) => ({
    idxPerfSource: index("idx_mp_source").on(table.source),
    idxPerfType: index("idx_mp_type").on(table.detection_type),
    idxPerfSourceType: uniqueIndex("idx_mp_source_type").on(table.source, table.detection_type),
    idxPerfReliability: index("idx_mp_reliability").on(table.reliability_score),
  })
);

// ═══════════════════════════════════════════════════════════════════════════
// Parameter History — Versioned parameter snapshots with recommendations
// ═══════════════════════════════════════════════════════════════════════════

export const parameterHistory = pgTable(
  "parameter_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    component: varchar("component", { length: 30 }).notNull(),
    // structure, liquidity, ob, fvg, pd_array, daily_bias, smt, signal_gen

    parameter_name: varchar("parameter_name", { length: 50 }).notNull(),
    // e.g. atrPeriod, pivotLookback, fvgMinBodyRatio, obLookForward

    current_value: decimal("current_value", { precision: 12, scale: 6 }).notNull(),
    suggested_value: decimal("suggested_value", { precision: 12, scale: 6 }),

    // Evidence for suggestion
    sample_size: integer("sample_size").notNull().default(0),
    win_rate_improvement: decimal("win_rate_improvement", { precision: 6, scale: 4 }),
    confidence: decimal("confidence", { precision: 5, scale: 4 }),

    // Status
    status: varchar("status", { length: 20 }).notNull().default("suggested"),
    // suggested, approved, applied, rejected, superseded

    approved_at: timestamp("approved_at"),
    approved_by: varchar("approved_by", { length: 100 }),

    created_at: timestamp("created_at").notNull().defaultNow(),
    version: varchar("version", { length: 20 }).notNull().default("1.0"),
  },
  (table) => ({
    idxParamComponent: index("idx_ph_component").on(table.component),
    idxParamName: index("idx_ph_name").on(table.parameter_name),
    idxParamStatus: index("idx_ph_status").on(table.status),
    idxParamCreated: index("idx_ph_created").on(table.created_at),
  })
);

// ═══════════════════════════════════════════════════════════════════════════
// Learning Events — Significant observations from the learning system
// ═══════════════════════════════════════════════════════════════════════════

export const learningEvents = pgTable(
  "learning_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    event_type: varchar("event_type", { length: 30 }).notNull(),
    // AGREEMENT_BREAKTHROUGH, DISAGREEMENT_PATTERN, PARAMETER_SUGGESTION,
    // RELIABILITY_SHIFT, ACCURACY_MILESTONE, FAILURE_PATTERN, SUCCESS_PATTERN,
    // ENGINE_OVERTAKES_TV, NEW_DETECTION_TYPE

    title: varchar("title", { length: 200 }).notNull(),
    description: text("description").notNull(),

    // Structured data
    evidence: jsonb("evidence").$type<Record<string, any>>(),
    metadata: jsonb("metadata").$type<Record<string, any>>(),

    // Impact
    significance: decimal("significance", { precision: 3, scale: 2 }).notNull().default("0.5"),
    // 0.0–1.0 how significant is this event

    detected_at: timestamp("detected_at").notNull().defaultNow(),
  },
  (table) => ({
    idxLearningType: index("idx_le_type").on(table.event_type),
    idxLearningSignificance: index("idx_le_significance").on(table.significance),
    idxLearningDetected: index("idx_le_detected").on(table.detected_at),
  })
);

// ═══════════════════════════════════════════════════════════════════════════
// Pattern Statistics — Recurring pattern analysis
// ═══════════════════════════════════════════════════════════════════════════

export const patternStatistics = pgTable(
  "pattern_statistics",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    pattern_name: varchar("pattern_name", { length: 100 }).notNull(),
    pattern_type: varchar("pattern_type", { length: 30 }).notNull(),
    // FAILURE_PATTERN, SUCCESS_PATTERN, DISAGREEMENT_PATTERN

    // Pattern definition
    description: text("description").notNull(),
    conditions: jsonb("conditions").$type<Record<string, any>>(),
    // e.g. { "detection_types": ["OB", "FVG"], "market_regime": "trending" }

    // Statistics
    occurrence_count: integer("occurrence_count").notNull().default(0),
    win_rate_when_present: decimal("win_rate_when_present", { precision: 5, scale: 4 }),
    confidence: decimal("confidence", { precision: 5, scale: 4 }),

    // First/last observed
    first_observed: timestamp("first_observed").notNull().defaultNow(),
    last_observed: timestamp("last_observed").notNull().defaultNow(),
  },
  (table) => ({
    idxPatternType: index("idx_ps_type").on(table.pattern_type),
    idxPatternName: index("idx_ps_name").on(table.pattern_name),
    idxPatternWinRate: index("idx_ps_winrate").on(table.win_rate_when_present),
    idxPatternLastObs: index("idx_ps_last_obs").on(table.last_observed),
  })
);
