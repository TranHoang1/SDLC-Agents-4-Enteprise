# Deployment Guide (DPG)

## SDLC Agents 4 Enterprise — SA4E-67: Semantic Understanding + Reference Analysis

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-67 |
| Title | Semantic Understanding + Reference Analysis |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2026-07-27 |
| Status | Draft |
| Related TDD | TDD.md |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-27 | DevOps Agent | Initiate document — SA4E-67 semantic + reference deployment |

---

## 1. Overview

### 1.1 Feature Summary

This deployment adds 4 new modules to the existing Pega parser: semantic analysis (summary, intent, side effects), offline rule simulation (Activity, DataTransform, Flow, DecisionTable), reference extraction (11 strategies, dependency graph, cycle detection), and impact analysis (scope, risk, test suggestions). All operations are CPU-bound and in-memory; no database migration required.

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| Pega Module — semantic/ | New | 2 files: PegaSemanticAnalyzer.ts (582 lines), PegaRuleSimulator.ts (476 lines), types.ts (57 lines) |
| Pega Module — references/ | New | 2 files: PegaReferenceExtractor.ts (513 lines), PegaImpactAnalyzer.ts (220 lines) |
| Existing Module Dependencies | No change | PegaExpressionEvaluator, PegaClipboardContext, PegaWorkflowEngine, PegaFlowGraph, PegaDecisionTableEvaluator — already deployed in SA4E-57 |
| Database | No change | All analysis/simulation/extraction is in-memory |

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
| Node.js 18+ | Required | Already satisfied by SA4E-57 deployment |
| No new infrastructure | N/A | Same single-process Hono server |

### 2.2 Software Dependencies

| Dependency | Version | Status |
|-----------|---------|--------|
| Node.js | 18+ | Required |
| Hono | 4.x | Already in project |
| vitest | Latest | Already in devDependencies |
| Pega module (expression, workflow, decision) | SA4E-57 | Required (runtime deps for simulator) |

### 2.3 Backup Requirements

- [ ] Database backup (Better-SQLite3 file) completed before deployment
- [ ] Previous backend build artifact saved

---

## 3. Pre-Deployment Checklist

| # | Item | Responsible | Status |
|---|------|-------------|--------|
| 1 | Code merged to release branch | Developer | ☐ |
| 2 | All 85 unit tests passed | Developer | ☐ |
| 3 | SA4E-57 dependencies (expression, workflow, decision modules) deployed | DevOps | ☐ |
| 4 | Performance benchmarks meet targets | DevOps | ☐ |

---

## 4. Database Migration

No database migration required. All WP1-WP4 operations are in-memory, working on the existing rule JSON stored by SA4E-57.

---

## 5. Application Deployment

### 5.1 Deployment Steps

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Build backend | `npm run build` in `backend/` | Build completes without errors |
| 2 | Run unit tests | `npx vitest run` in `backend/` | All tests pass |
| 3 | Start Hono server | `npm run dev` | Server starts on port 48721 |
| 4 | Verify semantic module | Import `PegaSemanticAnalyzer`, create instance, call `analyze()` with test JSON | SemanticAnalysis returned |
| 5 | Verify simulator module | Import `PegaRuleSimulator`, create instance, call `simulate()` with test Activity | SimulationResult with trace |
| 6 | Verify reference module | Import `PegaReferenceExtractor`, create instance, call `extractFromRule()` | ResolvedDependency[] returned |
| 7 | Verify impact module | Import `PegaImpactAnalyzer`, call `analyzeChange()` with graph | ImpactAnalysis returned |

### 5.2 Docker Deployment (if applicable)

```bash
# Build image
docker build -t sdlc-agents-backend:1.18.0 -f backend/Dockerfile .

# Stop existing container
docker stop sdlc-backend

# Start new container
docker run -d --name sdlc-backend \
  -p 48721:48721 \
  sdlc-agents-backend:1.18.0

# Verify
curl http://127.0.0.1:48721/api/pega/health
```

