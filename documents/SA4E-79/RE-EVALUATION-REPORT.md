# SA4E-79 Re-Evaluation Report: Client-Side LLM Knowledge Enrichment

## Meta

| Field | Value |
|-------|-------|
| **Reviewer** | TA Agent — Senior Technical Architect |
| **Date** | 2026-07-30 |
| **Scope** | Re-evaluation of TA-TECHNICAL-REVIEW findings against current implementation |
| **Files Reviewed** | 12 files (6 extension + 6 backend) |

---

## Executive Summary

**4 of 15** previous findings are fully **RESOLVED**. **3 are PARTIALLY RESOLVED** with remaining gaps. **8 remain UNRESOLVED** (mostly lower-severity or deferred items).

Additionally, **1 Critical new issue** (NEW-01) and **2 Medium new issues** (NEW-02, NEW-03) were discovered, plus **2 Low items** (NEW-04, NEW-05).

### Resolution Dashboard

| Severity | Total | RESOLVED | PARTIAL | UNRESOLVED | NEW |
|----------|-------|----------|---------|------------|-----|
| 🔴 Critical | 0 | 0 | 0 | 0 | 1 |
| 🟠 HIGH | 3 | 2 | 1 | 0 | 0 |
| 🟡 MEDIUM | 8 | 2 | 3 | 3 | 2 |
| 🔵 LOW | 4 | 0 | 0 | 4 | 2 |

---

## 1. Previous Finding Re-Evaluation

### TA-01: Unbounded Concurrent Enrichment — 🔴 HIGH → ✅ **RESOLVED**

**What was implemented:**
- `MAX_GLOBAL_CONCURRENT = 3` (line 26, EnrichmentObserver.ts)
- `activeCount` counter with increment before processing, decrement in `finally` (lines 44, 110, 117)
- Available slot calculation: `MAX_GLOBAL_CONCURRENT - this.activeCount` (line 101)
- Early return when `available <= 0` (line 102)

**Analysis:**
The throttle correctly limits across batches. The `activeCount` increment (line 110) happens synchronously before `Promise.allSettled` (line 111-113), and the decrement happens in `finally` (line 117). Because JS event loop guarantees atomicity for the synchronous code between the two `await` calls (lines 99 and 111), there is **no TOCTOU race** between concurrent invocations.

The implementation is simpler than the recommended queue-based approach (no `pendingQueue`) — entries are silently dropped when at capacity rather than queued. This is an acceptable trade-off for MVP (prevents cascade failure per R4.1).

**Verdict:** ✅ Fully addressed — global throttle prevents the cascade failure scenario.

---

### TA-02: Orphaned Fire-and-Forget Promises — 🔴 HIGH → ✅ **RESOLVED**

**What was implemented:**
- `private activePromises: Set<Promise<void>>` (line 46)
- `private shutdownController = new AbortController()` (line 50)
- `shutdown(): Promise<void>` with 10s max wait (lines 74-81)
- `trackPromise(promise)` — adds to set, deletes on settle (lines 176-179)
- `callLlm` checks `shutdownController.signal.aborted` early (line 163)

**Analysis:**
The promise lifecycle is fully tracked. During shutdown:
1. `shutdownController.abort()` is called
2. Already-started LLM calls that reach `callLlm` check before their signal check will throw early
3. In-flight promises are waited up to 10s via `Promise.race([allSettled, 10s timeout])`
4. Any promises that outlive the 10s window are orphaned (but safely — `enrichSingle` catches all errors)

**Remaining gap:** The `shutdownController.signal` is checked once at the start of `callLlm` but is **NOT passed** to `llmProvider.chat()` as part of the abort signal. Only `AbortSignal.timeout(LLM_TIMEOUT_MS)` is passed. If shutdown occurs during an LLM call, the call continues for up to 30s. This is safe (errors are caught) but wasteful. This is an intentional trade-off to avoid `AbortSignal.any()` (see TA-03).

**Verdict:** ✅ Functionally resolved — promise tracking and graceful shutdown work correctly. The mid-call abort gap is acceptable.

---

### TA-03: `AbortSignal.any()` Compatibility — 🔴 HIGH → ⚠️ **PARTIALLY RESOLVED**

**What was implemented:**
- `AbortSignal.any()` is **never used** in the codebase — the implementation avoids it entirely
- `AbortSignal.timeout(LLM_TIMEOUT_MS)` is used instead (line 171)
- The `shutdownController.signal` is checked at the start of `callLlm` only (line 163)

