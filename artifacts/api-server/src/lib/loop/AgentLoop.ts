/**
 * Agent Loop — central orchestrator for the Observe → Interpret → Reason →
 * Decide → Act → Evaluate → Update cycle.
 *
 * Extends EventEmitter to emit step-level events for SSE broadcasting.
 * Uses the existing toolRegistry, SignalGenerator, and TradeLedgerService.
 */

import { EventEmitter } from "events";
import { logger } from "../logger.js";
import { toolRegistry } from "../mcp/tool-registry.js";
import { candleStore } from "../realtime/candle-store.js";
import { buildReport } from "../smc/report.js";
import { resolveLlmConfig, chatCompletion } from "../llm/provider.js";
import { SignalGenerator } from "../services/SignalGenerator.js";
import { TradeLedgerService } from "../services/TradeLedgerService.js";
import { LoopContext } from "./LoopContext.js";
import { AgentGuardrails } from "./AgentGuardrails.js";
import { LoopTracer } from "../harness/LoopTracer.js";
import { LoopEvaluator } from "../harness/LoopEvaluator.js";
import { MemoryService } from "../memory/MemoryService.js";
import { DEFAULT_LOOP_CONFIG } from "./types.js";
import { langfuse } from "../observability/langfuse.js";

import type {
  LoopConfig,
  LoopIteration,
  LoopResult,
  LoopStep,
  LoopStatus,
  LoopTrigger,
  Decision,
} from "./types.js";
import type { SmcReport, Market } from "../smc/types.js";
import type { UnifiedTradeSignal } from "../services/SignalGenerator.js";

// Re-export detectMarket used by tool-registry for symbol-based market detection
function detectMarketFromSymbol(symbol: string): Market {
  return symbol.includes("=X") ? "forex" : "crypto";
}

export declare interface AgentLoop {
  on(event: "step", listener: (step: LoopStep) => void): this;
  on(event: "iteration", listener: (iteration: LoopIteration) => void): this;
  on(event: "decision", listener: (decision: Decision) => void): this;
  on(event: "signal", listener: (signal: UnifiedTradeSignal) => void): this;
  on(event: "error", listener: (error: Error) => void): this;
  on(event: "complete", listener: (result: LoopResult) => void): this;
}

export class AgentLoop extends EventEmitter {
  private context: LoopContext;
  private guardrails: AgentGuardrails;
  private tracer: LoopTracer;
  private evaluator: LoopEvaluator;
  private memory: MemoryService;
  private signalGenerator: SignalGenerator;
  private ledgerService: TradeLedgerService;
  private abortController: AbortController | null = null;
  private monitorCleanup: (() => void) | null = null;
  private runInProgress = false;

  constructor(
    config: LoopConfig,
    services?: {
      memory?: MemoryService;
      tracer?: LoopTracer;
      evaluator?: LoopEvaluator;
    },
  ) {
    super();

    const mem = services?.memory ?? new MemoryService();
    const tracer = services?.tracer ?? new LoopTracer();
    const evaluator = services?.evaluator ?? new LoopEvaluator(mem.semantic);

    this.context = new LoopContext(config);
    this.guardrails = new AgentGuardrails(config);
    this.memory = mem;
    this.tracer = tracer;
    this.evaluator = evaluator;
    this.signalGenerator = new SignalGenerator();
    this.ledgerService = new TradeLedgerService();
  }

  // ── Public API ─────────────────────────────────────────────────

