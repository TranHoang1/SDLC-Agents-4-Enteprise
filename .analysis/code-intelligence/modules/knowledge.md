# KnowledgeModule

**Location**: `backend/src/knowledge/`

## Overview
Backend-driven Knowledge Service (SA4E-85 Phase 0.1–0.3) — the authoritative storage for Threads, Messages, Checkpoints, Tool Executions, Artifacts, Events (append-only), and Agents. Owns its own SQLite database (`<workspace>/.code-intel/knowledge.db`) and exposes REST API at `/api/v1/threads*` and `/api/v1/agents`.

## Key Files

| File | Purpose |
|------|---------|
| `KnowledgeModule.ts` | IModule wrapper registered in ModuleFactory; exposes `getService()` |
| `KnowledgeService.ts` | Business logic: thread CRUD, checkpoint roundtrip, event sourcing, workspace binding |
| `KnowledgeDb.ts` | SQLite persistence layer (better-sqlite3), WAL + FK on, 0600 perms |
| `schema.ts` | SQLite DDL: threads, messages, checkpoints, tool_executions, artifacts, events, agents |
| `models.ts` | Entity models + `UUID_V4_REGEX` + `isUuidV4` validator |
| `routes.ts` | Hono route factory with security middleware (jwtAuth, localhostOnly, rateLimiter, 10MB bodyLimit) |

## Interfaces & Types (models.ts)

| Type | Description |
|------|-------------|
| `Thread` | Thread projection: thread_id (UUID v4), workspace_id, title, agent_id, status, timestamps |
| `Message` | Message projection: id, thread_id, role, content, agent_id, timestamp, seq |
| `Checkpoint` | Checkpoint projection: checkpoint JSON, metadata, channel_versions, pending_writes, version |
| `SaveCheckpointInput` | PUT checkpoint payload: checkpoint, metadata, writes/pendingWrites, newVersions |
| `ToolExecution` | Tool run record: tool_id, name, status, input, output |
| `Artifact` | Artifact record: type, name, content (JSON) |
| `KnowledgeEvent` | Append-only event: type, payload, created_at |
| `Agent` | Agent registry entry: agent_id, name, description, tools, mcp_servers, auto_approve |

## Security Enforcement (SECURITY-REVIEW v3.1)

- **Finding #18 (workspace binding)**: every GET/PUT verifies `thread.workspace_id === caller workspaceId`; mismatch/invalid UUID returns **404 THREAD_NOT_FOUND** (never 403). Workspace resolution order: `X-Project-Id` header → JWT `wid` claim → default workspace.
- **Finding #19 (auth/localhost)**: `localhostOnly` + `jwtAuth` middleware on all `/api/v1/threads*` routes; checkpoint bodies never logged (only thread_id/version at INFO).
- **Finding #23 (rate limit + body cap)**: `rateLimiter` middleware; checkpoint PUT wrapped in `bodyLimit({ maxSize: 10MB })` → 413 `PAYLOAD_TOO_LARGE`.

## Key Methods

### KnowledgeService
- `createThread({ title, agent_id?, initialMessage? })` → creates UUID v4 thread + THREAD_CREATED event; returns 201
- `getThread(threadId)`, `listThreads()` (workspace-scoped)
- `saveCheckpoint(threadId, SaveCheckpointInput)` → merge writes into pending_writes, version bump, CHECKPOINT_SAVED event
- `getCheckpoint(threadId)` → full projection (checkpoint, messages, tool_executions, artifacts, events)
- `addToolExecution`, `addArtifact`, `listArtifacts`
- `deleteThread(threadId)` → cascade delete + THREAD_DELETED event
- `upsertAgent(listAgents)` / `listAgents()` — agent registry

### KnowledgeDb
- `createInMemory()` — test helper
- `appendMessage` uses `INSERT OR IGNORE` with `seq` for dedup
- `upsertCheckpoint` — single `INSERT ... ON CONFLICT DO UPDATE`
- `deleteThread` — transactional cascade across 6 tables

### routes.ts
- `createKnowledgeApiRoutes(service, logger, options?)` → Hono sub-app, mounted at `/api/v1`

## Tests

| File | Scope |
|------|-------|
| `__tests__/KnowledgeService.test.ts` (15) | UUID v4, event sourcing, workspace isolation, checkpoint roundtrip, cascade delete, agent registry |
| `__tests__/KnowledgeService.pbt.test.ts` (3) | PBT-HYD-01 fast-check: 500 UUID v4 generations, uniqueness, invalid-ID rejection |
| `__tests__/routes.test.ts` (15) | REST contract 201/400/404/413, IT-HYD-03 roundtrip, rate-limit headers, jwtAuth coherence |

## Patterns Used
- Module pattern (IModule + ModuleRegistry, DI via constructor)
- Route factory pattern (per `kb-api.ts`), mounted via `registry.getModule('knowledge')?.getService()`
- Event sourcing (append-only `events` table)
- Security middleware composition (localhostOnly → jwtAuth → rateLimiter → bodyLimit)
