CREATE TABLE "agent_loop_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"timeframe" varchar(5) NOT NULL,
	"market" varchar(10) NOT NULL,
	"config_snapshot" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'running' NOT NULL,
	"triggered_by" varchar(20) NOT NULL,
	"total_iterations" integer DEFAULT 0,
	"total_tokens" integer DEFAULT 0,
	"result" jsonb,
	"error" varchar(500),
	"evaluation_score" integer,
	"evaluation" jsonb,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "agent_loop_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"iteration_sequence" integer NOT NULL,
	"step_type" varchar(30) NOT NULL,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"duration_ms" integer,
	"input_snapshot" jsonb,
	"output_snapshot" jsonb,
	"tool_calls" jsonb,
	"error" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "agent_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"memory_key" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"source" varchar(30) DEFAULT 'episode' NOT NULL,
	"score" numeric(5, 4) DEFAULT '0' NOT NULL,
	"tags" varchar(50)[] DEFAULT '{}' NOT NULL,
	"is_durable" boolean DEFAULT true NOT NULL,
	"source_run_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_accessed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "performance_matrix" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_class" varchar(20) NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"setup_type" varchar(50) NOT NULL,
	"setup_subtype" varchar(50) NOT NULL,
	"timeframe_cascade" varchar(50) NOT NULL,
	"market_regime" varchar(50) NOT NULL,
	"session_context" varchar(50) NOT NULL,
	"win_rate" numeric(5, 4) NOT NULL,
	"sharpe_ratio" numeric(8, 4) NOT NULL,
	"profit_factor" numeric(8, 4) NOT NULL,
	"avg_win" numeric(16, 4) DEFAULT '0' NOT NULL,
	"avg_loss" numeric(16, 4) DEFAULT '0' NOT NULL,
	"max_drawdown" numeric(5, 4) DEFAULT '0' NOT NULL,
	"trials" integer DEFAULT 0 NOT NULL,
	"is_significant" boolean DEFAULT false NOT NULL,
	"parameters" jsonb,
	"last_calculated" timestamp DEFAULT now() NOT NULL,
	"last_optimized" timestamp
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_class" varchar(20) NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"setup_type" varchar(50) NOT NULL,
	"setup_subtype" varchar(50) NOT NULL,
	"entry_price" numeric(20, 8) NOT NULL,
	"stop_loss" numeric(20, 8) NOT NULL,
	"take_profit" numeric(20, 8) NOT NULL,
	"confidence_score" integer NOT NULL,
	"analysis_context" jsonb NOT NULL,
	"parameter_snapshot" jsonb NOT NULL,
	"execution_mode" varchar(10) DEFAULT 'REVIEW' NOT NULL,
	"order_id" varchar(100),
	"outcome" jsonb,
	"rationale" jsonb,
	"structure_confluence" integer DEFAULT 0,
	"liquidity_quality" integer DEFAULT 0,
	"confluence_count" integer DEFAULT 0,
	"risk_reward_ratio" numeric(8, 4),
	"signal_timestamp" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "detection_comparisons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"timeframe" varchar(5) NOT NULL,
	"market" varchar(10) NOT NULL,
	"detection_type" varchar(30) NOT NULL,
	"price_level" numeric(20, 8) NOT NULL,
	"tv_detected" boolean DEFAULT false NOT NULL,
	"tv_confidence" numeric(5, 4),
	"tv_price" numeric(20, 8),
	"tv_metadata" jsonb,
	"engine_detected" boolean DEFAULT false NOT NULL,
	"engine_confidence" numeric(5, 4),
	"engine_price" numeric(20, 8),
	"engine_metadata" jsonb,
	"agreement" varchar(20) NOT NULL,
	"price_discrepancy_pct" numeric(10, 4),
	"confidence_gap" numeric(5, 4),
	"candle_time" timestamp NOT NULL,
	"compared_at" timestamp DEFAULT now() NOT NULL,
	"comparison_version" varchar(20) DEFAULT '1.0' NOT NULL,
	"signal_id" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "detection_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comparison_id" uuid NOT NULL,
	"outcome" varchar(30) NOT NULL,
	"touched_at" timestamp,
	"touch_price" numeric(20, 8),
	"max_extension" numeric(10, 4),
	"bars_until_touch" integer,
	"bars_until_resolution" integer,
	"correct_source" varchar(20),
	"would_win" boolean,
	"hypothetical_pnl_pct" numeric(10, 4),
	"market_regime_at_touch" varchar(30),
	"session_at_touch" varchar(20),
	"evaluated_at" timestamp DEFAULT now() NOT NULL,
	"evaluation_version" varchar(20) DEFAULT '1.0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(30) NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"evidence" jsonb,
	"metadata" jsonb,
	"significance" numeric(3, 2) DEFAULT '0.5' NOT NULL,
	"detected_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_performance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(10) NOT NULL,
	"detection_type" varchar(30) NOT NULL,
	"total_detections" integer DEFAULT 0 NOT NULL,
	"correct_detections" integer DEFAULT 0 NOT NULL,
	"false_positives" integer DEFAULT 0 NOT NULL,
	"false_negatives" integer DEFAULT 0 NOT NULL,
	"reliability_score" numeric(5, 4) DEFAULT '0' NOT NULL,
	"symbol_reliability" jsonb,
	"timeframe_reliability" jsonb,
	"session_reliability" jsonb,
	"regime_reliability" jsonb,
	"rolling_30d_accuracy" numeric(5, 4),
	"improvement_trend" numeric(6, 4),
	"last_updated" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parameter_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"component" varchar(30) NOT NULL,
	"parameter_name" varchar(50) NOT NULL,
	"current_value" numeric(12, 6) NOT NULL,
	"suggested_value" numeric(12, 6),
	"sample_size" integer DEFAULT 0 NOT NULL,
	"win_rate_improvement" numeric(6, 4),
	"confidence" numeric(5, 4),
	"status" varchar(20) DEFAULT 'suggested' NOT NULL,
	"approved_at" timestamp,
	"approved_by" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"version" varchar(20) DEFAULT '1.0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pattern_statistics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pattern_name" varchar(100) NOT NULL,
	"pattern_type" varchar(30) NOT NULL,
	"description" text NOT NULL,
	"conditions" jsonb,
	"occurrence_count" integer DEFAULT 0 NOT NULL,
	"win_rate_when_present" numeric(5, 4),
	"confidence" numeric(5, 4),
	"first_observed" timestamp DEFAULT now() NOT NULL,
	"last_observed" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"version" text NOT NULL,
	"description" text NOT NULL,
	"requires" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"optional" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"timeWindow" jsonb DEFAULT 'null'::jsonb,
	"assets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"parameters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"performanceStats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"isPublished" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_loop_steps" ADD CONSTRAINT "agent_loop_steps_run_id_agent_loop_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_loop_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detection_outcomes" ADD CONSTRAINT "detection_outcomes_comparison_id_detection_comparisons_id_fk" FOREIGN KEY ("comparison_id") REFERENCES "public"."detection_comparisons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_loop_symbol" ON "agent_loop_runs" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_loop_status" ON "agent_loop_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_loop_started" ON "agent_loop_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_loop_trigger" ON "agent_loop_runs" USING btree ("triggered_by");--> statement-breakpoint
