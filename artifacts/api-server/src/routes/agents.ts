import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { resolveLlmConfig } from "../lib/llm/provider.js";

const router: IRouter = Router();

function buildSystemPrompt(report: Record<string, unknown>): string {
  const r = report as {
    symbol: string;
    market: string;
    timeframe: string;
    currentPrice: number;
    structure: { trend: string; bias: string; confidence: number; breaks: Array<{ type: string; direction: string; price: number }> };
    dailyBias: { bias: string; strength: number; consecutiveDays: number; referencedSwing: string | null };
    liquidity: { nearestBSL: { price: number; score: number } | null; nearestSSL: { price: number; score: number } | null; pools: Array<{ type: string; price: number; touches: number; wasSwept: boolean; session: string | null }> };
    orderBlocks: Array<{ type: string; proximal: number; distal: number; valid: boolean; isMitigated: boolean; isBreaker: boolean; hasFvg: boolean; strength: number }>;
    fvg: Array<{ type: string; top: number; bottom: number; fillFraction: number; isInversion: boolean }>;
    pdArray: { currentBias: string; equilibrium: number; dealingRange: { high: number; low: number; timeframe: string } };
    smt: { detected: boolean; type: string | null; confidence: number; primarySymbol: string | null; correlatedSymbol: string | null };
    draw: Array<{ label: string; score: number; direction: string }>;
  };

  const recentBreaks  = (r.structure.breaks ?? []).slice(-3).map(b => `${b.type} ${b.direction} @ ${b.price}`).join(", ") || "none";
  const bslInfo       = r.liquidity.nearestBSL ? `BSL @ ${r.liquidity.nearestBSL.price} (score ${r.liquidity.nearestBSL.score.toFixed(2)})` : "none";
  const sslInfo       = r.liquidity.nearestSSL ? `SSL @ ${r.liquidity.nearestSSL.price} (score ${r.liquidity.nearestSSL.score.toFixed(2)})` : "none";
  const liveOBs       = (r.orderBlocks ?? []).filter(ob => ob.valid && !ob.isMitigated).slice(0, 5)
    .map(ob => `${ob.type} OB ${ob.proximal}→${ob.distal}${ob.hasFvg ? " +FVG" : ""}${ob.isBreaker ? " BREAKER" : ""}`).join(", ") || "none";
  const unfilledFVGs  = (r.fvg ?? []).filter(g => g.fillFraction < 0.5).slice(-5)
    .map(g => `${g.type} FVG ${g.bottom}–${g.top} (${Math.round(g.fillFraction * 100)}% filled)${g.isInversion ? " INV" : ""}`).join(", ") || "none";
  const topDraws      = (r.draw ?? []).slice(0, 3).map(d => `${d.label} (score ${d.score.toFixed(2)})`).join(", ");
  const smtLine       = r.smt.detected ? `DETECTED — ${r.smt.type} (${Math.round(r.smt.confidence * 100)}% confidence) between ${r.smt.primarySymbol} / ${r.smt.correlatedSymbol}` : "Not detected";
  const liquidityPools = (r.liquidity.pools ?? []).slice(0, 8)
    .map(p => `${p.type} @ ${p.price} (${p.touches}x${p.session ? " " + p.session : ""}${p.wasSwept ? " SWEPT" : ""})`).join(", ");

  return `You are an expert ICT/SMC (Inner Circle Trader / Smart Money Concepts) analyst embedded in "SMC Pulse Predict — Liquidity Hunter". You provide intelligent, contextual market analysis like a professional trader explaining to a colleague.

CORE BEHAVIOR:
- Respond conversationally FIRST — think out loud, explain your reasoning, then point to specific levels.
- Use bullet points or numbered steps for complex analysis.
- End each response with actionable insight or a follow-up question to continue the conversation.
- READ the indicators on the user's TradingView chart (LuxAlgo, Smart Money Concepts, ICT Concepts, etc.) and reference their levels in your analysis. The indicators are already loaded on the chart as data sources — use read_tv_indicator_levels to pull them, then compare against the internal SMC engine. This makes your analysis richer: "The LuxAlgo SMC indicator shows liquidity at X, and the engine agrees at Y."
- If you have access to the MCP agent's TV tools (tv_data_get_quote, tv_data_get_depth, etc.), use them to enrich your answers when relevant.

CURRENT MARKET CONTEXT:
- Symbol: ${r.symbol} (${r.market})
- Timeframe: ${r.timeframe}
- Current Price: ${r.currentPrice}

MARKET STRUCTURE:
- Trend: ${r.structure.trend} | Bias: ${r.structure.bias} | Confidence: ${Math.round(r.structure.confidence * 100)}%
- Recent Breaks: ${recentBreaks}

DAILY BIAS:
- ${r.dailyBias.bias} | Strength: ${Math.round(r.dailyBias.strength * 100)}% | Consecutive: ${r.dailyBias.consecutiveDays} days
- Swing Reference: ${r.dailyBias.referencedSwing ?? "none"}

LIQUIDITY MAP:
- Nearest BSL (Buy-Side): ${bslInfo}
- Nearest SSL (Sell-Side): ${sslInfo}
- Active Pools: ${liquidityPools}

ORDER BLOCKS (Live/Unmitigated):
- ${liveOBs}

FAIR VALUE GAPS (Unfilled):
- ${unfilledFVGs}

PD ARRAY:
- Current Position: ${r.pdArray.currentBias}
- Equilibrium: ${r.pdArray.equilibrium}
- Dealing Range (${r.pdArray.dealingRange.timeframe}): ${r.pdArray.dealingRange.low} – ${r.pdArray.dealingRange.high}

SMT DIVERGENCE:
- ${smtLine}

TOP DRAW ON LIQUIDITY TARGETS:
- ${topDraws}

INSTRUCTIONS:
- Analyze like a professional trader. Be precise and reference actual price levels from the context above.
- Respond conversationally FIRST — think out loud, explain your reasoning, then point to specific levels.
- Use bullet points or numbered steps for complex analysis.
- End each response with actionable insight or a follow-up question.
- Do not give financial advice or buy/sell signals.
- Explain concepts clearly using SMC/ICT terminology.
- If asked about invalidation, be specific about what price action would negate the current thesis.

SYSTEM CAPABILITIES YOU CAN USE (tell the user how to trigger these):
1. TRADINGVIEW DESKTOP CDP INTEGRATION — The system can connect to your local TradingView Desktop app via Chrome DevTools Protocol (port 9222). Once connected, it can read live chart data, detect your active indicators, draw SMC levels (BSL/SSL/FVGs/killzones), change symbol/timeframe, draw shapes/lines/levels, click UI elements, open panels, read quotes and order book depth — all directly on your TV chart.
2. PINE INDICATOR LEVEL READING — If you have LuxAlgo ICT tools or any other Pine Script indicator running on your TV chart, the system can read its horizontal line levels, labels, and detection outputs. It automatically classifies them into OB, FVG, BOS/CHoCH, liquidity sweep, SMT, and other detection types.
3. COMPARISON ENGINE (Internal Engine vs TV) — The system can cross-reference what YOUR indicators detect (from the TV chart) against what the internal SMC engine finds from raw price data. It produces structured comparisons, measures price discrepancy, confidence gaps, and tracks which source detected what. (Endpoint: POST /api/learning/comparisons/analyze)
4. RELIABILITY SCORING — Over time, the system tracks per-type reliability (e.g., "our engine is 96% reliable for OBs but 64% for SMT"). It builds a performance matrix and can suggest parameter improvements based on thousands of comparison data points. (Endpoint: GET /api/learning/reliability)
5. TRUTH ENGINE — When TV and engine disagree, the Truth Engine arbitrates: it considers reliability history, market regime, and context to produce a single authoritative verdict per level. (Endpoint: POST /api/learning/arbitrate)
6. OUTCOME EVALUATION — After a detection is stored, the system can check forward price action to see if the level was respected, swept, or ignored, then update who was correct — the TV indicator or the internal engine. (Endpoint: POST /api/learning/evaluate-outcomes)
7. CHART CONTROL — Change symbol, timeframe, chart type (candles/line/heikin-ashi), scroll to dates. (Endpoint: POST /api/agent-loop/tv-connect first to enable)
8. UI CLICKING & PANELS — The MCP agent (POST /api/agents/ask-mcp) can click UI elements like Buy/Sell buttons, open the Trading Panel, find elements by text, and execute keyboard shortcuts. This means IF you are signed into your TradingView paper trading account and the Trading Panel is visible, the MCP agent can place trades by clicking the buy/sell buttons through TV's UI. You just need to be logged into your paper account manually — the app can't log in for you.
9. ALPACA PAPER TRADING (alternative execution path) — If ALPACA_API_KEY_ID and ALPACA_API_SECRET_KEY are configured in .env, the system's ExecutionManager can execute trades through Alpaca's paper trading API directly (no TV needed). This is the more automated path with REVIEW/LIVE mode safety toggle. (Check /api/account status.)

RESPONDING TO CAPABILITY QUESTIONS:
- If the user asks about any of the above, say "Yes, this system CAN do that — here's how it works" and explain the relevant capability from the list above.
- If they ask about reading their specific TV indicators or comparing against LuxAlgo levels, explain that the system connects to the TradingView Desktop they have running locally via CDP, reads whatever indicators are active on their chart, and runs the Comparison Engine against the internal SMC analysis.
- If they ask about trading on TradingView: explain both paths — (a) UI clicking through the MCP agent (requires them to be signed in and the Trading Panel open), and (b) Alpaca paper trading (more automated, requires env var setup).
- Never say "I can't do that" when the user asks about TV chart reading, indicator comparison, cross-referencing against their TV levels, or trading execution — those are exactly what this system is built for. Instead, guide them on how to enable it.`;
}

