# Software Test Plan (STP)

## Code Intelligence MCP Server — SA4E-56: Unified Code & Pega Rule Indexing Pipeline

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-56 |
| Title | Unified Code & Pega Rule Indexing Pipeline |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-07-26 |
| Status | Draft |
| Related BRD | BRD-v1-SA4E-56.docx |
| Related FSD | FSD-v1-SA4E-56.docx |
| Related TDD | TDD-v1-SA4E-56.docx |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | QA Agent – QA Engineer | Create document |
| Peer Reviewer | TA Agent – Technical Analyst | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-26 | QA Agent | Initiate document — auto-generated from BRD, FSD, and TDD |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm the test plan in this STP |
| | ☐ I agree and confirm the test plan in this STP |

---

## 1. Introduction

### 1.1 Purpose

This Test Plan defines the testing strategy, scope, resources, and schedule for the **Unified Code & Pega Rule Indexing Pipeline** (SA4E-56). The feature extends the Code Intelligence MCP Server with a single unified indexing endpoint (`POST /api/index/source`) that accepts all file types (`.ts`, `.js`, `.py`, `.java`, `.pega`, etc.), resolves cross-file dependencies, performs version-aware deduplication, and integrates with Pega Platform via BFS-based rule crawling from the VS Code extension.

### 1.2 Test Objectives

- **Objective 1** — Verify all functional requirements from FSD Section 3 are implemented correctly: Unified Indexing API, Dependency Resolution, Pega Rule Parsing, Pega Platform Integration, and Version-Aware Deduplication
- **Objective 2** — Validate business rules (BR-01 through BR-33) are enforced: authentication, path safety, hash deduplication, symbol kinds, reference extraction
- **Objective 3** — Ensure non-functional requirements (FSD Section 8) are met: single file indexing < 1s, batch < 30s, dedup < 100ms, BFS crawl < 5 min for 1000 rules
- **Objective 4** — Verify security requirements (FSD Section 7): Bearer token authentication, path traversal prevention, credential storage in SecretStorage
- **Objective 5** — Validate extension UI behavior: Pega settings panel, connection test, context fetch, login panel password toggle, last username persistence

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | `documents/SA4E-56/BRD.md` |
| FSD | `documents/SA4E-56/FSD.md` |
| TDD | `documents/SA4E-56/TDD.md` |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Responsibility | Automation | Tools |
|-------|-------|---------------|------------|-------|
| Unit Testing (UT) | Individual classes/modules: PegaFileParser, PegaRuleAstParser, DependencyResolver, AuthManager, ProviderConfigService, SettingsMessageHandler individual handlers | Developer + QA | ✅ Automated | vitest, mocha |
| Integration Testing (IT) | Component interactions: API routes + DB (api-index.ts), PegaHttpClient + Backend APIs, IndexingService + PegaHttpClient, grammar-registry + language parser loading | Developer + QA | ✅ Automated | vitest, fetch, testcontainers |
| System Testing (ST) | End-to-end feature validation: complete indexing pipeline (POST → write → parse → deps → response), BFS crawl from extension to backend, Pega settings panel workflows | QA Team | ✅ Automated + Manual | Custom test scripts, VS Code extension test harness |
| User Acceptance Testing (UAT) | Business validation: developer/CI system usability, Pega project detection accuracy, settings panel UX, login UX, error message clarity | BA + Business Users | ❌ Manual | VS Code, Browser |
| Security Testing | Auth bypass attempts, path traversal attacks, credential leak prevention, token theft protection | QA + Security Team | ✅ Automated | Custom security test scripts, VS Code SecretStorage verification |
| Performance Testing | Single-file indexing time, batch throughput, dedup check latency, BFS crawl scalability (1000 rules) | QA Team | ✅ Automated | vitest benchmark, custom BFS simulation |

### 2.2 Test Types

