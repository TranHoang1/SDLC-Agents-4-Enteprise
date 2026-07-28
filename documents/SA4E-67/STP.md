# Software Test Plan (STP)

## SDLC Agents 4 Enterprise — SA4E-67: Semantic Understanding + Reference Analysis

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-67 |
| Title | Semantic Understanding + Reference Analysis |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-07-27 |
| Status | Draft |
| Related BRD | BRD.md |
| Related FSD | FSD.md |
| Related TDD | TDD.md |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-27 | QA Agent | Initiate document — 85 tests across 4 work packages |

---

## 1. Introduction

### 1.1 Purpose

This test plan defines the verification strategy for SA4E-67 Semantic Understanding + Reference Analysis across 4 work packages: PegaSemanticAnalyzer (33 tests), PegaRuleSimulator (15 tests), PegaReferenceExtractor (26 tests), and PegaImpactAnalyzer (11 tests).

### 1.2 Test Objectives

- Verify PegaSemanticAnalyzer produces correct semantic summaries for all 7 rule types (Activity, DT, Flow, Decision, Section, Connect, Declare)
- Validate side effect detection for api_call, page_update, db_write across Activity and Connect rules
- Confirm PegaRuleSimulator produces correct execution traces for Activity, DT, Flow, and DecisionTable rules
- Validate PegaReferenceExtractor extracts all references using all 11 strategies
- Confirm dependency graph construction, cycle detection, and orphan detection produce correct results
- Verify PegaImpactAnalyzer correctly determines scope, risk, and test suggestions
- Meet 100% pass rate across all 85 tests (48 semantic + 37 reference)

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | documents/SA4E-67/BRD.md |
| FSD | documents/SA4E-67/FSD.md |
| TDD | documents/SA4E-67/TDD.md |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Responsibility | Tools |
|-------|-------|---------------|-------|
| Unit Testing (UT) | Individual classes: 4 WP components | Developer | vitest |
| Integration Testing (IT) | Component interactions: simulator + evaluators, extractor + graph, analyzer + graph | Developer + QA | vitest + mock data |
| System Testing (ST) | End-to-end flows: analyze→simulate→extract→impact | QA Team | vitest + fixture data |
| User Acceptance Testing (UAT) | Business validation: semantic summaries accuracy, dependency graph correctness | BA + Business Users | Manual via API docs |
| Performance Testing | Large rule batch processing, graph construction on 100+ rules | DevOps | vitest benchmarks |

### 2.2 Test Types

| Type | Description | Applicable |
|------|-------------|------------|
| Functional Testing | Verify features work per FSD | Yes |
| Regression Testing | Ensure existing L1-L4 features not broken | Yes |
| Edge Case Testing | Empty steps, no actions, unknown rule types | Yes |
| Cycle Detection Testing | Self-loops, mutual cycles, deep cycles | Yes |
| Impact Analysis Testing | Various scope/risk combinations | Yes |

### 2.3 Test Approach

- **Automation**: All 85 tests automated via vitest
- **Fixture-based**: Each test uses pre-defined JSON fixtures for activity, DT, flow, decision, section, connect, declare rules
- **Graph-based**: Dependency graphs verified against expected node/edge counts and cycle/orphan detection
- **Risk-based**: Impact analysis tests cover all scope (local → system) and risk (low → high) combinations

### 2.4 Entry Criteria

| Level | Entry Criteria |
|-------|---------------|
| SIT | All unit tests pass (90%+ coverage for semantic, 85%+ for reference), code deployed to SIT |
| UAT | SIT completed with 0 Critical, ≤2 Major defects open, UAT environment ready |

### 2.5 Exit Criteria

| Level | Exit Criteria |
|-------|--------------|
| SIT | 100% test cases executed, 0 Critical defects, ≤2 Major defects open |
| UAT | All UAT scenarios passed, business sign-off obtained |

---

## 3. Test Scope

### 3.1 Features In Scope

