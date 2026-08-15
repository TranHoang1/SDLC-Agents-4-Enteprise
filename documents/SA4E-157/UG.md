# User Guide — SA4E-157: LLM Enrichment Progress Visibility

## 1. Overview

After indexing completes, the system performs LLM enrichment on knowledge base entries (generating summaries, tags, pseudocode). This feature makes that background process visible via a VS Code StatusBarItem and notifications.

## 2. What You'll See

### StatusBarItem (Bottom Bar)

| State | Display | Meaning |
|-------|---------|---------|
| Idle | `$(database) KB: Ready` | No enrichment running |
| Running | `$(sync~spin) Enriching: 150/2999 (5%)` | Active enrichment with progress |
| Complete | `$(database) KB: Ready` | Enrichment finished successfully |
| Error | `$(warning) KB: 3 failed` | Enrichment done with failures |
| Offline | `$(warning) KB: Offline` | Backend unreachable (3+ failures) |

### Notifications

- **Completion**: Info notification when enrichment finishes successfully
- **Partial failure**: Warning notification with "Show Details" button when some rules fail

## 3. Configuration

### Setting: Disable Polling

If you don't want enrichment status polling, set in VS Code settings:

```json
{
  "kiroSdlc.enrichment.pollingEnabled": false
}
```

Default: `true` (polling enabled).

### Polling Intervals (Automatic)

| State | Interval | Rationale |
|-------|----------|-----------|
| Idle | 30 seconds | Low overhead when nothing happening |
| Running | 5 seconds | Real-time progress during enrichment |
| Error/Complete | 15 seconds | Moderate monitoring after completion |

## 4. Commands

### `SA4E: Show Enrichment Status`

Open the Command Palette (`Ctrl+Shift+P`) and run `SA4E: Show Enrichment Status` to see a detailed status summary including:

- Current state
- Progress (completed/total with percentage)
- Failed rules count
- Start time and estimated completion
- Currently processing file

You can also click the StatusBarItem when enrichment is running or in error state.

## 5. API Reference

### `GET /api/v1/enrichment/status`

Returns current enrichment progress. Requires JWT authentication (same as all `/api/v1/*` endpoints). No admin permission needed.

**Response (200 OK):**

| Field | Type | Description |
|-------|------|-------------|
| state | `idle/running/complete/error` | Current enrichment state |
| totalRules | number | Total tasks in current batch |
| completedRules | number | Tasks completed successfully |
| failedRules | number | Tasks that failed |
| pendingRules | number | Tasks waiting to be processed |
| processingRules | number | Tasks currently being processed |
| percent | number | Completion percentage (0-100) |
| isRunning | boolean | Whether TaskWorker is active |
| startedAt | string or null | ISO timestamp of earliest active task |
| estimatedCompletion | string or null | Estimated finish time (requires 10+ completed) |
| currentFile | string or null | File currently being processed |
| lastPollAt | string or null | Last time TaskWorker polled for tasks |

**Error Responses:**

| Status | Meaning |
|--------|---------|
| 401 | Authentication required (missing/invalid JWT) |
| 503 | TaskWorker not initialized (memory module not loaded) |
| 500 | Internal error (DB query failure) |

## 6. Troubleshooting

| Symptom | Cause | Resolution |
|---------|-------|------------|
| StatusBarItem shows "KB: Offline" | Backend server unreachable | Verify backend is running, check URL in settings |
| Progress stuck at 0% | TaskWorker not started or no pending tasks | Check backend logs for TaskWorker errors |
| Many failed rules | LLM service unavailable or rate limited | Check LLM configuration in Admin panel |
| No StatusBarItem visible | Polling disabled or extension not activated | Check `kiroSdlc.enrichment.pollingEnabled` setting |

## 7. Error Codes

| Error | Source | Meaning |
|-------|--------|---------|
| `Enrichment service unavailable` | Backend 503 | Memory module not loaded |
| `Failed to retrieve enrichment status` | Backend 500 | Database query error |
| `Cannot reach backend` | Extension | Network timeout or connection refused |
| `Zod validation failed` | Extension | Backend returned unexpected response shape |
