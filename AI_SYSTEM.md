# AI System — SMC Pulse Predict

## Overview

The AI layer provides two modes of interaction, both powered by **Fireworks AI** (DeepSeek V4 Pro) via an OpenAI-compatible streaming API. Neither mode requires pre-training — the model is grounded entirely by injecting the live `SmcReport` into the system prompt at request time.

---

## Model

| Property | Value |
|---|---|
| Provider | Fireworks AI |
| Model | `accounts/fireworks/models/deepseek-v4-pro` |
| Context | Live SmcReport injected per request |
| Streaming | Server-Sent Events (SSE) — token-by-token |
| Auth | `FIREWORKS_API_KEY` environment secret |
| Base URL | `https://api.fireworks.ai/inference/v1` |

---

## System Prompt Construction

Every request builds a fresh system prompt from the current `SmcReport`. The prompt is structured as a strict-format market brief:

```
You are an expert SMC/ICT analyst embedded in "SMC Pulse Predict".

CURRENT MARKET CONTEXT:
- Symbol: BTCUSDT (crypto)
- Timeframe: 4h
- Current Price: 59740.37

MARKET STRUCTURE:
- Trend: bearish | Bias: bearish | Confidence: 72%
- Recent Breaks: CHoCH bearish @ 61200, BOS bearish @ 60100

DAILY BIAS:
- bearish | Strength: 68% | Consecutive: 7 days

LIQUIDITY MAP:
- Nearest BSL: BSL @ 65549.94 (score 0.81)
- Nearest SSL: SSL @ 59093.99 (score 0.94)
- Active Pools: BSL @ 65549 (3x), SSL @ 59093 (4x) ...

ORDER BLOCKS (Live/Unmitigated):
- bearish OB 61400→60800 +FVG

FAIR VALUE GAPS (Unfilled):
- bearish FVG 60800–61200 (12% filled)

PD ARRAY:
- Current Position: premium
- Equilibrium: 62321.00
- Dealing Range (4h): 58900 – 65550

SMT DIVERGENCE:
- DETECTED — bearish_smt (74% confidence) between BTCUSDT / ETHUSDT

TOP DRAW ON LIQUIDITY TARGETS:
- Sell-side Liquidity @ 59093.99000 (score 1.42)

INSTRUCTIONS:
- Answer as a focused SMC/ICT analyst...
```

Key design decisions:
- **Numeric grounding**: All prices and percentages are injected literally — the model cannot hallucinate levels because it reads them directly
- **Strict role framing**: The model is told it is embedded within the specific application, reinforcing it will not give financial advice or go off-topic
- **SMC vocabulary enforcement**: The system prompt uses SMC terminology throughout, which steers the model's language output to match the UI's vocabulary

---

## Mode 1 — Streaming Q&A (`/api/agents/ask`)

### Purpose
Contextual question-answering where the user can type any question and get a live SMC-analyst response grounded in the current timeframe's report.

### Request
```json
POST /api/agents/ask
{
  "question": "Where is the most likely draw on liquidity?",
  "report": { ...SmcReport },
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

### Conversation History
The last 8 turns of history are prepended before the current question. This enables follow-up questions ("and what would invalidate that?") without re-stating context.

### Streaming Flow
```
1. Response headers set: Content-Type: text/event-stream
2. fetch() → Fireworks SSE stream opens
3. Server reads chunks → re-emits as SSE:
   data: {"content": "The "}
   data: {"content": "nearest "}
   data: {"content": "draw..."}
4. Stream ends:
   data: {"done": true}
