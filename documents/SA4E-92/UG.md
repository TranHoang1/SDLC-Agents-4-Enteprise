# User Guide — SA4E-92: Parallel Pega Indexer

## Overview

SA4E-92 parallelizes the Pega rule fetching pipeline in the VS Code/Kiro extension's IndexingService. Previously, rules were fetched one-at-a-time from the Pega server — this fix introduces batched concurrent fetching, reducing full re-index time from ~5-10 minutes to ~30-60 seconds.

## What Changed

| Before | After |
|--------|-------|
| Rule fetches: sequential (1 at a time) | Rule fetches: 5 concurrent per batch |
| Rule type crawl: sequential (9 types, one-by-one) | Rule type crawl: all 9 types in parallel |
| Full re-index: ~5-10 min | Full re-index: ~30-60 sec |

## Configuration

No new configuration is required. The concurrency limit is hardcoded to **5 parallel requests** to protect the shared Pega academy server from overload.

### Concurrency Constant

If you need to adjust the concurrency limit (e.g., for a dedicated Pega instance that can handle more load), edit:

```
extension/src/services/PegaCrawlHelper.ts
```

Change line:
```typescript
const FETCH_CONCURRENCY = 5;
```

## Usage

No changes to user workflow. The "Index Workspace" command operates exactly as before — it just completes faster.

1. Open Command Palette (`Ctrl+Shift+P`)
2. Run **"SDLC: Index Workspace"**
3. Observe progress in the notification area and Output Channel

## Architecture

Three files are involved:

| File | Responsibility |
|------|---------------|
| `parallel-utils.ts` | Generic `parallelBatch<T,R>()` utility — runs async operations in batches with concurrency limit |
| `PegaCrawlHelper.ts` | Pega-specific fetch strategies: `fetchRulesInParallel()`, `fetchRuleTypesInParallel()`, `saveRuleFile()` |
| `IndexingService.ts` | Orchestrator — calls helpers, manages crawl queue and ingestion |

## Error Handling

Error behavior is unchanged:

| Error Type | Behavior |
|------------|----------|
| **Server error** (5xx, ECONNREFUSED, timeout) | Immediately aborts all parallel fetches and the entire crawl |
| **Not found** (404, "rule not found") | Logged and skipped — other fetches continue |
| **Other errors** | Logged and skipped |

When a server error is detected mid-batch, remaining in-flight requests complete but their results are discarded. The crawl aborts with a clear error message in the Output Channel.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Pega Server Connection Failed" during parallel fetch | Server overloaded by concurrent requests | Reduce `FETCH_CONCURRENCY` to 3 or 2 |
| Indexing still slow | Network latency, not parallelism | Check Pega server response times in Output Channel |
| Duplicate rules in output | Should not happen — `visitedKeys` marks items before fetch | Report as bug |

## Performance Expectations

- **Rule fetches**: With 50 rules per iteration chunk at concurrency 5, you get 10 batches of 5 = ~10 sequential wait periods instead of 50.
- **Rule type expansion**: 9 rule types fetched simultaneously per class rule (was 9 sequential calls).
- **Combined speedup**: ~5-10x depending on network latency and server response time.
