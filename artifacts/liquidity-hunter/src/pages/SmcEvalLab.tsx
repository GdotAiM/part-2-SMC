/**
 * SMC-EVAL Benchmark Lab
 *
 * Exposes the 100-scenario benchmark suite as a first-class product surface.
 * Uses the existing POST /api/smc-eval/evaluate and GET /api/smc-eval/scenarios endpoints.
 */

import { useState, useEffect } from "react";
import { FlaskConical, ChevronRight, TrendingUp, TrendingDown, Minus, Check, AlertTriangle, Brain, Target } from "lucide-react";
import { apiUrl } from "@/lib/api";

interface ScenarioMeta {
  id: string;
  asset: string;
  market: string;
  session: string;
  primaryModel: string;
}

interface EvalScore {
  scenarioId: string;
  scores?: {
    total: number;
    classification?: string;
    structuralAccuracy: { total: number };
    modelAlignment: { total: number };
    confluenceReasoning: { total: number };
    tradePrecision: { total: number };
    hallucinationAvoidance: { total: number };
    failureFlags?: string[];
  };
  modelClassification?: string;
}

const CATEGORIES = [
  { key: "clear", label: "Clear Model", desc: "One strongly represented model", count: 20, color: "bg-[hsl(var(--bullish))]" },
  { key: "false-positive", label: "False Positive", desc: "Missing critical prerequisite", count: 20, color: "bg-primary" },
  { key: "model-conflict", label: "Model Conflict", desc: "Competing interpretations", count: 20, color: "bg-yellow-500" },
  { key: "adversarial", label: "Adversarial", desc: "Trap claims & false narratives", count: 20, color: "bg-destructive" },
  { key: "ambiguous", label: "Ambiguous", desc: "Correct answer is uncertainty", count: 20, color: "bg-cyan-400" },
];

const SCORE_DIMS = [
  { key: "structuralAccuracy", label: "Structural Accuracy", max: 30 },
  { key: "modelAlignment", label: "Model Alignment", max: 25 },
  { key: "confluenceReasoning", label: "Reasoning", max: 20 },
  { key: "tradePrecision", label: "Trade Precision", max: 15 },
  { key: "hallucinationAvoidance", label: "Hallucination Avoidance", max: 10 },
];

export function SmcEvalLab() {
  const [scenarios, setScenarios] = useState<ScenarioMeta[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<EvalScore | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<string>("SMC-EVAL-000001");

  useEffect(() => {
    fetch(apiUrl("/smc-eval/scenarios"))
      .then(r => r.json())
      .then(d => setScenarios(d.scenarios ?? []))
      .catch(() => {});
  }, []);

  async function runEval() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch(apiUrl("/smc-eval/evaluate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: selectedScenario }),
      });
      const data = await res.json();
      setResult({
        scenarioId: data.scenarioId,
        scores: data.scores,
        modelClassification: data.modelClassification,
      });
    } catch { /* ignore */ }
    setRunning(false);
  }

  return (
    <div className="p-5 lg:p-7 max-w-[1800px] mx-auto space-y-5">
      {/* Header */}
      <div>
        <div className="text-[9px] text-primary/50 uppercase tracking-widest mb-1">Evaluate</div>
        <h1 className="text-2xl lg:text-3xl font-black tracking-tight">SMC-EVAL Benchmark Lab</h1>
        <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
          A benchmark for whether AI actually understands SMC reasoning — not just whether it can name a Fair Value Gap.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Score Overview */}
        <section className="col-span-12 xl:col-span-5 rounded-sm border border-border/30 bg-card/40 p-5">
          <div className="text-[9px] text-primary/50 uppercase tracking-widest">Current Benchmark</div>
          {result?.scores ? (
            <>
              <div className="mt-4 flex items-end gap-3">
                <span className="text-6xl font-black">{Math.round(result.scores.total)}</span>
                <span className="text-xs text-muted-foreground pb-2">/ 100<br />
                  <span className={result.scores.classification === "Strong" || result.scores.classification === "Expert-Level" ? "text-[hsl(var(--bullish))]" : result.scores.classification === "Competent" ? "text-primary" : "text-amber-400"}>
                    {result.scores.classification}
                  </span>
                </span>
              </div>
              <div className="mt-5 space-y-3">
                {SCORE_DIMS.map(dim => {
                  const val = (result.scores as any)[dim.key]?.total ?? 0;
                  return (
                    <div key={dim.key}>
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{dim.label}</span>
                        <span>{val}/{dim.max}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400" style={{ width: `${(val / dim.max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {result.modelClassification && (
                <div className="mt-4 p-3 rounded-sm bg-primary/5 border border-primary/20">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Classification: </span>
                  <span className="text-xs font-bold text-primary">{result.modelClassification}</span>
                </div>
              )}
            </>
          ) : (
            <div className="mt-8 flex items-center justify-center h-40 text-xs text-muted-foreground italic font-mono">
              Run an evaluation to see scores
            </div>
          )}
        </section>

        {/* Scenario Matrix */}
        <section className="col-span-12 xl:col-span-7 rounded-sm border border-border/30 bg-card/40 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Scenario Matrix</h3>
              <p className="text-[9px] text-muted-foreground/50 mt-0.5">100 Scenarios · 5 Difficulty Classes</p>
            </div>
            <span className="text-[9px] text-primary font-mono">SMC-EVAL-000001 → 000100</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
            {CATEGORIES.map((cat) => (
              <div key={cat.key} className="rounded-sm bg-muted/20 border border-border/20 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{cat.label}</span>
                  <span className="text-xs text-primary">{cat.count}</span>
                </div>
                <div className="text-[9px] text-muted-foreground mt-1">{cat.desc}</div>
                <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${cat.color}`} style={{ width: `${(cat.count / 100) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Run evaluation */}
          <div className="flex items-center gap-3">
            <select
              value={selectedScenario}
              onChange={e => setSelectedScenario(e.target.value)}
              className="bg-muted border border-border text-xs rounded-sm px-2 py-1.5 font-mono"
            >
              {scenarios.length > 0 ? scenarios.map(s => (
                <option key={s.id} value={s.id}>{s.id} — {s.asset}</option>
              )) : (
                <option value="SMC-EVAL-000001">SMC-EVAL-000001 — BTCUSDT</option>
              )}
            </select>
            <button
              onClick={runEval}
              disabled={running}
              className="px-4 py-1.5 rounded-sm bg-primary/10 border border-primary/20 text-xs text-primary font-semibold hover:bg-primary/15 disabled:opacity-40 transition-colors"
            >
              {running ? "Running..." : "Evaluate Scenario"}
            </button>
          </div>
        </section>

        {/* Dimensions explanation */}
        <section className="col-span-12 rounded-sm border border-border/30 bg-card/40 p-5">
          <div className="mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Scoring Dimensions</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              ["Structural Accuracy", "30", "Direction, BOS/MSS, liquidity, SMC structures"],
              ["Model Alignment", "25", "Primary model, prerequisites, discrimination"],
              ["Confluence & Reasoning", "20", "HTF/LTF, liquidity narrative, causality"],
              ["Trade Precision", "15", "Entry, SL, TP, R:R, invalidation"],
              ["Hallucination Avoidance", "10", "No fabricated concepts, uncertainty calibration"],
            ].map(([name, weight, desc]) => (
              <div key={name} className="rounded-sm bg-muted/20 border border-border/20 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold">{name}</span>
                  <span className="text-[9px] text-primary font-mono">{weight}</span>
                </div>
                <p className="text-[9px] text-muted-foreground mt-1">{desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
