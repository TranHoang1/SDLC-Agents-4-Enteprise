# SA4E-162 — Database Schema Review & Refactor Plan

## 1. Current Schema (ERD)

```
┌─────────────────────────────────────────────┐
│ knowledge_entries                            │
├─────────────────────────────────────────────┤
│ PK  id              SERIAL                  │
│     content         TEXT NOT NULL            │
│     summary         TEXT NOT NULL            │
│     type            TEXT (PEGA_RULE, etc.)   │
│     tier            TEXT (WORKING/SEMANTIC)  │
│     scope           TEXT (USER/PROJECT)      │
│     user_id         TEXT                     │
│     project_id      TEXT                     │
│     source          TEXT                     │
│     tags            TEXT                     │
│     structured_map  TEXT DEFAULT '{}'        │ ← SHOULD contain LLM result
│     enrichment_status TEXT (pending/done)    │ ← REDUNDANT with pending_tasks
│     quality_score   INTEGER                  │
│     ...timestamps, pinned, archived...       │
└──────────────┬──────────────────────────────┘
               │ 1:N (entry_id FK)
               ▼
┌─────────────────────────────────────────────┐
│ pending_tasks                                │
├─────────────────────────────────────────────┤
│ PK  id              SERIAL                  │
│     task_type       TEXT (TAG_ENRICHMENT)    │
│ FK  entry_id        INTEGER → ke.id         │
│     status          TEXT (PENDING/COMPLETED) │ ← DUAL source of truth
│     payload         TEXT (JSON)              │
│     error           TEXT                     │
│     retry_count     INTEGER                  │
│     ⚠️  NO project_id                       │ ← Forces JOIN for project filter
│     ...timestamps...                         │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ graph_nodes (admin DB)                       │
├─────────────────────────────────────────────┤
│ PK  entry_id        TEXT                    │ ← String, not INTEGER FK!
│     label           TEXT                     │
│     type            TEXT                     │
│     tier            TEXT                     │
│     project_id      TEXT                     │
│     x, y, z         REAL (3D layout)         │
│     level           INTEGER                  │
│     cluster_id      TEXT                     │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ knowledge_graph_edges (memory DB)            │
├─────────────────────────────────────────────┤
│ PK  id              SERIAL                  │
│ FK  source_id       INTEGER → ke.id         │
│ FK  target_id       INTEGER → ke.id         │
│     relation        TEXT                     │
│     weight          REAL                     │
└─────────────────────────────────────────────┘
```

## 2. Identified Issues

### 🔴 Critical

| # | Issue | Impact | Root Cause |
|---|-------|--------|------------|
| 1 | **Dual status tracking** | Task COMPLETED but entry still 'pending' | `processTagEnrichment` marks task done but code path skips `UPDATE knowledge_entries SET enrichment_status='done'` |
| 2 | **structured_map not populated** | LLM runs but result not saved to entry | Code bug: `updateEntryStructuredMap` conditional update fails when enrichment_status != expected |
| 3 | **No project_id on pending_tasks** | Expensive JOIN for per-project stats | Original design assumed global queue, project scope added later |
| 4 | **Orphan tasks from DELETE+INSERT** | 300K+ failed tasks accumulate | `ingestRule()` DELETEs entry (ID gone) → re-INSERTs (new ID) → old tasks reference dead ID |

### 🟡 Design Smells

| # | Issue | Impact |
|---|-------|--------|
| 5 | `graph_nodes.entry_id` is TEXT, `knowledge_entries.id` is INTEGER | No FK constraint, type mismatch |
| 6 | Two edge tables: `knowledge_graph_edges` (memory) + `graph_edges` (admin) | Confusing, potential data split |
| 7 | `enrichment_status` on `knowledge_entries` duplicates `pending_tasks.status` | Dual source of truth |
| 8 | `pending_tasks.payload` stores full content in JSON | Redundant with `knowledge_entries.content` |

## 3. Refactor Plan

### Phase 1: Fix Critical Bug (Immediate)

**Task COMPLETED but entry not updated:**

Fix: After successful LLM analysis, ALWAYS update knowledge_entries:
```typescript
// After analyzeTags succeeds:
await adapter.runAsync(
  `UPDATE knowledge_entries SET enrichment_status = 'done', structured_map = $1, updated_at = $2 WHERE id = $3`,
  [JSON.stringify(structuredResult), new Date().toISOString(), task.entry_id]
);
await this.repo.markCompleted(task.id);
```

### Phase 2: Add project_id to pending_tasks

```sql
ALTER TABLE pending_tasks ADD COLUMN project_id TEXT;
CREATE INDEX idx_pending_tasks_project ON pending_tasks(project_id, status);
UPDATE pending_tasks pt SET project_id = (
  SELECT ke.project_id FROM knowledge_entries ke WHERE ke.id = pt.entry_id
);
```

### Phase 3: Prevent Orphan Tasks (UPSERT instead of DELETE+INSERT)

```sql
-- Requires UNIQUE constraint:
CREATE UNIQUE INDEX idx_ke_source_project ON knowledge_entries(source, project_id);

-- Then use UPSERT:
INSERT INTO knowledge_entries (...) VALUES (...)
ON CONFLICT (source, project_id) DO UPDATE SET
  content = EXCLUDED.content, summary = EXCLUDED.summary, updated_at = now();
```

### Phase 4: Eliminate Dual Status

Remove `enrichment_status` from `knowledge_entries`. Use `structured_map != '{}'` as indicator.

### Phase 5: Unify Graph Tables

Merge `graph_nodes.entry_id` (TEXT) → INTEGER FK to `knowledge_entries.id`.

## 4. Priority Order

1. **Phase 1** — Fix NOW (bug: LLM result not saved)
2. **Phase 2** — Next release (performance)
3. **Phase 3** — Next release (prevents data corruption)
4. **Phase 4** — Future (clean design)
5. **Phase 5** — Future (architecture simplification)
