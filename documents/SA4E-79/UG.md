# User Guide — SA4E-79: On-Demand Client LLM Enrichment for KB Entries

## Document Information

| Field | Value |
|-------|-------|
| Ticket | SA4E-79 |
| Version | 1.0 |
| Date | 2025-07-20 |
| Author | DEV Agent |

---

## 1. Overview

This feature adds automatic client-side enrichment for KB entries that couldn't be processed by the backend LLM. When the backend LLM (Ollama/OpenAI) is unavailable during ingestion, entries are stored in "pending" status. The VS Code extension detects these during searches and enriches them using the client-side LLM (Claude/Kiro) in the background.

**Key benefits:**
- Zero-downtime KB enrichment — entries are always searchable, even without backend LLM
- Transparent fallback — no user action required
- Race-safe — atomic database operations prevent data corruption

---

## 2. Quick Start

No installation required. The feature activates automatically when:
1. The backend memory server is running
2. The VS Code extension is connected
3. A client-side LLM provider is configured

---

## 3. How It Works

### 3.1 Ingestion Flow

When content is ingested via `mem_ingest`:
- **Backend LLM available**: Entry is marked `enrichment_status='done'` and processed by TaskWorker normally
- **Backend LLM unavailable**: Entry is marked `enrichment_status='pending'` and stored without enrichment metadata

### 3.2 Search + Enrichment Flow

When `mem_search` is called:
1. Normal search results are returned immediately
2. Up to 3 pending entries are appended in a `--- Pending Entries (need enrichment) ---` section
3. The extension's `EnrichmentObserver` detects these pending entries
4. In the background (non-blocking), the observer:
   - Sends entry content to the client LLM for metadata extraction
   - Calls `mem_enrich` to update the entry with generated summary, tags, and structured_map
5. Next search will show the entry with full metadata

### 3.3 Race Condition Handling

If both the backend TaskWorker and client extension try to enrich the same entry:
- The first one to succeed wins (atomic `UPDATE WHERE enrichment_status='pending'`)
- The second one receives a harmless "already enriched" response
- No data corruption occurs

---

## 4. Configuration Reference

### 4.1 Backend Configuration

No additional configuration required. The migration runs automatically on server startup.

| Parameter | Default | Description |
|-----------|---------|-------------|
| enrichment_status column default | `'done'` | Existing entries are not affected |
| Pending entries per search | 3 | Max pending entries appended to search results |

### 4.2 Extension Configuration

The `EnrichmentObserver` uses the existing LLM provider configuration. No separate config needed.

| Parameter | Value | Description |
|-----------|-------|-------------|
| LLM timeout | 30s | Max wait time for client LLM response |
| Max batch size | 3 | Max entries enriched per search response |
| Dedup stale timeout | 60s | Auto-release stuck in-flight entries |
| LLM temperature | 0.3 | Low temperature for consistent extraction |
| Max tokens | 1000 | Limit response size from LLM |

---

## 5. API Reference

### 5.1 `mem_enrich` Tool

**Purpose:** Accept client-generated enrichment metadata for a pending KB entry.

**Input:**
```json
{
  "entry_id": 42,
  "summary": "Concise description of entry content",
  "tags": "keyword1,keyword2,keyword3",
  "structured_map": {
    "summary": "1-2 sentence overview",
    "business_entities": ["Entity1", "Entity2"],
    "actors": ["Actor1"],
    "business_rules": ["Rule1"],
    "tags": ["tag1", "tag2"]
  }
}
```

**Success Response:**
```
Entry #42 enriched successfully. Status: done. Enriched by: client_llm.
```

**Error Responses:**

| Condition | Response |
|-----------|----------|
| Invalid entry_id | `Error: Invalid entry_id` |
| Entry not found | `Error: Entry #42 not found` |
| Already enriched | `Error: Entry #42 already enriched (status=done)` |
| Empty summary | `Error: Invalid metadata - summary required` |
| Summary > 500 chars | `Error: Invalid metadata - summary too long (max 500)` |
| Tags > 500 chars | `Error: Invalid metadata - tags too long (max 500)` |
| structured_map > 100KB | `Error: Invalid metadata - structured_map too large (max 100KB)` |
| Unknown keys in structured_map | `Error: Invalid metadata - structured_map has unknown key: X` |
| No project scope | `Error: Project scope required for enrichment` |
| Scope violation | `Error: Entry #42 not accessible in current scope` |

