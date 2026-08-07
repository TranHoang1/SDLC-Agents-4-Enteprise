# User Guide — SA4E-94: Redesigned Pega Crawler

## Document Information

| Field | Value |
|-------|-------|
| Ticket | SA4E-94 |
| Title | Redesign Pega Crawler: RuleSet-scoped Enumeration |
| Version | 1.0 |
| Date | 2025-07-08 |

---

## Overview

The Pega crawler has been redesigned from an iterative blind dependency crawl to a deterministic **enumerate-then-fetch** pipeline. Instead of following references rule-by-rule (which generated many 404 errors for platform rules), the crawler now discovers ALL rules upfront via RuleSet-scoped enumeration, then fetches content in a single pass.

## What Changed

| Before | After |
|--------|-------|
| Seeds → crawlPlan → fetch → nextBatch → loop | Hierarchy → Enumerate RuleSets → Fetch all → Ingest |
| Iterative (unknown iterations) | Single-pass (deterministic) |
| Many 404s for platform rules | Zero wasted API calls |
| Non-deterministic coverage | Same RuleSets → identical results |

## How It Works

### 4-Phase Pipeline

1. **Hierarchy Resolution** — Operator → Access Group → App Rule → merged RuleSets (unchanged)
2. **RuleSet Enumeration** — Query Service 10 per RuleSet to discover ALL rules (paginate until exhausted)
3. **Content Fetch** — Parallel chunked fetch with concurrency tuning (reuses existing logic)
4. **NDJSON Ingest** — Stream rules to backend (simplified: no nextBatch loop)

### Progress Messages

During indexing, the Output Channel shows:

```
[Pega Enumerator] Enumerating 3 RuleSets in parallel...
[Pega Enumerator] RuleSet "HRAppsV2": page 1, found 200 rules (total: 200)
[Pega Enumerator] RuleSet "HRAppsV2": page 2, found 150 rules (total: 350)
[Pega Enumerator] RuleSet "Pega-RULES": page 1, found 50 rules (total: 50)
[Pega Enumerator] ✅ Enumeration complete: 400 unique rules from 3 RuleSets
[Pega Indexer] 📋 Crawl set: 400 rules to fetch
[Pega Indexer] 🎯 Auto-tuned: latency=120ms → FETCH_CONCURRENCY=12
```

## Configuration

No new configuration is required. The crawler uses the existing settings:

| Setting | Purpose |
|---------|---------|
| `kiroSdlc.pegaEndpoint` | Pega server URL |
| `kiroSdlc.pegaUsername` | Operator ID for hierarchy resolution |
| Pega password (SecretStorage) | Authentication for API calls |

## Troubleshooting

### Enumeration returns 0 rules

**Symptom:** Log shows `⚠️ Enumeration returned 0 rules. Falling back to seed-based crawl.`

**Cause:** The RuleSet entries from hierarchy resolution may not match any rules via `pyRuleSet` filter. This can happen if:
- The Pega application doesn't have the CodeIntelligence REST service configured
- RuleSet names in the hierarchy don't match actual rule metadata

**Resolution:** The crawler automatically falls back to seed-based crawl using the `crawlPlan` endpoint. Verify your Pega REST service is correctly deployed.

### Single RuleSet fails

**Symptom:** Log shows `⚠️ RuleSet "X" enumeration failed: {error}`

**Cause:** Network timeout or auth issue for that specific query.

**Resolution:** Non-fatal — the crawler continues with other RuleSets. Re-run indexing to retry.

### Authentication errors (401/403)

**Symptom:** Crawl aborts with auth error during enumeration.

**Resolution:** Verify credentials in VS Code settings and SecretStorage. Ensure the operator has access to the target RuleSets.

## Error Codes

| Error | Severity | Action |
|-------|----------|--------|
| `Enumeration returned 0 rules` | Warning | Auto-fallback to seeds |
| `RuleSet "X" returned 0 rules` | Warning | Check RuleSet name matches Pega config |
| `RuleSet enumeration failed` | Warning | Non-fatal, continues with others |
| `Pega Server Connection Failed` | Fatal | Check endpoint/credentials |
| `HTTP 401/403` | Fatal | Fix credentials |

## Backend Changes

The backend `pega-stream` and `pega-api` routes no longer compute `nextBatch`. They return an empty array for backward compatibility. The `computeNextBatch()` method is retained in `PegaCrawler.ts` but not called from routes — it will be removed in a future cleanup ticket.

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-07-08 | Initial UG for SA4E-94 |
