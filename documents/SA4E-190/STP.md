# Software Test Plan (STP)

## SDLC Agents 4 Enterprise — SA4E-190: Autonomy L3 Pipeline Automation for SDLC Agents 4 Enterprise

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-190 |
| Title | Autonomy L3 Pipeline Automation for SDLC Agents 4 Enterprise |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-08-23 |
| Status | Draft |
| Related BRD | documents/SA4E-190/BRD.md |
| Related FSD | documents/SA4E-190/FSD.md |
| Related TDD | documents/SA4E-190/TDD.md |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | QA Agent – QA Engineer | Create document |
| Peer Reviewer | TBD – TBD | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-23 | QA Agent | Initiate document — auto-generated from BRD, FSD, and TDD |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm the test plan in this STP |
| | ☐ I agree and confirm the test plan in this STP |

---

## 1. Introduction

### 1.1 Purpose

This Software Test Plan defines the testing strategy, scope, approach, resources, and schedule for validating the Autonomy L3 Pipeline Automation for SDLC Agents 4 Enterprise. The plan covers requirements phase automation including pipeline reset with autonomy level, BRD generation from Jira tickets, diagram creation/export, STATUS.json tracking, and human-in-the-loop approval gates.

### 1.2 Test Objectives

- Verify all functional requirements from FSD UC-01 to UC-04 are implemented correctly
- Validate business rules BR-01 to BR-11 are enforced
- Ensure non-functional requirements: BRD generation < 60s, pipeline reset < 2s, 99% availability
- Verify human-in-the-loop approval gates enforced for L3 autonomy
- Ensure STATUS.json updates with correct timestamps and schema
- Validate Knowledge Base ingestion and Draw.io export integration

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | documents/SA4E-190/BRD.md |
| FSD | documents/SA4E-190/FSD.md |
| TDD | documents/SA4E-190/TDD.md |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Automation | Tools |
|-------|-------|------------|-------|
| PBT | Correctness properties with random inputs | Automated | fast-check |
| UT | Unit/edge case tests for services and controllers | Automated | vitest |
| IT | API integration Hono app in-process | Automated | vitest + Hono `app.request()` |
| E2E-API | REST endpoint E2E real server | Automated | vitest + fetch |
| E2E-UI | Browser UI E2E | Automated | Playwright |
| SIT | Manual exploratory / visual verification only | Manual | Browser |

**E2E Automation Coverage:** CRUD operations for pipeline reset, BRD generation, status updates are automated as E2E-API. UI diagram review flows are automated as E2E-UI where possible. SIT is limited to visual/UX validation of draw.io diagrams and approval gate timing.

### 2.2 Test Types

| Type | Description | Applicable |
|------|-------------|------------|
| Functional Testing | Verify features work per FSD use cases | Yes |
| Business Rule Validation | Verify BR-01 to BR-11 enforcement | Yes |
| Integration Testing | Jira, Knowledge Base, Draw.io CLI | Yes |
| Non-Functional Testing | Performance, availability | Yes |
| Security Testing | Access control, input validation | Yes |
| Regression Testing | Ensure existing pipeline behavior preserved | Yes |

### 2.3 Test Approach

Risk-based testing prioritized by MUST HAVE stories. Automation first for API and unit levels. Property-based tests validate invariant properties of pipeline reset and status updates. E2E-API tests cover real server endpoints. E2E-UI tests cover stakeholder review flows. SIT limited to manual exploratory and visual diagram checks.

### 2.4 Entry Criteria

| Level | Entry Criteria |
|-------|---------------|
| UT/IT | Code merged to develop, unit tests compile |
| E2E-API | Service deployed to SIT, endpoints reachable |
| E2E-UI | UI available, test data seeded |
| SIT | All automated tests passed, test data ready |

### 2.5 Exit Criteria

| Level | Exit Criteria |
|-------|--------------|
| UT/IT/E2E | 100% test cases executed, 0 Critical, ≤2 Major open |
| SIT | 100% SIT cases executed, 0 Critical defects |

### 2.6 Test Cases Summary

| Level | Count | Automated | Manual |
|-------|-------|-----------|--------|
| PBT | 8 | 8 | 0 |
| UT | 24 | 24 | 0 |
| IT | 16 | 16 | 0 |
| E2E-API | 12 | 12 | 0 |
| E2E-UI | 8 | 8 | 0 |
| SIT | 6 | 0 | 6 |
| **Total** | **74** | **68 (92%)** | **6 (8%)** |

---

## 3. Test Scope

### 3.1 Features In Scope

| # | Feature / Story | Priority | FSD Reference | Test Type |
|---|----------------|----------|---------------|-----------|
| 1 | Trigger Pipeline Automation with Autonomy L3 | MUST | UC-01, BR-01..04 | Functional, IT, E2E-API |
| 2 | Generate BRD from Tickets | MUST | UC-02, BR-05..07 | Functional, IT, E2E-API |
| 3 | Configure Autonomy Level and Pipeline Parameters | SHOULD | UC-03, BR-08..09 | Functional, IT, E2E-API |
| 4 | Review Generated Artifacts | MUST | UC-04, BR-10..11 | Functional, E2E-UI, SIT |