**Analysis:**
The primary risk (crash from missing `AbortSignal.any()`) is fully mitigated by not using it. However:

| API | Node.js | VS Code Version | Risk |
|-----|---------|----------------|------|
| `AbortSignal.timeout()` | 17+ | VS Code 1.82+ (Node 18) | ✅ OK for current VS Code |
| `AbortSignal.any()` | 20+ | VS Code 1.82+ (Node 18) ✅ | Not used |

`AbortSignal.timeout()` is available in Node 17+ → VS Code's bundled Node 18. For the supported VS Code version range, this is fine.

**No polyfill was provided** for either API. If minimum VS Code compatibility needs to extend back to Node 16, a `setTimeout`-based fallback would be needed.

**Verdict:** ⚠️ The dangerous API (`AbortSignal.any()`) is avoided. `AbortSignal.timeout()` is used instead, which is compatible with VS Code's Node 18+. No polyfill for older environments. **Acceptable for current target.**

---

### TA-04: Missing Existing Metadata in Prompt — 🟡 MEDIUM → ❌ **UNRESOLVED**

**Status:** `prompts.ts` is unchanged (user confirmed). `EnrichmentObserver.callLlm()` passes only raw content — no existing tags, type, or structured_map context.

**Impact:** The LLM enriches without knowledge of existing metadata. User-applied tags can be replaced rather than merged. Enrichment quality is lower than it could be.

**Priority:** Sprint+1 (per original review). Not blocking.

**Verdict:** ❌ Not addressed — deferred.

---

### TA-05: 409 Counted as Consecutive Failure — 🟡 MEDIUM → ✅ **RESOLVED**

**What was implemented:**
- `enrichSingle` checks for `"already enriched"` text and returns `true` (line 153)
- Only if NOT already enriched, checks `!result.includes("Error:")` (line 154)
- `updateFailureTracking` resets `consecutiveFailures = 0` on any success (line 125)
- `disableWithBackoff()` with exponential backoff up to `MAX_BACKOFF_MS = 300000` (lines 133-138)

**Flow verification:**
```
Server returns: "Error: Entry #42 already enriched (status=done)"
→ Line 153: result.includes("already enriched") → true → return true
→ updateFailureTracking: status=fulfilled, value=true → reset failures = 0
```

✅ 409 is correctly treated as success, not failure.

**Verdict:** ✅ Fully addressed.

---

### TA-06: `enrichment_status` Set Atomically With INSERT — 🟡 MEDIUM → ⚠️ **PARTIALLY RESOLVED**

**What was implemented:**
- In `handleIngest` (crud.ts line 75-96): wrapped in `dbAdapter.transactionAsync(() => {...})`
- INSERT + enrichment_status UPDATE are inside the same transaction

**Analysis:**
The original recommendation was to include `enrichment_status` in the INSERT params directly. Instead, the code uses a transaction wrapping both INSERT and UPDATE.

SQLite transactions are fully atomic (rolls back on crash). So functionally, the INSERT and UPDATE are atomic together — **equivalent to the recommended approach** for the adapter path.

However, the **no-adapter path** (lines 97-123) does NOT use a transaction:
```typescript
} else {
  id = await engine.insert({...});           // No transaction
  if (!tagAnalyzer) {
    await engine.getAdapter().runAsync(       // Separate UPDATE
      `UPDATE knowledge_entries SET enrichment_status = 'pending' WHERE id = ?`,
      [id],
    );
  }
}
```

If the server crashes between `insert` and the `UPDATE`, the entry defaults to `'done'` (when it should be `'pending'`).

**Verdict:** ⚠️ Adapter path is safe (wrapped in transaction). No-adapter fallback path still has the race window.

---

### TA-07: No Server-Side Rate Limit on `mem_enrich` — 🟡 MEDIUM → ❌ **UNRESOLVED**

**Status:** No rate limiting code in `enrich.ts` or anywhere in the handler chain.

**Mitigating factors:**
- Atomic `WHERE enrichment_status = 'pending'` limits damage — each entry can only be enriched once
- Project scope check prevents cross-project attacks
- Bounded resource (only `pending` entries can be enriched)

**Verdict:** ❌ Not addressed — deferred to Sprint+2.

---

### TA-08: TaskWorker May Process After Client Enrichment — 🟡 MEDIUM → ⚠️ **PARTIALLY RESOLVED**