  /**
   * Run one complete loop cycle: Observe → Interpret → Reason → Decide → Act.
   */
  async run(
    report: SmcReport,
    trigger: LoopTrigger = "manual",
  ): Promise<LoopResult> {
    if (this.runInProgress) {
      logger.warn("Loop run already in progress — skipping duplicate trigger");
      return { action: "no_action", confidence: 0, narrative: "Skipped: run already in progress" };
    }

    this.runInProgress = true;
    this.abortController = new AbortController();
    const config = { ...DEFAULT_LOOP_CONFIG, ...this.context.config };

    try {
      // ── Start traces ──
      this.context.status = "running";
      const runId = await this.tracer.startRun(config, trigger);

      // Create Langfuse trace for observability
      const langfuseTraceId = langfuse.createTrace({
        name: `agent_loop:${report.symbol}_${report.timeframe}`,
        sessionId: runId,
        metadata: {
          symbol: report.symbol,
          timeframe: report.timeframe,
          market: report.market,
          trigger,
          price: report.currentPrice,
        },
        tags: ["agent_loop", report.market, trigger],
      });
      const langfuseSpanIds: string[] = [];

      // 1. OBSERVE
      const observeStep = this.context.addStep("observe", { report: { symbol: report.symbol, timeframe: report.timeframe, price: report.currentPrice } });
      this.context.updateReport(report);
      this.context.completeStep("observe", { observed: true, candles: report.candles.length });
      await this.tracer.traceStep(runId, this.context.iterations.length, observeStep);
      this.emit("step", observeStep);

      // Langfuse: observe span
      let currentSpanId = langfuse.createSpan({ traceId: langfuseTraceId, name: "observe", input: { symbol: report.symbol, timeframe: report.timeframe, candles: report.candles.length, price: report.currentPrice } });

      // Check guardrails
      const preCheck = this.guardrails.checkPreConditions(report);
      if (!preCheck.passed) {
        const result: LoopResult = { action: "no_action", confidence: 0, narrative: preCheck.reason ?? "Guardrail check failed" };
        this.context.completeIteration(result);
        await this.tracer.completeRun(runId, result, "completed");
        langfuse.endSpan(currentSpanId, langfuseTraceId, { passed: false, reason: preCheck.reason });
        this.emit("complete", result);
        this.context.status = "completed";
        return result;
      }
      langfuse.endSpan(currentSpanId, langfuseTraceId, { passed: true });

      // 2. INTERPRET — call SMC tools
      currentSpanId = langfuse.createSpan({ traceId: langfuseTraceId, name: "interpret", input: { symbol: report.symbol, timeframe: report.timeframe } });
      const interpretStep = this.context.addStep("interpret", { tools: [] });
      const toolResults = await this.callAnalysisTools(report.symbol, report.timeframe);
      interpretStep.output = toolResults;
      interpretStep.toolCalls = Object.entries(toolResults).map(([name, result]) => ({
        name,
        args: { symbol: report.symbol, timeframe: report.timeframe },
        result,
      }));
      this.context.completeStep("interpret", toolResults);
      await this.tracer.traceStep(runId, this.context.iterations.length, interpretStep);
      langfuse.endSpan(currentSpanId, langfuseTraceId, {
        toolsCalled: Object.keys(toolResults),
        results: Object.fromEntries(Object.entries(toolResults).map(([k, v]) => [k, (v as any)?.bias || (v as any)?.trend || "ok"])),
      });
      this.emit("step", interpretStep);

      // 3. REASON — use LLM to decide what to do
      currentSpanId = langfuse.createSpan({ traceId: langfuseTraceId, name: "reason", input: { toolResults: Object.keys(toolResults) } });
      const reasonStep = this.context.addStep("reason", { toolResults });
      const marketRegime = report.structure.phase;
      const decision = await this.reason(report, toolResults, marketRegime);
      reasonStep.output = decision;
      this.context.completeStep("reason", decision);
      await this.tracer.traceStep(runId, this.context.iterations.length, reasonStep);
      this.emit("step", reasonStep);
      this.emit("decision", decision);
      langfuse.endSpan(currentSpanId, langfuseTraceId, {
        action: decision.action,
        confidence: decision.confidence,
        reasoning: decision.reasoning.slice(0, 200),
      });

      // 4. DECIDE — validate through guardrails
      const validated = this.guardrails.validateDecision(decision, report);
      const finalDecision = validated.passed ? decision : (validated.modifiedDecision ?? {
        ...decision,
        action: "no_action" as const,
        confidence: 0,
        reasoning: validated.reason ?? "Blocked by guardrails",
      });

      // 5. ACT
      const actStep = this.context.addStep("act", { decision: finalDecision });
      const result = await this.act(finalDecision, report);
      actStep.output = result;
      this.context.completeStep("act", result);
      await this.tracer.traceStep(runId, this.context.iterations.length, actStep);
      this.emit("step", actStep);

      if (result.action === "signal_generated" && result.signal) {
        this.emit("signal", result.signal);
      }

      // 6. EVALUATE (in-memory only — outcomes come later)
      const evalStep = this.context.addStep("evaluate", { action: result.action });
      const evaluation = this.evaluator.scoreRun(this.context.iterations, result);
      evalStep.output = evaluation;
      this.context.completeStep("evaluate", evaluation);
      await this.tracer.traceStep(runId, this.context.iterations.length, evalStep);

      // 7. UPDATE MEMORY
      const memStep = this.context.addStep("update_memory", { runId });
      await this.tracer.completeRun(runId, result, "completed");
      await this.evaluator.persistEvaluation(evaluation, runId);
      this.context.completeStep("update_memory", { persisted: true });
      await this.tracer.traceStep(runId, this.context.iterations.length, memStep);

      // Complete the iteration
      this.context.completeIteration(result);
      this.context.status = "completed";

      // Update Langfuse trace with final result
      langfuse.updateTrace(langfuseTraceId, {
        action: result.action,
        confidence: result.confidence,
        iterations: this.context.iterations.length,
      });
      langfuse.score({
        traceId: langfuseTraceId,
        name: "loop_quality",
        value: result.action === "signal_generated" ? 1 : result.action === "analysis_complete" ? 0.7 : 0.3,
        comment: result.narrative?.slice(0, 200),
      });
      this.emit("complete", result);
      this.runInProgress = false;

      return result;
    } catch (err: any) {
      this.context.status = "error";
      this.context.errors.push(err.message);

      const errorResult: LoopResult = {
        action: "error",
        confidence: 0,
        narrative: err.message,
      };

      this.emit("error", err);
      this.runInProgress = false;
      return errorResult;
    }
  }

