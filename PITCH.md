# SMC Pulse Predict — Liquidity Hunter

**AMD x LabLab.ai Hackathon — "Build Across the AI Stack"**

> One-page pitch for judges. For step-by-step running, see [`DEMO.md`](./DEMO.md).
> For full architecture, see [`ARCHITECTURE.md`](./ARCHITECTURE.md) and
> [`BACKEND.md`](./BACKEND.md). For the AMD/MI300X story, see
> [`AMD_INFRASTRUCTURE.md`](./AMD_INFRASTRUCTURE.md).

---

## The problem

Most retail traders lose because they read charts the wrong way. Institutions
don't buy at support and sell at resistance — they **hunt liquidity**, create
imbalance, and deliver price into equilibrium. The **ICT / Smart Money Concepts
(SMC)** methodology captures this, but doing it by hand across multiple
timeframes takes a trained analyst 30–60 minutes per symbol — and has to be
redone on every candle close.

## The solution

An automated SMC analyst that ingests live OHLCV data, runs the full ICT
methodology deterministically, and lets a **Gemma 4**-powered AI agent explain
the institutional narrative in plain language — updated in real time on every
candle close. Crypto and forex, across 7 timeframes simultaneously, in seconds.

## Architecture (3 layers)

1. **Deterministic SMC engine** (`artifacts/api-server/src/lib/smc/*`) — 8 real
   modules: market structure (pivots → BOS/CHoCH → phase), liquidity pools
   (BSL/SSL/EQH/EQL with session-weighted sweep probability), order blocks,
   fair value gaps, premium/discount array, daily bias, SMT divergence, and a
   report builder that assembles draw-on-liquidity targets + a market
   narrative. This is the grounding layer — no hallucination possible here.
2. **Real-time pipeline** — Binance WebSocket → in-memory candle store
   (EventEmitter) → analysis bridge (rebuilds the SMC report on every candle
   close) → SSE push to the browser. The dashboard updates live without a REST
   round-trip.
3. **Agentic AI layer on AMD MI300X** — a multi-provider LLM abstraction routes
   three agent surfaces to self-hosted **vLLM running Gemma 4 26B** on the
   MI300X: a streaming Q&A analyst, a 4-stage analysis pipeline, and an **MCP
   tool-calling agent** that picks from 11 SMC tools via Gemma's native
   function-calling.

## What's real (shipped, working)

- ✅ Live SMC dashboard — real Binance WS candles, real SMC annotations on a
  lightweight-charts v5 canvas (OB/FVG/BOS-CHoCH/PD array/session bands/SMT)
- ✅ Real-time SSE pipeline — report rebuilds on candle close, pushes to browser
- ✅ AI Market Briefing — streams a structured read of the current report, with
  follow-up conversation
- ✅ MCP tool-calling agent — genuine multi-round loop (up to 3 rounds), 11
  tools, dual-path (FastMCP server for external clients + internal registry)
- ✅ 4-stage analysis pipeline (Structure → Liquidity → FVG → Confluence),
  where the Confluence agent synthesizes the **actual outputs** of the prior three
- ✅ Trade lifecycle — signal generation → Postgres ledger → performance matrix
  (win rate / Sharpe / profit factor per setup) → auto-settlement daemon
- ✅ Broker abstraction — Alpaca paper trading + file-based MockBroker, with
  REVIEW/LIVE mode gating (LIVE requires explicit `confirm: "LIVE"`)
- ✅ Backtester — sliding-window, runs the real SMC engine on Yahoo Finance history
- ✅ gzip compression on all JSON responses (SSE excluded to keep token streaming)
- ✅ Graceful no-DB / no-key fallbacks — the app boots and demos without Postgres
  or an LLM key (AI endpoints report "not configured" rather than crashing)

## AMD integration

- **Hardware:** AMD Instinct MI300X (192 GB HBM3), ROCm, `vllm/vllm-openai-rocm`
- **Model:** `google/gemma-4-26B-A4B-it` with native tool-calling
  (`--tool-call-parser gemma4 --reasoning-parser gemma4 --enable-auto-tool-choice`)
- **Deployment:** `deploy/amd-developer-cloud/docker-compose.yml` — vllm + api +
  db + frontend, GPU device passthrough, weight caching across restarts
- **Cost:** self-hosted inference → **no per-token API bill** (Fireworks kept only
  as an opt-in fallback via one env var)
- **Status:** the vLLM/ROCm stack and provider routing are **configured and ready**;
  running it on a live AMD Developer Cloud VM is the remaining checklist item
  (honestly marked `[ ]` in `README.md`)

## What's next (scoped, not yet built)

A **vision-language chart analysis** extension (Track 3): chart screenshot → a
multimodal model on the MI300X → structured SMC read, compared against the
deterministic engine for consensus. This is documented as **planned future
work** in `AMD_INFRASTRUCTURE.md` §3 — it is not in the current submission.
See [`ROADMAP.md`](./ROADMAP.md) for the full post-hackathon plan (DuckDB
analytics split, async backtest queue, measure-first sizing).

## Why it fits the hackathon

- **Uses the MI300X meaningfully** — local Gemma 4 inference drives the agent
  layer, not just configured-and-idle
- **Agentic (Track 1)** — real multi-round MCP tool-calling, not single-shot prompts
- **Open-source stack** — Express, Drizzle, vLLM, lightweight-charts, shadcn/ui
- **Honest** — claims match code; aspirational features are labelled as planned
