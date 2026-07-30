# Software Test Plan (STP)

## SDLC Agents 4 Enterprise — SA4E-57: Pega Parser L3-L4 Semantic Understanding & Execution Engine

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-57 |
| Title | Pega Parser L3-L4: Semantic Understanding & Execution Engine |
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
| 1.0 | 2026-07-27 | QA Agent | Initiate document — auto-generated from BRD, FSD, TDD, and upgrade plan |

---

## 1. Introduction

### 1.1 Purpose

This test plan defines the verification strategy for the Pega Parser L3-L4 upgrade across all 7 work packages: expression parser, workflow engine, decision evaluator, UI preview, security hardening, test infrastructure, and deployment/performance.

### 1.2 Test Objectives

- Verify all expression types (property refs, literals, operators, functions) parse and evaluate correctly
- Validate workflow simulation produces correct work item state transitions
- Confirm decision tables/trees evaluate conditions correctly with all operator types
- Ensure UI section renderer produces valid HTML with proper structure and escaping
- Validate security sandbox prevents code execution, DoS, and XSS
- Meet performance targets for all evaluation operations

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | documents/SA4E-57/BRD.md |
| FSD | documents/SA4E-57/FSD.md |
| TDD | documents/SA4E-57/TDD.md |
| Detailed Upgrade Plan | documents/SA4E-56/pega-parser-upgrade-plan.md (Section 8: Test Strategy) |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Responsibility | Tools |
|-------|-------|---------------|-------|
| Unit Testing (UT) | Individual classes: lexer, parser, evaluator, shape handlers, condition operators, layout renderers | Developer | vitest |
| Integration Testing (IT) | Component interactions: expression evaluator + clipboard, workflow engine + graph, decision table + input | Developer + QA | vitest + mock data |
| System Testing (ST) | End-to-end API flows: POST evaluate-expression, POST simulate-flow, POST evaluate-decision | QA Team | vitest + fixture data |
| User Acceptance Testing (UAT) | Business validation: expression evaluation accuracy, workflow path simulation | BA + Business Users | Manual via API docs |
| Security Testing | Expression injection, XSS vectors, sandbox timeout, stack overflow, DoS | Security Team | vitest + attack pattern fixtures |
| Performance Testing | Response times, worker pool throughput, memory usage | DevOps | vitest benchmarks + custom scripts |

### 2.2 Test Types

| Type | Description | Applicable |
|------|-------------|------------|
| Functional Testing | Verify features work per FSD use cases | Yes |
| Regression Testing | Ensure existing L1-L2 features not broken | Yes |
| Property-Based Testing | Random expression generation against random clipboard states | Yes |
| Snapshot Testing | UI renderer HTML output comparison | Yes |
| Performance Testing | Verify response times and throughput | Yes |
| Security Testing | Injection patterns, sandbox validation, timeout checks | Yes |

### 2.3 Test Approach

- **Automation**: All UT, IT, Security, and Performance tests automated via vitest
- **Property-based**: Expression evaluator uses fast-check for random expression + clipboard generation
- **Snapshot**: UI renderer uses vitest snapshot comparison for HTML output
- **Manual**: UAT scenarios executed by BA with documented acceptance criteria
- **Risk-based**: Security tests highest priority — must pass before any execution capability ships

### 2.4 Entry Criteria

| Level | Entry Criteria |
|-------|---------------|
| SIT | All unit tests pass (90%+ coverage for lexer/parser, 85%+ for evaluators), code deployed to SIT |
| UAT | SIT completed with 0 Critical, ≤2 Major defects open, UAT environment ready |

### 2.5 Exit Criteria

| Level | Exit Criteria |
|-------|--------------|
| SIT | 100% test cases executed, 0 Critical defects, ≤2 Major defects open |
| UAT | All UAT scenarios passed, business sign-off obtained |

---

## 3. Test Scope

### 3.1 Features In Scope

| # | Feature / Story | Priority | FSD Reference | Test Type |
|---|----------------|----------|---------------|-----------|
| 1 | Expression lexer tokenization | High | 3.1 | UT, Property-based |
| 2 | Expression parser (all grammar rules) | High | 3.1 | UT, Property-based |
| 3 | Expression evaluator with clipboard context | High | 3.1 | UT, IT, Property-based |
| 4 | Constraint evaluator | High | 3.1 | UT |
| 5 | When evaluator | High | 3.1 | UT |
| 6 | Flow graph building from shapes + connectors | High | 3.2 | UT |
| 7 | Workflow engine simulation (basic flow) | High | 3.2 | IT, ST |
| 8 | Assign shape handler | High | 3.2 | UT |
| 9 | Route shape handler with conditions | High | 3.2 | UT |
| 10 | Approval handler (multi-level chain) | High | 3.2 | UT |
| 11 | SLA engine calculation | Medium | 3.2 | UT |
| 12 | Decision table evaluator (all operators) | High | 3.3 | UT, IT |
| 13 | Decision tree evaluator | High | 3.3 | UT |
| 14 | Decision condition parser | High | 3.3 | UT |
| 15 | Strategy component resolver | Medium | 3.3 | UT |
| 16 | UI section renderer (all layout types) | Medium | 3.4 | UT, Snapshot |
| 17 | UI field renderer + property metadata | Medium | 3.4 | UT, Snapshot |
| 18 | Harness assembler | Medium | 3.4 | UT, Snapshot |
| 19 | Visibility condition evaluator | Medium | 3.4 | UT |
| 20 | Expression sandbox (worker_thread + timeout) | Critical | 3.5 | Security |
| 21 | Expression validator (depth, whitelist) | Critical | 3.5 | Security |
| 22 | HTML sanitizer | Critical | 3.5 | Security |
| 23 | Rate limiter | High | 3.5 | Security |
| 24 | Worker pool dispatch | High | 3.7 | Performance |
| 25 | Evaluation cache | Medium | 3.7 | UT |