  /**
   * Start background monitoring: listen for candleClose events for the
   * configured symbol/timeframe and run the loop automatically.
   */
  async startMonitoring(): Promise<void> {
    const config = this.context.config;
    logger.info(
      { symbol: config.symbol, timeframe: config.timeframe },
      "Agent loop monitoring started",
    );

    this.context.status = "awaiting_data";

    const handler = async (evt: { symbol: string; timeframe: string; candle: unknown }) => {
      if (this.runInProgress) return; // Skip if busy
      if (evt.symbol.toUpperCase() !== config.symbol.toUpperCase()) return;
      if (evt.timeframe !== config.timeframe) return;

      const candles = candleStore.getCandles(config.symbol, config.timeframe);
      if (candles.length < 10) return;

      const market = detectMarketFromSymbol(config.symbol);
      const report = buildReport(candles, config.symbol, market, config.timeframe);

      await this.run(report, "candle_close");
    };

    candleStore.on("candleClosed", handler);
    this.monitorCleanup = () => {
      candleStore.removeListener("candleClosed", handler);
    };
  }

  /**
   * Stop the loop gracefully.
   */
  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    if (this.monitorCleanup) {
      this.monitorCleanup();
      this.monitorCleanup = null;
    }
    this.context.status = "stopped";
    logger.info({ symbol: this.context.config.symbol }, "Agent loop stopped");
  }

  /**
   * Get the current status of this loop instance.
   */
  getStatus(): { status: LoopStatus; iterations: number; symbol: string; timeframe: string } {
    return {
      status: this.context.status as LoopStatus,
      iterations: this.context.iterations.length,
      symbol: this.context.config.symbol,
      timeframe: this.context.config.timeframe,
    };
  }

  // ── Private: Loop Phases ────────────────────────────────────────

  /**
   * Call all 8 SMC analysis tools via the toolRegistry.
   */
  private async callAnalysisTools(
    symbol: string,
    timeframe: string,
  ): Promise<Record<string, unknown>> {
    const toolNames = [
      "analyze_structure",
      "analyze_liquidity",
      "analyze_fvg",
      "analyze_order_blocks",
      "analyze_pd_array",
      "get_daily_bias",
      "detect_smt",
      "get_draw_targets",
    ];

    const results: Record<string, unknown> = {};
    const args = { symbol, timeframe };

    // Run tools sequentially (some share state)
    for (const name of toolNames) {
      const fn = toolRegistry.get(name);
      if (!fn) {
        results[name] = { error: `Tool "${name}" not found in registry` };
        continue;
      }
      try {
        // Some tools need special argument shapes
        let toolArgs: Record<string, unknown>;
        if (name === "detect_smt") {
          toolArgs = { primarySymbol: symbol, correlatedSymbol: "ETHUSDT", timeframe };
        } else if (name === "get_daily_bias") {
          toolArgs = { symbol }; // daily bias only needs symbol
        } else {
          toolArgs = { symbol, timeframe };
        }
        const raw = await fn(toolArgs);
        results[name] = JSON.parse(raw);
      } catch (err: any) {
        results[name] = { error: err.message };
      }
    }

    return results;
  }

  /**
   * Use the LLM to reason about the data and decide what to do.
   */
  private async reason(
    report: SmcReport,
    toolResults: Record<string, unknown>,
    marketRegime: string,
  ): Promise<Decision> {
    const contextSummary = this.context.summarizeContext();
    const episodicStr = await this.memory.episodic.formatForPrompt(report.symbol);
    const semanticStr = await this.memory.semantic.formatForPrompt(report.symbol, marketRegime);

    const prompt = this.buildDecisionPrompt(contextSummary, episodicStr, semanticStr, toolResults);

    const llmConfig = resolveLlmConfig();
    if (!llmConfig.apiKey && llmConfig.provider !== "amd") {
      return {
        action: "analysis_report",
        confidence: 50,
        reasoning: "LLM not configured — generating analysis report instead of AI-powered signal",
      };
    }

    try {
      const response = await chatCompletion(
        [{ role: "user", content: prompt }],
        { config: llmConfig, maxTokens: 1024, temperature: 0.1 },
      );

      logger.info({ response: response.content.slice(0, 200), usage: response.usage }, "LLM reason response");
      return this.parseDecision(response.content, report);
    } catch (err: any) {
      logger.error({ err }, "LLM reasoning failed");
      return {
        action: "analysis_report",
        confidence: 30,
        reasoning: `LLM error: ${err.message}. Falling back to basic analysis.`,
      };
    }
  }

  /**
   * Build the system prompt for the LLM decision/reasoning step.
   */
  private buildDecisionPrompt(
    contextSummary: string,
    episodicStr: string,
    semanticStr: string,
    toolResults: Record<string, unknown>,
  ): string {
    const structure = toolResults["analyze_structure"] as any || {};
    const liquidity = toolResults["analyze_liquidity"] as any || {};
    const fvg = toolResults["analyze_fvg"] as any || {};
    const obs = toolResults["analyze_order_blocks"] as any || {};
    const pd = toolResults["analyze_pd_array"] as any || {};
    const draws = toolResults["get_draw_targets"] as any || {};

    return `You are an expert SMC/ICT analyst running an automated trading analysis loop.

CURRENT MARKET CONTEXT:
${contextSummary}

SMC ANALYSIS RESULTS:
Structure: ${structure.trend ?? "unknown"} / ${structure.bias ?? "unknown"} (confidence ${typeof structure.confidence === 'number' ? Math.round(structure.confidence * 100) + '%' : 'N/A'}, phase: ${structure.phase ?? "unknown"})
Liquidity: BSL @ ${liquidity.nearestBSL?.price ?? "N/A"} (prob: ${liquidity.nearestBSL?.probSweep ?? "N/A"}), SSL @ ${liquidity.nearestSSL?.price ?? "N/A"} (prob: ${liquidity.nearestSSL?.probSweep ?? "N/A"})
Order Blocks: ${obs.activeOBs?.length ?? 0} active OBs
FVG: ${fvg.unfilledGaps?.length ?? 0} unfilled gaps
PD Array: ${pd.currentBias ?? "unknown"}, equilibrium @ ${pd.equilibrium ?? "N/A"}
Draw Targets: ${(draws.targets ?? []).map((t: any) => `${t.label} (${t.direction})`).join(", ")}
Recent Signals (Episodic Memory):
${episodicStr}

Pattern Knowledge (Semantic Memory):
${semanticStr}

DECISION TASK:
Based on the above data, choose ONE action:

1. "generate_signal" — if there's a clear, high-confluence trade setup with R:R > 1.5 and confidence > 60
2. "analysis_report" — if you can provide useful market insights but no clear signal
3. "monitor" — if the market is unclear, wait for more data
4. "no_action" — if conditions are unfavorable

Respond with ONLY valid JSON in this exact format, no markdown, no explanation:
{"action": "generate_signal|analysis_report|monitor|no_action", "confidence": 75, "reasoning": "2-3 sentence explanation"}`;
  }

  /**
   * Parse the LLM's JSON decision response, handling markdown fences
   * and extra text that commonly appears around the JSON.
   */
  private parseDecision(response: string, report: SmcReport): Decision {
    try {
      // Remove markdown code fences if present
      let cleaned = response.trim();
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
      cleaned = cleaned.replace(/\s*```$/i, "");

      // Try to extract a JSON object from the response
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON object found in response");
      const parsed = JSON.parse(jsonMatch[0]);

      const validActions = ["generate_signal", "analysis_report", "monitor", "no_action"];
      const action = validActions.includes(parsed.action) ? parsed.action : "analysis_report";

      return {
        action,
        confidence: Math.min(100, Math.max(0, parsed.confidence ?? 50)),
        reasoning: parsed.reasoning ?? "No reasoning provided",
      };
    } catch {
      // Fallback: just report analysis
      return {
        action: "analysis_report",
        confidence: 50,
        reasoning: "Could not parse LLM decision. Generating analysis report.",
      };
    }
  }

  /**
   * Execute the decided action.
   */
  private async act(decision: Decision, report: SmcReport): Promise<LoopResult> {
    if (decision.action !== "generate_signal") {
      return {
        action: decision.action === "no_action" ? "no_action" : "analysis_complete",
        confidence: decision.confidence,
        narrative: decision.reasoning,
      };
    }

    const market: Market = detectMarketFromSymbol(report.symbol);
    const signal = this.signalGenerator.generateFromReport(report, market, {
      source: "AGENT_LOOP",
    });

    if (!signal) {
      return {
        action: "no_action",
        confidence: decision.confidence,
        narrative: `No valid trade setup detected: ${decision.reasoning}`,
      };
    }

    // Apply guardrails to the signal
    const signalCheck = this.guardrails.validateSignal(
      signal.confidence_score,
      signal.risk_reward_ratio,
    );

    if (!signalCheck.passed) {
      return {
        action: "analysis_complete",
        confidence: decision.confidence,
        narrative: `Signal blocked by guardrails: ${signalCheck.reason}. ${decision.reasoning}`,
      };
    }

    // Persist to ledger (best-effort)
    try {
      await this.ledgerService.logSignal(signal, "REVIEW");
      logger.info(
        { symbol: signal.symbol, confidence: signal.confidence_score, rr: signal.risk_reward_ratio },
        "Agent loop generated and logged signal",
      );
    } catch (err: any) {
      logger.warn({ err }, "Failed to log signal to ledger");
    }

    return {
      action: "signal_generated",
      confidence: signal.confidence_score,
      narrative: decision.reasoning,
      signal,
    };
  }
}
