# Software Test Plan (STP)

## SDLC Agents 4 Enterprise — SA4E-65: Pega MetaModel Engine

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-65 |
| Title | Pega MetaModel Engine — Auto-Schema Loading & Runtime Strategy Compilation |
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
| 1.0 | 2026-07-27 | QA Agent | Initiate document — auto-generated from BRD, FSD, TDD |

---

## 1. Introduction

### 1.1 Purpose

This test plan defines the verification strategy for the Pega MetaModel Engine across 2 work packages: schema loading with inheritance resolution (WP1) and strategy compilation (WP2).

### 1.2 Test Objectives

- Verify 239+ schema files are loaded correctly from the schema directory
- Validate inheritance chain resolution merges parent properties/children recursively
- Confirm strategy compilation produces correct IPegaRuleParserStrategy instances
- Verify wildcard matching (@baseclass, prefix categories, inheritance chain)
- Ensure dependency detection works for reference fields
- Validate error handling for edge cases (missing files, unknown classes, empty schemas)

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | documents/SA4E-65/BRD.md |
| FSD | documents/SA4E-65/FSD.md |
| TDD | documents/SA4E-65/TDD.md |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Responsibility | Tools |
|-------|-------|---------------|-------|
| Unit Testing (UT) | Individual classes: loader, registry, compiler, service | Developer | vitest |
| Integration Testing (IT) | Component interactions: loader→registry, compiler→registry→parser | Developer + QA | vitest + real schema files |

### 2.2 Test Types

| Type | Description | Applicable |
|------|-------------|------------|
| Functional Testing | Verify features work per BRD/FSD requirements | Yes |
| Regression Testing | Ensure existing strategy parsing not broken | Yes |
| Error Handling | Malformed JSON, missing files, null values | Yes |
| Integration Testing | Full initialization pipeline (load→compile→register) | Yes |

### 2.3 Test Approach

- **Automation**: All 41 tests automated via vitest
- **Data-driven**: Tests use real schema files from `schemas/` directory
- **Edge cases**: Missing directories, empty objects, null values, unknown classes

### 2.4 Entry Criteria

| Level | Entry Criteria |
|-------|---------------|
| SIT | All unit tests pass (90%+ coverage), code deployed to SIT |

### 2.5 Exit Criteria

| Level | Exit Criteria |
|-------|--------------|
| SIT | 100% test cases executed, 0 Critical defects, ≤2 Major defects open |

---

## 3. Test Scope

### 3.1 Features In Scope

| # | Feature / Story | Priority | FSD Reference | Test Type |
|---|----------------|----------|---------------|-----------|
| 1 | Schema directory loading | High | 3.2 | UT |
| 2 | Class definition parsing | High | 3.2 | UT |
| 3 | Inheritance chain resolution (1-level) | High | 3.2 | UT |
| 4 | Inheritance chain resolution (multi-level to @baseclass) | High | 3.2 | UT |
| 5 | Property merging (parent→child) | High | 3.2 | UT |
| 6 | Child definition merging | High | 3.2 | UT |
| 7 | Class lookup (known class) | High | 3.3 | UT |
| 8 | Class lookup (unknown class returns undefined) | High | 3.3 | UT |
| 9 | getAllClasses enumeration | High | 3.3 | UT |
| 10 | Singleton registry pattern | High | 3.3 | UT |
| 11 | Registry lazy initialization | High | 3.3 | UT |
| 12 | Runtime registerClass API | High | 3.3 | UT |
| 13 | Strategy compilation (single class) | High | 3.4 | UT |
| 14 | Strategy supports() — exact match | High | 3.4 | UT |
| 15 | Strategy supports() — @baseclass wildcard | High | 3.4 | UT |
| 16 | Strategy supports() — prefix category (- ending) | High | 3.4 | UT |
| 17 | Strategy supports() — inheritance chain | High | 3.4 | UT |
| 18 | compileAll returns 175+ strategies | High | 3.4 | UT |
| 19 | Strategy specificity ordering | High | 3.4 | UT |
| 20 | Parse symbol extraction | High | 3.4 | UT |
| 21 | Reference dependency detection | High | 3.4 | UT |
| 22 | Dependency deduplication | High | 3.4 | UT |
| 23 | PegaParserRegistry integration | High | 3.4 | IT |
| 24 | PegaMetaModelService initialization | High | 3.5 | IT |
| 25 | Service idempotent initialization | Medium | 3.5 | UT |
| 26 | Missing directory handling | Medium | 3.2 | UT |
| 27 | Invalid schema file handling | Medium | 3.2 | UT |
| 28 | Empty JSON object parsing | Medium | 3.4 | UT |
| 29 | Null/undefined value handling | Medium | 3.4 | UT |
| 30 | Minimally populated JSON parsing | Medium | 3.4 | UT |

