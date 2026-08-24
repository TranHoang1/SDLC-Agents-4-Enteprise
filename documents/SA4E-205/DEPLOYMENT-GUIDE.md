# Deployment Guide (DPG)

## SA4E-205 — Parallel Phase Execution in SDLC Pipeline Graph

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-205 |
| Title | Parallel Phase Execution in SDLC Pipeline Graph |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2026-08-22 |
| Status | Draft |
| Related TDD | TDD-v1-SA4E-205.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-22 | DevOps Agent | Initiate document — auto-generated from TDD and project context |

---

## Sign-Off

| Name | Role | Signature and date |
|------|------|--------------------|
| | Dev Lead | ☐ Approved for deployment |
| | QA Lead | ☐ Testing completed |
| | Ops Lead | ☐ Infrastructure ready |

---

## 1. Overview

### 1.1 Feature Summary

Enable concurrent execution of independent SDLC phases using LangGraph fan-out/fan-in within the SDLC Pipeline Graph. The change introduces state merge strategy, join nodes, and per-branch error handling to allow parallel phase execution for optimal throughput, building on benefits from SA4E-204.

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| extension/src/langgraph/pipeline/parallel | New | PhaseIdentificationService, FanOutNode, JoinNode, StateMergeService, ErrorIsolationService, ParallelExecutor |
| VS Code Extension | Modified | Pipeline graph orchestration updated to support fan-out/fan-in |
| Configuration ENABLE_PARALLEL_PHASES | New | Feature flag to enable/disable parallel execution per environment |
| Knowledge SQLite Checkpoints | Unchanged | No schema changes required |

### 1.3 Target Environments

| Environment | URL | Deploy Order | Approval Required |
|-------------|-----|-------------|-------------------|
| DEV | localhost:48721 | 1st | No |
| SIT | https://sit.sa4e.local | 2nd | No |
| UAT | https://uat.sa4e.local | 3rd | QA Sign-off |
| PROD | https://sa4e.company.com | 4th | PM + Business Sign-off |

---

## 2. Prerequisites

### 2.1 Infrastructure

| Requirement | Status | Notes |
|-------------|--------|-------|
| VS Code Extension host available | Ready | Developer workstations / CI agents |
| Node.js 20.x runtime | Ready | Required for LangGraph execution |
| Knowledge DB SQLite accessible | Ready | RemoteCheckpointer persistence |
| CI/CD pipeline for extension build | Pending | Ensure npm ci and build steps enabled |

### 2.2 Software Dependencies

| Dependency | Version | Status |
|-----------|---------|--------|
| Node.js | 20.x | Installed |
| LangGraph / LangChain | 0.2.x | Installed |
| TypeScript | 5.x | Installed |
| VS Code Extension | 4.x | Installed |

### 2.3 Access Requirements

| Access | Type | Who Needs It |
|--------|------|-------------|
| Git repo read | SSH Key | DevOps team |
| Extension marketplace internal | Service account | Automated |
| Feature flag config | Admin | DevOps lead |
| Knowledge DB backup | Credentials | DBA |

### 2.4 Backup Requirements

- [ ] VS Code extension source code backed up in git
- [ ] Knowledge SQLite checkpoint backup completed before deployment
- [ ] Configuration backup for ENABLE_PARALLEL_PHASES

---

## 3. Pre-Deployment Checklist

| # | Item | Responsible | Status |
|---|------|-------------|--------|
| 1 | Code merged to release branch | Developer | ☐ |
| 2 | All unit tests passed | Developer | ☐ |
| 3 | All integration tests passed | QA | ☐ |
| 4 | SIT/UAT sign-off obtained | QA + BA | ☐ |
| 5 | Database backup completed | DBA | ☐ |
| 6 | Configuration files prepared | DevOps | ☐ |
| 7 | Feature flags configured | Developer | ☐ |
| 8 | Monitoring/alerting configured | DevOps | ☐ |
| 9 | Rollback plan reviewed | Team | ☐ |
| 10 | Deployment window confirmed | PM | ☐ |

---

## 4. Database Migration

### 4.1 Migration Scripts

No schema changes required. State is persisted via existing RemoteCheckpointer tables: threads, checkpoints, events.

### 4.2 Execution Steps

No migration required.

### 4.3 Verification Queries

```sql
-- Verify checkpoint persistence working
SELECT COUNT(*) FROM checkpoints WHERE thread_id LIKE 'pipeline_%';
```

### 4.4 Rollback Scripts

Not applicable — no schema changes.

---

## 5. Application Deployment

### 5.1 Deployment Flow

![Deployment Flow](diagrams/deployment-flow.png)

