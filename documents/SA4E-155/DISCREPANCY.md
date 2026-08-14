# Discrepancy Report — SA4E-155

## Document Information

| Field | Value |
|-------|-------|
| Ticket | SA4E-155 |
| Author | SA Agent |
| Date | 2026-08-14 |
| Severity | Medium |
| Status | Resolved in TDD (SA decision applied) |

---

## Discrepancy #1: COALESCE Inconsistency in CodeEnrichmentHandler

| Aspect | Detail |
|--------|--------|
| FSD Requirement | BR-08: COALESCE semantics on write — first-write-wins for ALL enrichment fields |
| Codebase State | storeResults() uses summary = ? (overwrite) but COALESCE(?, pseudo_code) for pseudo_code |
| File | backend/src/engine/enrichment/CodeEnrichmentHandler.ts line ~185 |
| Impact | If extension writes summary first via /enrich-save, backend TaskWorker will overwrite it (violates first-write-wins) |

**Resolution:** SA chose Option A (both paths use COALESCE). DEV must fix storeResults() as part of Implementation Phase 3.1.

---

## Discrepancy #2: FK Constraint Prevents CODE_ENRICHMENT Tasks

| Aspect | Detail |
|--------|--------|
| FSD Requirement | pending_tasks can reference symbols (CODE_ENRICHMENT) or knowledge_entries (TAG_ENRICHMENT) |
| Codebase State | FOREIGN KEY (entry_id) REFERENCES knowledge_entries(id) in migration 003-pending-tasks.ts |
| Impact | Creating CODE_ENRICHMENT tasks with symbol IDs will fail FK constraint violation |

**Resolution:** SA chose Option A (remove FK). DEV must apply migration in Phase 1.2.

---

## Discrepancy #3: claimBatch() Missing Priority Ordering

| Aspect | Detail |
|--------|--------|
| FSD Requirement | BR-02: Task claiming MUST order by priority DESC, then created_at ASC |
| Codebase State | ORDER BY created_at ASC only (no priority column exists yet) |
| Impact | On-demand HIGH_PRIORITY tasks will not be processed before NORMAL background tasks |

**Resolution:** Migration adds priority column + composite index. DEV modifies claimBatch() query in Phase 2.2.

---

## Summary

All discrepancies are resolved by SA decisions in TDD and require only implementation changes (no FSD modification needed). The FSD correctly identified these as Open Issues (OI-01, OI-02, OI-03) for SA review.

No FSD revision required — discrepancies are implementation gaps, not specification gaps.