### 3.2 Features Out of Scope

| # | Feature | Reason |
|---|---------|--------|
| 1 | PegaSchemaInferrer (Layer 2) | Future ticket, not in current scope |
| 2 | PegaSchemaKBService (Layer 3) | Future ticket, not in current scope |
| 3 | Real Pega Platform connection | Explicitly out of scope per BRD |
| 4 | Performance benchmarking | Not required for MVP |

---

## 4. Test Environment

### 4.1 Environment Requirements

| Environment | URL | Database | Purpose |
|-------------|-----|----------|---------|
| DEV | http://127.0.0.1:48721 | Better-SQLite3 local | Developer testing |
| SIT | http://127.0.0.1:48721 | Better-SQLite3 local | QA integration testing |
| CI | vitest | None (in-memory tests) | Automated test execution |

### 4.2 Test Data Requirements

| Data Type | Description | Source | Preparation |
|-----------|-------------|--------|-------------|
| Schema files | 239+ JSON files in schemas/ directory | Project source | Existing in repository |
| Sample JSON | Activity, REST, DecisionTable instances | Test fixtures | Created per test case |

### 4.3 External Dependencies

| System | Dependency | Mock/Stub Available |
|--------|-----------|---------------------|
| File system | Schema directory reading | Real files used |

---

## 5. Test Schedule

| Phase | Start Date | End Date | Duration | Milestone |
|-------|-----------|----------|----------|-----------|
| Test Planning | Week 0 | Week 1 | 1 wk | STP + STC approved |
| WP1 Testing | Week 1 | Week 2 | 2 wks | 23 loader + registry tests pass |
| WP2 Testing | Week 2 | Week 3 | 2 wks | 18 compiler + service tests pass |

---

## 6. Resources & Responsibilities

| Role | Name | Responsibility |
|------|------|---------------|
| Test Lead | QA Agent | Test planning, coordination, reporting |
| QA Engineer | QA Agent | Test case design, execution, defect reporting |
| Developer | DEV Agent | Unit tests, bug fixing |

---

## 7. Risk & Mitigation

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | Schema file missing in directory | High | Low | Loader handles gracefully (empty registry) |
| 2 | Circular inheritance chain | Medium | Low | resolved Set prevents infinite recursion |
| 3 | Malformed schema JSON | Medium | Low | loadSchemaFile returns null on parse failure |
| 4 | New schema breaks existing parsing | Medium | Medium | compileAll tests verify 175+ strategies |

---

## 8. Defect Management

### 8.1 Severity Levels

| Severity | Definition | Example |
|----------|-----------|---------|
| Critical | Crash, data loss, incorrect parsing | Wrong symbol extraction, cyclic infinite loop |
| Major | Feature not working | Inheritance not resolved, strategy fails to match |
| Minor | Edge case failure | Null value in non-critical field |
| Trivial | Typo, formatting | Incomplete dependency detection for obscure pattern |

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
| Critical Defect Count | Count of Critical severity | 0 |
| Code Coverage (Loader) | Line coverage | ≥ 90% |
| Code Coverage (Compiler) | Line coverage | ≥ 85% |
