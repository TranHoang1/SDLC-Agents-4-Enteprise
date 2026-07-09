# Loop Constraints — Hard Guardrails

SM MUST read this before every pipeline run (Step 0). Violation = **hard stop** + report user.

## Path Denylist

CANNOT edit/delete:
- `.env`, `.env.*` — Secrets
- `secrets/`, `credentials/`, `auth/` — Security-sensitive
- `*.pem`, `*.key`, `*.p12` — Private keys
- `production.yml`, `prod.conf` — Production configs
- `jira.conf` (by sub-agents) — Only SM manages
- `.git/` — Git internals

## Execution Limits

| Limit | Value | On Breach |
|-------|-------|-----------|
| Fix attempts per document | **3** | Escalate to user |
| Feedback loop iterations (BA↔SA) | **5** | Hard stop, mark blocked |
| Sub-agent retries per phase | **2** | Stop phase, report |
| Consecutive phase failures | **3** | Circuit breaker OPEN |
| Total agent invocations per session | **30** | Warn at 25, hard stop at 30 |

## Push & Merge Safety

- Never auto-merge to main/master without explicit "merge approved"
- Always branch per ticket: `{TICKET}` key
- Never push without user confirmation (exception: L3 mode → feature branch only)
- Never force push — `git push --force` NEVER allowed
- Never delete remote branches

## Data Safety

- Never delete STATUS.json without rebuild from file scan
- Never overwrite KB entries without versioning
- Never truncate RUN-LOG.md — append only
- Never modify committed documents without version bump

## Agent Invocation Safety

- Never invoke agent without prerequisite check
- Never skip verification after agent completes
- Never fabricate agent results
- Never invoke same agent >2 times for same task → escalate

## Budget Safety

| Threshold | Action |
|-----------|--------|
| 80% daily cap | Switch to report-only mode, notify user |
| 100% daily cap | Hard stop all agent invocations |
| Single invoke >100k tokens | Warn before invoke |

## Violation Response

```
⛔ CONSTRAINT VIOLATION
Rule: {which rule}
Attempted by: {agent or SM action}
Action taken: HARD STOP
User: please advise how to proceed.
```
