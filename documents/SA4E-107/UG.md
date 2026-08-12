# User Guide — SA4E-107: LLM Enrichment cho Source Code Index

## Overview

LLM Enrichment automatically generates summaries, pseudo code, and semantic tags for indexed code symbols using a local or remote LLM. This runs asynchronously after indexing and does not block the indexing pipeline.

---

## Quick Start

1. **Index your project** — enrichment tasks are created automatically after indexing completes
2. **Ensure LLM is available** — default: local Ollama at `http://localhost:11434`
3. **TaskWorker processes enrichment** — tasks are picked up in the background
4. **Query enriched data** — use `code_search_by_tag` or `code_enrichment_stats` MCP tools

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `ollama` | LLM provider (ollama, openai, anthropic, gemini, lmstudio) |
| `LLM_MODEL` | `qwen2.5:7b-instruct-q4_K_M` | Model name |
| `LLM_BASE_URL` | `http://localhost:11434` | LLM API base URL |
| `LLM_API_KEY` | _(none)_ | API key (required for cloud providers) |

### TaskWorker Configuration

The TaskWorker polling behavior can be adjusted at runtime via the Admin UI:
- **concurrency**: 1–8 (how many tasks process in parallel)
- **baseInterval**: polling interval in ms (default: 2000)
- **maxInterval**: max backoff interval when idle

---

## How It Works

### Enrichment Pipeline

1. **Indexing** — Tree-sitter or regex parser indexes files → symbols stored in DB
2. **Task Creation** — After indexing, `CodeEnrichmentTaskCreator` creates `CODE_ENRICHMENT` tasks for eligible symbols (classes, functions, methods, interfaces, enums)
3. **TaskWorker** — Background worker picks up tasks and calls `CodeEnrichmentHandler`
4. **LLM Call** — Handler builds a prompt based on symbol kind, sends to LLM (30s timeout)
5. **Storage** — Results (summary, pseudo_code, llm_tags) stored in `symbols` table

### Strategy Selection

| Symbol Kind | Strategy | Fields Populated |
|-------------|----------|------------------|
| class, interface, enum | CLASS_SUMMARY | summary + tags |
| function, method, arrow_function, generator | FUNCTION_SUMMARY | summary + pseudo_code + tags |
| pega_activity, pega_data_transform, pega_flow | PEGA_SUMMARY | summary only |

### Tag Categories

Tags follow format `category:value`. Valid categories:

| Category | Examples |
|----------|----------|
| `design-pattern` | design-pattern:factory, design-pattern:observer |
| `responsibility` | responsibility:data-access, responsibility:validation |
| `domain` | domain:authentication, domain:payment |
| `complexity` | complexity:high, complexity:low |
| `dependency` | dependency:database, dependency:http-client |

---

## MCP Tools

### code_search_by_tag

Search symbols by LLM-enriched semantic tags.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tag` | string | Yes | Full tag (`design-pattern:factory`) or category prefix (`design-pattern`) |
| `limit` | number | No | Max results (default 20) |

**Example:**
```
code_search_by_tag(tag: "design-pattern:strategy", limit: 10)
```

### code_enrichment_stats

Get enrichment progress statistics.

**Parameters:** None required (uses injected projectId).

**Example output:**
```
📊 Code Enrichment Stats
  Total symbols: 1234
  Completed: 890 (72%)
  Pending: 200
  Failed: 44
  Not started: 100
```

---

## Troubleshooting

### Enrichment not starting

1. Check LLM availability: verify Ollama is running (`ollama list`)
2. Check TaskWorker is running: look for `TaskWorker started` in logs
3. Verify tasks exist: check `pending_tasks` table for `CODE_ENRICHMENT` entries

### All tasks FAILED

1. Check LLM connectivity — most common cause is LLM timeout (30s limit)
2. Check logs for `llm_timeout` errors
3. Use a faster/smaller model if timeouts persist
4. Retry failed tasks: TaskWorker retries up to 3 times with exponential backoff (5s, 15s, 45s)

### Tags not appearing

1. Verify enrichment completed: `code_enrichment_stats` shows completed count
2. Tags are validated — invalid categories are discarded silently
3. Check `llm_tags` column in symbols table for raw JSON

---

## Error Codes

| Error | Cause | Resolution |
|-------|-------|------------|
| `llm_timeout` | LLM call exceeded 30s | Use faster model or reduce body text size |
| `invalid_payload` | Corrupted task payload | Delete failed task, re-index file |
| `symbol_not_found` | Symbol was deleted after task creation | Safe to ignore, task will be marked FAILED |

---

## Administration

### Re-enrichment

To re-enrich symbols (e.g., after model upgrade):
1. Set `enrichment_status = NULL` on target symbols
2. Re-run indexing or manually trigger task creation
3. TaskWorker will pick up new tasks automatically

### Monitoring

- Use `code_enrichment_stats` tool for progress
- Check `pending_tasks` table: `SELECT status, COUNT(*) FROM pending_tasks WHERE task_type='CODE_ENRICHMENT' GROUP BY status`
- Pino logs: look for `[enrichment]` prefix

---

## Document Information

| Field | Value |
|-------|-------|
| Ticket | SA4E-107 |
| Version | 1.0 |
| Author | DEV Agent |
| Date | 2025-07-27 |
