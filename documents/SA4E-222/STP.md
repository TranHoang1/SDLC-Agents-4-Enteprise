# Software Test Plan (STP)

## SA4E-222 — Generic self-learning Pega rule understanding for LLM enrichment + rule generation

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-222 |
| Title | Generic self-learning Pega rule understanding for LLM enrichment + rule generation |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-08-27 |
| Status | Draft |
| Related BRD | BRD-v1-SA4E-222.docx |
| Related FSD | FSD-v1-SA4E-222.docx |
| Related TDD | TDD-v1-SA4E-222.docx |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | QA Agent – QA Engineer | Create document |
| Peer Reviewer | SA Agent – Solution Architect | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-27 | QA Agent | Initiate document — auto-generated from BRD, FSD, and TDD |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm the test plan in this STP |
| | ☐ I agree and confirm the test plan in this STP |

---

## 1. Introduction

### 1.1 Purpose

Define the test strategy and scope for verifying the generic self-learning Pega rule understanding layer (Scopes A/B/C) and its integration into the enrichment pipeline.

### 1.2 Test Objectives

- Verify all functional requirements from FSD use cases (UC-01..UC-07) are implemented.
- Validate business rules (BR-A-*, BR-B-*, BR-C-*) are enforced.
- Ensure non-functional requirements (performance, IP paraphrase, reliability) are met.
- Confirm DISC-1 is resolved (canonical schema key discoverable by renderers).

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-SA4E-222.docx |
| FSD | FSD-v1-SA4E-222.docx |
| TDD | TDD-v1-SA4E-222.docx |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Responsibility | Tools |
|-------|-------|---------------|-------|
| Unit Testing | Individual functions/classes (extractors, renderer, storage, ingestor, retriever) | Developer | Vitest |
| Integration Testing | CodeEnrichmentHandler orchestration, KB read/write, mem_search retrieval | Developer + QA | Vitest + test KB |
| System Testing (SIT) | End-to-end enrichment with learned schema + doc grounding | QA Team | Manual + Vitest |
| UAT | Business validation of enrichment quality | BA + Business Users | Manual |

### 2.2 Test Types

| Type | Description | Applicable |
|------|-------------|------------|
| Functional Testing | Verify features per FSD use cases | Yes |
| Regression Testing | Ensure SA4E-214 schema behavior still works | Yes |
| Performance Testing | Extraction latency, concept retrieval latency | Yes |
| Security Testing | IP paraphrase-only doc ingestion, scope isolation | Yes |
| Usability Testing | N/A (no UI) | No |
| Compatibility Testing | N/A | No |

### 2.3 Test Approach

Automated unit + integration tests for deterministic logic (Scopes A/B-extract/C). LLM-dependent paths (B schema creation, C summarization) tested with mocked LLM/fetcher to keep tests deterministic and offline. SIT exercises the full pipeline with a real or stubbed LLM.

### 2.4 Entry Criteria

| Level | Entry Criteria |
|-------|---------------|
| SIT | Code deployed to SIT, unit + integration tests passed, KB seeded with sample schemas/docs |
| UAT | SIT completed with no Critical/Major defects open |

### 2.5 Exit Criteria

| Level | Exit Criteria |
|-------|--------------|
| SIT | 100% planned test cases executed, 0 Critical defects, ≤2 Major defects open |
| UAT | All UAT scenarios passed, business sign-off obtained |

---

## 3. Test Scope

### 3.1 Features In Scope

| # | Feature / Story | Priority | FSD Reference | Test Type |
|---|----------------|----------|---------------|-----------|
| 1 | Generic logic extraction (A) | High | UC-01 | Functional/Unit |
| 2 | Self-learning schema creation (B) | High | UC-02 | Unit (mocked LLM) |
| 3 | Schema-driven rendering (B) | High | UC-03 | Functional/Unit |
| 4 | Canonical schema storage / DISC-1 fix (B) | High | UC-04 | Integration |
| 5 | Pega doc ingestion (C) | High | UC-05 | Unit (injected store) |
| 6 | Pega concept retrieval (C) | High | UC-06 | Integration |
| 7 | Re-enrichment backfill (B/C) | Medium | UC-07 | Ops/Manual |

### 3.2 Features Out of Scope