// ── /agents/ask — streaming Q&A with report context ──────────────────────────

router.post("/agents/ask", async (req: Request, res: Response): Promise<void> => {
  const { question, report, history = [] } = req.body as {
    question: string;
    report: Record<string, unknown>;
    history: Array<{ role: "user" | "assistant"; content: string }>;
  };

  if (!question || typeof question !== "string") {
    res.status(400).json({ error: "question is required" });
    return;
  }

  if (!report || typeof report !== "object") {
    res.status(400).json({ error: "report context is required" });
    return;
  }

  const llmConfig = resolveLlmConfig();
  if (!llmConfig.apiKey && llmConfig.provider !== "amd") {
    res.status(500).json({ error: "AI not configured — set FIREWORKS_API_KEY or LLM_API_KEY" });
    return;
  }

  const messages = [
    ...history.slice(-8),
    { role: "user" as const, content: question },
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const response = await fetch(`${llmConfig.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(llmConfig.apiKey && llmConfig.apiKey !== "not-needed"
          ? { Authorization: `Bearer ${llmConfig.apiKey}` }
          : {}),
      },
      body: JSON.stringify({
        model: llmConfig.model,
        stream: true,
        max_tokens: 1024,
        messages: [
          { role: "system", content: buildSystemPrompt(report) },
          ...messages,
        ],
      }),
    });

    if (!response.ok || !response.body) {
      const text = await response.text();
      res.write(`data: ${JSON.stringify({ error: `AI error: ${response.status} ${text}` })}\n\n`);
      res.end();
      return;
    }

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer    = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (!trimmed.startsWith("data: ")) continue;
        try {
          const json  = JSON.parse(trimmed.slice(6));
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
        } catch { /* skip malformed chunk */ }
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "Agent ask failed");
    res.write(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`);
    res.end();
  }
});

