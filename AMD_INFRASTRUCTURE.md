# How SMC Liquidity Hunter Uses AMD Developer Cloud

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   React Frontend (Vite)                       │
│  Dashboard · ChartView · IntelligenceSheet · Analytics        │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Chart Screenshot → base64 → POST /api/vision/analyze│    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP REST
┌──────────────────────────▼──────────────────────────────────┐
│              Express 5 API Server (Replit Autoscale)          │
│  /api/analysis/*  /api/agents/*  /api/ledger/*               │
│  /api/vision/analyze  ← NEW: chart screenshot → MI300X       │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              vLLM Client (vllm-client.ts)             │    │
│  │  OpenAI-compatible /v1/chat/completions               │    │
│  │  Model: Qwen2.5-VL-7B · Llama 3.1 70B                │    │
│  └──────────────────────┬───────────────────────────────┘    │
└──────────────────────────│───────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────┐
│              AMD Developer Cloud VM                           │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  AMD Instinct™ MI300X (192 GB HBM3)                   │    │
│  │                                                       │    │
│  │  ┌─────────────────────────────────────┐              │    │
│  │  │  vLLM Server (port 8000)            │              │    │
│  │  │  ┌─────────────────────────────┐    │              │    │
│  │  │  │  Qwen2.5-VL-7B-Instruct     │    │ ← Vision     │
│  │  │  │  (Chart screenshot → SMC)   │    │   Model      │
│  │  │  └─────────────────────────────┘    │              │    │
│  │  │  ┌─────────────────────────────┐    │              │    │
│  │  │  │  Llama 3.1 70B / Qwen 3.5   │    │ ← Agent      │    │
│  │  │  │  (Trade analysis + Q&A)     │    │   Model      │    │
│  │  │  └─────────────────────────────┘    │              │    │
│  │  └─────────────────────────────────────┘              │    │
│  │                                                       │    │
│  │  ROCm 7.2 · PyTorch · HuggingFace Optimum-AMD          │    │
│  └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Three AMD Infrastructure Touchpoints

### 1. Vision-Language Chart Analysis (Primary — Track 3)

**What it does**: User clicks "AI Vision" on any chart → ChartView renders a high-res candlestick screenshot → base64-encoded → sent to Qwen2.5-VL-7B running on AMD MI300X → returns structured SMC analysis.

**AMD hardware used**: 1× AMD Instinct™ MI300X (192 GB HBM3)

**Model**: Qwen2.5-VL-7B-Instruct via vLLM on ROCm 7.2

**Why MI300X**: The 192 GB HBM3 allows the vision model to process full-resolution chart screenshots (candlesticks + SMC overlays at 4K) without tiling or downscaling. Qwen2.5-VL-7B uses ~14 GB VRAM in BF16, leaving 178 GB headroom for concurrent workloads.

**MCP tool**: `analyze_chart_image` — registered alongside the 11 existing SMC analysis tools
- Input: base64 PNG + user question (e.g., "Where is the nearest bearish OB?")
- Output: structured JSON with detected patterns, price levels, confidence scores
- Processing: `POST /api/vision/analyze` → Express → vLLM on MI300X → response

**Relevant files**:
- `artifacts/api-server/src/lib/ml/vllm-client.ts` — vLLM OpenAI-compatible client
- `artifacts/api-server/src/lib/ml/chart-vision.ts` — Screenshot → vision model pipeline
- `artifacts/api-server/src/lib/mcp/tools/chart-vision.ts` — MCP tool registration

### 2. AI Agent Inference (Secondary — Track 1/2 spillover)

**What it does**: The existing 4-agent pipeline (Structure → Liquidity → FVG → Confluence) + free-form Q&A currently runs on Fireworks AI. On AMD Cloud, it runs on Llama 3.1 70B or Qwen 3.5 35B via the same vLLM instance.

**AMD hardware used**: Same MI300X — models share the GPU sequentially. vLLM unloads the vision model and loads the agent model on demand (~5s warm-up).

**Why MI300X**: The 192 GB HBM3 enables model swapping without sharding. Llama 3.1 70B in BF16 uses ~140 GB, fitting comfortably on a single card. The same model on an 80 GB H100 would require 2 GPUs with tensor parallelism.

**Relevant files**:
- `artifacts/api-server/src/routes/agents.ts` — Swapped to call vLLM instead of Fireworks
- `artifacts/api-server/src/routes/agents-mcp.ts` — MCP tool-calling agent via vLLM

### 3. Backtest Signal Dataset (Training Data)

**What it does**: The 254 backtest signals stored in PostgreSQL (with full analysis_context jsonb) are exported as a training dataset for potential LoRA fine-tuning of the vision model on SMC-specific chart patterns.

**AMD hardware used**: MI300X (inference) + ROCm PyTorch (training)

**Why MI300X**: Fine-tuning Qwen2.5-VL-7B with LoRA on a single MI300X takes ~1 hour for 254 samples — the 192 GB HBM3 handles the full model + optimizer states without gradient checkpointing.

**Relevant files**:
- `artifacts/api-server/src/scripts/export-training-data.ts` — PostgreSQL → JSONL
- `artifacts/api-server/src/lib/ml/fine-tune/train.py` — LoRA fine-tuning script

## ROCm Environment

```bash
# AMD Developer Cloud VM setup (run once)
docker pull rocm/vllm-dev:nightly_main_20260506

# Launch vLLM with both vision and language models
docker run --rm -d \
    --device=/dev/kfd --device=/dev/dri \
    --group-add video --cap-add=SYS_PTRACE \
    --name vllm-server \
    -p 8000:8000 \
    -v $HOME/models:/models \
    rocm/vllm-dev:nightly_main_20260506 \
    vllm serve Qwen/Qwen2.5-VL-7B-Instruct \
        --host 0.0.0.0 --port 8000 \
        --dtype float16 --max-model-len 4096 \
        --gpu-memory-utilization 0.85

# ROCm performance flags (set inside container):
# PYTORCH_HIP_ALLOC_CONF=expandable_segments:True
# TORCH_BLAS_PREFER_HIPBLASLT=1
# MIOPEN_FIND_MODE=FAST
# GPU_MAX_HW_QUEUES=2
# HIP_FORCE_DEV_KERNARG=1
# HSA_ENABLE_SDMA=0
```

## Infrastructure Flow

```
1. User opens ChartView (BTCUSDT 1h)
2. Clicks "AI Vision Analyze"
3. ChartView.toDataURL() → base64 PNG (candlesticks + FVG rectangles + OB boxes + session bands)
4. POST /api/vision/analyze { image: "data:image/png;base64,...", question: "Find the nearest bearish OB and FVG" }
5. Express → vllmClient.chat({
     model: "Qwen2.5-VL-7B-Instruct",
     messages: [{
       role: "user",
       content: [
         { type: "image_url", image_url: { url: "data:image/png;base64,..." } },
         { type: "text", text: "Find the nearest bearish OB and FVG on this BTCUSDT 1h chart..." }
       ]
     }]
   })
6. vLLM on MI300X processes image through Qwen2.5-VL vision encoder
7. Returns: { ob: { type: "bearish", proximal: 63200, distal: 62800 }, fvg: { top: 63150, bottom: 62850 } }
8. Compare vision model output with deterministic SMC engine
9. Consensus signal → UnifiedTradeSignal → Trade Ledger
```

## Model Memory Budget (Single MI300X — 192 GB HBM3)

| Model | Precision | VRAM | Use Case |
|---|---|---|---|
| Qwen2.5-VL-7B-Instruct | BF16 | ~14 GB | Chart screenshot → SMC analysis |
| Llama 3.1 70B | BF16 | ~140 GB | AI agent pipeline (4 agents sequential) |
| Qwen 3.5 35B | BF16 | ~70 GB | Lighter agent model (faster, fits with vision model) |
| vLLM overhead | — | ~8 GB | KV cache, scheduler |

**Recommended config**: Run Qwen2.5-VL-7B (14 GB) + Qwen 3.5 35B (70 GB) concurrently = ~92 GB total, well within 192 GB. No model swapping needed — both models available simultaneously for seamless chart vision + agent Q&A.

## Comparison: Before vs After AMD

| Dimension | Before (Fireworks AI) | After (AMD Developer Cloud) |
|---|---|---|
| **Inference provider** | Fireworks hosted API | Self-hosted vLLM on MI300X |
| **Vision capability** | None (text-only agents) | Chart screenshot → structured SMC |
| **Model control** | Fixed models, no fine-tuning | Full control, LoRA fine-tuning possible |
| **Latency** | ~2-5s (network round-trip) | ~0.5-1s (same-region cloud VM) |
| **Cost** | Pay-per-token | $100 AMD credits (included) |
| **Model size limit** | Provider-defined | Up to 192 GB — any open-source model |
| **Multimodal** | Not available | Qwen2.5-VL, Llama 3.2 Vision |
| **ROCm optimization** | N/A | ParaAttention FBCache (2× speedup), hipBLASLt, torch.compile |
