# Software Test Plan (STP)

## SDLC Agents 4 Enterprise — SA4E-68: Quality & Verification Tools for Pega Parser

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-68 |
| Title | Quality & Verification — Golden Dataset, Round-Trip Validator, Mutation Tester, Schema Inference, Understanding Service, Artifact Analyzer |
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

This test plan defines the verification strategy for all 4 work packages under SA4E-68: Quality tools (Golden Dataset, Round-Trip Validator, Mutation Tester), Schema Inference & KB Service, Understanding Service, and Artifact Analyzer MCP tool.

### 1.2 Test Objectives

- Verify all 15 golden samples parse correctly against expected AST values
- Validate round-trip fidelity: parse → serialize → compare produces zero semantic differences
- Confirm mutation testing detects all 9 mutation types with different fingerprints
- Ensure schema inference correctly detects types, references, children, and base classes
- Validate field documentation produces 78 correct descriptions for standard Pega fields
- Confirm KB persistence: save → restart → load preserves schema definitions
- Verify UnderstandingService orchestrates all 7 sub-services correctly
- Ensure artifact analyzer correctly detects all 4 types and routes to appropriate analyzer

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | documents/SA4E-68/BRD.md |
| FSD | documents/SA4E-68/FSD.md |
| TDD | documents/SA4E-68/TDD.md |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Responsibility | Tools |
|-------|-------|---------------|-------|
| Unit Testing (UT) | Individual classes: GoldenDataset, RoundTripValidator, MutationTester, SchemaInferrer, FieldDocumentor, KBService, UnderstandingService, Detector, Registry, Analyzers | Developer | vitest |
| Integration Testing (IT) | Component interactions: quality tools + parser, inference + KB, understanding + all services, analyzer + detector | Developer + QA | vitest + mock data |
| System Testing (ST) | End-to-end: analyze_artifact MCP tool, full understanding pipeline | QA Team | vitest + fixture data |
| User Acceptance Testing (UAT) | Business validation: quality reports, understanding output, artifact analysis | BA + Business Users | Manual via API docs |

### 2.2 Test Types

| Type | Description | Applicable |
|------|-------------|------------|
| Functional Testing | Verify features work per FSD use cases | Yes |
| Regression Testing | Ensure existing parser features not broken | Yes |
| Snapshot Testing | Golden sample AST verification | Yes |
| Round-Trip Testing | Parse-serialize-compare field fidelity | Yes |
| Mutation Testing | AST fingerprint change detection | Yes |

### 2.3 Test Approach

- **Automation**: All UT, IT, and ST tests automated via vitest
- **Fixture-based**: Golden samples, mutation test data, inference fixtures
- **Snapshot comparison**: Golden dataset verification uses expected values

### 2.4 Entry Criteria

| Level | Entry Criteria |
|-------|---------------|
| SIT | All unit tests pass (90%+ coverage for quality tools, 85%+ for inference) |
| UAT | SIT completed with 0 Critical, ≤2 Major defects open |

### 2.5 Exit Criteria

| Level | Exit Criteria |
|-------|--------------|
| SIT | 100% test cases executed, 0 Critical defects, ≤2 Major defects open |
| UAT | All UAT scenarios passed, business sign-off obtained |

---

## 3. Test Scope

### 3.1 Features In Scope

| # | Feature / Story | Priority | FSD Reference | WP | Tests |
|---|----------------|----------|---------------|----|-------|
| 1 | PegaGoldenDataset — 15 samples across 15 rule types | High | §4.1 | WP1 | 32 |
| 2 | PegaRoundTripValidator — parse/serialize/compare | High | §4.2 | WP2 | 9 |
| 3 | PegaMutationTester — 6 strategies, 9 mutations | High | §4.3 | WP3 | 16 |
| 4 | Schema inference — property/child/reference detection | High | §4.4 | WP4 | 10 |
| 5 | Field documentation — 78 field descriptions | High | §4.5 | WP4 | 8 |
| 6 | Schema KB persistence — save/load/learn | High | §4.6 | WP4 | 8 |
| 7 | Schema auto-learner — learn + compile | Medium | §4.7 | WP4 | 5 |
| 8 | Understanding service — orchestrate 7 services | High | §4.8 | WP4 | 8 |
| 9 | Artifact detector — priority-based type detection | High | §3.4 | Analyzer | 6 |
| 10 | Artifact analyzer registry — plugin routing | High | §3.4 | Analyzer | 6 |
| 11 | PegaRuleAnalyzer — full understanding analysis | High | §3.4 | Analyzer | 5 |
| 12 | GenericCodeAnalyzer — language detection | Medium | §3.4 | Analyzer | 5 |
| 13 | StructureAnalyzer — JSON/XML/YAML analysis | Medium | §3.4 | Analyzer | 5 |
| 14 | FallbackAnalyzer — basic metadata | Low | §3.4 | Analyzer | 4 |

### 3.2 Features Out of Scope

