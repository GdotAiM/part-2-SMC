# How SMC Liquidity Hunter Uses AMD Developer Cloud

> **Status (July 2026):** The vLLM-on-ROCm deployment described here is
> **configured and ready** via `deploy/amd-developer-cloud/docker-compose.yml`.
> The LLM provider layer routes agent inference to it (`LLM_PROVIDER=amd`).
> Running it end-to-end on a live AMD Developer Cloud MI300X VM is the
> remaining roadmap item (see the unchecked `End-to-end MI300X deployment`
> box in `README.md`). The **vision-language chart analysis** described
> below as "Planned" is **not yet implemented** — it is scoped future work,
> not shipped code. Everything else in this document reflects code that
> exists in the repo today.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   React Frontend (Vite)                       │
│  Dashboard · ChartView · IntelligenceSheet · Analytics        │
│  AI Market Briefing (streams from /api/agents/ask)            │
└──────────────────────────────────────────────────────────┬────┘
                           │ HTTP REST + SSE
┌──────────────────────────▼──────────────────────────────────┐
│              Express 5 API Server                             │
│  /api/analysis/*  /api/agents/*  /api/agents/ask-mcp          │
│  /api/ledger/*  /api/stream/:symbol (SSE)  /api/healthz       │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  LLM Provider Abstraction (lib/llm/provider.ts)      │    │
│  │  OpenAI-compatible /v1/chat/completions              │    │
│  │  resolveLlmConfig() → amd | fireworks | openai       │    │
│  └──────────────────────┬───────────────────────────────┘    │
└──────────────────────────│───────────────────────────────────┘
                           │ HTTP (OpenAI-compatible)
┌──────────────────────────▼──────────────────────────────────┐
│              AMD Developer Cloud VM                           │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  AMD Instinct™ MI300X (192 GB HBM3)                   │    │
│  │                                                       │    │
│  │  ┌─────────────────────────────────────┐              │    │
│  │  │  vLLM Server (port 8000)            │              │    │
│  │  │  ┌─────────────────────────────┐    │              │    │
│  │  │  │  google/gemma-4-26B-A4B-it  │    │  Agent       │    │
│  │  │  │  (SMC analysis + Q&A,       │    │  model       │    │
│  │  │  │   native tool-calling)      │    │              │    │
│  │  │  └─────────────────────────────┘    │              │    │
│  │  └─────────────────────────────────────┘              │    │
│  │                                                       │    │
│  │  ROCm · vLLM (vllm-openai-rocm)                        │    │
│  └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## AMD Infrastructure Touchpoints

### 1. AI Agent Inference on MI300X (implemented)

**What it does:** The SMC analyst agents — the free-form Q&A endpoint
(`/api/agents/ask`), the 4-stage analysis pipeline (`/api/agents/pipeline`),
and the MCP tool-calling agent (`/api/agents/ask-mcp`) — route their LLM
calls to a self-hosted vLLM instance running Gemma 4 26B (A4B) on the
MI300X. This replaces per-token Fireworks API spend with local inference.

**AMD hardware used:** 1× AMD Instinct™ MI300X (192 GB HBM3), ROCm,
`vllm/vllm-openai-rocm`.

**Model:** `google/gemma-4-26B-A4B-it`, launched with
`--tool-call-parser gemma4 --reasoning-parser gemma4 --enable-auto-tool-choice`
so Gemma's native function-calling drives the MCP agent's tool selection.

**Why MI300X:** Gemma 4 26B is a Mixture-of-Experts model; the 192 GB HBM3
gives ample headroom for weights + KV cache at high `--gpu-memory-utilization`,
and lets a single card serve the model without tensor-parallel sharding.

**Relevant files (all exist):**
- `artifacts/api-server/src/lib/llm/provider.ts` — multi-provider abstraction; `amd` case points at `http://vllm:8000/v1`
- `artifacts/api-server/src/routes/agents.ts` — `/agents/ask` + `/agents/pipeline` call the resolved provider
- `artifacts/api-server/src/routes/agents-mcp.ts` — MCP tool-calling agent via the same provider
- `deploy/amd-developer-cloud/docker-compose.yml` — `vllm` service with ROCm device passthrough, Gemma 4 parsers, weight caching

### 2. Real-Time SMC Engine (no GPU required — runs on the API host)

The deterministic SMC engine (`artifacts/api-server/src/lib/smc/*`) and the
real-time pipeline (Binance WebSocket → candle store → analysis bridge → SSE)
run on the API server's CPU. They are the grounding layer the agents reason
over — the GPU is used only for the LLM inference above, not for the engine.
This separation keeps GPU utilization tied to actual agent queries.

### 3. Vision-Language Chart Analysis (PLANNED — NOT YET IMPLEMENTED)

> **Not built.** No `lib/ml/` directory, no `/api/vision/analyze` route, no
> `analyze_chart_image` MCP tool, and no chart-screenshot pipeline exist in
> the codebase today. This section documents the *scoped future work* for a
> multimodal Track-3 extension; it is not part of the current submission.

**What it would do:** A user clicks "AI Vision" on a chart → ChartView
renders a high-res candlestick screenshot → base64-encoded → sent to a
vision-language model (e.g. Qwen2.5-VL) on the MI300X → returns structured
SMC analysis, which is compared against the deterministic engine for
consensus.

**Why MI300X would matter here:** The 192 GB HBM3 could hold a vision model
(~14 GB BF16) concurrently with the agent model, processing full-resolution
chart screenshots without tiling, and leave headroom for both workloads at
once.

**What would need to be built:** a `lib/ml/vllm-client.ts`, a
`lib/ml/chart-vision.ts` screenshot pipeline, an `analyze_chart_image` MCP
tool, a `POST /api/vision/analyze` route, a ChartView screenshot capture
path, and an export/training-data script. None of these exist yet.

## ROCm / vLLM deployment (configured)

The canonical deployment is Docker Compose (`deploy/amd-developer-cloud/`),
not the bare `docker run` below — but the flags are equivalent and useful
for understanding what the compose file sets up:

```bash
# Equivalent to the `vllm` service in deploy/amd-developer-cloud/docker-compose.yml
docker run --rm -d \
    --device=/dev/kfd --device=/dev/dri \
    --group-add video --cap-add=SYS_PTRACE --ipc=host \
    --security-opt seccomp=unconfined \
    -e HSA_OVERRIDE_GFX_VERSION=9.4.2 \
    -v vllm-cache:/root/.cache/vllm \
    -v hf-cache:/root/.cache/huggingface \
    -p 8000:8000 \
    vllm/vllm-openai-rocm:latest \
    --model google/gemma-4-26B-A4B-it \
    --host 0.0.0.0 --port 8000 \
    --max-model-len 8192 \
    --gpu-memory-utilization 0.92 \
    --dtype auto \
    --tool-call-parser gemma4 --reasoning-parser gemma4 \
    --enable-auto-tool-choice --trust-remote-code --enforce-eager
```

Notes:
- `--enforce-eager` is used for ROCm compatibility (no CUDA graphs).
- `--trust-remote-code` is required because Gemma 4 ships custom modeling
  code; this is a supply-chain consideration documented in the compose file.
- `vllm-cache` + `hf-cache` volumes persist the Gemma 4 weights across
  restarts so the model does not re-download (~30 s cold-start avoided).

## Model Memory Budget (Single MI300X — 192 GB HBM3)

| Model | Precision | VRAM (approx) | Use Case | Status |
|---|---|---|---|---|
| `google/gemma-4-26B-A4B-it` | auto/BF16 | headroom well within 192 GB | AI agent pipeline + Q&A | **Configured** |
| Vision-language model (e.g. Qwen2.5-VL-7B) | BF16 | ~14 GB | Chart screenshot → SMC analysis | **Planned, not built** |

## Comparison: Fireworks vs. AMD self-hosted

| Dimension | Fireworks (fallback) | AMD Developer Cloud (default, `LLM_PROVIDER=amd`) |
|---|---|---|
| **Inference provider** | Hosted API | Self-hosted vLLM on MI300X |
| **Cost** | Pay-per-token | AMD credits (included) — no per-token bill |
| **Model control** | Fixed catalog | Full control; any OpenAI-compatible model |
| **Tool-calling** | Provider-dependent | Gemma 4 native tool-calling via vLLM parsers |
| **Multimodal / vision** | N/A today | Scoped (see §3, not yet built) |
| **Latency** | Network round-trip | Same-region cloud VM |
| **Switching** | One env var (`LLM_PROVIDER`) | Same abstraction, same code path |

The `FIREWORKS_API_KEY` is still threaded through the compose file as an
opt-in fallback (`LLM_PROVIDER=fireworks`) for testing without GPU access;
the default path is local inference on the MI300X.