**What was implemented:**
- Re-check **before** LLM call: `entry = await this.engine.findById(task.entry_id)` → checks `enrichment_status === 'done'` (lines 190-196)
- Re-check **after** LLM call: `currentEntry = await this.engine.findById(task.entry_id)` → checks `enrichment_status === 'done'` (lines 210-215)
- Atomic UPDATE: `WHERE id = ? AND enrichment_status = 'pending'` (lines 228-234)

**Analysis:**
The re-check after the LLM call (lines 210-215) correctly implements R2.1 and prevents overwriting `enrichment_status`.

**However, there are TWO remaining gaps:**

**Gap 1 — Tags and structured_map not protected (Medium):**
The `engine.updateTags()` call (line 222) and `updateEntryStructuredMap()` (line 225) run BEFORE the enrichment_status UPDATE (line 229). If a client enriches between lines 222-225 and line 229:
1. Backend merges tags → writes tags (line 222)
2. Client enriches → atomically sets all fields (mid-race)
3. Backend `updateEntryStructuredMap` → **overwrites client's structured_map** (line 225) — no enrichment_status check
4. Backend enrichment_status UPDATE → 0 rows affected (silent)
5. Backend marks task completed

**Result:** Client's `structured_map` is overwritten. Client's tags are lost (overwritten by step 1).

**Gap 2 — UPDATE result not checked:**
The result of `runAsync` at line 229 is not checked. If it affects 0 rows (client enriched during the micro-window), the code doesn't detect this — it silently continues and calls `markCompleted`. While this doesn't corrupt data (atomic WHERE prevents overwriting `enrichment_status`), it should log the race.

**Verdict:** ⚠️ The re-check logic is correctly implemented per R2.1, but `updateTags` and `updateEntryStructuredMap` are not protected by `enrichment_status` checks, creating a small race window for structured_map and tags overwrites.

---

### TA-09: No Observability/Metrics — 🟡 MEDIUM → ❌ **UNRESOLVED**

**Status:**
- Still uses `console.warn` (line 136) and `console.debug` (line 156)
- No structured logger (pino or similar)
- No `getEnrichmentStats()` method
- No metrics endpoint or dashboard

**Impact:** Cannot detect enrichment staleness, systemic failures, or performance regressions without deep log inspection.

**Verdict:** ❌ Not addressed — deferred to Sprint+1.

---

### TA-10: `handleIngest` Sets Status via Separate Non-Atomic UPDATE — 🟡 MEDIUM → ⚠️ **PARTIALLY RESOLVED**

**Note:** This finding overlaps with TA-06 but is specific to `handleIngest`.

**Adapter path:** Wrapped in `transactionAsync` → functionally atomic. ✅
**No-adapter path:** Separate INSERT + UPDATE without transaction → not atomic. ⚠️

The no-adapter path is a fallback for when `dbAdapter` is not passed. The code correctly handles this by wrapping the UPDATE in try/catch, but the atomicity gap remains.

**Verdict:** ⚠️ Same as TA-06 — adapter path OK, no-adapter path has atomicity gap.

---

### TA-11: No-Adapter Ingest Path Doesn't Set `enrichment_status` — 🟡 MEDIUM → ✅ **RESOLVED**

**What was implemented:**
```typescript
// TA-11: Set enrichment_status in no-adapter path (non-atomic but best effort)
if (!tagAnalyzer) {
  try {
    await engine.getAdapter().runAsync(
      `UPDATE knowledge_entries SET enrichment_status = 'pending' WHERE id = ?`,
      [id],
    );
  } catch { /* non-fatal — graceful degradation */ }
}
```

**Analysis:**
When `tagAnalyzer` is NOT available in the no-adapter path, the code now correctly sets `enrichment_status = 'pending'`, enabling client-side enrichment to pick up the entry.

When `tagAnalyzer` IS available, the status defaults to `'done'` and a fire-and-forget `analyzeTags()` call is made. This is correct behavior.

**Verdict:** ✅ Fully addressed.

---

### TA-12: Static 4000 Char Token Budget — 🔵 LOW → ❌ **UNRESOLVED**

**Status:** `MAX_CONTENT_FOR_LLM = 4000` remains hardcoded in `prompts.ts`. No dynamic budget based on model context window.

**Verdict:** ❌ Not addressed — low priority, deferred to Sprint+2.

---

### TA-13: Provider Availability False Negatives — 🔵 LOW → ❌ **UNRESOLVED**

