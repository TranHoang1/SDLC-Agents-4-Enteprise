# Software Test Plan (STP)

## SDLC Agents 4 Enterprise — SA4E-66: Pega Rule Type Coverage — 7 Parser Modules

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-66 |
| Title | Pega Rule Type Coverage — 7 Parser Modules |
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
| 1.0 | 2026-07-27 | QA Agent | Initiate document — 172 tests across 6 parser modules |

---

## 1. Introduction

### 1.1 Purpose

This test plan defines the verification strategy for the Pega Rule Type Coverage expansion across all 6 parser modules: Connect, Declare, Access, Portal, Decisioning, and Misc, plus the DefaultPegaParserStrategy fallback.

### 1.2 Test Objectives

- Verify all 7 parser modules correctly parse their respective rule types into typed ASTs
- Validate the ParserRegistry correctly resolves `pxObjClass` patterns to the appropriate strategy
- Confirm the DefaultPegaParserStrategy fallback produces valid parse results for unrecognized rule types
- Ensure edge cases (empty JSON, missing fields, malformed data) are handled gracefully
- Meet 100% pass rate across all 172 tests

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | documents/SA4E-66/BRD.md |
| FSD | documents/SA4E-66/FSD.md |
| TDD | documents/SA4E-66/TDD.md |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Responsibility | Tools |
|-------|-------|---------------|-------|
| Unit Testing (UT) | Individual parser strategies, registry resolution, AST construction | Developer | vitest |
| Integration Testing (IT) | End-to-end parse flow: raw JSON → registry → parser → AST | Developer + QA | vitest + fixture data |
| Edge Case Testing | Empty JSON, missing fields, malformed payloads, null values | QA | vitest + fixture data |
| Regression Testing | Ensure existing L1-L2 parsers still function correctly | QA | vitest |

### 2.2 Test Types

| Type | Description | Applicable |
|------|-------------|------------|
| Functional Testing | Verify each parser produces correct AST for valid input | Yes |
| Edge Case Testing | Empty objects, missing required fields, unexpected types | Yes |
| Registry Resolution | Verify pxObjClass → correct strategy mapping | Yes |
| DefaultPegaParserStrategy Fallback | Verify catch-all produces valid ParseResult | Yes |
| Regression Testing | Ensure no breakage in existing parsers | Yes |

### 2.3 Test Approach

- **Automation**: All tests automated via vitest
- **Fixture Data**: Each parser module has dedicated fixture files with sample rule JSON payloads
- **Snapshot Testing**: AST output comparison for deterministic parsers

### 2.4 Entry Criteria

| Level | Entry Criteria |
|-------|---------------|
| SIT | All unit tests pass (90%+ coverage per module), code deployed to SIT |

### 2.5 Exit Criteria

| Level | Exit Criteria |
|-------|--------------|
| SIT | 100% test cases executed, 0 Critical defects, ≤2 Major defects open |

---

## 3. Test Scope

### 3.1 Features In Scope

| # | Feature | Module | Tests | Priority |
|---|---------|--------|-------|----------|
| 1 | Connect Parser — REST/SOAP/SQL/File strategies | connect/ | 20 | High |
| 2 | Declare Parser — Expression/OnChange/Trigger/Decision | declare/ | 30 | High |
| 3 | Access Parser — AccessGroup/Role/Privilege/OperatorID | access/ | 33 | High |
| 4 | Portal Parser — Section/Harness/FlowAction/Portal/Skin | portal/ | 23 | High |
| 5 | Decisioning Parser — Strategy/NBA/Offer/Proposition | decisioning/ | 37 | High |
| 6 | Misc Parser — 15+ catch-all rule types (includes Data+Process) | misc/ | 29 | High |
| 7 | DefaultPegaParserStrategy Fallback | strategies/ | Included | Critical |
| 8 | PegaParserRegistry Resolution | strategies/ | Included | High |
| **Total** | | | **172** | |

### 3.2 Features Out of Scope

| # | Feature | Reason |
|---|---------|--------|
| 1 | Pega runtime execution | Parser only — no evaluation |
| 2 | Pega Bridge REST Services | SA4E-57 scope |
| 3 | Remote Pega Platform connectivity | Parser only — local operation |

---

## 4. Test Environment

### 4.1 Environment Requirements

| Environment | URL | Database | Purpose |
|-------------|-----|----------|---------|
| DEV | http://127.0.0.1:48721 | Better-SQLite3 local | Developer testing |
| CI | vitest in GitHub Actions | None (in-memory tests) | Automated test execution |

### 4.2 Test Data Requirements

| Data Type | Description | Source | Preparation |
|-----------|-------------|--------|-------------|
| Connect Fixtures | Sample REST/SOAP/SQL rule JSON | Pega samples + synthetic | `fixtures/connect-samples.ts` |
| Declare Fixtures | Expression/OnChange/Decision samples | Pega samples + synthetic | `fixtures/declare-samples.ts` |
| Access Fixtures | AccessGroup/Role/OperatorID samples | Pega samples + synthetic | `fixtures/access-samples.ts` |
| Portal Fixtures | Section/Harness/FlowAction samples | Pega samples + synthetic | `fixtures/portal-samples.ts` |
| Decisioning Fixtures | Strategy/NBA/Offer samples | Pega samples + synthetic | `fixtures/decisioning-samples.ts` |
| Misc Fixtures | CaseType/Stage/Report/Utility samples | Pega samples + synthetic | `fixtures/misc-samples.ts` |
| Edge Case Fixtures | Empty, missing fields, malformed JSON | Manually created | `fixtures/edge-cases.ts` |

---

## 5. Test Schedule

| Phase | Start Date | End Date | Duration | Milestone |
|-------|-----------|----------|----------|-----------|
| Test Planning | Week 0 | Week 1 | 1 wk | STP + STC approved |
| Test Data Preparation | Week 1 | Week 2 | 1 wk | All fixture files created |
| Phase A Testing (Connect + Declare) | Week 2 | Week 4 | 2 wks | 50 tests pass |
| Phase B Testing (Access + Portal) | Week 4 | Week 6 | 2 wks | 56 tests pass |
| Phase C Testing (Decisioning + Misc, incl. fallback) | Week 6 | Week 8 | 2 wks | 66 tests + fallback pass |
| Regression Testing | Week 8 | Week 9 | 1 wk | All 172 tests pass |

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
| 1 | Real Pega rule samples for some types are scarce | Medium | Medium | Synthetic fixtures based on Pega documentation |
| 2 | Parser registry ordering causes wrong strategy match | High | Low | Explicit tests for pxObjClass resolution order |
| 3 | DefaultPegaParserStrategy fallback produces incorrect result for edge cases | Medium | Medium | Comprehensive edge case fixture coverage |

---

## 8. Defect Management

### 8.1 Severity Levels

| Severity | Definition | Example |
|----------|-----------|---------|
| Critical | Wrong AST output, registry resolution failure | Wrong strategy selected for pxObjClass |
| Major | Specific rule type fails to parse | Parse error on valid rule JSON |
| Minor | Edge case failure, non-critical bug | Truncated field value in AST |
| Trivial | Typo, formatting, cosmetic | Incorrect field name in metadata |

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
| Code Coverage (Parsers) | Line coverage | ≥ 90% |
| Code Coverage (Registry) | Line coverage | ≥ 95% |