### 5.2 Modified `mem_search` Response

Search results now include a pending section when unenriched entries exist:

```
Found 3 results:

[CONTEXT] Memory module configuration guide
  ID: 10 | Tier: SHARED | Scope: PROJECT | Score: 0.892

--- Pending Entries (need enrichment) ---

[PENDING #1] ID: 42 | Source: agent-output/SA4E-79
  Content: Raw content preview (first 300 chars)...
```

---

## 6. Administration

### 6.1 Database Migration

Migration `007_enrichment_status` adds three columns to `knowledge_entries`:
- `enrichment_status TEXT NOT NULL DEFAULT 'done'`
- `enriched_by TEXT DEFAULT NULL`
- `enriched_at TEXT DEFAULT NULL`

Plus a partial index `idx_ke_enrichment_pending` for efficient pending queries.

**Backward compatibility:** All existing entries default to `'done'` — no disruption.

### 6.2 Monitoring Enrichment Status

Query pending entries directly:
```sql
SELECT COUNT(*) FROM knowledge_entries WHERE enrichment_status = 'pending';
```

Check enrichment sources:
```sql
SELECT enriched_by, COUNT(*) as count
FROM knowledge_entries
WHERE enriched_by IS NOT NULL
GROUP BY enriched_by;
```

---

## 7. Troubleshooting

### 7.1 Entries Stay Pending Indefinitely

**Cause:** Both backend LLM and client LLM are unavailable.

**Resolution:**
1. Check backend LLM health (Ollama/OpenAI connectivity)
2. Verify extension has an active LLM provider configured
3. Pending entries will be enriched automatically once either LLM becomes available

### 7.2 Enrichment Observer Not Triggering

**Cause:** Extension LLM provider not configured or not reachable.

**Resolution:**
1. Verify the LLM provider is configured in extension settings
2. Check extension output channel for `[EnrichmentObserver]` warnings
3. If 3+ consecutive failures are logged, check LLM provider connectivity

### 7.3 "Project scope required" Error

**Cause:** The `mem_enrich` call was made without a project context.

**Resolution:** Ensure the MCP client sends the `X-Project-Id` header with requests.

---

## 8. Error Codes

| Error Code | HTTP Equivalent | Description | Resolution |
|-----------|----------------|-------------|------------|
| Invalid entry_id | 400 | entry_id missing or <= 0 | Provide valid positive integer |
| Entry not found | 404 | No entry with given ID | Verify entry exists |
| Already enriched | 409 | Entry already has status=done | No action needed (idempotent) |
| Invalid metadata | 400 | Validation failure on inputs | Check field constraints |
| Project scope required | 403 | Missing project context | Include X-Project-Id header |
| Not accessible in scope | 403 | Entry belongs to different project | Cannot enrich cross-project entries |

---

## 9. FAQ

**Q: Does this feature affect search performance?**
A: Minimal impact. The pending query uses a partial index (only indexes pending rows) and is capped at 3 results.

**Q: What happens if the client LLM produces bad output?**
A: The output is validated (JSON parse + schema check). Invalid responses are silently discarded. The entry stays pending for the next attempt.

**Q: Can I manually trigger enrichment?**
A: Yes, call `mem_enrich` directly with the entry_id and metadata. This is useful for testing or manual override.

**Q: Will existing entries be affected?**
A: No. The migration defaults all existing entries to `enrichment_status='done'`. Only new entries ingested while the backend LLM is unavailable will be marked as pending.

**Q: How do I know which LLM enriched an entry?**
A: Check the `enriched_by` column: `'client_llm'` for extension-side or `'backend_llm'` for TaskWorker-side enrichment.
