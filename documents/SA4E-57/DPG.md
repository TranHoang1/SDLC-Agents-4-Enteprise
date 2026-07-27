# Deployment Guide (DPG)

## SDLC Agents 4 Enterprise — SA4E-57: Pega Parser L3-L4 Semantic Understanding & Execution Engine

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-57 |
| Title | Pega Parser L3-L4: Semantic Understanding & Execution Engine |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2026-07-27 |
| Status | Draft |
| Related TDD | TDD.md |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-27 | DevOps Agent | Initiate document — L3-L4 deployment configuration |

---

## 1. Overview

### 1.1 Feature Summary

This deployment covers the Pega Parser L3-L4 upgrade — adding expression evaluation, workflow simulation, decision table/tree evaluation, UI section preview, and security sandboxing to the existing Pega parser module. All evaluation is CPU-bound and in-memory; no database migration required.

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| Pega Module — expression/ | New | 7 files: Lexer, Parser, AST, Evaluator, ClipboardContext, ConstraintEvaluator, WhenEvaluator |
| Pega Module — workflow/ | New | 10 files: FlowGraphBuilder, FlowGraph, WorkflowEngine, WorkItem, SlaEngine, WorkPartyResolver + 5 shape handlers |
| Pega Module — decision/ | New | 6 files: DT Evaluator, Tree Evaluator, ConditionParser, OperatorRegistry, EvaluationResult, StrategyResolver |
| Pega Module — ui/ | New | 8 files: SectionRenderer, FieldRenderer, HarnessAssembler, VisibilityEvaluator + 4 layout renderers |
| Pega Module — security/ | New | 6 files: Sandbox, Validator, FunctionWhitelist, HtmlSanitizer, RateLimiter, AccessPolicyParser |
| Pega Module — deploy/ | New | 4 files: WorkerPool, WorkerTask, EvaluationCache, ConfigProvider |
| API Routes | Modified | 3 new endpoints in Hono router |
| Database | No change | All evaluation is in-memory |

### 1.3 Target Environments

| Environment | URL | Deploy Order | Approval Required |
|-------------|-----|-------------|-------------------|
| DEV | http://127.0.0.1:48721 | 1st | No |
| SIT | http://127.0.0.1:48721 | 2nd | No |
| UAT | http://127.0.0.1:48721 | 3rd | QA Sign-off |
| PROD | http://127.0.0.1:48721 | 4th | PM + Business Sign-off |

---

## 2. Prerequisites

### 2.1 Infrastructure

| Requirement | Status | Notes |
|-------------|--------|-------|
| Node.js 18+ | Required | worker_threads support |
| 2+ CPU cores recommended | Recommended | Worker pool leaves 1 core for HTTP server |
| No new infrastructure | N/A | Same single-process Hono server |

### 2.2 Software Dependencies

| Dependency | Version | Status |
|-----------|---------|--------|
| Node.js | 18+ | Required |
| Hono | 4.x | Already in project |
| vitest | Latest | Already in devDependencies |
| fast-check | Latest | Already in devDependencies |

### 2.3 Backup Requirements

- [ ] Database backup (Better-SQLite3 file) completed before deployment
- [ ] Previous backend build artifact saved
- [ ] Environment configuration backed up

---

## 3. Pre-Deployment Checklist

| # | Item | Responsible | Status |
|---|------|-------------|--------|
| 1 | Code merged to release branch | Developer | ☐ |
| 2 | All unit tests passed (lexer/parser 90%, evaluators 85%, workflow 80%) | Developer | ☐ |
| 3 | All security tests passed | Security | ☐ |
| 4 | Performance benchmarks meet targets (PB-01 through PB-08) | DevOps | ☐ |
| 5 | Feature flags configured in production | DevOps | ☐ |
| 6 | Worker pool size configured per environment | DevOps | ☐ |
| 7 | Monitoring dashboards updated with new metrics | DevOps | ☐ |

---

## 4. Database Migration

No database migration required. All L3-L4 evaluation is in-memory. The existing Better-SQLite3 database continues to serve the L1-L2 indexing pipeline unchanged.

---

## 5. Application Deployment

### 5.1 Deployment Steps

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Build backend | `npm run build` in `backend/` | Build completes without errors |
| 2 | Run unit tests | `npx vitest run` in `backend/` | All tests pass |
| 3 | Update environment config | Set PEGA_* variables (see §6) | Config loaded correctly |
| 4 | Start Hono server | `npm run dev` | Server starts on port 48721 |
| 5 | Health check | `curl http://127.0.0.1:48721/api/pega/health` | 200 OK with status |

### 5.2 Docker Deployment (if applicable)

```bash
# Build image
docker build -t sdlc-agents-backend:1.17.0 -f backend/Dockerfile .

# Stop existing container
docker stop sdlc-backend

# Start new container
docker run -d --name sdlc-backend \
  -p 48721:48721 \
  -e PEGA_WORKER_POOL_SIZE=4 \
  -e PEGA_SANDBOX_TIMEOUT_MS=5000 \
  -e PEGA_MAX_DECISION_ROWS=10000 \
  -e PEGA_DEPLOYMENT_MODE=worker-pool \
  sdlc-agents-backend:1.17.0

# Verify
curl http://127.0.0.1:48721/api/pega/health
```

---

## 6. Configuration Changes

### 6.1 New Environment Variables