| Type | Description | Applicable |
|------|-------------|------------|
| Functional Testing | Verify features work per FSD use cases | Yes |
| Regression Testing | Ensure existing features are not broken by new code | Yes |
| Performance Testing | Verify response times and load capacity | Yes |
| Security Testing | Verify auth, authorization, data protection | Yes |
| Usability Testing | Verify UI/UX meets specifications | Yes |
| Compatibility Testing | Verify `.pega` file format compatibility across rule types | Yes |

### 2.3 Test Approach

**Automation-First Strategy:**
- All UT and IT tests are fully automated using vitest (backend) and mocha (extension)
- System tests for API endpoints are automated using HTTP client scripts
- Manual SIT is reserved for visual/UX validation: settings panel layout, login panel toggle behavior, connection test feedback display
- Security tests are automated where possible (path traversal, auth bypass) and manually verified for credential storage
- Performance tests use automated benchmarking with measurable pass/fail criteria

**Risk-Based Prioritization:**
- **P1 (Critical)**: Auth, path safety, dedup correctness — must be tested first
- **P2 (High)**: API contract compliance, .pega parsing, dependency resolution
- **P3 (Medium)**: Extension settings UI, BFS crawl edge cases, error handling
- **P4 (Low)**: Cosmetics, non-critical error messages

### 2.4 Entry Criteria

| Level | Entry Criteria |
|-------|---------------|
| UT | Source code is compiled; test framework is configured; no compilation errors |
| IT | Backend server can start with test configuration; database migrations are run |
| ST | All UT and IT tests pass; build artifacts are deployed to SIT environment |
| UAT | ST completed with 0 Critical defects and ≤ 2 Major defects open; UAT environment ready |
| Security | Feature-complete build available; security test scenarios documented |
| Performance | Feature-complete build available; performance benchmarks defined |

### 2.5 Exit Criteria

| Level | Exit Criteria |
|-------|--------------|
| UT | 100% code coverage for new modules; all tests pass |
| IT | All integration test cases pass; contract validation complete |
| ST | All system test cases executed; 0 Critical defects; ≤ 2 Major defects |
| UAT | All UAT scenarios passed; business sign-off obtained |
| Security | All security test scenarios pass; no P1/P2 vulnerabilities |
| Performance | All performance tests meet acceptance criteria |

---

## 3. Test Scope

### 3.1 Features In Scope

| # | Feature / Story | Priority | FSD Reference | Test Types |
|---|----------------|----------|---------------|------------|
| 1 | Unified Indexing API — POST /api/index/source | Critical | UC-01, BR-01..06 | UT, IT, ST, Security, Performance |
| 2 | Deduplication via gitHash/checksum | Critical | UC-08, BR-30..33 | UT, IT, ST |
| 3 | Dependency Resolution (TS/JS, Java, Python, Pega) | High | UC-02, BR-10..14 | UT, IT, ST |
| 4 | Pega File Parsing (.pega) | High | UC-03, BR-20..24 | UT, IT |
| 5 | PegaRuleAstParser (20+ Rule Types) | High | UC-03, BR-24 | UT |
| 6 | Pega Platform Integration — Settings Panel | High | UC-04, FSD §3.4.3 | UT, IT, ST, UAT |
| 7 | Test Pega Connection | High | UC-05 | UT, IT, ST |
| 8 | Fetch Pega Context | Medium | UC-06 | UT, IT, ST |
| 9 | BFS Crawl Orchestration | High | UC-07, AF-05..08 | UT, IT, ST, Performance |
| 10 | AuthManager — Login/Logout/Token Lifecycle | High | FSD §7.1 | UT, ST, Security |
| 11 | Login Panel — Password Toggle, Pre-fill | Medium | FSD §7.1 | UT, UAT |
| 12 | ProviderConfigService — SecretStorage Credentials | High | FSD §7.2 | UT, Security |
| 13 | File Scanning — .pega Extension Mapping | Medium | FSD §3.3 | UT, IT |
| 14 | Grammar Registry — Pega Language Loading | Medium | FSD §3.3 | UT |

### 3.2 Features Out of Scope

