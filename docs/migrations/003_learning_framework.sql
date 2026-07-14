-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 003: Learning & Validation Framework
-- ═══════════════════════════════════════════════════════════════════════════════
-- Creates tables for the evidence-driven feedback system that compares
-- internal SMC Engine outputs against TradingView/Pine indicators and
-- accumulates reliability data from market outcomes.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Detection Comparisons ────────────────────────────────────────────────────
-- Per-event record comparing TV/Pine vs Internal Engine for a detection point.

CREATE TABLE IF NOT EXISTS detection_comparisons (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Market context
    symbol          VARCHAR(20) NOT NULL,
    timeframe       VARCHAR(5) NOT NULL,
    market          VARCHAR(10) NOT NULL,

    -- Detection metadata
    detection_type  VARCHAR(30) NOT NULL,
    -- OB, FVG, BOS, CHoCH, MSS, LIQUIDITY_SWEEP, EQH, EQL,
    -- PREMIUM, DISCOUNT, SMT, SESSION_BREAKOUT, DISPLACEMENT, BIAS
    price_level     DECIMAL(20,8) NOT NULL,

    -- TradingView side
    tv_detected     BOOLEAN NOT NULL DEFAULT FALSE,
    tv_confidence   DECIMAL(5,4),
    tv_price        DECIMAL(20,8),
    tv_metadata     JSONB,

    -- Internal engine side
    engine_detected  BOOLEAN NOT NULL DEFAULT FALSE,
    engine_confidence DECIMAL(5,4),
    engine_price     DECIMAL(20,8),
    engine_metadata  JSONB,

    -- Agreement analysis
    agreement        VARCHAR(20) NOT NULL,
    -- BOTH_DETECTED, TV_ONLY, ENGINE_ONLY, NEITHER
    price_discrepancy_pct DECIMAL(10,4),
    confidence_gap         DECIMAL(5,4),

    -- Timing
    candle_time      TIMESTAMP NOT NULL,
    compared_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    comparison_version VARCHAR(20) NOT NULL DEFAULT '1.0',

    -- Link
    signal_id        VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_dc_type ON detection_comparisons(detection_type);
CREATE INDEX IF NOT EXISTS idx_dc_symbol ON detection_comparisons(symbol);
CREATE INDEX IF NOT EXISTS idx_dc_agreement ON detection_comparisons(agreement);
CREATE INDEX IF NOT EXISTS idx_dc_candle ON detection_comparisons(candle_time);
CREATE INDEX IF NOT EXISTS idx_dc_signal ON detection_comparisons(signal_id);
CREATE INDEX IF NOT EXISTS idx_dc_type_sym ON detection_comparisons(detection_type, symbol);

-- ── Detection Outcomes ───────────────────────────────────────────────────────
-- Market result for a detection: did price respect it, sweep it, or ignore it?

CREATE TABLE IF NOT EXISTS detection_outcomes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comparison_id   UUID NOT NULL REFERENCES detection_comparisons(id) ON DELETE CASCADE,

    -- Outcome classification
    outcome         VARCHAR(30) NOT NULL,
    -- RESPECTED, SWEPT, IGNORED, FILLED, PARTIAL_FILL,
    -- REVERSAL, CONTINUATION, PENDING, INCONCLUSIVE

    -- Price action details
    touched_at      TIMESTAMP,
    touch_price     DECIMAL(20,8),
    max_extension   DECIMAL(10,4),
    bars_until_touch    INTEGER,
    bars_until_resolution INTEGER,

    -- Which source was correct
    correct_source  VARCHAR(20),
    -- TV, ENGINE, BOTH, NEITHER

    -- Hypothetical performance
    would_win           BOOLEAN,
    hypothetical_pnl_pct DECIMAL(10,4),

    -- Context at touch time
    market_regime_at_touch VARCHAR(30),
    session_at_touch        VARCHAR(20),

    evaluated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    evaluation_version VARCHAR(20) NOT NULL DEFAULT '1.0'
);

CREATE INDEX IF NOT EXISTS idx_do_comparison ON detection_outcomes(comparison_id);
CREATE INDEX IF NOT EXISTS idx_do_outcome ON detection_outcomes(outcome);
CREATE INDEX IF NOT EXISTS idx_do_source ON detection_outcomes(correct_source);
CREATE INDEX IF NOT EXISTS idx_do_eval ON detection_outcomes(evaluated_at);

-- ── Model Performance ────────────────────────────────────────────────────────
-- Per-detection-type accumulated reliability for each source.

