# User Guide — SA4E-78: Decoupled Code Intelligence Indexer

## 1. Overview

SA4E-78 decouples the Code Intelligence indexer from the local filesystem. The backend no longer watches files directly — instead, the VS Code Extension (or any HTTP client) pushes file change events via new API endpoints. This enables remote/cloud deployment of the backend.

## 2. Quick Start

No migration is needed. Existing `POST /api/index/source` continues to work unchanged. The new endpoints are additive.

### New Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/index/full` | Trigger async full index |
| POST | `/api/index/file-events` | Push file change events |
| POST | `/api/index/cancel` | Cancel running index |
| GET | `/api/index/progress` | Poll indexing progress |

All endpoints require:
- `Authorization: Bearer {session_token}`
- `X-Project-Id: {projectId}`

## 3. Triggering a Full Index

```http
POST /api/index/full
Authorization: Bearer <token>
X-Project-Id: my-project
X-Workspace-Root: /path/to/workspace   (optional, defaults to boot config)
```

**Response 202 (started):**
```json
{
  "operationId": "idx-a1b2c3d4",
  "projectId": "my-project",
  "status": "started",
  "message": "Full index started"
}
```

**Response 409 (already running):**
```json
{
  "error": "Index already running",
  "operationId": "idx-existing",
  "projectId": "my-project"
}
```

## 4. Pushing File Events

Send file change events when files are created, modified, or deleted:

```http
POST /api/index/file-events
Authorization: Bearer <token>
X-Project-Id: my-project
Content-Type: application/json

{
  "events": [
    { "type": "add", "path": "src/utils/helper.ts", "content": "export function..." },
    { "type": "change", "path": "src/index.ts", "content": "import..." },
    { "type": "delete", "path": "src/old-file.ts" }
  ]
}
```

**Response 200:**
```json
{
  "indexed": 1,
  "updated": 1,
  "removed": 1,
  "skipped": 0,
  "rejected": [],
  "projectId": "my-project"
}
```

### Rules
- Maximum 100 events per request (returns 413 if exceeded)
- Paths are validated via `resolveWithinWorkspace()` — path traversal attempts are rejected
- For `add`/`change`: if `content` is provided, it's written to disk then indexed
- For `delete`: the file record is removed from the index

## 5. Cancelling an Index

```http
POST /api/index/cancel
Authorization: Bearer <token>
X-Project-Id: my-project
```

**Response 200:**
```json
{
  "operationId": "idx-a1b2c3d4",
  "status": "cancelling",
  "message": "Cancellation signal sent"
}
```

**Response 404 (no active operation):**
```json
{ "error": "No active index operation", "projectId": "my-project" }
```

Cancellation is cooperative — the engine finishes the current batch before stopping.

## 6. Polling Progress

```http
GET /api/index/progress
Authorization: Bearer <token>
X-Project-Id: my-project
```

**Response 200 (active):**
```json
{
  "operationId": "idx-a1b2c3d4",
  "phase": "indexing",
  "current": 150,
  "total": 500,
  "percentage": 30,
  "startedAt": "2026-07-30T10:00:00.000Z",
  "elapsedMs": 5000
}
```

**Response 200 (idle):**
```json
{
  "operationId": "",
  "phase": "idle",
  "current": 0,
  "total": 0,
  "percentage": 0,
  "startedAt": "",
  "elapsedMs": 0
}
```

### Progress Phases

| Phase | Meaning |
|-------|---------|
| `idle` | No active operation |
| `scanning` | Discovering files in workspace |
| `indexing` | Parsing and indexing file symbols |
| `resolving` | Resolving cross-file references |
| `complete` | Index finished successfully |
| `cancelled` | Index was cancelled by user |
| `error` | Index failed (check logs) |

## 7. Configuration

No new configuration is required. The indexer uses the existing `AppConfig`:
- `workspace` — target directory for scanning
- `projectId` — tenant isolation key
- `maxFileSize` — skip files larger than this (default 512KB)
- `excludePatterns` — directories to skip (node_modules, .git, etc.)
- `includeExtensions` — file extensions to index

## 8. Migration Notes

### FileWatcher Deprecation

The `FileWatcher` class (chokidar-based) is now deprecated. It is no longer started by the backend. For co-located deployments, the existing behavior is preserved (files can still be pushed via `/api/index/source`). For decoupled deployments, use the Extension's `FileSystemWatcher` to push events to `/api/index/file-events`.

### DependencyResolver Changes

The `DependencyResolver` no longer reads files from disk to compute hashes. It returns `expectedHash: ''` for all dependencies. Hash verification is deferred to when file content is available through the indexer. This is a non-breaking change — consumers already handle empty hashes.

## 9. Error Codes

| HTTP | Error | Cause | Resolution |
|------|-------|-------|------------|
| 400 | `X-Project-Id required` | Missing project header | Add `X-Project-Id` header |
| 401 | `Unauthorized` | Invalid/missing token | Provide valid Bearer token |
| 409 | `Index already running` | Duplicate full index trigger | Wait or cancel first |
| 413 | `Max 100 events per request` | Too many file events | Split into smaller batches |
| 404 | `No active index operation` | Cancel with no running op | No action needed |
| 503 | `Code intelligence not ready` | Module not initialized | Wait for startup |

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Progress stuck at "scanning" | Large workspace, slow disk | Wait or increase `maxFileSize` threshold |
| Cancel doesn't stop immediately | Cooperative — waits for batch | Normal behavior, batch completes first |
| `rejected` paths in file-events | Path traversal attempt | Fix client to send relative paths only |
| 503 on all endpoints | CodeIntel module failed to init | Check server logs for init errors |