| # | WP | Feature | Priority | Test Count | Test Type |
|---|-----|---------|----------|-----------|-----------|
| 1 | WP1 | Activity semantic analysis (Call/Branch, Property-Set, Obj-Save/Delete, Page-New, when conditions) | High | 5 | UT |
| 2 | WP1 | DataTransform semantic analysis (Set actions, sub-transform refs, when conditions) | High | 4 | UT |
| 3 | WP1 | Flow semantic analysis (shapes, flow actions, when conditions, class refs) | High | 4 | UT |
| 4 | WP1 | Decision semantic analysis (rows, conditions, property evaluated, return actions) | High | 4 | UT |
| 5 | WP1 | Section semantic analysis (field extraction, layout types) | Medium | 3 | UT |
| 6 | WP1 | Connect semantic analysis (URL, method, auth, req/resp classes) | Medium | 3 | UT |
| 7 | WP1 | Declare semantic analysis (expression, target property, property refs) | Medium | 3 | UT |
| 8 | WP2 | Activity simulation (step execution, when-skip, max steps, error handling) | High | 6 | UT, IT |
| 9 | WP2 | DataTransform simulation (action execution, when-skip) | High | 5 | UT, IT |
| 10 | WP2 | Flow simulation (graph build, WorkflowEngine delegation) | High | 5 | UT, IT |
| 11 | WP2 | DecisionTable simulation (condition parsing, evaluator delegation) | High | 6 | UT, IT |
| 12 | WP3 | 11-strategy extraction (MetaModel, known fields, convention suffixes, activity steps, DT actions, flow shapes, pxRuleReferences, declare pages, strategy comps, pyMethodParameters, UI layouts) | High | 11 | UT |
| 13 | WP3 | Dependency graph construction (nodes, edges) | High | 2 | UT |
| 14 | WP3 | Cycle detection (no cycles, self-loop, mutual, deep) | High | 3 | UT, ST |
| 15 | WP3 | Orphan detection (no orphans, some orphans) | Medium | 2 | UT |
| 16 | WP3 | Depth calculation, getDependents, getAllDependents | Medium | 2 | UT |
| 17 | WP4 | Impact scope determination (local → system) | High | 5 | UT |
| 18 | WP4 | Risk assessment (low → high) | High | 5 | UT |
| 19 | WP4 | Test suggestion generation (by risk, by rule type) | Medium | 3 | UT |
| 20 | WP4 | Batch analysis | Medium | 2 | UT |
| 21 | WP4 | DOT graph export | Low | 2 | UT |

### 3.2 Features Out of Scope

| # | Feature | Reason |
|---|---------|--------|
| 1 | Real Pega Platform connection | SA4E-57 scope (REST Bridge) |
| 2 | Live rule execution on Pega | Offline simulation only |
| 3 | UI rendering preview | SA4E-57 scope (L3-L4 UI module) |
| 4 | Security sandboxing | SA4E-57 scope (security module) |

---

## 4. Test Environment

### 4.1 Environment Requirements

| Environment | URL | Database | Purpose |
|-------------|-----|----------|---------|
| DEV | http://127.0.0.1:48721 | Better-SQLite3 local | Developer testing |
| SIT | http://127.0.0.1:48721 | Better-SQLite3 local | QA integration testing |
| CI | vitest in GitHub Actions | None (in-memory tests) | Automated test execution |

### 4.2 Test Data Requirements

| Data Type | Description | Source | Preparation |
|-----------|-------------|--------|-------------|
| Activity Rules | Various steps: Call, Branch, Property-Set, Obj-Save, Page-New, with/without when conditions | Created from Pega schema | `fixtures/activity-*.ts` |
| DataTransform Rules | Set actions, Apply Data Transform, with/without when | Created from DT schema | `fixtures/dat*.ts` |
| Flow Rules | Shapes: Start, Assign, Route, End, Approval with connectors | Created from flow schema | `fixtures/flow-*.ts` |
| Decision Rules | Rows with =, >, <, >=, <=, != operators; with/without return actions | Created from DT schema | `fixtures/decision-*.ts` |
| Section Rules | Dynamic layout, tab layout, fields nested in layouts | Created from section schema | `fixtures/section-*.ts` |
| Connect Rules | REST, SOAP, SQL connectors with various URLs, methods, auth | Created from connect schema | `fixtures/connect-*.ts` |
| Declare Rules | Expressions with property refs, when conditions | Created from declare schema | `fixtures/declare-*.ts` |
| Reference Graphs | Multi-rule collections with known dependency topologies | Manually constructed | `fixtures/graph-*.ts` |

### 4.3 External Dependencies

| System | Dependency | Mock/Stub Available |
|--------|-----------|---------------------|
| No external systems | All analysis/simulation/extraction is in-memory | N/A |

---

## 5. Test Schedule

| Phase | Start Date | End Date | Duration | Milestone |
|-------|-----------|----------|----------|-----------|
| Test Planning | 2026-07-27 | 2026-07-28 | 1 day | STP + STC approved |
| Test Data Preparation | 2026-07-28 | 2026-07-30 | 2 days | All fixture files created |
| WP1 Testing (Semantic Analyzer) | 2026-07-30 | 2026-08-01 | 2 days | 33 tests pass |
| WP2 Testing (Rule Simulator) | 2026-07-30 | 2026-08-01 | 2 days | 15 tests pass |
| WP3 Testing (Reference Extractor) | 2026-08-01 | 2026-08-03 | 2 days | 26 tests pass |
| WP4 Testing (Impact Analyzer) | 2026-08-03 | 2026-08-04 | 1 day | 11 tests pass |
| Integration Testing | 2026-08-06 | 2026-08-07 | 1 day | Cross-WP integration passes |
| UAT | 2026-08-07 | 2026-08-08 | 1 day | Business sign-off |

---

## 6. Resources & Responsibilities

| Role | Name | Responsibility |
|------|------|---------------|
| Test Lead | QA Agent | Test planning, coordination, reporting |
| QA Engineer | QA Agent | Test case design, execution, defect reporting |
| Developer | DEV Agent | Unit tests, bug fixing |
| BA | BA Agent | UAT support, acceptance criteria clarification |

---

