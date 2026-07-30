# Software Test Plan (STP)

## SDLC-Agents-4-Enterprise — SA4E-77: Pega Knowledge Graph — Categorized node types, Pega-mode colors, entry_id-based Code/KB split

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-77 |
| Title | Pega Knowledge Graph — Categorized node types, Pega-mode colors, entry_id-based Code/KB split |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-07-30 |
| Status | Draft |

---

## 1. Introduction

### 1.1 Scope

This test plan covers verification of:
- Code/KB split via entry_id prefix matching (GraphRepository)
- isPega auto-detection in /positions API
- Pega rule categorization (config-driven + auto-fallback)
- Pega-mode color switching in frontend (legend, filter, badges)
- Dashboard analytics (codeSymbols includes Pega rules)

### 1.2 Test Levels

| Level | Scope | Responsibility |
|-------|-------|----------------|
| Unit Test | GraphRepository, PegaService, MemoryEngineCrud | Developer |
| Integration Test | /positions API, isPega flag, category mapping | QA |
| E2E-UI Test | Graph legend switching, filter dropdown, color display | QA |
| Regression Test | Non-Pega projects graph behavior | QA |

### 1.3 Test Environment

| Component | Environment |
|-----------|-------------|
| Backend | Local dev (tsx watch) |
| Extension | VS Code with installed VSIX |
| Database | SQLite (dev database) |
| Pega Data | Mock Pega rules or real Pega server |

### 1.4 Risks

- Graph renderer color changes may not match between renderer and legend if COLORS/colors get out of sync
- pega-categories.json config changes require manual verification

---

## 2. Test Coverage Matrix

| FSD Requirement | UC-1 | UC-2 | UC-3 | UC-4 | UC-5 |
|-----------------|------|------|------|------|------|
| BR-01: isPega detection | TC-001 | | | | |
| BR-02: isPega default false | TC-002 | | | | |
| BR-03: Config mapping | | TC-101 | | | |
| BR-04: Missing config fallback | | TC-102 | | | |
| BR-05: Auto-category logic | | TC-103 | | | |
| BR-06: Unknown → OTHER | | TC-104 | | | |
| BR-07: isPega→PEGA_COLORS | | | TC-201 | | |
| BR-08: typeColor() | | | TC-202 | | |
| BR-09: Legend active map | | | TC-203 | | |
| BR-10/11/12: entry_id split | | | | TC-301 | |
| BR-13: No CODE_TYPES | | | | TC-302 | |
| BR-14/15/16: Config rules | | | | | TC-401 |

---

## 3. Test Schedule

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Unit Tests | 1 day | Test results |
| Integration Tests | 1 day | Test report |
| Regression Tests | 0.5 day | Regression pass |
| UAT | 0.5 day | Sign-off |
