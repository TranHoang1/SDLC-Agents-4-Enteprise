# SA4E Backend — application build
# Requires base image built from Dockerfile.base.
#
# Build:
#   docker build --build-arg BASE_IMAGE=sa4e-base:latest -t sa4e:latest .
#
# Or let docker-compose handle it via the `base` service dependency.

ARG BASE_IMAGE=sa4e-base:latest

# --- Build base: Node + native-module toolchain ---
FROM node:20-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# --- Dependencies stage: production node_modules only ---
FROM builder AS deps
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# --- Build stage: compile TypeScript + preload embedding models ---
FROM builder AS build
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY tsconfig.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/
RUN npm run build

ENV TRANSFORMERS_CACHE=/app/.hf-cache
RUN node scripts/preload-models.mjs || echo "preload-models skipped. Models will load at runtime."

# --- Production stage: base image + compiled artifacts ---
FROM ${BASE_IMAGE} AS production

USER root
COPY --chown=sa4e:sa4e --from=deps  /app/node_modules  ./node_modules
COPY --chown=sa4e:sa4e --from=build /app/dist          ./dist
COPY --chown=sa4e:sa4e --from=build /app/package.json  ./
COPY --chown=sa4e:sa4e --from=build /app/.hf-cache     ./.hf-cache
USER sa4e

ENV NODE_ENV=production
ENV PORT=48721

EXPOSE 48721

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:48721/health || exit 1

CMD ["node", "dist/index.js"]