// ── /agents/pipeline — sequential multi-agent analysis ───────────────────────

router.post("/agents/pipeline", async (req: Request, res: Response): Promise<void> => {
  const { report } = req.body as { report: Record<string, unknown> };

  if (!report) {
    res.status(400).json({ error: "report is required" });
    return;
  }

  const llmConfig = resolveLlmConfig();
  if (!llmConfig.apiKey && llmConfig.provider !== "amd") {
    res.status(500).json({ error: "AI not configured — set FIREWORKS_API_KEY or LLM_API_KEY" });
    return;
  }

  const systemPrompt = buildSystemPrompt(report);

  const agentPrompts: Array<{ agent: string; prompt: string }> = [
    {
      agent: "Structure Agent",
      prompt: "In 2–3 sentences, describe the current market structure: who controls the market, the last MSS/BOS, and what the bias implies for the next move. Be specific with price levels.",
    },
    {
      agent: "Liquidity Agent",
      prompt: "In 2–3 sentences, identify where the most significant buy-side and sell-side liquidity rests, which is more likely to be hunted next, and why. Reference specific price levels.",
    },
    {
      agent: "FVG Agent",
      prompt: "In 2–3 sentences, identify the most important unfilled FVG(s) and explain whether price is likely to seek a rebalance there before continuing, or if they will remain as continuation gaps.",
    },
    {
      agent: "Confluence Agent",
      prompt: "In 3–4 sentences, synthesize all agents and produce the final narrative: what is the highest-probability draw on liquidity, what confirms this thesis, and what price action would invalidate it.",
    },
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  // Accumulate each agent's full streamed output so the Confluence agent can
  // synthesize from what the prior agents ACTUALLY said, instead of re-reading
  // the same SmcReport they all started from. This is what makes the pipeline a
  // genuine multi-step chain rather than four independent single-shot calls.
  const priorOutputs: Array<{ agent: string; text: string }> = [];

  for (const { agent, prompt } of agentPrompts) {
    res.write(`data: ${JSON.stringify({ agent, type: "start" })}\n\n`);

    // The Confluence agent is fed the real outputs of the Structure, Liquidity,
    // and FVG agents. Earlier agents get their original prompt unchanged.
    const userContent = priorOutputs.length
      ? `Previous agents in this pipeline produced the following analyses. Synthesize your answer from THESE outputs (not from the raw report):\n\n` +
        priorOutputs.map((o) => `### ${o.agent}\n${o.text}`).join("\n\n") +
        `\n\nNow, as the Confluence Agent: ${prompt}`
      : prompt;

    try {
      const response = await fetch(`${llmConfig.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(llmConfig.apiKey && llmConfig.apiKey !== "not-needed"
            ? { Authorization: `Bearer ${llmConfig.apiKey}` }
            : {}),
        },
        body: JSON.stringify({
          model: llmConfig.model,
          stream: true,
          max_tokens: 512,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        }),
      });

      if (!response.ok || !response.body) {
        res.write(`data: ${JSON.stringify({ agent, type: "error", content: `Error ${response.status}` })}\n\n`);
        continue;
      }

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";
      let agentText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (!trimmed.startsWith("data: ")) continue;
          try {
            const json  = JSON.parse(trimmed.slice(6));
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              agentText += delta;
              res.write(`data: ${JSON.stringify({ agent, type: "delta", content: delta })}\n\n`);
            }
          } catch { /* skip */ }
        }
      }

      priorOutputs.push({ agent, text: agentText });
      res.write(`data: ${JSON.stringify({ agent, type: "done" })}\n\n`);
    } catch (err) {
      req.log.error({ err, agent }, "Pipeline agent failed");
      res.write(`data: ${JSON.stringify({ agent, type: "error", content: "Agent failed" })}\n\n`);
    }
  }

  res.write(`data: ${JSON.stringify({ type: "pipeline_done" })}\n\n`);
  res.end();
});

export default router;
