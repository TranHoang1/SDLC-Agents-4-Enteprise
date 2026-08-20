# Software Test Plan (STP)

## SA4E-183: File Change Tracking — Session-wide diff summary visualization

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-183 |
| Title | File Change Tracking — Session-wide diff summary visualization |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-07-27 |
| Status | Draft |
| Related BRD | BRD-v1-SA4E-183.docx |
| Related FSD | FSD-v1-SA4E-183.docx |
| Related TDD | TDD-v1-SA4E-183.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-27 | QA Agent | Initial test plan creation |

---

## 1. Introduction

### 1.1 Purpose

This STP defines the test strategy, test levels, entry/exit criteria, environment setup, and requirements traceability for the File Change Tracking feature (SA4E-183). The feature introduces a session-scoped DiffTracker service in the VS Code extension, a `/diff` slash command, a change badge indicator, and clickable file paths opening VS Code's native diff editor.

### 1.2 Scope

Testing covers:
- Extension Host: DiffTracker service (record, merge, evict, reset, debounce)
- Extension Host: Integration hooks (chat-graph-nodes, ChatEngineAdapter, SessionLifecycleEmitter)
- Extension Host: DiffOriginalProvider (TextDocumentContentProvider)
- Webview: diffTrackerStore, ChangeBadge, DiffSummaryPanel, DiffEntryRow
- PostMessage bridge: DIFF_COUNT_UPDATED, DIFF_SUMMARY_RESPONSE, DIFF_OPEN_FILE
- Slash command: `/diff` registration and dispatch
- Security: Path traversal protection, URI normalization, sensitive file handling

### 1.3 Test Approach

6-level test pyramid aligned with VS Code extension plugin architecture:

| Level | Focus | Tools |
|-------|-------|-------|
| PBT | DiffTracker invariants, diff-utils edge cases | Vitest + fast-check |
| UT | Individual classes/functions in isolation | Vitest + vi.mock |
| IT | Module interactions (DiffTracker ↔ SessionLifecycle ↔ Bridge) | Vitest + real instances |
| E2E-API | PostMessage protocol contracts (Extension Host ↔ Webview) | Vitest + mock WebviewPanel |
| E2E-UI | Svelte component rendering and interaction | Vitest + @testing-library/svelte |
| SIT | Full feature flow in VS Code Extension Host context | Vitest + vscode mock + visual check |

### 1.4 Test Framework

- **Vitest** — Primary test runner (existing project standard)
- **fast-check** — Property-based testing library
- **@testing-library/svelte** — Svelte component testing
- **vi.mock** — VS Code API mocking (existing pattern)

---

## 2. Test Levels

### 2.1 PBT — Property-Based Testing

**Scope:** DiffTracker invariants and diff-utils mathematical properties

**Entry Criteria:**
- IDiffTracker interface and types defined
- diff-utils module implemented

**Exit Criteria:**
- All PBT properties pass with ≥1000 iterations
- No counterexamples found

**Properties to verify:**
- P1: entries.size ≤ 100 (MAX_FILES invariant)
- P2: For any sequence of recordChange calls, totalFiles = totalAdded + totalModified + totalDeleted
- P3: Net-zero rule: added(path) then deleted(path) → entries does not contain path
- P4: computeUnifiedDiff(a, b) + computeUnifiedDiff(b, c) ≠ computeUnifiedDiff(a, c) in general (non-transitive)
- P5: truncateDiff(content, maxSize) produces output ≤ maxSize bytes
- P6: DiffTracker.getFileCount() === DiffTracker.getSummary().totalFiles (consistency)
- P7: After clearSession(), getFileCount() === 0

**Techniques:** fast-check arbitraries for filePath strings, operation types, random sequencing

---

### 2.2 UT — Unit Tests

**Scope:** Individual classes/functions tested in isolation with all dependencies mocked

**Entry Criteria:**
- Source code compiled without errors
- All dependencies mockable

**Exit Criteria:**
- ≥90% line coverage for DiffTracker, diff-utils, SessionLifecycleEmitter, DiffOriginalProvider
- All boundary conditions tested (0, 1, 100, 101 entries)
- All error paths exercised

**Target modules:**
| Module | Key scenarios |
|--------|--------------|
| DiffTracker | recordChange, getSummary, clearSession, getOriginalContent, eviction, debounce |
| diff-utils | computeUnifiedDiff, countLines, truncateDiff, isSensitiveFile |
| SessionLifecycleEmitter | emit events, multiple listeners, remove listener |
| DiffOriginalProvider | provideTextDocumentContent with valid/invalid paths |
| diffTrackerStore | update, reset, derived values |

