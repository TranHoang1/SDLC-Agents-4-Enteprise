# Release Notes (RLN)

## SDLC Agents 4 Enterprise — SA4E-57: Pega Parser L3-L4 Semantic Understanding & Execution Engine

---

## Release Information

| Field | Value |
|-------|-------|
| Release Version | 1.17.0 |
| Release Date | 2026-07-27 |
| Jira Ticket | SA4E-57 |
| Environment | DEV / SIT / UAT / PROD |
| Author | DevOps Agent |
| Status | Draft |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-27 | DevOps Agent | Initiate document |

---

## 1. What's New

### 1.1 Feature Summary

Version 1.17.0 upgrades the Pega Parser module from knowledge-level understanding (L1-L2) to semantic understanding and execution (L3-L4). The system can now parse, understand, and evaluate Pega clipboard expressions, simulate workflow execution, evaluate decision tables and trees, render UI section previews, and execute all evaluation in a hardened security sandbox.

### 1.2 User-Facing Changes

| # | Change | Description | Impact |
|---|--------|-------------|--------|
| 1 | Expression Evaluation API | POST /api/pega/evaluate-expression — parse and evaluate Pega clipboard expressions | High |
| 2 | Workflow Simulation API | POST /api/pega/simulate-flow — simulate work item progression through flows | High |
| 3 | Decision Evaluation API | POST /api/pega/evaluate-decision — evaluate decision tables and trees | High |
| 4 | UI Section Preview | HTML rendering of Pega UI sections and harnesses | Medium |
| 5 | Security Sandbox | All evaluation runs in isolated worker_threads with timeout and function whitelist | Critical |

---

## 2. Technical Changes

### 2.1 API Changes

| Type | Endpoint | Method | Description |
|------|----------|--------|-------------|
| New | /api/pega/evaluate-expression | POST | Evaluate a Pega clipboard expression |
| New | /api/pega/simulate-flow | POST | Simulate workflow execution through a flow graph |
| New | /api/pega/evaluate-decision | POST | Evaluate a decision table or tree |
| New | /api/pega/health | GET | Health check with worker pool status |

### 2.2 Database Changes

| Type | Object | Description |
|------|--------|-------------|
| No change | — | All L3-L4 evaluation is in-memory. No database migration required. |

### 2.3 Configuration Changes

| Property | Change Type | Description |
|----------|-----------|-------------|
| PEGA_WORKER_POOL_SIZE | New | Worker thread pool size (default: os.cpus().length - 1) |
| PEGA_SANDBOX_TIMEOUT_MS | New | Per-evaluation timeout in ms (default: 5000) |
| PEGA_MAX_DECISION_ROWS | New | Max rows in decision tables (default: 10000) |
| PEGA_DEPLOYMENT_MODE | New | "worker-pool" or "in-process" (default: worker-pool) |
| PEGA_CACHE_TTL_MS | New | Evaluation cache TTL in ms (default: 300000) |
| PEGA_CACHE_MAX_ENTRIES | New | Max cached evaluations (default: 1000) |
| PEGA_MAX_EVAL_DEPTH | New | Max expression nesting depth (default: 100) |
| PEGA_RATE_LIMIT_RPM | New | Rate limit per user per minute (default: 100) |

### 2.4 Infrastructure Changes

| Component | Change | Description |
|-----------|--------|-------------|
| Backend (Hono) | Modified | 3 new API routes added |
| Worker Threads | New | Worker pool for sandboxed evaluation |
| No new services | — | All within existing process |

### 2.5 New Files Added

```
backend/src/modules/pega/
├── expression/ (7 files)
├── workflow/ (10 files)
│   └── shapes/ (5+ files)
├── decision/ (6 files)
├── ui/ (8 files)
│   └── layouts/ (4 files)
├── security/ (6 files)
└── deploy/ (4 files)
```

---

## 3. Bug Fixes

No bug fixes included in this release.

---

## 4. Known Issues & Limitations

