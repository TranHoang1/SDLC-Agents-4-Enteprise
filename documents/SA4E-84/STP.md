# Software Test Plan (STP)

## SDLC Agents 4 Enterprise — SA4E-84: [drawio] Upgrade drawio_auto_layout to FIX mode — auto-layout reduce edge crossings with elkjs

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-84 |
| Title | [drawio] Upgrade drawio_auto_layout to FIX mode — auto-layout reduce edge crossings with elkjs |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-08-01 |
| Status | Draft |
| Related BRD | BRD-v1.0-SA4E-84.docx |
| Related FSD | FSD-v1.0-SA4E-84.docx |
| Related TDD | TDD-v1.1-SA4E-84.docx |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | QA Agent – Quality Engineer | Create document |
| Peer Reviewer | SA Agent – Solution Architect | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-01 | QA Agent | Initiate document — auto-generated from BRD, FSD, and TDD |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm the test plan in this STP |
| | ☐ I agree and confirm the test plan in this STP |

---

## 1. Introduction

### 1.1 Purpose

This test plan defines the comprehensive testing approach for upgrading the `drawio_auto_layout` tool from REVIEW-only mode to FIX mode, implementing ELK layout engine integration to auto-fix edge crossings and node overlaps in draw.io diagrams.

### 1.2 Test Objectives

- Verify all functional requirements from BRD and FSD are implemented correctly
- Validate business rules are enforced in both review and apply modes
- Ensure non-functional requirements (performance, maintainability) are met
- Confirm ELK layout engine integration works for edge crossing detection and correction
- Verify existing test suite continues to pass without regression

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1.0-SA4E-84.docx |
| FSD | FSD-v1.0-SA4E-84.docx |
| TDD | TDD-v1.1-SA4E-84.docx |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Responsibility | Tools |
|-------|-------|---------------|-------|
| PBT (Package Based Testing) | Test the drawio tool package in isolation | QA | Vitest, Mock XML |
| UT (Unit Testing) | Individual functions in drawio-tool.ts, elk-layout.ts, drawio-writer.ts, drawio-apply.ts | Developer | Vitest |
| IT (Integration Testing) | Test interactions between components (parser, elk, writer) | Developer | Vitest |
| E2E-API (End-to-End API) | Test complete review→apply workflow with mock XML | QA | Vitest |
| E2E-UI (End-to-End UI) | Test draw.io XML generation via tool (automated PNG export) | QA | Vitest |
| SIT (System Integration Testing) | Full SDLC pipeline integration testing | QA | Vitest |

### 2.2 Test Types

| Type | Description | Applicable |
|------|-------------|------------|
| Functional Testing | Verify features work per FSD use cases | Yes |
| Regression Testing | Ensure existing features are not broken | Yes |
| Performance Testing | Verify ELK layout completes in acceptable time for ≤200 nodes | Yes |
| Security Testing | Verify base64 decode/encode doesn't expose sensitive content | No |
| Reliability Testing | Verify ELK errors are handled gracefully, no broken XML returned | Yes |

### 2.3 Test Approach

Risk-based testing approach prioritizing critical FRs (elkjs integration, ELK apply mode, review mode preservation). Automated testing for all new functionality using Vitest. Manual review for diagram visual verification.

### 2.4 Entry Criteria

| Level | Entry Criteria |
|-------|---------------|
| SIT | Backend implemented with all 12 FRs, unit tests written, test data generated |
| E2E-API | Test cases and data prepared, test execution flow diagram complete |

### 2.5 Exit Criteria

| Level | Exit Criteria |
|-------|---------------|
| SIT | All 39 test cases executed, 0 Critical defects, ≤2 Major defects |
| E2E-API | Test coverage 100% for all FRs, ELK layout working correctly |

---

## 3. Test Scope

### 3.1 Features In Scope

| # | Feature / Story | Priority | FSD Reference | Test Type |
|---|----------------|----------|---------------|-----------|
| 1 | Drawio auto-layout upgrade to FIX mode | MUST HAVE | BRD FR-1..FR-12 | Functional |
| 2 | ELK layered layout integration | MUST HAVE | BRD FR-4, FR-5 | Functional |
| 3 | Review mode preservation | MUST HAVE | BRD FR-2, FR-7 | Regression |
| 4 | Apply mode (ELK layout) | MUST HAVE | BRD FR-3, FR-6 | Functional |
| 5 | Steering file update | SHOULD HAVE | BRD FR-9 | System |

### 3.2 Features Out of Scope

| # | Feature | Reason |
|---|---------|--------|
| 1 | Modifying drawio_export_png | Out of scope — maintain backward compatibility |
| 2 | Adding new layout algorithms beyond ELK | ELK is only new layout engine |