### 3.2 Features Out of Scope

| # | Feature | Reason |
|---|---------|--------|
| 1 | Specification, Design, Implementation phases automation | Out of scope per BRD 1.2 |
| 2 | Custom UI development beyond diagram generation | Not in requirements |
| 3 | Integration with external ticketing beyond Jira | Out of scope |

### 3.3 Test Scope Overview

![Test Coverage](diagrams/test-coverage.png)

---

## 4. Test Environment

### 4.1 Environment Requirements

| Environment | URL | Database | Purpose |
|-------------|-----|----------|---------|
| SIT | http://localhost:3000 | SQLite file | System integration testing |
| UAT | http://localhost:3000 | SQLite file | User acceptance testing |

### 4.2 Browser Requirements

| Browser | Version | OS | Required |
|---------|---------|----|----------|
| Chrome | 120+ | Windows | Yes |

### 4.3 Test Data Requirements

| Data Type | Description | Source | Preparation |
|-----------|-------------|--------|-------------|
| Pipeline status | STATUS.json with ticket, autonomyLevel, phase | testdata/pre-seeded-data.csv | Seed before tests |
| BRD template | documents/templates/BRD-TEMPLATE.md | Repo | Exists |
| Draw.io diagrams | .drawio files for business-flow, use-case | Generated | Created by BA Agent |

### 4.4 External Dependencies

| System | Dependency | Mock/Stub Available |
|--------|-----------|---------------------|
| Jira | Ticket metadata read | Mock API responses |
| Knowledge Base | mem_ingest API | Stubbed |
| Draw.io CLI | Export PNG | Real CLI required |

---

## 5. Test Schedule

| Phase | Start Date | End Date | Duration | Milestone |
|-------|-----------|----------|----------|-----------|
| Test Planning | 2026-08-23 | 2026-08-23 | 1 day | STP + STC approved |
| Test Data Preparation | 2026-08-24 | 2026-08-24 | 1 day | Test data ready |
| SIT Execution | 2026-08-25 | 2026-08-26 | 2 days | SIT sign-off |
| Defect Fix & Retest | 2026-08-27 | 2026-08-27 | 1 day | All Critical/Major fixed |
| UAT Execution | 2026-08-28 | 2026-08-28 | 1 day | UAT sign-off |

---

## 6. Resources & Responsibilities

| Role | Name | Responsibility |
|------|------|---------------|
| Test Lead | QA Agent | Test planning, coordination, reporting |
| QA Engineer | QA Agent | Test case design, execution, defect reporting |
| BA | BA Agent | UAT support, acceptance criteria clarification |
| Developer | DEV Agent | Bug fixing, unit test coverage |
| DevOps | DevOps Agent | Environment setup |

---

## 7. Risk & Mitigation

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | Test data not available | High | Medium | Prepare CSV seed data in advance |
| 2 | Draw.io CLI export fails | Medium | Medium | Manual export fallback |
| 3 | STATUS.json schema mismatch | Low | Low | Validate against examples |
| 4 | No Jira description available | Medium | High | Use generic BRD generation |

---

## 8. Defect Management

### 8.1 Severity Levels

| Severity | Definition | Example |
|----------|-----------|---------|
| Critical | System crash, data loss, security breach | Pipeline reset corrupts STATUS.json |
| Major | Feature not working, workaround exists | BRD generation fails |
| Minor | UI issue, cosmetic defect | Diagram label misalignment |
| Trivial | Typo, minor alignment | Text typo in BRD |

### 8.2 Priority Levels

| Priority | Definition | SLA |
|----------|-----------|-----|
| P1 | Must fix immediately | 4 hours |
| P2 | Must fix before release | 1 business day |
| P3 | Should fix if time permits | 3 business days |
| P4 | Nice to fix | Next release |

### 8.3 Defect Lifecycle

New → Open → In Progress → Fixed → Ready for Retest → Verified → Closed

---

## 9. Test Metrics & Reporting

### 9.1 Metrics

| Metric | Formula | Target |
|--------|---------|--------|
| Test Execution Rate | Executed / Total × 100% | 100% |
| Pass Rate | Passed / Executed × 100% | ≥ 95% |
| Defect Density | Defects / Test Cases | ≤ 0.1 |
| Critical Defect Count | Count | 0 |

### 9.2 Reporting Schedule

| Report | Frequency | Audience |
|--------|-----------|----------|
| Daily Test Status | Daily | Project team |
| Defect Summary | Daily | Dev team + PM |
| Test Completion | End of SIT | All stakeholders |

---

## 10. Appendix

### Glossary

| Term | Definition |
|------|------------|
| SIT | System Integration Testing |
| UAT | User Acceptance Testing |
| PBT | Property-Based Testing |
| E2E-API | End-to-End API Testing |

### Assumptions

- Draw.io CLI available at C:\Program Files\draw.io\draw.io.exe
- STATUS.json schema compatible
- Knowledge Base ingestion via mem_ingest available
