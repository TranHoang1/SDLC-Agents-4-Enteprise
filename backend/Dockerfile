# SA4E-44 Backend Dockerfile
# Node.js 20 + Hono backend for Code Intelligence MCP Server
# Uses node:20-slim (Debian/glibc) — onnxruntime-node requires glibc, not musl (Alpine)
FROM node:20-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ git && rm -rf /var/lib/apt/lists/*

# --- Dependencies stage ---
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- Build stage ---
FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/
RUN npm run build

# Pre-download embedding model into image so it works offline
ENV TRANSFORMERS_CACHE=/app/.hf-cache
RUN node scripts/preload-models.mjs

# --- Production stage ---
FROM node:20-slim AS production

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends git wget && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY --from=build /app/.hf-cache /app/.hf-cache

# Create non-root user
RUN groupadd -g 1001 sa4e && \
    useradd -u 1001 -g sa4e -m -s /bin/bash sa4e && \
    mkdir -p /app/.code-intel && \
    chown -R sa4e:sa4e /app

USER sa4e

ENV NODE_ENV=production
ENV PORT=48721
ENV TRANSFORMERS_CACHE=/app/.hf-cache

EXPOSE 48721

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:48721/health || exit 1

CMD ["node", "dist/index.js"]