| # | Feature | Reason |
|---|---------|--------|
| 1 | Real Pega Platform connection | Quality tools operate on local JSON only |
| 2 | Performance benchmarking of inference | Covered under separate performance epic |
| 3 | UI for quality reports | Console/API-based output only |

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
| Golden Samples | 15 rule samples across 14 types | `PegaGoldenDataset.ts` | Built into test fixtures |
| Round-Trip Inputs | Various rule JSON payloads | `PegaGoldenDataset` samples + edge cases | Created per test case |
| Mutation Samples | Activity, DataTransform, Flow samples | `PegaGoldenDataset` samples | Created per test case |
| Inference Inputs | Unknown rule type JSON payloads | Custom fixtures | `fixtures/inference-samples.ts` |
| Field Doc Inputs | 78-field test JSON | Custom fixtures | `fixtures/field-doc-samples.ts` |
| KB Test Data | Schema entries for save/load | Custom fixtures | `fixtures/kb-samples.ts` |
| Artifact Samples | Pega JSON, code snippets, JSON, XML, YAML, binary | Custom fixtures | `fixtures/artifact-samples.ts` |

### 4.3 External Dependencies

| System | Dependency | Mock/Stub Available |
|--------|-----------|---------------------|
| Database | Better-SQLite3 for KB persistence | In-memory mock adapter |
| PegaRuleAstParser | Used by quality tools | Direct instantiation |
| MetaModelRegistry | Used by inference | Direct instantiation |

---

## 5. WP Test Breakdown

### WP1-WP3: Quality Module (PegaQuality.test.ts) — 55 tests
- **Sample integrity**: 15 per-sample tests — each golden sample returns correct pxObjClass, name, and structure (15 tests)
- **verify() correctness**: verify passes for valid samples, catches mismatches in ruleType, references, children (5 tests)
- **All samples parse**: All 15 golden samples parse without throwing with correct ruleType and children count (15 tests)
- **Round-trip validation**: Field preservation across rule types, system field exclusion, name field mapping, batch validation (9 tests)
- **Mutation testing**: 6 mutation strategies, 9 predefined mutations, fingerprint determinism, edge cases (11 tests)
- **Cross-module integration**: Quality tools work together — round-trip + mutation, all samples verify+parse (5 tests)
- **Edge cases**: Null/undefined handling, empty arrays, missing arrays, immutability, diff consistency (8 tests)

### WP4: Inference Module (PegaInference.test.ts) — 55 tests
- Property inference and type detection
- Child array inference and system field filtering
- Base class resolution (3-layer)
- Reference field detection
- Field documentation generation and prompt context
- Schema persistence (save/load/learn)
- Auto-learner pipeline
- Duplicate prevention

### WP4: KB Service (PegaSchemaKBService.test.ts) — 24 tests
- Schema save/load operations
- KB serialization round-trip
- Cross-session schema persistence

### WP4: Understanding Service (PegaRuleUnderstanding.test.ts) — 39 tests
- Full understanding pipeline with all 7 sub-services
- Schema, field docs, semantic analysis, dependencies
- Simulation mode and prompt context generation
- LLM-ready structured output

### WP4: Artifact Analyzer (artifact-analyzer.test.ts) — 27 tests
- Type detection priority routing (pega_rule, code, structured_data, unknown)
- PegaRuleAnalyzer — full understanding via UnderstandingService
- GenericCodeAnalyzer — language detection, function/class counting
- StructureAnalyzer — JSON schema tree, XML tags, YAML keys
- FallbackAnalyzer — basic metadata, content hash, binary detection
- Hint override for type detection

---

## 6. Test Schedule

| Phase | Start Date | End Date | Duration | Milestone |
|-------|-----------|----------|----------|-----------|
| Test Planning | Week 0 | Week 1 | 1 wk | STP + STC approved |
| Test Data Preparation | Week 1 | Week 2 | 1 wk | All fixture files created |
| WP1-WP3 Testing (Quality Module) | Week 2 | Week 4 | 2 wks | 55 tests pass |
| WP4 Testing (Inference/Understanding/Analyzer) | Week 5 | Week 8 | 3 wks | 145 tests pass |
| Integration Testing | Week 7 | Week 8 | 1 wk | Cross-module integration |
| UAT | Week 8 | Week 9 | 1 wk | Business sign-off |

---

## 7. Resources & Responsibilities

| Role | Name | Responsibility |
|------|------|---------------|
| Test Lead | QA Agent | Test planning, coordination, reporting |
| QA Engineer | QA Agent | Test case design, execution, defect reporting |
| Developer | DEV Agent | Unit tests, bug fixing |
| BA | BA Agent | UAT support, acceptance criteria clarification |

---

## 8. Risk & Mitigation

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | Golden samples insufficient to catch regressions | High | Low | 15 samples cover 15 rule types; extend with real-world samples |
| 2 | Round-trip fails on complex nested structures | Medium | Medium | Edge case fixtures for deep nesting, arrays, null values |
| 3 | Mutation fingerprint collisions | Medium | Low | fingerprint includes ruleType, name, className, children, refs, properties |
| 4 | Schema inference misses edge cases | Medium | Medium | Test with diverse unknown rule types; add inference fixtures |

---

## 9. Defect Management

### 9.1 Severity Levels

| Severity | Definition | Example |
|----------|-----------|---------|
| Critical | Golden sample verifies wrong, round-trip loses semantic fields | Missing required fields in round-trip output |
| Major | Feature not working, incorrect inference | Wrong type detection, missing field docs |
| Minor | Edge case failure, non-critical bug | Obscure rule type inference gaps |
| Trivial | Typo, formatting, cosmetic | Error message formatting |

### 9.2 Defect Lifecycle
```
New → Open → In Progress → Fixed → Ready for Retest → Verified → Closed
                                                 → Reopened → In Progress
```