| # | Feature | Reason |
|---|---------|--------|
| 1 | Pega Platform server-side deployment | Out of scope per FSD §1.2 |
| 2 | Non-textual Pega assets (binary formats) | Explicitly excluded in TDD §1.2 |
| 3 | Custom Pega rule types beyond built-in 20+ AST builders | Out of scope per TDD §1.2 |
| 4 | Real-time Pega rule sync or webhook-based change detection | Future enhancement per TDD §1.2 |
| 5 | GUI for Pega rule editing within VS Code | Explicitly excluded in TDD §1.2 |
| 6 | Cross-browser compatibility testing (Extension-only feature) | VS Code uses Chromium runtime only |

---

## 4. Test Environment

### 4.1 Environment Requirements

| Environment | URL | Database | Purpose |
|-------------|-----|----------|---------|
| SIT | `http://localhost:48721` | Better-SQLite3 (test index.db) | System Integration Testing |
| UAT | `http://localhost:48721` | Better-SQLite3 (test index.db) | User Acceptance Testing |
| Pega Mock | `http://localhost:8080/prweb` | N/A (mock server) | Pega Platform integration testing |

### 4.2 VS Code Extension Requirements

| Component | Version | Required |
|-----------|---------|----------|
| VS Code | ≥ 1.16.0 | Yes |
| Node.js | ≥ 18.x | Yes |
| OS Keychain | Available | Yes (for SecretStorage) |
| Workspace Folder | Open | Yes (for extension tests) |

### 4.3 Test Data Requirements

| Data Type | Description | Source | Preparation |
|-----------|-------------|--------|-------------|
| Source Files | `.ts`, `.js`, `.java`, `.py`, `.pega` sample files | Test fixtures | Pre-created in `testdata/` directory |
| Authentication | Valid Bearer token | Backend `/api/admin/auth/login` | Login script in test setup |
| Pega Credentials | Username/password for Pega Platform | Mock server config | Pre-seeded mock credentials |
| pega-project.json | Pega project metadata | Generated by Fetch Context | Pre-created for BFS crawl tests |
| Application.xml | Pega application XML | Generated by Fetch Context | Pre-created for fallback tests |

### 4.4 External Dependencies

| System | Dependency | Mock/Stub Available |
|--------|-----------|---------------------|
| Pega Platform REST API | GET /api/v1/data/D_OperatorID, GET /api/v1/casetypes, GET /api/v1/applications, GET /api/v1/objects/{class}/{key} | ✅ Pega Platform mock server (returns controlled JSON fixtures) |
| Backend Database | Better-SQLite3 | ✅ In-memory SQLite for test isolation |
| VS Code SecretStorage | OS keychain | ✅ Mock SecretStorage in tests |

---

## 5. Test Schedule

| Phase | Start Date | End Date | Duration | Milestone |
|-------|-----------|----------|----------|-----------|
| Test Planning | 2026-07-26 | 2026-07-26 | 1 day | STP + STC approved |
| Test Data Preparation | 2026-07-26 | 2026-07-27 | 1 day | Test data CSVs ready |
| UT Execution | 2026-07-27 | 2026-07-28 | 2 days | UT pass rate = 100% |
| IT Execution | 2026-07-28 | 2026-07-29 | 2 days | IT pass rate = 100% |
| ST Execution | 2026-07-29 | 2026-07-30 | 2 days | 0 Critical defects |
| Defect Fix & Retest | 2026-07-30 | 2026-07-31 | 1 day | All Critical/Major fixed |
| Security Testing | 2026-07-29 | 2026-07-30 | 2 days | No P1/P2 vulnerabilities |
| Performance Testing | 2026-07-30 | 2026-07-31 | 1 day | All benchmarks met |
| UAT Execution | 2026-07-31 | 2026-08-01 | 1 day | UAT sign-off |
| Go-Live | 2026-08-01 | 2026-08-01 | 1 day | Production deployment |

---

## 6. Resources & Responsibilities