```

### Frontend (`AgentChat.tsx`)
- Uses `EventSource` / `fetch` with `ReadableStream`
- Appends delta tokens to `assistantContent` state in real-time
- Scrolls to bottom on each token

### Token Budget
- `max_tokens: 1024` — allows thorough answers without runaway responses

---

## Mode 2 — Sequential Multi-Agent Pipeline (`/api/agents/pipeline`)

### Purpose
A structured 4-agent analysis that runs sequentially, each agent specialising in one aspect of the SMC analysis. Triggered when the user taps the **SMT** indicator on a TF card.

### Agents

| Agent | Focus | Prompt Summary |
|---|---|---|
| **Structure Agent** | Market structure | Who controls the market, last MSS/BOS, what the bias implies |
| **Liquidity Agent** | Liquidity map | Where BSL/SSL rests, which is more likely hunted, why |
| **FVG Agent** | Imbalances | Most important unfilled FVG, rebalance vs continuation gap |
| **Confluence Agent** | Synthesis | Highest-probability draw, confirming factors, invalidation level |

### Pipeline SSE Protocol
```
data: {"agent": "Structure Agent", "type": "start"}
data: {"agent": "Structure Agent", "type": "delta", "content": "Bears "}
data: {"agent": "Structure Agent", "type": "delta", "content": "control..."}
data: {"agent": "Structure Agent", "type": "done"}
data: {"agent": "Liquidity Agent", "type": "start"}
...
data: {"type": "pipeline_done"}
```

### Frontend (`AgentPipeline.tsx`)
- Renders each agent as a labelled panel
- Streams tokens into the correct agent panel in real-time
- Shows a pulsing indicator while the current agent is streaming

### Token Budget
- `max_tokens: 512` per agent — encourages concise 2–4 sentence outputs

---

## Agent Roles & Reasoning Flow

```
Structure Agent
  Reads: structure.bias, structure.breaks, structure.trend, structure.confidence
  Output: "Bears made a confirmed BOS at 60,100 following a CHoCH at 61,200.
           The 72% confidence bearish bias points to the SSL at 59,094 as
           the next institutional draw."

      ↓

Liquidity Agent
  Reads: liquidity.nearestBSL, nearestSSL, pools
  Output: "SSL at 59,094 has been touched 4 times and sits below a tight
           consolidation. BSL at 65,550 is unlikely to be reached before
           a sweep of SSL given the bearish HTF bias."

      ↓

FVG Agent
  Reads: fvg[] filtered to fillFraction < 0.5
  Output: "The bearish FVG at 60,800–61,200 (12% filled) acts as a
           resistance zone. Price is unlikely to close this gap before
           continuing south — it serves as a bearish continuation gap."

      ↓

Confluence Agent
  Reads: all of the above (same system prompt)
  Output: "The highest-probability draw is SSL at 59,094 — confirmed by
           bearish structure, premium PD positioning, SMT divergence, and
           an unmitigated bearish OB above current price. Invalidation: a
           reclaim and BOS above 61,400 would negate the bearish thesis."
```

---

## Context Construction

The `buildSystemPrompt()` function transforms the `SmcReport` into the text brief. Key transformation steps:

1. **Filter active data**: Only unmitigated OBs, unfilled FVGs (< 50%), unswept pools
2. **Slice for brevity**: Top 5 OBs, 5 FVGs, 8 liquidity pools, last 3 structure breaks
3. **Humanise numbers**: Scores formatted to 2 decimal places, confidence as %
4. **Conditional sections**: SMT section only appears if `smt.detected = true`
5. **Sorted targets**: `draw[]` already sorted by confluenceBoost score before injection

---

## Future AI Roadmap

- **Streaming narrative generation**: Replace the deterministic `buildMarketNarrative()` with a lighter AI call for richer narrative output
- **Multi-TF synthesis agent**: An agent that reads all 7 timeframe reports simultaneously and generates a top-down cascade narrative
- **Entry refinement agent**: Given a setup, proposes specific entry, SL, and TP levels based on OB proximal and liquidity distances
- **Invalidation tracker**: Monitors live price against the AI-stated invalidation levels and fires alerts
- **Fine-tuned SMC model**: A smaller model fine-tuned specifically on ICT educational material for lower latency and cost
- **RAG over ICT corpus**: Attach a retrieval system so the agent can cite specific ICT concepts with their definitions
