# User Guide — SA4E-106: LLM Enrichment for Source Code Symbols

## Overview

LLM Enrichment automatically generates AI-powered metadata (summary, pseudo code, semantic tags) for indexed code symbols. This guide covers the fixes and features introduced in SA4E-106.

---

## What's New in SA4E-106

| Feature | Description |
|---------|-------------|
| Non-retryable error handling | `invalid_payload` and `symbol_not_found` errors are now immediately marked FAILED instead of retried |
| Cross-scope enrichment copy | When a file is already enriched in another project, enrichment data is copied instead of left empty |
| Enrichment Progress UI | New Svelte component shows real-time enrichment progress |

---

## Non-Retryable Errors (OI-02 Fix)

### Problem Solved

Previously, CODE_ENRICHMENT tasks that failed with `invalid_payload` or `symbol_not_found` were retried up to 3 times despite being permanent failures, wasting LLM resources.

### Behavior After Fix

| Error Pattern | Retryable | Behavior |
|---------------|-----------|----------|
| `invalid_payload: ...` | No | Marked FAILED immediately |
| `symbol_not_found: ...` | No | Marked FAILED immediately |
| `invalid_json` | No | Marked FAILED immediately |
| `entry_not_found` | No | Marked FAILED immediately |
| `llm_timeout` | Yes | Retried up to 3 times |
| Other errors | Yes | Retried up to 3 times |

### Monitoring

Use the `code_enrichment_stats` MCP tool to check how many tasks are failed:

```
code_enrichment_stats
```

---

## Cross-Scope Enrichment Copy (OI-05 Fix)

### Problem Solved

When the same file (identified by content hash) exists in multiple projects, the system previously skipped LLM enrichment for duplicates but left the symbols in the new project without enrichment data.

### Behavior After Fix

1. System detects file already enriched in another project (content_hash match)
2. Instead of skipping, copies `summary`, `pseudo_code`, and `llm_tags` from the enriched scope
3. Uses `COALESCE` for `pseudo_code` to preserve existing PegaLogicNormalizer output
4. No new LLM API calls are made (saves cost and time)

### Important Notes

- Only AI-generated metadata is copied (never source code)
- Matching is by file `content_hash` + symbol `name` + `kind`
- Existing `pseudo_code` from Pega normalization is never overwritten

---

## Enrichment Progress UI

### Location

The `EnrichmentProgress` component is available in the Admin UI area of the VS Code extension.

### Features

- Polls `/api/admin/taskworker/progress` every 5 seconds
- Displays: `Enriching symbols: {completed}/{total} ({percent}%)`
- Shows failed count with warning indicator if > 0
- Auto-hides when no enrichment tasks exist
- WCAG 2.1 AA compliant

### Integration

Import from the components barrel:

```typescript
import { EnrichmentProgress } from './components';
```

Add to your Svelte layout:

```svelte
<EnrichmentProgress />
```

---

## Troubleshooting

| Symptom | Cause | Resolution |
|---------|-------|------------|
| Many tasks stuck in FAILED | `invalid_payload` errors from malformed tasks | Check `code_enrichment_stats` — these are now correctly non-retryable |
| Symbols show null summary in new project | Cross-scope copy may have found no match | Verify file `content_hash` matches between projects |
| Progress bar not showing | No active enrichment tasks | This is expected behavior — component auto-hides |
| Progress bar stuck | LLM provider may be down | Check TaskWorker logs for timeout errors |

---

## Configuration

No new configuration required. The enrichment pipeline uses existing settings:

| Setting | Default | Description |
|---------|---------|-------------|
| Task max retries | 3 | Maximum retry attempts for transient errors |
| Poll interval | 5s | TaskWorker polling frequency |
| Progress poll | 5s | UI component polling frequency |

---

## API Reference

### GET /api/admin/taskworker/progress

Returns current enrichment progress.

**Response:**

```json
{
  "phase": "CODE_ENRICHMENT",
  "file": "symbol-123",
  "current": 50,
  "total": 100,
  "percent": 50
}
```

Returns `null` when no tasks are being processed.