| Variable | Description | DEV | SIT | UAT | PROD |
|----------|-------------|-----|-----|-----|------|
| PEGA_WORKER_POOL_SIZE | Max worker threads for evaluation | 2 | 4 | 4 | max(1, os.cpus()-1) |
| PEGA_SANDBOX_TIMEOUT_MS | Per-evaluation timeout | 10000 | 5000 | 5000 | 5000 |
| PEGA_MAX_DECISION_ROWS | Max rows in decision tables | 500 | 5000 | 10000 | 10000 |
| PEGA_DEPLOYMENT_MODE | Evaluation execution mode | in-process | worker-pool | worker-pool | worker-pool |
| PEGA_CACHE_TTL_MS | Evaluation cache TTL | 300000 | 300000 | 300000 | 300000 |
| PEGA_CACHE_MAX_ENTRIES | Max cached evaluations | 100 | 500 | 1000 | 1000 |
| PEGA_MAX_EVAL_DEPTH | Max expression nesting depth | 100 | 100 | 100 | 100 |
| PEGA_RATE_LIMIT_RPM | Rate limit per user (req/min) | 100 | 100 | 100 | 50 |

### 6.2 Feature Flags

| Flag | DEV | SIT | UAT | PROD |
|------|-----|-----|-----|------|
| pega.expressionEvaluation | true | true | true | true |
| pega.workflowSimulation | true | true | true | true |
| pega.decisionEvaluation | true | true | true | true |
| pega.uiPreview | true | true | false | false |
| pega.sandboxEnabled | true | true | true | true |

---

## 7. Post-Deployment Verification

### 7.1 Health Checks

| Check | Endpoint/Command | Expected Result | Timeout |
|-------|-----------------|-----------------|---------|
| Application health | GET /api/pega/health | 200 OK, status: UP | 30s |
| Worker pool ready | GET /api/pega/health → workers | poolSize > 0, activeWorkers = 0 | 10s |

### 7.2 Smoke Tests

| # | Scenario | Steps | Expected Result |
|---|----------|-------|-----------------|
| 1 | Simple expression evaluation | POST /api/pega/evaluate-expression with `.Customer.Name` | 200 OK, value returned |
| 2 | Workflow simulation | POST /api/pega/simulate-flow with simple flow | 200 OK, completed: true |
| 3 | Decision evaluation | POST /api/pega/evaluate-decision with decision table | 200 OK, matched: true |
| 4 | Security sandbox | POST with timeout=1ms, long-running expression | 408 TIMEOUT error |

### 7.3 Log Verification

| Log Entry | Level | Expected | Location |
|-----------|-------|----------|----------|
| Pega module initialized | INFO | After startup | Application log |
| Worker pool started | INFO | poolSize: N | Application log |
| Expression evaluated | INFO | expressionHash, duration | Application log |

### 7.4 Monitoring Dashboard

- [ ] pega_evaluation_count metric visible
- [ ] pega_evaluation_duration histogram within targets
- [ ] pega_worker_pool_utilization gauge < 80%
- [ ] No unexpected errors in logs

---

## 8. Rollback Plan

### 8.1 Rollback Decision Criteria

| Condition | Action |
|-----------|--------|
| Security sandbox bypass discovered | Immediate rollback |
| Worker thread crash causes process exit | Immediate rollback |
| Evaluation results are incorrect (wrong values) | Immediate rollback |
| Performance degradation > 50% for existing APIs | Immediate rollback |
| Minor evaluation edge case failures | Hotfix — no rollback |

### 8.2 Rollback Steps

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Disable feature flags | Set all pega.* flags to false | Feature endpoints return 404 |
| 2 | Deploy previous build | Restore previous backend artifact | Health check passes |
| 3 | Verify L1-L2 still working | Run existing indexing tests | Pipeline completes |
| 4 | Restore configuration | Revert environment variables | Config matches pre-deployment |

### 8.3 Rollback Time Estimate

| Action | Estimated Time |
|--------|---------------|
| Feature flag disable | 1 minute |
| Application rollback | 5 minutes |
| Verification | 10 minutes |
| **Total** | **16 minutes** |

---

## 9. Performance Considerations

### 9.1 CPU-Bound Operations

All L3-L4 operations are CPU-bound. Key considerations:

| Operation | CPU Impact | Mitigation |
|-----------|------------|------------|
| Expression evaluation | 0.1-3ms per expression | Worker pool isolation prevents main thread blocking |
| Decision table evaluation | 5-200ms (10-100 rows) | maxRows=10000, maxEvalTime=5s enforced |
| Workflow simulation | 20-100ms (10 shapes) | Sequential execution, no parallel paths yet |
| UI rendering | 10-50ms per section | Static HTML — minimal CPU |

### 9.2 Worker Pool Sizing

- Pool size formula: `max(1, os.cpus().length - 1)`
- On a 4-core machine: pool size = 3
- On a 2-core machine: pool size = 1 (fallback to in-process may be better)
- Idle worker timeout: 30 seconds

### 9.3 Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Simple expression evaluation | < 1ms | vitest benchmark |
| Decision table (100 rows, 5 conditions) | < 200ms | vitest benchmark |
| Workflow simulation (50 shapes) | < 500ms | vitest benchmark |
| UI section render (100 fields) | < 200ms | vitest benchmark |
| Worker pool throughput (10 concurrent) | < 2s total | PB-03 benchmark |
| Memory after 1000 evaluations | < 50MB increase | Heap measurement |

---

## 10. Appendix

### Contacts

| Role | Name | Contact |
|------|------|---------|
| DevOps Lead | DevOps Agent | Project channel |
| On-Call Dev | DEV Agent | Project channel |

### Related Tickets

| Ticket | Summary | Relationship |
|--------|---------|-------------|
| SA4E-57 | Pega Parser L3-L4 Upgrade | Main ticket |
| SA4E-56 | Unified Code & Pega Rule Indexing Pipeline | Foundation (L1-L2) |
