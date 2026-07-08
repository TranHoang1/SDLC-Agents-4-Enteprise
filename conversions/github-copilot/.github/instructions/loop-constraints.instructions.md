---
applyTo: "documents/**"
---

# Loop Constraints — Hard Guardrails

SM MUST read this before every pipeline run. Violation = **hard stop** + report user.

## Path Denylist

CANNOT edit/delete: `.env*`, `secrets/`, `credentials/`, `auth/`, `*.pem`, `*.key`, `*.p12`, `production.yml`, `prod.conf`, `jira.conf` (sub-agents), `.git/`

## Execution Limits

| Limit | Value | On Breach |
|-------|-------|-----------|
| Fix attempts per document | **3** | Escalate to user |
| Feedback loop (BA↔SA) | **5** | Hard stop, mark blocked |
| Sub-agent retries per phase | **2** | Stop phase, report |
| Consecutive phase failures | **3** | Circuit breaker OPEN |
| Total invocations per session | **30** | Warn at 25, stop at 30 |

## Push & Merge Safety

- Never auto-merge to main without "merge approved"
- Branch per ticket, never force push, never delete remote branches

## Data Safety

- Never delete STATUS.json without rebuild
- Never overwrite KB without versioning
- Never truncate RUN-LOG.md
- Version bump on document changes

## Agent Safety

- Prerequisite check before invoke
- Verification after invoke
- Never fabricate results
- Max 2 same-agent per task

## Budget: 80% → report-only, 100% → hard stop