### 5.2 Deployment Steps

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Build extension | npm run compile | dist/ folder created |
| 2 | Package extension | npm run package | .vsix artifact generated |
| 3 | Deploy to DEV | vsce publish --target dev | Installation success |
| 4 | Configure feature flag ENABLE_PARALLEL_PHASES=true | Update config | Flag visible in logs |
| 5 | Health check | GET /api/v1/pipeline/execute | 200 OK |

### 5.3 Docker Deployment (if applicable)

Backend Code Intelligence service unchanged. No container updates required for this feature.

---

## 6. Configuration Changes

### 6.1 New Environment Variables

| Variable | Description | DEV | SIT | UAT | PROD |
|----------|-------------|-----|-----|-----|------|
| ENABLE_PARALLEL_PHASES | Toggle parallel phase execution | true | true | true | false — enable after validation |

### 6.2 Application Properties Changes

| Property | Old Value | New Value | File |
|----------|-----------|-----------|------|
| pipeline.parallel.enabled | N/A | true | extension/package.json config |

### 6.3 Feature Flags

| Flag | DEV | SIT | UAT | PROD |
|------|-----|-----|-----|------|
| ENABLE_PARALLEL_PHASES | true | true | true | false — enable after verification |

---

## 7. Post-Deployment Verification

### 7.1 Health Checks

| Check | Endpoint/Command | Expected Result | Timeout |
|-------|-----------------|-----------------|---------|
| Application health | GET /api/v1/pipeline/execute with enable_parallel=true | 200 OK, status running | 30s |
| Parallel branches count | Check response branches_executed | >=1 for independent phases | 10s |

### 7.2 Smoke Tests

| # | Scenario | Steps | Expected Result |
|---|----------|-------|-----------------|
| 1 | Independent phases execute concurrently | Submit job with 2 independent phases, enable_parallel=true | Both phases complete in parallel, execution_time_ms reduced |
| 2 | State merge | Submit job with parallel branches with overlapping state keys | Merged state contains all outputs, conflicts logged |
| 3 | Error isolation | Force one branch to fail | Other branches complete, error captured in state.branchErrors |

### 7.3 Log Verification

| Log Entry | Level | Expected | Location |
|-----------|-------|----------|----------|
| fanout.created | INFO | Within 60s of job start | extension logs |
| branch.completed | INFO | After startup | extension logs |
| state.merged | INFO | After join | extension logs |

### 7.4 Monitoring Dashboard

- [ ] pipeline.parallel.branches_executed counter visible
- [ ] pipeline.parallel.execution_time_ms histogram within SLA
- [ ] pipeline.parallel.merge_conflicts counter monitored
- [ ] No unexpected alerts triggered

---

## 8. Rollback Plan

### 8.1 Rollback Flow

![Rollback Flow](diagrams/rollback-flow.png)

### 8.2 Rollback Decision Criteria

| Condition | Action |
|-----------|--------|
| Critical defect found in production | Immediate rollback |
| Performance degradation > 50% | Immediate rollback |
| Data integrity issue | Immediate rollback + DBA investigation |
| Minor UI issue | Hotfix — no rollback |

### 8.3 Rollback Steps

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Disable feature flag | Set ENABLE_PARALLEL_PHASES=false | Log shows flag off |
| 2 | Restart extension host | Reload window | Pipeline falls back to sequential |
| 3 | Verify fallback | Submit job with enable_parallel=false | Execution sequential, no errors |
| 4 | Restore configuration | Revert config file | Config matches previous version |

### 8.4 Rollback Time Estimate

| Action | Estimated Time |
|--------|---------------|
| Feature flag disable | 2 minutes |
| Extension restart | 3 minutes |
| Verification | 5 minutes |
| **Total** | **10 minutes** |

---

## 9. Environment-Specific Notes

### 9.1 DEV

Feature flag ENABLE_PARALLEL_PHASES defaults true. No approval required.

### 9.2 SIT

Feature flag ENABLE_PARALLEL_PHASES defaults true. Validate parallel execution with test jobs.

### 9.3 UAT

Feature flag ENABLE_PARALLEL_PHASES defaults true. QA sign-off required before PROD.

### 9.4 PROD

- **Deployment Window:** Off-hours, Tuesday/Thursday 22:00-00:00
- **Approval Required From:** PM + Business Owner
- **Communication Plan:** Notify DevOps Slack channel before/after deployment
- **On-Call Contact:** DevOps Lead

---

## 10. Appendix

### Contacts

| Role | Name | Contact |
|------|------|---------|
| DevOps Lead | TBD | TBD |
| DBA | TBD | TBD |
| On-Call Dev | TBD | TBD |

### Related Tickets

| Ticket | Summary | Relationship |
|--------|---------|-------------|
| SA4E-205 | Parallel Phase Execution | Main ticket |
| SA4E-204 | Parallel Tool Execution | Dependency |