**Status:** No retry logic or cached availability status for `isAvailable()`. The `enrichInBackground` method calls `await this.llmProvider.isAvailable()` once and returns early if unavailable. Transient network blips can cause enrichment opportunities to be missed.

**Verdict:** ❌ Not addressed — low priority, deferred to Sprint+1.

---

### TA-14: `sanitizeText` Misses `javascript:` URLs — 🔵 LOW → ❌ **UNRESOLVED**

**Status:** `sanitizeText()` still only removes angle brackets (`[<>]/g`). `javascript:` URLs and `on*` event handlers are not sanitized.

**Mitigation:** Parameterized queries prevent SQL injection. Lower priority as stored data is consumed via parameterized SQL and LLM prompts (JSON-parse-guarded).

**Verdict:** ❌ Not addressed — deferred to Future.

---

### TA-15: `parsePendingHits` Regex Fragile — 🔵 LOW → ❌ **UNRESOLVED**

**Status:** The original regex-based parser remains unchanged (EnrichmentObserver.ts line 88). No block parser was implemented.

**Risk:** If the `[PENDING]` block format changes in `search.ts`, the regex silently stops matching, and entries go undetected.

**Verdict:** ❌ Not addressed — deferred to Future.

---

## 2. New Issues Found

### NEW-01: 🔴 CRITICAL — `handleIngestFile` Creates TAG_ENRICHMENT Tasks That Are Never Processed

**File:** `backend/src/modules/memory/dispatchers/crud.ts` (lines 231-243)

**Issue:**
In `handleIngestFile`, entries are inserted via `engine.insert()` which does NOT set `enrichment_status`. The column defaults to `'done'` (from migration 007). TAG_ENRICHMENT tasks are created (when `taskRepo` exists), but in `TaskWorker.processTagEnrichment()` (line 192):

```typescript
if ((entry as any).enrichment_status === 'done') {
  this.logger.info('Skipping TAG_ENRICHMENT — already enriched');
  await this.repo.markCompleted(task.id);
  return;
}
```

Since `enrichment_status` defaults to `'done'`, the TaskWorker **skips every TAG_ENRICHMENT task** created by `handleIngestFile`. These entries are never enriched — they have no tags, no summary, no structured_map — yet they're marked as `'done'` so client enrichment won't pick them up either.

| Ingest Path | tagAnalyzer? | enrichment_status | TAG_ENRICHMENT Task | Gets Enriched? |
|-------------|-------------|-------------------|---------------------|----------------|
| `handleIngest` (adapter) | ✅ Available | `'done'` | Created | ❌ Skipped by TaskWorker |
| `handleIngest` (adapter) | ❌ Unavailable | `'pending'` | None | Client enriches |
| `handleIngestFile` (taskRepo) | ✅ Available | `'done'` (default) | Created | ❌ **Skipped by TaskWorker** |
| `handleIngestFile` (taskRepo) | ❌ Unavailable | `'done'` (default) | Created | ❌ Skipped by TaskWorker |

**All file-ingested entries fall through the cracks.**

**Recommended fix:**
```typescript
// In the handleIngestFile loop, after engine.insert():
if (taskRepo) {
  await dbAdapter!.runAsync(
    `UPDATE knowledge_entries SET enrichment_status = 'pending' WHERE id = ?`,
    [id],
  );
  await taskRepo.create({ task_type: TaskType.TAG_ENRICHMENT, ... });
}
```

Also applies to the `handleIngest` adapter path (TA-06 overlap): when tagAnalyzer IS available, entries are set to `'done'` + TAG_ENRICHMENT created, which the TaskWorker then skips. This suggests the original design intent was that the TaskWorker should process TAG_ENRICHMENT tasks **regardless** of enrichment_status, using the status only to avoid overwriting client enrichment.

---

### NEW-02: 🟡 MEDIUM — TaskWorker UPDATE Result Not Checked for 0-Changes

**File:** `backend/src/modules/memory/task-queue/TaskWorker.ts` (lines 228-236)

**Issue:**
```typescript
await this.engine.getAdapter().runAsync(
  `UPDATE knowledge_entries
   SET enrichment_status = 'done', enriched_by = 'backend_llm', enriched_at = ?
   WHERE id = ? AND enrichment_status = 'pending'`,
  [now, task.entry_id],
);
await this.repo.markCompleted(task.id);
// ^^ No check on result.changes
```

If a client enriched the entry between the re-check (line 210) and this UPDATE (line 229), the UPDATE affects 0 rows. The code still calls `markCompleted` without logging the race. While data is not corrupted (the `WHERE` clause prevents overwrites), this should at minimum log a warning.