### 3.2 Features Out of Scope

| # | Feature | Reason |
|---|---------|--------|
| 1 | Real-time Pega Platform connection | Explicitly out of scope per BRD |
| 2 | Adaptive Decision Models / Scorecards | ML territory — L5 scope |
| 3 | Pixel-perfect Pega UI rendering | Structural HTML preview only |
| 4 | Integration connector execution (Rule-Connect-*) | Explicitly excluded from MVP |
| 5 | Access policy enforcement in production | Security design only |

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
| Expressions | 50+ expression patterns: property refs, literals, operators, functions | Manually created + Pega samples | `fixtures/expressions.ts` |
| Clipboards | Various page structures, typed properties, nested pages | Created per test case | `fixtures/clipboard-contexts.ts` |
| Decision Tables | Rows with =, range, IN, NOT operators; priority ordering | Created from decision table schema | `fixtures/decision-samples.ts` |
| Decision Trees | Simple 2-branch, multi-level with mixed operators | Created from tree schema | `fixtures/decision-samples.ts` |
| Flows | Assign→Route→End, Approval chain, Subprocess, Loop guard | Created from flow schema | `fixtures/flow-samples.ts` |
| UI Sections | Dynamic layout 1-col/2-col, Tab, Repeating | Created from section schema | `fixtures/ui-section-samples.ts` |
| Security | Expression injection attempts, XSS vectors, deep nesting | OWASP patterns + custom | `fixtures/security-attack-patterns.ts` |

### 4.3 External Dependencies

| System | Dependency | Mock/Stub Available |
|--------|-----------|---------------------|
| File system | Pega .pega file reading | Existing test fixtures |
| No external systems | All evaluation is in-memory | N/A |

---

## 5. Test Schedule

| Phase | Start Date | End Date | Duration | Milestone |
|-------|-----------|----------|----------|-----------|
| Test Planning | Week 0 | Week 1 | 1 wk | STP + STC approved |
| Test Data Preparation | Week 1 | Week 3 | 2 wks | All fixture files created |
| Phase A Testing (WP1, WP5) | Week 4 | Week 11 | 8 wks | Expression + Security tests pass |
| Phase B Testing (WP2, WP3) | Week 12 | Week 27 | 16 wks | Workflow + Decision tests pass |
| Phase C Testing (WP4, WP6) | Week 28 | Week 35 | 8 wks | UI snapshot + remaining tests pass |
| Security Pen Test | Week 37 | Week 38 | 2 wks | All security tests pass |
| Performance Benchmarking | Week 39 | Week 40 | 2 wks | Performance targets met |
| UAT | Week 40 | Week 42 | 3 wks | Business sign-off |

---

## 6. Resources & Responsibilities

| Role | Name | Responsibility |
|------|------|---------------|
| Test Lead | QA Agent | Test planning, coordination, reporting |
| QA Engineer | QA Agent | Test case design, execution, defect reporting |
| Developer | DEV Agent | Unit tests, bug fixing |
| BA | BA Agent | UAT support, acceptance criteria clarification |
| Security Expert | Security Agent | Security pen test execution |
| DevOps | DevOps Agent | Performance benchmarking, environment setup |

---

## 7. Risk & Mitigation

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | Real Pega expression samples insufficient | High | Medium | Synthetic fixtures based on Pega docs; property-based testing |
| 2 | Expression grammar gaps found during testing | High | Medium | Iterate grammar as tests reveal gaps; flag unsupported patterns |
| 3 | Worker thread serialization overhead high | Medium | Medium | Benchmark early; fallback to in-process mode |
| 4 | Security tests miss injection vector | Critical | Low | Dedicated attack pattern fixture file; OWASP reference |

---

## 8. Defect Management

### 8.1 Severity Levels

| Severity | Definition | Example |
|----------|-----------|---------|
| Critical | Security bypass, crash, data loss | Sandbox bypass, infinite loop |
| Major | Feature not working, incorrect evaluation | Wrong expression result, workflow stuck |
| Minor | Edge case failure, non-critical bug | Parsing error for obscure syntax |
| Trivial | Typo, formatting, cosmetic | CSS misalignment in UI preview |

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
| Pass Rate | Passed / Executed × 100% | ≥ 95% |
| Defect Density | Defects / Test Cases | ≤ 0.1 |
| Critical Defect Count | Count of Critical severity | 0 |
| Code Coverage (Lexer/Parser) | Line coverage | ≥ 90% |
| Code Coverage (Evaluators) | Line coverage | ≥ 85% |
| Code Coverage (Workflow) | Line coverage | ≥ 80% |