| # | Issue | Impact | Workaround | Target Fix |
|---|-------|--------|------------|------------|
| 1 | Workflow simulation supports sequential paths only (no parallel split-join) | Medium — parallel flows cannot be simulated | N/A (post-MVP feature) | Future release |
| 2 | UI preview is structural HTML only (not pixel-perfect) | Low — shows layout structure, not exact rendering | N/A (by design) | N/A |
| 3 | Expression grammar may have gaps — undocumented Pega patterns may fail to parse | Medium — some real expressions may error | Flag unsupported patterns; add to grammar iteratively | Ongoing |
| 4 | Worker pool fixed size (no auto-scaling) | Low — manual sizing per environment | Configure PEGA_WORKER_POOL_SIZE appropriately | Future release |
| 5 | Decision trees limited to 50 levels depth | Low — realistic trees rarely exceed 10 levels | Restructure very deep trees | N/A |

---

## 5. Dependencies

### 5.1 Pre-requisite Releases

| Release | Version | Status | Required Before |
|---------|---------|--------|-----------------|
| SA4E-56 (L1-L2 Foundation) | 1.16.0 | In Progress | This release |

### 5.2 External System Changes

| System | Change Required | Status | Contact |
|--------|----------------|--------|---------|
| None | All evaluation is in-memory, no external system dependencies | N/A | N/A |

---

## 6. Migration Notes

### 6.1 Data Migration

| Migration | Description | Automated | Estimated Time |
|-----------|-------------|-----------|----------------|
| None | No data migration — all evaluation is in-memory | N/A | N/A |

### 6.2 Breaking Changes

No breaking changes in this release. Fully backward compatible. All existing L1-L2 APIs continue to work unchanged. The 3 new endpoints are additive.

### 6.3 Backward Compatibility

Fully backward compatible. Existing L1-L2 APIs (`/api/index/source`, etc.) are unaffected.

---

## 7. Testing Summary

| Test Level | Total | Passed | Failed | Blocked | Pass Rate |
|-----------|-------|--------|--------|---------|-----------|
| Unit Tests (Expression) | 50+ | — | — | — | Target ≥ 90% |
| Unit Tests (Workflow) | 30+ | — | — | — | Target ≥ 80% |
| Unit Tests (Decision) | 25+ | — | — | — | Target ≥ 85% |
| Unit Tests (UI) | 20+ | — | — | — | Target ≥ 80% |
| Security Tests | 20+ | — | — | — | Target 100% |
| Integration Tests | 15+ | — | — | — | Target ≥ 85% |
| Performance Benchmarks | 8 | — | — | — | All targets met |

---

## 8. Deployment Instructions

See: [Deployment Guide](DPG.md)

### Quick Reference

| Step | Action | Estimated Time |
|------|--------|---------------|
| 1 | Build backend (`npm run build`) | 2 minutes |
| 2 | Update environment configuration | 5 minutes |
| 3 | Deploy artifact | 1 minute |
| 4 | Health check + smoke tests | 5 minutes |
| **Total** | | **13 minutes** |

---

## 9. Rollback Plan

See: [Deployment Guide](DPG.md) §8

**Rollback Decision Criteria:**
- Security sandbox bypass detected → Immediate rollback
- Worker thread crash causes process exit → Immediate rollback
- Incorrect evaluation results → Immediate rollback
- Performance degradation > 50% for existing APIs → Immediate rollback

**Estimated Rollback Time:** 16 minutes

---

## 10. Contacts

| Role | Name | Contact | Responsibility |
|------|------|---------|---------------|
| Release Manager | SM Agent | Project channel | Release coordination |
| Dev Lead | DEV Agent | Project channel | Technical issues |
| QA Lead | QA Agent | Project channel | Testing sign-off |
| DevOps | DevOps Agent | Project channel | Deployment execution |
| Business Owner | BA Agent | Project channel | Business sign-off |

---

## 11. Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Dev Lead | | | ☐ Approved |
| QA Lead | | | ☐ Approved |
| Business Owner | | | ☐ Approved |
| Release Manager | | | ☐ Approved |