**Recommended fix:**
```typescript
const result = await this.engine.getAdapter().runAsync(...);
if (result.changes === 0) {
  this.logger.warn({ entry_id: task.entry_id },
    'Race: entry enriched by client during backend processing');
  await this.repo.markCompleted(task.id);
  return;
}
```

---

### NEW-03: 🟡 MEDIUM — `updateTags` and `updateEntryStructuredMap` Not Protected by `enrichment_status`

**File:** `backend/src/modules/memory/task-queue/TaskWorker.ts` (lines 217-225)

**Issue:**
The backend writes tags and structured_map BEFORE the atomic enrichment_status UPDATE. If a client enriches during this gap:

```
T1: Backend: engine.updateTags(task.entry_id, merged.join(','))  // Writes tags
T2: Client:  mem_enrich(entry_id, summary="X", tags="Y", structured_map={...})  // Atomic write
T3: Backend: updateEntryStructuredMap(task.entry_id, result, context)  // OVERWRITES client's structured_map
T4: Backend: UPDATE enrichment_status WHERE id=? AND status='pending' → 0 rows
```

**Result:** Client's structured_map is overwritten by the backend (T3). Client's tags are lost (overwritten by T1). But the atomic check at T4 prevents the status overwrite.

**Recommended fix:** Either:
1. Wrap all three operations (tags, structured_map, enrichment_status) in a single transaction, OR
2. Perform the enrichment_status UPDATE FIRST (atomic with `WHERE`), then write tags + structured_map only if the UPDATE succeeded, OR
3. Move `updateTags` and `updateEntryStructuredMap` to happen ONLY inside a successful enrichment_status UPDATE callback.

This is the origin of the concern in the original TA-08 finding about **Scenario C** — the waste was noted but the partial-overwrite risk was not fully appreciated.

---

### NEW-04: 🔵 LOW — `handleIngestFile` Entries Miss `enrichment_status` Entirely

**File:** `backend/src/modules/memory/dispatchers/crud.ts` (line 233)

Unlike `handleIngest` (which sets `enrichment_status` in both adapter and no-adapter paths), `handleIngestFile` never explicitly sets `enrichment_status`. Even if the NEW-01 fix is applied (setting to 'pending'), there's an atomicity gap similar to TA-06: the `engine.insert()` + enrichment_status UPDATE are not wrapped in a transaction.

For the file ingest loop, entries are created one by one, and the loop is not transactional. A crash mid-loop would leave some entries with `'done'` (default) and no enrichment.

**Mitigation:** Low severity — file re-ingest is idempotent. Missing enrichment is non-destructive.

---

### NEW-05: 🔵 LOW — `enrichSingle` JSON Parse Error Not Differentiated

**File:** `extension/src/langgraph/enrichment/EnrichmentObserver.ts` (lines 144, 155-158)

```typescript
const metadata = JSON.parse(response);  // Can throw SyntaxError
```

If the LLM returns invalid JSON (possible despite the system prompt directing JSON output), the error is caught by the generic `catch` at line 155. The error message (`"Unexpected token..."`) is logged but not distinguishable from network/LLM errors. Enrichment silently fails.

**Mitigation:** The `updateFailureTracking` counts this as a failure, which may trigger backoff unnecessarily for transient JSON parsing issues (often self-correcting on retry).

---

## 3. Regression Check

| Check | Result | Notes |
|-------|--------|-------|
| TypeScript compilation | ✅ No issues | Imports resolve correctly |
| Import paths | ✅ Correct | `../enrichment/EnrichmentObserver` from `base-node.ts` resolves |
| Module exports | ✅ Correct | Barrel export in `enrichment/index.ts` |
| DB schema backward compat | ✅ | `DEFAULT 'done'` for existing entries |
| Search response unchanged | ✅ | `pendingHits` section appended without breaking existing format |
| MCP tool definition | ✅ | `mem_enrich` schema matches handler expectations |
| Promise lifecycle | ✅ | No unhandled rejections (all caught) |
| Extension deactivation | ✅ | Graceful shutdown with 10s timeout |

---

## 4. Quality Gate Status

| Gate | Previous Score | Current Score | Change |
|------|---------------|---------------|--------|
| **Functional Correctness** | 9/10 | 9/10 | Unchanged |
| **Security** | 9/10 | 9/10 | Unchanged |
| **Performance** | 6/10 (FAIL) | 8/10 (PASS) | ⬆️ TA-01, TA-02 |
| **Observability** | 4/10 (FAIL) | 4/10 (FAIL) | Unchanged (TA-09) |
| **Production Readiness** | 6/10 (CONDITIONAL) | 7/10 (PASS) | ⬆️ TA-01, TA-02 resolved |

