# Extension Knowledge Client & RemoteCheckpointer

**Location**: `extension/src/` (`knowledge-client.ts`, `langgraph/core/remote-checkpointer.ts`, `langgraph/core/checkpointer-helpers.ts`)

## Overview
SA4E-85 Phase 0.4–0.7 extension integration: the VS Code extension talks to the
Backend Knowledge Service over HTTP instead of local JSON state files.
The legacy `WorkspaceCheckpointer` (`.vscode/kiro-pipeline-state/`) was removed
(TDD Phase 0.5) — Backend KB is the single source of truth.

## Key Files

| File | Purpose |
|------|---------|
| `knowledge-client.ts` | REST client for `/api/v1/threads*` + `resolveKbBaseUrl()` + UUID v4 contract |
| `langgraph/core/remote-checkpointer.ts` | `BaseCheckpointSaver` over HTTP (getTuple/put/putWrites/list/deleteThread/listPersistedPipelines) |
| `langgraph/core/checkpointer-helpers.ts` | `sanitizeMetadata` only (fs helpers removed) |
| `utils/http-client-utils.ts` | `httpPostJson`/`httpGetJson`/`httpPutJson`/`httpDeleteJson` via node http |

## KnowledgeClient (`knowledge-client.ts`)

- Methods: `listThreads()`, `createThread(input)`, `getMessages(threadId)`,
  `getCheckpoint(threadId)`, `saveCheckpoint(threadId, input)`, `deleteThread(threadId)`
- `resolveKbBaseUrl()`: `kiroSdlc.backend.url` config → `CODE_INTEL_PORT` env → default `http://127.0.0.1:48721`
- `getHeaders()` option: workspace-bound (`X-Project-Id`) + optional Bearer JWT (Finding #19)
- Resilience: configurable `timeoutMs` + `retries` with backoff; network/timeout errors
  wrap into recoverable `KbUnreachableError`
- Models mirror backend `knowledge/models.ts` (Thread/Message/Checkpoint/PendingWrite)
- `isUuidV4` / `parseThreadJson` / `validateThreadJson` — PBT-HYD-01 contract

## RemoteCheckpointer (`remote-checkpointer.ts`)

- Implements the same `BaseCheckpointSaver` contract the engine consumed before,
  so `LangGraphEngine`, `buildSdlcSubgraph`, `buildRouterGraph` are unchanged (BR-30/31)
- `put()` persists `{ checkpoint, metadata, newVersions, messages }`; `extractMessages()`
  projects `chatHistory` channel → `messages` for hydration
- `putWrites()` merges pending writes; `list()` iterates `GET /threads`;
  `deleteThread()` → `DELETE /threads/:id`; `cleanup()` is a no-op (backend owns retention)
- `listPersistedPipelines()` → KB query, sorted by `lastUpdatedAt` desc

## Stateless SessionManager (`chat/engine/SessionManager.ts`, v3.1)

- `ensureSession()` resolves the most recent `active` thread from Backend KB
  (reuse) or `POST /api/v1/threads` (create). No local `session.json`.
- `getSessionMessages()` → `SYNC_CHAT_HISTORY` payload for webview hydration.

## Hydration Protocol (v3.1)

- Webview `ChatPanel.svelte` `onMount` → `REQUEST_SYNC_STATE` (new WebviewMessage type)
- `ChatEngineAdapter.handleRequestSyncState()` → SessionManager → `SYNC_CHAT_HISTORY`
  (new ExtensionMessage type) → webview `chatStore.hydrateChat(messages, context)`
- `SYNC_CHAT_HISTORY` payload carries `{ threadId, messages, context }` where
  `context: { tokenCount, maxTokens, files: ContextFile[] }` is derived from
  `contextManager.getState()` (TDD §4.1 / STC API-HYD-02, UT-HYD-01 step 6).
  Empty history still hydrates with `messages=[]` (STC API-HYD-02 step 7).
- `chatStore` gains an `isHydrated` flag set on successful hydration (STC UT-HYD-01).
- Backend unreachable → recoverable `STREAM_ERROR(SYNC_STATE_FAILED, retryable=true)`

## Tests

| File | Scope |
|------|-------|
| `langgraph/core/__tests__/knowledge-client.test.ts` | PBT-HYD-01 (fast-check 500 runs) + REST contract vs embedded mock server |
| `langgraph/core/__tests__/remote-checkpointer.test.ts` | IT-HYD-03 write→restart→read over real HTTP |
| `chat/engine/__tests__/SessionManager.test.ts` | UT-HYD-03 thread resolution + unreachable backend |
| `chat/engine/__tests__/hydration.test.ts` | IT-HYD-01 host-side REQUEST_SYNC_STATE → SYNC_CHAT_HISTORY |
| `webview/__tests__/chat-store.test.ts` | UT-HYD-01 hydrateChat |
| `webview/__tests__/request-sync-state.test.ts` | UT-HYD-02 mount trigger |

## Patterns Used
- Adapter / interface segregation (ISessionManager, IStreamProtocolAdapter)
- HTTP client with retry/backoff + recoverable error taxonomy
- Embedded HTTP test server for real HTTP-contract integration tests
- Property-based testing (fast-check) for UUID v4 contract