---

### 2.3 IT — Integration Tests

**Scope:** Real interactions between DiffTracker components without mocking inter-module boundaries

**Entry Criteria:**
- All UT pass
- Core modules implemented and integrated

**Exit Criteria:**
- All IT test cases pass
- Cross-module data flow verified end-to-end within Extension Host

**Focus areas:**
- DiffTracker + SessionLifecycleEmitter (session reset flow)
- DiffTracker + debounce timer (real setTimeout behavior)
- DiffTracker + DiffOriginalProvider (content retrieval consistency)
- executeSingleTool → DiffTracker recording (with mock tool execution)
- ChatEngineAdapter → DiffTracker.getSummary (command dispatch flow)

---

### 2.4 E2E-API — End-to-End PostMessage Protocol

**Scope:** Complete PostMessage contract between Extension Host and Webview

**Entry Criteria:**
- All IT pass
- PostMessage types defined in messages.ts
- Both Host-side and Webview-side handlers implemented

**Exit Criteria:**
- All message types exercised with valid and invalid payloads
- Request/response patterns verified (COMMAND_DISPATCH → DIFF_SUMMARY_RESPONSE)
- Fire-and-forget patterns verified (DIFF_OPEN_FILE → side effect)

**Techniques:**
- Mock WebviewPanel with postMessage spy
- Verify message serialization/deserialization
- Zod schema validation of all payloads (per SECURITY-REVIEW Finding #4)

---

### 2.5 E2E-UI — Svelte Component End-to-End

**Scope:** Webview UI components rendering and user interaction

**Entry Criteria:**
- All E2E-API pass
- Svelte components implemented
- diffTrackerStore functional

**Exit Criteria:**
- All UI components render correctly for all states
- User interactions (click, expand, keyboard nav) trigger correct behaviors
- ARIA attributes present for accessibility

**Target components:**
| Component | Key scenarios |
|-----------|--------------|
| ChangeBadge | Hidden at 0, visible at N>0, click dispatches diff command, ARIA label |
| DiffSummaryPanel | Empty state, grouped sections, expand/collapse files, large diff collapse |
| DiffEntryRow | File path clickable, expand chevron, line count display, color coding |
| SlashMenu | `/diff` appears in autocomplete with correct description |

---

### 2.6 SIT — System Integration Testing

**Scope:** Full feature flow simulating real VS Code extension behavior

**Entry Criteria:**
- All E2E-UI pass
- Feature fully implemented on feature branch

**Exit Criteria:**
- Complete user scenario flows pass
- Performance targets met (badge <100ms, panel <200ms)
- No regressions in existing extension functionality

**Focus areas:**
- Complete flow: tool execution → DiffTracker recording → badge update → /diff → panel render → file click → VS Code diff editor
- Session lifecycle: new session → changes tracked → new session → reset
- Stress: 100 files tracked, rapid tool calls, large diffs
- Graceful degradation: DiffTracker disabled, webview unavailable

---

## 3. Test Environment

### 3.1 Development Environment

| Component | Specification |
|-----------|---------------|
| OS | Windows 11 / macOS 14 / Ubuntu 22.04 |
| Node.js | ≥18.x |
| VS Code API | ≥1.80 (mocked via vi.mock) |
| TypeScript | 5.x |
| Test Runner | Vitest (latest) |
| PBT Library | fast-check (latest) |
| UI Testing | @testing-library/svelte |
| Coverage | Vitest coverage (v8 provider) |

### 3.2 Mock Infrastructure

| Dependency | Mock Strategy |
|-----------|---------------|
| VS Code API (vscode module) | vi.mock('vscode') — existing project pattern |
| File System | In-memory file content map |
| PostMessage Bridge | Mock WebviewPanel with message spy |
| setTimeout/clearTimeout | vi.useFakeTimers() for debounce testing |
| SessionManager | Mock SessionLifecycleEmitter events |
| LLM/Tool execution | Mock executeSingleTool result |

### 3.3 Test Data

Test data provided via CSV files in `documents/SA4E-183/test-data/`:
- `change-entries.csv` — Diverse ChangeEntry inputs
- `file-paths.csv` — Various file path patterns (normal, sensitive, edge cases)
- `diff-content.csv` — Diff content samples (small, large, empty, binary-like)

---

## 4. Requirements Traceability Matrix (RTM)

### 4.1 User Stories → Test Cases

| User Story | Description | Test Cases |
|------------|-------------|------------|
| US-1 | Session-wide change summary | STC-01, STC-02, STC-03, STC-04, STC-05, STC-39, STC-40 |
| US-2 | Unified diff viewer per file | STC-14, STC-15, STC-16, STC-17, STC-18 |
| US-3 | `/diff` slash command | STC-19, STC-20, STC-21, STC-22, STC-42 |
| US-4 | Clickable file paths | STC-23, STC-24, STC-25, STC-26, STC-27 |
| US-5 | Badge/indicator for pending changes | STC-28, STC-29, STC-30, STC-31, STC-32 |
| US-6 | Session scope reset | STC-33, STC-34, STC-35, STC-36 |
| US-7 | Changes grouped by operation type | STC-37, STC-38 |

### 4.2 Business Rules → Test Cases

| Rule ID | Rule Description | Test Cases |
|---------|-----------------|------------|
| BR-01 | Only successful changes recorded | STC-01, STC-06 |
| BR-02 | Cumulative entry for same file | STC-04, STC-41 |
| BR-03 | Max 100 files, oldest evicted | STC-07, STC-08, PBT-01 |
| BR-04 | Reset on new session creation | STC-33, STC-34 |
| BR-05 | Hydration does NOT reset | STC-35 |
| BR-06 | Badge debounced at 100ms | STC-30, STC-43 |
| BR-07 | Cumulative diff = original → current | STC-04, STC-14 |
| BR-08 | Failed/rejected tool calls NOT recorded | STC-06, STC-44 |
| BR-09 | Memory ≤ 10MB | STC-09, PBT-05 |
| BR-10 | Operations: added, modified, deleted | STC-01, STC-02, STC-03 |
| BR-11 | /diff in slash menu autocomplete | STC-19 |
| BR-12 | Panel renders within 200ms | STC-20, SIT-01 |
| BR-13 | /diff works during streaming | STC-22 |
| BR-14 | Command ID: command-diff | STC-19 |
| BR-15 | Standard unified diff format | STC-14 |
| BR-16 | Green additions, red removals | STC-15, STC-16 |
| BR-17 | Large diffs (>500 lines) collapsed | STC-17 |
| BR-18 | Syntax highlighting by extension | STC-18 |
| BR-19 | Modified files open VS Code diff editor | STC-23 |
| BR-20 | New files open in normal editor | STC-24 |
| BR-21 | Deleted files show notification | STC-25 |
| BR-22 | Store original content for modified files | STC-23, STC-40 |
| BR-23 | Badge hidden when count=0 | STC-28 |
| BR-24 | Badge updates within 100ms | STC-30 |
| BR-25 | Badge click opens diff summary | STC-31 |
| BR-26 | Badge uses codicon-diff + numeric counter | STC-32 |
| BR-27 | DiffTracker registers as lifecycle listener | STC-33 |
| BR-28 | Window reload loses state (acceptable) | STC-36 |
| BR-29 | Display order: Added → Modified → Deleted | STC-37 |
| BR-30 | Empty sections hidden | STC-38 |
| BR-31 | Files sorted alphabetically within sections | STC-37 |

### 4.3 Security Findings → Test Cases

| Finding | Description | Test Cases |
|---------|-------------|------------|
| SEC-01 | Path traversal via DIFF_OPEN_FILE | STC-45, STC-46, STC-47 |
| SEC-02 | DiffOriginalProvider URI validation | STC-48, STC-49 |
| SEC-03 | Sensitive file diff redaction | STC-50, STC-51 |
| SEC-04 | PostMessage runtime validation (zod) | STC-52, STC-53 |
| SEC-05 | Memory exhaustion — originalContent cap | STC-09, STC-54 |

---

## 5. Test Case Summary

### 5.1 Test Case Distribution by Level

| Level | Count | Test Case IDs |
|-------|-------|---------------|
| PBT | 7 | PBT-01 → PBT-07 |
| UT | 20 | STC-01 → STC-13, STC-39 → STC-44, STC-54 |
| IT | 8 | STC-55 → STC-62 |
| E2E-API | 7 | STC-63 → STC-69 |
| E2E-UI | 12 | STC-14 → STC-18, STC-19, STC-28 → STC-32, STC-37, STC-38 |
| SIT | 6 | SIT-01 → SIT-06 |

**Total: 60 test cases**

### 5.2 Priority Distribution

| Priority | Count | Description |
|----------|-------|-------------|
| Critical | 18 | Core recording, summary, session reset, security boundaries |
| High | 24 | Badge, command, grouping, integration flows |
| Medium | 12 | Large diffs, edge cases, performance, debounce |
| Low | 6 | UI polish, accessibility, informational security |

---

## 6. Entry / Exit Criteria (Global)

### 6.1 Global Entry Criteria

- [ ] All source code compiles without TypeScript errors
- [ ] All existing tests pass (no regressions)
- [ ] Feature branch created and code pushed
- [ ] TDD implementation checklist complete
- [ ] Test environment configured (Vitest, fast-check, @testing-library/svelte)

### 6.2 Global Exit Criteria

- [ ] All Critical priority tests: 100% PASS
- [ ] All High priority tests: ≥95% PASS
- [ ] All Medium/Low priority tests: ≥90% PASS
- [ ] Code coverage (DiffTracker module): ≥90% lines
- [ ] Code coverage (overall new code): ≥85% lines
- [ ] No Critical/High severity bugs open
- [ ] Performance targets met (badge <100ms, panel <200ms for 50 files)
- [ ] Security test cases for Findings #1-#5 all PASS
- [ ] TEST-REPORT.md generated and attached to Jira

---

## 7. Risk Analysis

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| VS Code API mock inaccuracy | Tests pass but real behavior differs | Medium | Use existing vscode mock patterns proven in project |
| Timer-dependent tests (debounce) flaky | False negatives in CI | Medium | Use vi.useFakeTimers() consistently |
| @testing-library/svelte version compatibility | UI tests fail | Low | Pin version, verify in CI |
| Large property-based tests slow CI | Pipeline timeout | Low | Limit iterations to 1000, use CI-specific config |
| PostMessage serialization edge cases | Missed bugs in real communication | Medium | E2E-API tests with actual JSON serialization |

---

## 8. Test Automation Strategy

### 8.1 Automation Percentage Target: 100%

All 60 test cases are automated via Vitest. No manual test cases for this feature (VS Code extension development model — all testable via mocks and unit/integration patterns).

### 8.2 Test File Structure

```
extension/src/
├── chat/diff/__tests__/
│   ├── DiffTracker.test.ts              # UT: Core DiffTracker
│   ├── DiffTracker.pbt.test.ts          # PBT: Property-based
│   ├── diff-utils.test.ts              # UT: Utility functions
│   ├── DiffOriginalProvider.test.ts    # UT: Content provider
│   └── DiffTracker.security.test.ts    # UT: Security-specific
├── chat/engine/__tests__/
│   ├── SessionLifecycleEmitter.test.ts # UT: Event emitter
│   └── ChatEngineAdapter.diff.test.ts  # IT: Command dispatch + DIFF_OPEN_FILE
├── langgraph/__tests__/
│   └── diff-tracker-integration.test.ts # IT: Tool execution → recording
├── webview/stores/__tests__/
│   └── diffTrackerStore.test.ts        # UT: Svelte store
└── webview/components/__tests__/
    ├── ChangeBadge.test.ts             # E2E-UI: Badge component
    ├── DiffSummaryPanel.test.ts        # E2E-UI: Panel component
    └── DiffEntryRow.test.ts            # E2E-UI: Entry row component
```

### 8.3 CI Integration

- All tests run on every push to feature branch
- PBT tests run with reduced iterations (100) in CI, full (1000) locally
- Coverage report generated and stored as artifact

---

## 9. Defect Management

### 9.1 Bug Severity Classification

| Severity | Definition | Example |
|----------|-----------|---------|
| Critical | Feature completely broken, data loss | DiffTracker records nothing, session reset fails |
| High | Major functionality impaired | Badge never updates, /diff shows wrong data |
| Medium | Minor functionality impaired, workaround exists | Grouping order wrong, large diff not collapsed |
| Low | Cosmetic or edge case | ARIA label text incorrect, icon style |

### 9.2 Bug Resolution SLA

| Severity | Fix Timeline |
|----------|-------------|
| Critical | Before Phase 6 exit |
| High | Before Phase 6 exit |
| Medium | Before UAT |
| Low | Track as tech debt |

---

## 10. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage Matrix | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |

### Reference Documents

| Document | Location |
|----------|----------|
| BRD | documents/SA4E-183/BRD.md |
| FSD | documents/SA4E-183/FSD.md |
| TDD | documents/SA4E-183/TDD.md |
| SECURITY-REVIEW | documents/SA4E-183/SECURITY-REVIEW.md |
| Test Data | documents/SA4E-183/test-data/ |
