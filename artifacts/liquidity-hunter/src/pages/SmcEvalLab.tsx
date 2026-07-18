/**
 * SMC-EVAL Benchmark Lab
 *
 * Dual workflow:
 * 1. "Evaluate Scenario" — runs the engine-only evaluation (POST /api/smc-eval/evaluate)
 * 2. "Score AI Answer" — submits human/AI reasoning for scoring (POST /api/smc-eval/score)
 */

import { useState, useEffect } from "react";
import { FlaskConical, ChevronRight, Check, AlertTriangle, Loader2, Brain, Target } from "lucide-react";
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
  failureFlags?: string[];
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
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState<EvalScore | null>(null);
  const [selectedScenario, setSelectedScenario] = useState("SMC-EVAL-000001");
  const [error, setError] = useState<string | null>(null);

  // AI answer inputs
  const [reasoning, setReasoning] = useState("");
  const [modelIds, setModelIds] = useState("");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [rr, setRr] = useState("");
  const [invalidation, setInvalidation] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(apiUrl("/smc-eval/scenarios"))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { if (!cancelled) setScenarios(d.scenarios ?? []); })
      .catch(e => { if (!cancelled) setError(e.message ?? "Failed to load scenarios"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  /** Engine-only evaluation — sends { scenarioId } */
  async function runEval() {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(apiUrl("/smc-eval/evaluate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: selectedScenario }),
      });
      if (!res.ok) { setError(`HTTP ${res.status}: ${res.statusText}`); return; }
      const data = await res.json();
      setResult({
        scenarioId: data.scenarioId,
        scores: data.scores,
        modelClassification: data.modelClassification,
      });
    } catch (e: any) { setError(e.message ?? "Evaluation failed"); }
    setRunning(false);
  }

  /** Score AI reasoning — sends { scenarioId, reasoning, modelIds, ...trade } */
  async function scoreAnswer() {
    if (!reasoning.trim()) { setError("Enter AI reasoning text before scoring."); return; }
    setScoring(true);
    setResult(null);
    setError(null);
    try {
      const body: Record<string, unknown> = { scenarioId: selectedScenario, reasoning: reasoning.trim() };
      const parsedModels = modelIds.split(",").map(s => s.trim()).filter(Boolean);
      if (parsedModels.length > 0) body.modelIds = parsedModels;
      if (entry.trim()) body.entry = entry.trim();
      if (stop.trim()) body.stop = stop.trim();
      if (target.trim()) body.target = target.trim();
      if (rr.trim()) body.rr = parseFloat(rr);
      if (invalidation.trim()) body.invalidation = invalidation.trim();

      const res = await fetch(apiUrl("/smc-eval/score"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); setError(err.error ?? `HTTP ${res.status}`); return; }
      const data = await res.json();
      setResult({
        scenarioId: data.scenarioId,
        scores: data.scores,
        modelClassification: data.modelClassification,
        failureFlags: data.failureFlags,
      });
    } catch (e: any) { setError(e.message ?? "Scoring failed"); }
    setScoring(false);
  }

  const classificationColor = (c?: string) => {
    if (c === "Strong" || c === "Expert-Level") return "text-[hsl(var(--bullish))]";
    if (c === "Competent") return "text-primary";
    return "text-amber-400";
  };

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
                  <span className={classificationColor(result.scores.classification)}>
                    {result.scores.classification ?? "Unclassified"}
                  </span>
                </span>
              </div>

              {result.failureFlags && result.failureFlags.length > 0 && (
                <div className="mt-3 space-y-1">
                  {result.failureFlags.map(flag => (
                    <div key={flag} className="flex items-center gap-1.5 text-[10px] text-destructive">
                      <AlertTriangle className="w-3 h-3" /> {flag.replace(/_/g, " ")}
                    </div>
                  ))}
                </div>
              )}

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
              Run an evaluation or score an AI answer to see results
            </div>
          )}

          {error && (
            <div className="mt-3 flex items-center gap-2 text-[10px] text-destructive">
              <AlertTriangle className="w-3 h-3" /> {error}
            </div>
          )}
        </section>

        {/* Scenario Matrix + Submission */}
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

          {/* Scenario selector + buttons */}
          <div className="flex items-center gap-3 mb-4">
            <select
              value={selectedScenario}
              onChange={e => { setSelectedScenario(e.target.value); setResult(null); setError(null); }}
              className="bg-muted border border-border text-xs rounded-sm px-2 py-1.5 font-mono flex-1"
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
              {running ? "Running..." : "Engine Eval"}
            </button>
          </div>

          {/* AI Answer Submission */}
          <div className="rounded-sm bg-muted/20 border border-border/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Brain className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Score AI Answer</span>
            </div>

            <textarea
              value={reasoning}
              onChange={e => setReasoning(e.target.value)}
              placeholder="Paste the AI's reasoning text here…"
              rows={4}
              className="w-full bg-muted border border-border rounded-sm px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y"
            />

            <div className="grid grid-cols-2 gap-2">
              <input
                value={modelIds}
                onChange={e => setModelIds(e.target.value)}
                placeholder="Model IDs (comma-separated, e.g. SILVER_BULLET,CHOCH)"
                className="bg-muted border border-border rounded-sm px-2 py-1.5 text-[10px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <input
                value={invalidation}
                onChange={e => setInvalidation(e.target.value)}
                placeholder="Invalidation reason"
                className="bg-muted border border-border rounded-sm px-2 py-1.5 text-[10px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-4 gap-2">
              <input value={entry} onChange={e => setEntry(e.target.value)} placeholder="Entry" className="bg-muted border border-border rounded-sm px-2 py-1.5 text-[10px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              <input value={stop} onChange={e => setStop(e.target.value)} placeholder="Stop" className="bg-muted border border-border rounded-sm px-2 py-1.5 text-[10px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              <input value={target} onChange={e => setTarget(e.target.value)} placeholder="Target" className="bg-muted border border-border rounded-sm px-2 py-1.5 text-[10px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              <input value={rr} onChange={e => setRr(e.target.value)} placeholder="R:R" className="bg-muted border border-border rounded-sm px-2 py-1.5 text-[10px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>

            <button
              onClick={scoreAnswer}
              disabled={scoring || !reasoning.trim()}
              className="w-full py-2 rounded-sm bg-primary/10 border border-primary/20 text-xs text-primary font-semibold hover:bg-primary/15 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              {scoring ? <><Loader2 className="w-3 h-3 animate-spin" /> Scoring…</> : <><Check className="w-3 h-3" /> Score AI Answer</>}
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