**Note:** Performance gate now passes with the global throttle and promise lifecycle. Observability remains failing (no structured logging or metrics), but this is a Sprint+1 item. Production Readiness passes conditionally — the NEW-01 (handleIngestFile) critical bug should be fixed before production deployment.

---

## 5. Summary Table

| Finding | Severity | Status | Notes |
|---------|----------|--------|-------|
| TA-01 | 🔴 HIGH | ✅ **RESOLVED** | Global throttle with activeCount tracking works correctly |
| TA-02 | 🔴 HIGH | ✅ **RESOLVED** | Promise lifecycle, shutdown(), trackPromise() implemented |
| TA-03 | 🔴 HIGH | ⚠️ **PARTIAL** | Avoids AbortSignal.any(); uses AbortSignal.timeout() (Node 18 OK); no polyfill |
| TA-04 | 🟡 MEDIUM | ❌ **UNRESOLVED** | Deferred (Sprint+1) |
| TA-05 | 🟡 MEDIUM | ✅ **RESOLVED** | 409 "already enriched" → success; exponential backoff |
| TA-06 | 🟡 MEDIUM | ⚠️ **PARTIAL** | Wrapped in transaction (adapter path); no-adapter path has atomicity gap |
| TA-07 | 🟡 MEDIUM | ❌ **UNRESOLVED** | Deferred (Sprint+2) |
| TA-08 | 🟡 MEDIUM | ⚠️ **PARTIAL** | Re-check added but tags/structured_map not protected; UPDATE result unchecked |
| TA-09 | 🟡 MEDIUM | ❌ **UNRESOLVED** | Deferred (Sprint+1) |
| TA-10 | 🟡 MEDIUM | ⚠️ **PARTIAL** | Same as TA-06 (adapter path OK, no-adapter path not) |
| TA-11 | 🟡 MEDIUM | ✅ **RESOLVED** | enrichment_status set in no-adapter path |
| TA-12 | 🔵 LOW | ❌ **UNRESOLVED** | Deferred (Sprint+2) |
| TA-13 | 🔵 LOW | ❌ **UNRESOLVED** | Deferred (Sprint+1) |
| TA-14 | 🔵 LOW | ❌ **UNRESOLVED** | Deferred (Future) |
| TA-15 | 🔵 LOW | ❌ **UNRESOLVED** | Deferred (Future) |
| **NEW-01** | 🔴 **CRITICAL** | **NEW** | `handleIngestFile` TAG_ENRICHMENT tasks never processed (status='done' default) |
| **NEW-02** | 🟡 **MEDIUM** | **NEW** | TaskWorker UPDATE result unchecked for 0-changes race |
| **NEW-03** | 🟡 **MEDIUM** | **NEW** | `updateTags`/`updateEntryStructuredMap` runs before enrichment_status check |
| **NEW-04** | 🔵 **LOW** | **NEW** | `handleIngestFile` misses enrichment_status setting entirely |
| **NEW-05** | 🔵 **LOW** | **NEW** | `enrichSingle` JSON parse error not differentiated |

---

## 6. Recommendations

### Fix Before Production (HIGH Priority)
1. **NEW-01 (Critical):** Add `UPDATE knowledge_entries SET enrichment_status = 'pending'` after `engine.insert()` in `handleIngestFile` for entries that receive TAG_ENRICHMENT tasks
2. **NEW-03 (Medium):** Wrap `updateTags` + `updateEntryStructuredMap` + enrichment_status UPDATE in a single atomic operation, or move them to execute only AFTER the enrichment_status UPDATE succeeds
3. **NEW-02 (Medium):** Add result.changes check after TaskWorker enrichment_status UPDATE

### Fix Current Sprint (MEDIUM Priority)
4. **TA-06/TA-10 (Partial):** Include `enrichment_status` in the engine.insert() params for both `handleIngest` and `handleIngestFile` to eliminate the atomicity gap

### Fix Next Sprint (LOW Priority)
5. **TA-04 (Medium):** Enhance `buildEnrichmentUserPrompt` to include existing tags/type/structured_map
6. **TA-09 (Medium):** Add structured logging with pino and/or expose `getEnrichmentStats()` method