## 7. Risk & Mitigation

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | Real Pega rule JSON complexity exceeds test fixtures | Medium | Medium | Fixtures based on actual Pega samples from SA4E-57 pipeline |
| 2 | Expression grammar gaps in simulator when-conditions | Medium | Low | Simulator delegates to existing expression evaluator |
| 3 | Reference extraction misses edge-case patterns | Medium | Low | 11 strategies provide comprehensive coverage |
| 4 | Impact analyzer scope/risk heuristics too simplistic | Low | Low | Heuristics based on standard change management practices |

---

## 8. Defect Management

### 8.1 Severity Levels

| Severity | Definition | Example |
|----------|-----------|---------|
| Critical | Incorrect analysis results lead to wrong decisions | Wrong side effect classification, missed cycle |
| Major | Feature not working correctly | Incorrect dependency count, wrong risk level |
| Minor | Edge case failure, non-critical bug | Missing optional reference, wrong summary wording |
| Trivial | Typo, formatting | Minor text formatting in summary |

### 8.2 Defect Lifecycle

```
New → Open → In Progress → Fixed → Ready for Retest → Verified → Closed
                                                      → Reopened → In Progress
```

---

## 9. Test Metrics & Reporting

| Metric | Formula | Target |
|--------|---------|--------|
| Test Execution Rate | Executed / Total × 100% | 100% |
| Pass Rate | Passed / Executed × 100% | 100% |
| Defect Density | Defects / Test Cases | ≤ 0.05 |
| Critical Defect Count | Count of Critical severity | 0 |
| Code Coverage (Semantic) | Line coverage | ≥ 90% |
| Code Coverage (Reference) | Line coverage | ≥ 85% |

---

## 10. Test Specifications by WP

### WP1: PegaSemanticAnalyzer — 33 Tests

| Test Group | Count | Description |
|-----------|-------|-------------|
| Activity Analysis | 8 | Step count, called activities, set properties, side effects (api_call/db_write/page_update), when conditions, dependencies, data flow, intent |
| DataTransform Analysis | 4 | Property mappings, sub-transform references, when conditions, summary |
| Flow Analysis | 4 | Route description, shape types, flow action dependencies, when conditions |
| Decision Analysis | 5 | Conditions and results, row count + property, data flow, return action deps, summary |
| Section Analysis | 3 | Rendered fields, layout types, field-focused summary |
| Connect Analysis | 3 | Endpoint URL/method/auth, api_call side effect, summary |
| Declare Analysis | 3 | Target property + expression, summary, data flow |
| Generic Analysis | 2 | Unknown type fallback, class definition metadata |
| Dispatch | 1 | Type-based dispatch routing |

### WP2: PegaRuleSimulator — 15 Tests

| Test Group | Count | Description |
|-----------|-------|-------------|
| Activity Simulation | 2 | Multi-step execution trace, when-condition skip |
| DataTransform Simulation | 2 | Action execution, when-condition skip |
| Flow Simulation | 2 | Start-to-end simulation, error on no shapes |
| DecisionTable Simulation | 2 | Evaluation path, no-match handling |
| Expression Evaluation | 2 | Simple property, text property |
| Dispatch | 1 | Route requests by pxObjClass |
| Integration | 1 | Analyzer output informs simulator config |
| Error Handling | 3 | Empty activity, missing steps, unsupported type |

### WP3: PegaReferenceExtractor — 26 Tests

| Test Group | Count | Description |
|-----------|-------|-------------|
| Activity Extraction | 2 | Called activities from steps, non-optional marks |
| DataTransform Extraction | 2 | Transform references, when conditions |
| Flow Extraction | 2 | Flow actions, when conditions |
| Connect Extraction | 2 | Auth profile, request/response transforms |
| Decision Extraction | 1 | Strategy component references |
| Section Extraction | 1 | Layout when conditions |
| Declare Extraction | 2 | Activity reference, when condition |
| buildGraph | 1 | Nodes and edges from multiple rules |
| findCycles | 2 | Simple 2-rule cycle, 3-rule cycle |
| calculateDepth | 1 | Nested chain depth |
| findOrphans | 1 | Unreferenced rules |
| getDependents | 1 | Direct dependents on shared rule |
| Edge Cases | 8 | Empty rule, malformed JSON, partial JSON, convention auto-detection, deduplication, pxRuleReferences, extractPegaName, empty buildGraph |

### WP4: PegaImpactAnalyzer — 11 Tests

| Test Group | Count | Description |
|-----------|-------|-------------|
| Change Analysis | 3 | One dependent, transitive dependents, risk/scope assignment |
| Batch Analysis | 1 | Multiple rules batch |
| Test Suggestions | 2 | Risk-based suggestions, rule-type-specific suggestions |
| DOT Export | 2 | Valid DOT format, optional edges |
| Advanced Scenarios | 3 | No dependents → local scope, unknown rule → safe defaults, scope escalates with multiple types |

---

## 11. Deliberate Test Gap Plan

| Gap | Justification | Mitigation |
|-----|---------------|------------|
| No browser/UI tests | All 4 WPs are pure backend logic | Unit + Integration coverage sufficient |
| No stress/load tests | All operations are single-threaded, in-memory | Performance benchmarks in WP4 DOT export tests |
| No cross-browser tests | Backend only, no browser interaction | N/A |