CREATE TABLE IF NOT EXISTS model_performance (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    source          VARCHAR(10) NOT NULL,   -- TV or ENGINE
    detection_type  VARCHAR(30) NOT NULL,

    total_detections    INTEGER NOT NULL DEFAULT 0,
    correct_detections  INTEGER NOT NULL DEFAULT 0,
    false_positives     INTEGER NOT NULL DEFAULT 0,
    false_negatives     INTEGER NOT NULL DEFAULT 0,

    reliability_score   DECIMAL(5,4) NOT NULL DEFAULT '0',

    -- Per-segment breakdowns
    symbol_reliability      JSONB,
    timeframe_reliability   JSONB,
    session_reliability     JSONB,
    regime_reliability      JSONB,

    -- Trend
    rolling_30d_accuracy DECIMAL(5,4),
    improvement_trend    DECIMAL(6,4),

    last_updated TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mp_source_type ON model_performance(source, detection_type);
CREATE INDEX IF NOT EXISTS idx_mp_source ON model_performance(source);
CREATE INDEX IF NOT EXISTS idx_mp_type ON model_performance(detection_type);
CREATE INDEX IF NOT EXISTS idx_mp_reliability ON model_performance(reliability_score);

-- ── Parameter History ────────────────────────────────────────────────────────
-- Versioned parameter snapshots with recommendations requiring human approval.

CREATE TABLE IF NOT EXISTS parameter_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    component       VARCHAR(30) NOT NULL,
    -- structure, liquidity, ob, fvg, pd_array, daily_bias, smt, signal_gen
    parameter_name  VARCHAR(50) NOT NULL,
    -- e.g. atrPeriod, pivotLookback, fvgMinBodyRatio, obLookForward

    current_value   DECIMAL(12,6) NOT NULL,
    suggested_value DECIMAL(12,6) NOT NULL,

    evidence_data   JSONB,
    sample_size     INTEGER NOT NULL DEFAULT 0,
    win_rate_improvement DECIMAL(6,4),
    confidence      DECIMAL(5,4),

    status          VARCHAR(20) NOT NULL DEFAULT 'suggested',
    -- suggested, approved, applied, rejected, superseded

    approved_at     TIMESTAMP,
    approved_by     VARCHAR(100),

    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    version         VARCHAR(20) NOT NULL DEFAULT '1.0'
);

CREATE INDEX IF NOT EXISTS idx_ph_component ON parameter_history(component);
CREATE INDEX IF NOT EXISTS idx_ph_name ON parameter_history(parameter_name);
CREATE INDEX IF NOT EXISTS idx_ph_status ON parameter_history(status);
CREATE INDEX IF NOT EXISTS idx_ph_created ON parameter_history(created_at);

-- ── Learning Events ──────────────────────────────────────────────────────────
-- Significant observations from the learning system.

CREATE TABLE IF NOT EXISTS learning_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    event_type      VARCHAR(30) NOT NULL,
    -- AGREEMENT_BREAKTHROUGH, DISAGREEMENT_PATTERN, PARAMETER_SUGGESTION,
    -- RELIABILITY_SHIFT, ACCURACY_MILESTONE, FAILURE_PATTERN, SUCCESS_PATTERN,
    -- ENGINE_OVERTAKES_TV, NEW_DETECTION_TYPE

    title           VARCHAR(200) NOT NULL,
    description     TEXT NOT NULL,

    evidence        JSONB,
    metadata        JSONB,

    significance    DECIMAL(3,2) NOT NULL DEFAULT '0.5',

    detected_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_le_type ON learning_events(event_type);
CREATE INDEX IF NOT EXISTS idx_le_significance ON learning_events(significance);
CREATE INDEX IF NOT EXISTS idx_le_detected ON learning_events(detected_at);

-- ── Pattern Statistics ───────────────────────────────────────────────────────
-- Recurring pattern analysis from accumulated comparisons.

CREATE TABLE IF NOT EXISTS pattern_statistics (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    pattern_name    VARCHAR(100) NOT NULL,
    pattern_type    VARCHAR(30) NOT NULL,
    -- FAILURE_PATTERN, SUCCESS_PATTERN, DISAGREEMENT_PATTERN

    description     TEXT NOT NULL,
    conditions      JSONB,

    occurrence_count     INTEGER NOT NULL DEFAULT 0,
    win_rate_when_present DECIMAL(5,4),
    confidence           DECIMAL(5,4),

    first_observed  TIMESTAMP NOT NULL DEFAULT NOW(),
    last_observed   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ps_type ON pattern_statistics(pattern_type);
CREATE INDEX IF NOT EXISTS idx_ps_name ON pattern_statistics(pattern_name);
CREATE INDEX IF NOT EXISTS idx_ps_winrate ON pattern_statistics(win_rate_when_present);
CREATE INDEX IF NOT EXISTS idx_ps_last_obs ON pattern_statistics(last_observed);