| # | Feature | Reason |
|---|---------|--------|
| 1 | Rule-generation pipeline | Out of scope (only grounding primitive delivered) |
| 2 | UI for schema browsing | Not part of this ticket |

---

## 4. Test Environment

### 4.1 Environment Requirements

| Environment | URL | Database | Purpose |
|-------------|-----|----------|---------|
| SIT | backend test instance | test SQLite KB | System Integration Testing |
| UAT | backend UAT instance | UAT SQLite KB | User Acceptance Testing |

### 4.2 Browser / Device Requirements

N/A (backend-only feature).

### 4.3 Test Data Requirements

| Data Type | Description | Source | Preparation |
|-----------|-------------|--------|-------------|
| Sample Pega rule JSON | Activity/DataTransform/Decision bodies | fixture files | Committed test fixtures |
| docs.pega.com pages | Concept pages | fixture text | Stored in tests (no live fetch) |
| KB seed schemas | Pre-stored `pega-schema:{ruleType}` | test setup | Inserted in beforeEach |

### 4.4 External Dependencies

| System | Dependency | Mock/Stub Available |
|--------|-----------|---------------------|
| LLMService | Schema creation, summarization | Yes — mocked in unit tests |
| docs.pega.com | Doc fetch | Yes — injected fetcher returns fixture |

---

## 5. Test Schedule

| Phase | Start Date | End Date | Duration | Milestone |
|-------|-----------|----------|----------|-----------|
| Test Planning | 2026-08-27 | 2026-08-27 | 1d | STP + STC approved |
| Test Data Preparation | 2026-08-27 | 2026-08-28 | 1d | Fixtures ready |
| SIT Execution | 2026-08-28 | 2026-08-30 | 2d | SIT sign-off |
| Defect Fix & Retest | 2026-08-31 | 2026-09-01 | 1d | All Critical/Major fixed |
| UAT Execution | 2026-09-02 | 2026-09-03 | 1d | UAT sign-off |

---

## 6. Resources & Responsibilities

| Role | Name | Responsibility |
|------|------|---------------|
| Test Lead | QA Agent | Test planning, coordination, reporting |
| QA Engineer | QA Agent | Test case design, execution, defect reporting |
| BA | BA Agent | UAT support, acceptance criteria clarification |
| Developer | DEV Agent | Bug fixing, unit test coverage |
| DevOps | DevOps Agent | Environment setup, backfill runs |

---

## 7. Risk & Mitigation

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | LLM returns low-quality schema | Medium | Medium | Generic fallback; `parseLlmSchema` defaults; `update` can overwrite |
| 2 | DISC-1 regression | High | Low | Canonical key single-writer; regression test TC-701 |
| 3 | Doc ingestion copies verbatim (IP) | High | Low | Summarizer paraphrase + `Source:` assertion in TC-502 |
| 4 | Test data not available | Medium | Low | Fixtures committed in repo |

---

## 8. Defect Management

### 8.1 Severity Levels

| Severity | Definition | Example |
|----------|-----------|---------|
| Critical | Enrichment broken for all rules | Schema store corrupts KB |
| Major | Feature not working | Generic extractor misses known container |
| Minor | Cosmetic / log only | Extra WARN log |
| Trivial | Typo | n/a |

### 8.2 Priority Levels

| Priority | Definition | SLA (Fix Time) |
|----------|-----------|----------------|
| P1 | Must fix immediately | 4 hours |
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
| Pass Rate | Passed / Executed × 100% | ≥ 95% |
| Defect Density | Defects / Test Cases | ≤ 0.1 |
| Critical Defect Count | Count of Critical severity | 0 |

### 9.2 Reporting Schedule

| Report | Frequency | Audience |
|--------|-----------|----------|
| Daily Test Status | Daily during SIT/UAT | Project team |
| Defect Summary | Daily | Dev team + PM |
| Test Completion Report | End of SIT / UAT | All stakeholders |

---

## 10. Appendix

### Glossary

| Term | Definition |
|------|------------|
| SIT | System Integration Testing |
| UAT | User Acceptance Testing |
| STP | Software Test Plan |
| STC | Software Test Cases |
| DISC-1 | Defect: on-the-fly schemas stored under unreadable key |

### Assumptions

- LLM and docs.pega.com are mocked in unit/integration tests for determinism.
- KB fixtures are reset per test to avoid cross-test contamination.
