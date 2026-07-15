# syntax=docker/dockerfile:1

# ===================================================================
# Stage 1 — Builder
# Compiles TypeScript, builds native addons, downloads HF model.
# ===================================================================
FROM node:20-bookworm AS builder

# Required for native addons: better-sqlite3 and onnxruntime-node
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# @xenova/transformers v2 reads TRANSFORMERS_CACHE (not HF_HOME) for cache dir
ENV TRANSFORMERS_CACHE=/app/.hf-cache

# Install dependencies first (layer cache reuse on source changes)
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

# Copy source and compile
COPY backend/ .
RUN npm run build

# tsc does not copy non-TS assets; copy WASM grammars and JSON configs
RUN mkdir -p dist/engine/parsers/grammars \
    && cp src/engine/parsers/grammars/*.wasm dist/engine/parsers/grammars/ \
    && cp src/engine/parsers/grammars/*.json dist/engine/parsers/grammars/

# Pre-download Xenova/paraphrase-multilingual-MiniLM-L12-v2.
# The script must run from /app so Node can resolve @xenova/transformers.
COPY docker/preload-model.mjs ./preload-model.mjs
RUN node preload-model.mjs && rm preload-model.mjs

# ===================================================================
# Stage 2 — Production
# Lean runtime image — no build tools, no source files.
# ===================================================================
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    tini ca-certificates curl git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/dist         ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
# Baked-in HF model cache — enables air-gapped / no-internet operation
COPY --from=builder /app/.hf-cache    ./.hf-cache

RUN mkdir -p /data

ENV NODE_ENV=production \
    TRANSFORMERS_CACHE=/app/.hf-cache \
    CODE_INTEL_PORT=48721 \
    CODE_INTEL_HOST=0.0.0.0 \
    CODE_INTEL_DATA_DIR=/data/.code-intel \
    CODE_INTEL_LOG_LEVEL=info \
    LLM_PROVIDER=ollama \
    LLM_BASE_URL=http://ollama:11434 \
    LLM_MODEL=qwen2.5:7b-instruct-q4_K_M

EXPOSE 48721

# /data      — persistent SQLite databases and project state
# /workspace — source code to analyse (mount at runtime, read-only)
VOLUME ["/data", "/workspace"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:48721/health || exit 1

ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/index.js"]