CREATE INDEX "idx_step_run" ON "agent_loop_steps" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_step_type" ON "agent_loop_steps" USING btree ("step_type");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_memory_key" ON "agent_memory" USING btree ("memory_key");--> statement-breakpoint
CREATE INDEX "idx_memory_tags" ON "agent_memory" USING btree ("tags");--> statement-breakpoint
CREATE INDEX "idx_memory_score" ON "agent_memory" USING btree ("score");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_perf_matrix_dimensions" ON "performance_matrix" USING btree ("asset_class","symbol","setup_type","setup_subtype","timeframe_cascade","market_regime","session_context");--> statement-breakpoint
CREATE INDEX "idx_perf_matrix_significant" ON "performance_matrix" USING btree ("is_significant","sharpe_ratio");--> statement-breakpoint
CREATE INDEX "idx_perf_matrix_asset" ON "performance_matrix" USING btree ("asset_class");--> statement-breakpoint
CREATE INDEX "idx_perf_matrix_setup" ON "performance_matrix" USING btree ("setup_type");--> statement-breakpoint
CREATE INDEX "idx_perf_matrix_sharpe" ON "performance_matrix" USING btree ("sharpe_ratio");--> statement-breakpoint
CREATE INDEX "idx_trades_asset_setup" ON "trades" USING btree ("asset_class","setup_type");--> statement-breakpoint
CREATE INDEX "idx_trades_symbol_setup" ON "trades" USING btree ("symbol","setup_type");--> statement-breakpoint
CREATE INDEX "idx_trades_execution_mode" ON "trades" USING btree ("execution_mode");--> statement-breakpoint
CREATE INDEX "idx_trades_created_at" ON "trades" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_trades_asset_class" ON "trades" USING btree ("asset_class");--> statement-breakpoint
CREATE INDEX "idx_dc_type" ON "detection_comparisons" USING btree ("detection_type");--> statement-breakpoint
CREATE INDEX "idx_dc_symbol" ON "detection_comparisons" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_dc_agreement" ON "detection_comparisons" USING btree ("agreement");--> statement-breakpoint
CREATE INDEX "idx_dc_candle" ON "detection_comparisons" USING btree ("candle_time");--> statement-breakpoint
CREATE INDEX "idx_dc_signal" ON "detection_comparisons" USING btree ("signal_id");--> statement-breakpoint
CREATE INDEX "idx_dc_type_sym" ON "detection_comparisons" USING btree ("detection_type","symbol");--> statement-breakpoint
CREATE INDEX "idx_do_comparison" ON "detection_outcomes" USING btree ("comparison_id");--> statement-breakpoint
CREATE INDEX "idx_do_outcome" ON "detection_outcomes" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX "idx_do_source" ON "detection_outcomes" USING btree ("correct_source");--> statement-breakpoint
CREATE INDEX "idx_do_eval" ON "detection_outcomes" USING btree ("evaluated_at");--> statement-breakpoint
CREATE INDEX "idx_le_type" ON "learning_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_le_significance" ON "learning_events" USING btree ("significance");--> statement-breakpoint
CREATE INDEX "idx_le_detected" ON "learning_events" USING btree ("detected_at");--> statement-breakpoint
CREATE INDEX "idx_mp_source" ON "model_performance" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_mp_type" ON "model_performance" USING btree ("detection_type");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_mp_source_type" ON "model_performance" USING btree ("source","detection_type");--> statement-breakpoint
CREATE INDEX "idx_mp_reliability" ON "model_performance" USING btree ("reliability_score");--> statement-breakpoint
CREATE INDEX "idx_ph_component" ON "parameter_history" USING btree ("component");--> statement-breakpoint
CREATE INDEX "idx_ph_name" ON "parameter_history" USING btree ("parameter_name");--> statement-breakpoint
CREATE INDEX "idx_ph_status" ON "parameter_history" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ph_created" ON "parameter_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ps_type" ON "pattern_statistics" USING btree ("pattern_type");--> statement-breakpoint
CREATE INDEX "idx_ps_name" ON "pattern_statistics" USING btree ("pattern_name");--> statement-breakpoint
CREATE INDEX "idx_ps_winrate" ON "pattern_statistics" USING btree ("win_rate_when_present");--> statement-breakpoint
CREATE INDEX "idx_ps_last_obs" ON "pattern_statistics" USING btree ("last_observed");--> statement-breakpoint
CREATE INDEX "idx_md_category" ON "model_definitions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_md_version" ON "model_definitions" USING btree ("version");--> statement-breakpoint
CREATE INDEX "idx_md_published" ON "model_definitions" USING btree ("isPublished");--> statement-breakpoint
CREATE INDEX "idx_md_created" ON "model_definitions" USING btree ("createdAt");