---

## 6. Configuration Changes

### 6.1 New Environment Variables

No new environment variables required. All 4 modules operate with default configurations.

### 6.2 Feature Flags

| Flag | DEV | SIT | UAT | PROD |
|------|-----|-----|-----|------|
| pega.semanticAnalysis | true | true | true | true |
| pega.ruleSimulation | true | true | true | true |
| pega.referenceExtraction | true | true | true | true |
| pega.impactAnalysis | true | true | true | true |

---

## 7. Post-Deployment Verification

### 7.1 Smoke Tests

| # | Scenario | Steps | Expected Result |
|---|----------|-------|-----------------|
| 1 | Semantic analyze Activity | Create Activity JSON, call `analyze()`, check summary | Summary contains step descriptions and side effects |
| 2 | Simulate Activity | Create Activity JSON with 2 steps, call `simulate()`, check trace | Trace contains 4+ entries (start, step1, step2, complete) |
| 3 | Extract references | Create Activity JSON with Call step, call `extractFromRule()`, check deps | 1+ dependencies of type "activity" with relation "calls" |
| 4 | Build graph | Call `buildGraph()` with 2+ rules, check nodes/edges | Graph with all rules as nodes, references as edges |
| 5 | Impact analyze | Call `analyzeChange()` with a rule name from graph | ImpactAnalysis with scope, risk, test suggestions |
| 6 | DOT export | Call `toDot()` with graph | Valid DOT string starting with "digraph" |

### 7.2 Log Verification

| Log Entry | Level | Expected | Location |
|-----------|-------|----------|----------|
| Semantic analysis completed | INFO | After analyze() call | Application log |
| Simulation completed | INFO | executionTimeMs | Application log |
| Graph built with N nodes, M edges | INFO | After buildGraph() | Application log |

---

## 8. Rollback Plan

### 8.1 Rollback Decision Criteria

| Condition | Action |
|-----------|--------|
| Incorrect semantic analysis results | Immediate rollback if critical |
| Simulation produces wrong execution trace | Immediate rollback |
| Reference extractor misses known reference patterns | Immediate rollback |
| Impact analyzer gives incorrect risk assessment | Rollback if causing wrong change decisions |
| Minor inaccuracies in text summaries | Hotfix — no rollback |

### 8.2 Rollback Steps

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Disable feature flags | Set all pega.* flags to false | Feature endpoints return 404 or fallback |
| 2 | Deploy previous build | Restore previous backend artifact | Health check passes |
| 3 | Verify L1-L3 still working | Run existing semantic tests | Pipeline completes |

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

| Operation | CPU Impact | Mitigation |
|-----------|------------|------------|
| Semantic analysis (Activity with 50 steps) | 1-5ms | Single-threaded, in-memory |
| Rule simulation (Activity with 50 steps) | 5-20ms | Configurable maxSteps (default 100) |
| Reference extraction (single rule) | 1-10ms | O(props + steps + actions + shapes) |
| Graph construction (100 rules) | 10-100ms | O(rules × deps) |
| Cycle detection (100 nodes, 200 edges) | 1-5ms | O(V + E) — DFS |
| Impact analysis | 1-10ms | O(V + E) per change |

### 9.2 Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Single rule semantic analysis | < 5ms | vitest benchmark |
| Single rule simulation | < 20ms | vitest benchmark |
| Single rule reference extraction | < 10ms | vitest benchmark |
| Graph construction (100 rules) | < 100ms | vitest benchmark |
| Cycle detection (1000 nodes) | < 50ms | vitest benchmark |
| Impact analysis (single rule) | < 10ms | vitest benchmark |

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
| SA4E-67 | Semantic Understanding + Reference Analysis | Main ticket |
| SA4E-57 | Pega Parser L3-L4 (Expression, Workflow, Decision) | Foundation (runtime deps) |
| SA4E-56 | Unified Code & Pega Rule Indexing Pipeline | Foundation (KB storage) |
