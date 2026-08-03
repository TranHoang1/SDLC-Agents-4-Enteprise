# Project Structure — Backend (backend/src)

## Server Core
- `server/HttpServer.ts` — Hono app factory; mounts module routes at `/api/v1` (incl. knowledge routes via `registry.getModule('knowledge')?.getService()`)
- `server/jwt-auth.ts` — jwtAuth middleware (JWT wid claim → workspaceId)
- `server/rate-limiter.ts` — rateLimiter middleware
- `server/...` — other server infrastructure

## Modules (`modules/`)
| Module | Location | Notes |
|--------|----------|-------|
| `knowledge` | `../knowledge/` (top-level dir) | SA4E-85 Knowledge Service: threads/checkpoints/agents REST API, own SQLite DB |
| `pega/understanding` | `modules/pega/understanding/` | Pega rule understanding orchestrator (see `modules/pega-understanding.md`) |
| `ModuleFactory.ts` | `modules/ModuleFactory.ts` | Registers all modules; `new KnowledgeModule(this.logger)` added for SA4E-85 |

## Knowledge Module (`knowledge/`)
- `KnowledgeModule.ts` — IModule wrapper (service accessor + default dbPath `<workspace>/.code-intel/knowledge.db`)
- `KnowledgeService.ts` — business logic + workspace binding (Finding #18)
- `KnowledgeDb.ts` — better-sqlite3 persistence (WAL, 0600 perms)
- `schema.ts` — DDL (threads, messages, checkpoints, tool_executions, artifacts, events, agents)
- `models.ts` — entity models + isUuidV4
- `routes.ts` — Hono route factory (jwtAuth + localhostOnly + rateLimiter + 10MB bodyLimit)
- `__tests__/` — 3 test files, 33 tests (unit + PBT + route integration)

## Tests (backend/tests)
- `tests/integration/mcp-tools.test.ts` — **5 pre-existing failures** (memory-graph `[graph] Failed to upsert graph node`; unrelated to SA4E-85)

## Extension (extension/src) — SA4E-85 Phase 0.4–0.7
| File | Notes |
|------|-------|
| `knowledge-client.ts` | REST client for Backend `/api/v1/threads*`, `resolveKbBaseUrl()`, UUID v4 contract (see `modules/extension-knowledge.md`) |
| `langgraph/core/remote-checkpointer.ts` | `BaseCheckpointSaver` over HTTP — replaces removed `WorkspaceCheckpointer` |
| `langgraph/core/checkpointer.ts` | **REMOVED** (TDD Phase 0.5) — persistence is backend-driven |
| `chat/engine/SessionManager.ts` | Stateless, resolves thread_id from Backend KB |
| `chat/types/messages.ts` | Added `REQUEST_SYNC_STATE` + `SYNC_CHAT_HISTORY` |
| `webview/components/ChatPanel.svelte` | `onMount` → REQUEST_SYNC_STATE hydration |