| Role | Name | Responsibility |
|------|------|---------------|
| Test Lead | QA Agent | Test planning, coordination, reporting |
| QA Engineer | QA Agent | Test case design, execution, defect reporting |
| BA | BA Agent | UAT support, acceptance criteria clarification |
| Developer | DEV Agent | Bug fixing, unit test coverage |
| Technical Architect | TA Agent | Technical review, test guidance |
| DevOps | DevOps Agent | Environment setup, deployment |

---

## 7. Risk & Mitigation

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | Pega Platform unavailable during testing | High | Medium | Mock Pega Platform server with configurable responses; all integration tests run against mock |
| 2 | Path traversal attacks not properly blocked | Critical | Low | Dedicated security test suite with known traversal patterns; FSD BR-02 enforcement |
| 3 | Credential leak in logs or settings.json | Critical | Low | Automated scan of log statements for password leakage; verify SecretStorage-only storage |
| 4 | BFS crawl infinite loop on circular Pega references | High | Medium | visitedKeys Set prevents re-visiting; MAX_ITERATIONS=1000 safety limit; unit test with circular refs |
| 5 | Race condition on concurrent index requests (same file) | Medium | Medium | Test with parallel POST requests; verify DB unique constraint (project_id, path) prevents duplicates |
| 6 | 16-char hash collision for dedup | Low | Very Low | Risk accepted per TDD Open Question #2 (2^64 combinations) |
| 7 | Test environment not matching production Pega version | Medium | Medium | URL fallback pattern tested (with/without `/PRRestService`) |

---

## 8. Defect Management

### 8.1 Severity Levels

| Severity | Definition | Example |
|----------|-----------|---------|
| Critical | System crash, data loss, security breach, auth bypass | Path traversal succeeds, credential leak, 401 bypass |
| Major | Feature not working, incorrect dedup, wrong dependency resolution | .pega file not indexed, deps missing, symbol kind wrong |
| Minor | UI issue, cosmetic defect, non-critical error message | Wrong error message text, button alignment |
| Trivial | Typo, minor alignment issue | Label text formatting, icon not matching |

### 8.2 Priority Levels

| Priority | Definition | SLA (Fix Time) |
|----------|-----------|----------------|
| P1 | Must fix immediately — blocks testing | 4 hours |
| P2 | Must fix before release — significant feature impact | 1 business day |
| P3 | Should fix if time permits — minor impact | 3 business days |
| P4 | Nice to fix, can defer to next release | Next release |

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
| Major Defect Count | Count of Major severity | ≤ 2 at exit |
| Code Coverage (UT) | Lines covered / Total lines × 100% | ≥ 80% |
| API Response Time (p95) | Measured from performance tests | ≤ 30s for batch of 50 |
| BFS Crawl Time (1000 rules) | Measured from performance tests | ≤ 5 min |

### 9.2 Reporting Schedule

| Report | Frequency | Audience |
|--------|-----------|----------|
| Daily Test Status | Daily during SIT/UAT | Project team |
| Defect Summary | Daily | Dev team + PM |
| Test Completion Report | End of SIT / End of UAT | All stakeholders |

---

## 10. Appendix

### Glossary

| Term | Definition |
|------|------------|
| UT | Unit Testing — testing individual classes/modules |
| IT | Integration Testing — testing component interactions |
| ST | System Testing — end-to-end feature validation |
| UAT | User Acceptance Testing — business validation |
| BFS | Breadth-First Search — traversal strategy for crawling Pega rules |
| Content Hash | First 16 hex chars of SHA-256 hash of file content |
| FileDependency | Interface representing a resolved dependency |
| ILanguageParser | Interface for language-specific parsers |
| SecretStorage | VS Code API for secure credential storage |
| Pega Rule AST | Abstract Syntax Tree representation of parsed Pega rule |

### Assumptions

- Backend server is running on localhost:48721 with default configuration
- Pega Platform mock server is available for extension integration tests
- VS Code 1.16+ with SecretStorage API is available
- Test data fixtures are pre-created in the `testdata/` directory
- All tests run in isolation with fresh database per test suite