---

## 4. Test Environment

### 4.1 Environment Requirements

| Environment | URL | Database | Purpose |
|-------------|-----|----------|---------|
| Test (dev) | N/A | N/A | Vitest unit and integration tests |

### 4.2 Browser / Device Requirements

| Browser | Version | OS | Required |
|---------|---------|-----|----------|
| Chrome | 90+ | Windows/Mac/Linux | No (backend tests) |

### 4.3 Test Data Requirements

| Data Type | Description | Source | Preparation |
|-----------|-------------|--------|-------------|
| Test XML diagrams | Sample drawio XML with edge crossings and overlaps | Generated | Created in Phase 4 |
| Test data CSV | Mapping, RACI, FR-specific data | Generated | Created in Phase 4 |

### 4.4 External Dependencies

| System | Dependency | Mock/Stub Available |
|--------|-----------|---------------------|
| elkjs | ELK layout engine | Yes (mocked in tests) |
| drawio-parser | XML to DiagramGraph parser | Yes (existing) |
| drawio-writer | XML serialization and base64 encoding | Yes (new) |

---

## 5. Test Schedule

| Phase | Start Date | End Date | Duration | Milestone |
|-------|-----------|----------|----------|-----------|
| Test Planning | 2026-08-01 | 2026-08-01 | 1 day | STP + STC approved |
| Test Data Preparation | 2026-08-01 | 2026-08-01 | 1 day | Test data ready |
| Test Execution | 2026-08-01 | 2026-08-01 | 1 day | Unit tests pass, diagrams generated |
| Defect Fix & Retest | 2026-08-01 | 2026-08-01 | 1 day | All Critical/Major fixed |
| Go-Live | 2026-08-01 | 2026-08-01 | 0 days | Ready for production |

---

## 6. Resources & Responsibilities

| Role | Name | Responsibility |
|------|------|----------------|
| Test Lead | QA Agent | Test planning, coordination, reporting |
| QA Engineer | QA Agent | Test case design, execution, defect reporting |
| Developer | DEV Agent | Bug fixing, unit test coverage |
| DevOps | Not assigned | Environment setup, deployment |

---

## 7. Risk & Mitigation

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | ELK layout fails on complex diagrams with containers | High | Medium | Add fallback to layered layout from drawio-layout.ts |
| 2 | Test coverage gaps for FR-1 (elkjs dependency) | Medium | Low | Automated npm install verification |
| 3 | Review mode behavior regression | High | Low | Comprehensive regression testing |

---

## 8. Defect Management

### 8.1 Severity Levels

| Severity | Definition | Example |
|----------|-----------|---------|
| Critical | ELK layout returns broken XML, tool crashes | Tool returns error instead of valid JSON |
| Major | ELK layout slow (>5s for 200 nodes), missing repositioned_nodes | Apply mode response incomplete |
| Minor | Minor formatting issues, missing documentation | Missing comments in code |
| Trivial | Cosmetic, style issues | Unused imports |

### 8.2 Priority Levels

| Priority | Definition | SLA (Fix Time) |
|----------|-----------|----------------|
| P1 | Must fix immediately for functionality to work | 4 hours |
| P2 | Must fix before release | 1 business day |
| P3 | Should fix if time permits | 3 business days |
| P4 | Nice to fix, can defer | Next release |

### 8.3 Defect Lifecycle

```
New → Open → In Progress → Fixed → Ready for Retest → Verified → Closed
                                            → Reopened → In Progress
```

---

## 9. Test Metrics & Reporting

### 9.1 Metrics

| Metric | Formula | Target |
|--------|---------|--------|
| Test Execution Rate | Executed / Total × 100% | 100% |
| Pass Rate | Passed / Executed × 100% | ≥ 98% |
| Test Coverage | Code lines covered / Total lines × 100% | ≥ 90% |
| Defect Density | Defects / Test Cases | ≤ 0.1 |
| Critical Defect Count | Count of Critical severity | 0 |

### 9.2 Reporting Schedule

| Report | Frequency | Audience |
|--------|-----------|----------|
| Daily Test Status | Daily | Project team |
| Defect Summary | Daily | Dev team + PM |
| Test Completion Report | End of Test Execution | All stakeholders |

---

## 10. Appendix

### Test Coverage Summary

| Level | Count | Status |
|-------|-------|--------|
| PBT | 39 | Ready |
| UT | 39 | Ready |
| IT | 39 | Ready |
| E2E-API | 39 | Ready |
| E2E-UI | 39 | Ready |
| SIT | 39 | Ready |

### Test Execution Flow

All test cases follow the same pattern: generate diagram → call review mode → detect issues → call apply mode → verify fixes → export PNG.