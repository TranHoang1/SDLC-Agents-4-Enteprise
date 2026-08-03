# System Test Plan (STP)

## SDLC Agents 4 Enterprise — SA4E-85: Nâng cấp Chat UI Agentic - Svelte Webview

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-85 |
| Title | Nâng cấp Chat UI Agentic - Svelte Webview |
| Author | QA Agent |
| Version | 2.0 |
| Date | 2026-08-02 |
| Status | Draft |
| Related BRD | BRD-v2-SA4E-85.docx |
| Related FSD | FSD-v2-SA4E-85.docx |
| Related TDD | TDD-v2-SA4E-85.docx |
| Security Review | SECURITY-REVIEW-SA4E-85.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-02 | QA Agent | Initial STP from BRD v2 + FSD v2 + TDD v2 + Security Review |
| 2.0 | 2026-08-02 | QA Agent | v3 Backend-Driven State: +14 test cases for BR-30/31, UC-11, Phase 0 Backend, Pub/Sub |
| 2.1 | 2026-08-02 | QA Agent | **[Review-05]** v3.1 Backend-Driven Knowledge: test KB Checkpointer (HTTP) thay cho SQLite persistence, RemoteCheckpointer, stateless host/webview |

---

## 1. Introduction

### 1.1 Purpose

This document defines the System Test Plan for SA4E-85 — a comprehensive VSCode Extension upgrade introducing Agentic Chat UI capabilities via Svelte 4 Webview. The plan covers all functional, non-functional, security, and accessibility requirements across 6 test levels.

### 1.2 Scope

- 11 Use Cases (UC-01 to UC-11)
- 31 Business Rules (BR-01 to BR-31)
- 8 Extension Host modules + RemoteCheckpointer + Backend Knowledge Service
- 7 Svelte Webview components
- 5 Svelte stores (mirrors of backend state)
- IPC Bridge (WebSocket JSON-RPC 2.0) + Pub/Sub Broadcasting
- Multi-IDE Session Management via Backend KB (thread_id shared)
- Security findings from SECURITY-REVIEW

### 1.3 Test Levels

| Level | Abbreviation | Description | Tool/Framework |
|-------|-------------|-------------|----------------|
| Property-Based Testing | PBT | Invariant verification with random inputs | fast-check |
| Unit Testing | UT | Module isolation with mocked deps | Vitest + @testing-library/svelte |
| Integration Testing | IT | Cross-module with real deps | Vitest + ws (mock server) |
| E2E API Testing | E2E-API | Message protocol contract validation | Vitest + postMessage mock |
| E2E UI Testing | E2E-UI | User interaction scenarios | Playwright (VSCode Extension) |
| System Integration Testing | SIT | Visual/UX + real extension runtime | Manual + Playwright |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD v2 | BRD-v2-SA4E-85.docx |
| FSD v2 | FSD-v2-SA4E-85.docx |
| TDD v2 | TDD-v2-SA4E-85.docx |
| Security Review | SECURITY-REVIEW-SA4E-85.docx |
| Plugin Pattern | .kiro/steering/patterns/plugin.md |

---

## 2. Test Strategy

### 2.1 Test Pyramid

```
        /  SIT (12)  \        — Manual visual/UX validation
       / E2E-UI (21)  \      — Gherkin scenarios, real browser
      / E2E-API (20)    \    — Protocol contracts
     / IT (29)            \  — Multi-module integration
    / UT (49)              \ — Isolated unit logic
   / PBT (11)              \ — Property invariants
```

Total: 142 test cases across 6 levels.

### 2.2 Risk-Based Prioritization

| Risk Area | Priority | Coverage Focus |
|-----------|----------|----------------|
| Concurrent Modification (BR-05/06/07) | Critical | PBT + UT + IT + E2E-UI |
| Permission Guard (BR-01/02/03/04) | Critical | UT + IT + E2E-API + E2E-UI |
| IPC Bridge Security (BR-13/14) | High | PBT + UT + IT + Security |
| Chat Streaming (STREAM_*) | High | UT + IT + E2E-API |
| Context Pruning (BR-08/09/10) | Medium | UT + IT |
| Agent Registry (BR-11/12) | Medium | UT + IT |
| Performance (BR-15/16/17/18) | High | PBT + IT + SIT |
| Terminal/Artifacts (BR-21/22/27) | Medium | UT + E2E-UI |
| Diagram Rendering (BR-28/29) | Low | UT + IT |
| **[v3]** Backend-Driven State / Hydration (BR-30/31) | Critical | PBT + UT + IT + E2E-API + SIT |
| **[v3]** Multi-IDE Pub/Sub Sync (UC-11) | High | IT + E2E-API + SIT |

### 2.3 Entry Criteria

- All source code compiled without errors
- Unit tests from dev phase pass (≥80% coverage)
- Extension activates without crash
- Mock WebSocket server available for IPC tests
- Test data CSV files available

### 2.4 Exit Criteria

- 100% RTM coverage (all 31 BRs tested)
- 0 Critical defects open
- 0 High defects open
- ≤3 Medium defects open (with accepted risk)
- Performance benchmarks met (BR-15/16/17/18)
- Security test cases pass (IPC rate limit, CSP, command validation)
- Multi-IDE sync verified (BR-30/31, UC-11)

### 2.5 Suspension Criteria

- Extension fails to activate
- >5 Critical defects found in a single session
- IPC Bridge cannot establish connection (blocking integration tests)

---

## 3. Test Environment

### 3.1 Hardware/Software

| Component | Requirement |
|-----------|-------------|
| OS | Windows 11 / macOS 14 / Ubuntu 22.04 |
| VSCode | ≥1.85 |
| Node.js | ≥18.x (Extension Host runtime) |
| Java | ≥11 (PlantUML JAR rendering) |
| Browser | Chromium (Webview runtime) |
| RAM | ≥8GB |
| Disk | ≥500MB free |

### 3.2 Test Tools

| Tool | Purpose |
|------|---------|
| Vitest | Unit + Integration + E2E-API |
| fast-check | Property-Based Testing |
| @testing-library/svelte | Component testing |
| Playwright | E2E-UI automation |
| ws (npm) | Mock WebSocket server |
| vscode-test | Extension integration testing |
| c8 / istanbul | Code coverage |

### 3.3 Test Data Sources

| File | Content |
|------|---------|
| test-data/agents.csv | Agent metadata for registry tests |
| test-data/diffs.csv | Diff payloads with various conflict states |
| test-data/tools.csv | Tool definitions (safe/dangerous types) |
| test-data/messages.csv | Stream message sequences |
| test-data/ipc-services.csv | Service discovery configurations |
| test-data/diagrams.csv | PlantUML sources for render tests |
| test-data/sessions.csv | **[v3.1]** Thread/session payloads for hydration + RemoteCheckpointer tests |

---

## 4. Requirements Traceability Matrix (RTM)

### 4.1 Business Rules → Test Cases

| BR-ID | Rule Description | PBT | UT | IT | E2E-API | E2E-UI | SIT |
|-------|-----------------|-----|----|----|---------|--------|-----|
| BR-01 | Dangerous tools require approval | | UT-PG-01 | IT-PG-01 | API-PG-01 | UI-PG-01 | |
| BR-02 | Safe tools auto-approve | | UT-PG-02 | IT-PG-02 | API-PG-02 | | |
| BR-03 | Permission timeout 60s → auto-deny | | UT-PG-03 | IT-PG-03 | API-PG-03 | UI-PG-02 | |
| BR-04 | Allow All Session per type | | UT-PG-04 | IT-PG-04 | API-PG-04 | UI-PG-03 | |
| BR-05 | File hash checked before apply | PBT-CM-01 | UT-CM-01 | IT-CM-01 | API-CM-01 | UI-CM-01 | |
| BR-06 | Patch >5min → stale warning | | UT-CM-02 | | API-CM-02 | UI-CM-02 | |
| BR-07 | Concurrent mod → BLOCK + Regenerate | PBT-CM-02 | UT-CM-03 | IT-CM-02 | API-CM-03 | UI-CM-03 | |
| BR-08 | Token >80% → badge pulse | | UT-CTX-01 | | | UI-CTX-01 | SIT-CTX-01 |
| BR-09 | Token >90% → auto-suggest unpin | | UT-CTX-02 | IT-CTX-01 | | UI-CTX-02 | |
| BR-10 | /clear resets ALL context | | UT-CTX-03 | IT-CTX-02 | API-CTX-01 | UI-CTX-03 | |
| BR-11 | Registry hot-reload <2s | | UT-REG-01 | IT-REG-01 | | | SIT-REG-01 |
| BR-12 | Invalid YAML → skip + log | PBT-REG-01 | UT-REG-02 | IT-REG-02 | | | |
| BR-13 | IPC backoff: 1s,2s,4s,8s,16s max 5 | PBT-IPC-01 | UT-IPC-01 | IT-IPC-01 | | | |
| BR-14 | IPC localhost only | PBT-IPC-02 | UT-IPC-02 | IT-IPC-02 | | | SIT-IPC-01 |
| BR-15 | Bundle ≤15KB gzipped | | | | | | SIT-PERF-01 |
| BR-16 | First render <100ms | | | IT-PERF-01 | | | SIT-PERF-02 |
| BR-17 | Activation impact <200ms | | | IT-PERF-02 | | | SIT-PERF-03 |
| BR-18 | Virtualized chat ≤1000 msgs at 60fps | PBT-PERF-01 | UT-PERF-01 | | | UI-PERF-01 | SIT-PERF-04 |
| BR-19 | Component ≤200 lines | | UT-LINT-01 | | | | |
| BR-20 | Telemetry local only | | UT-TEL-01 | IT-TEL-01 | | | |
| BR-21 | TerminalLogBlock 300px max, monospace | | UT-TLB-01 | | | UI-TLB-01 | SIT-TLB-01 |
| BR-22 | Shell complete → collapse + summary | | UT-TLB-02 | | | UI-TLB-02 | |
| BR-23 | WorkspaceEdit preserves Undo/Redo | | UT-CM-04 | IT-CM-03 | | UI-CM-04 | |
| BR-24 | CSP: no inline scripts, nonce loading | | UT-SEC-01 | IT-SEC-01 | | | SIT-SEC-01 |
| BR-25 | WCAG 2.1 AA | | UT-A11Y-01 | | | UI-A11Y-01 | SIT-A11Y-01 |
| BR-26 | Deep-link → "Open in AntiGravity" button | | UT-DL-01 | IT-DL-01 | API-DL-01 | UI-DL-01 | |
| BR-27 | Artifact auto-detect regex → buttons | PBT-ART-01 | UT-ART-01 | IT-ART-01 | | UI-ART-01 | |
| BR-28 | Diagram → inline SVG render | | UT-DGR-01 | IT-DGR-01 | | | |
| BR-29 | Diagram renderer ≤5KB bundle impact | | | | | | SIT-PERF-05 |
| BR-30 | **[v3.1]** Backend Knowledge Service = SoT, Stores are Mirrors, RemoteCheckpointer (HTTP) | PBT-HYD-01 | UT-HYD-01, UT-HYD-02, UT-HYD-04 | IT-HYD-01, IT-HYD-03 | API-HYD-01, API-HYD-02 | UI-HYD-01 | SIT-SYNC-01 |
| BR-31 | **[v3.1]** Multi-IDE session via thread_id, hydrate từ Backend KB | PBT-HYD-01 | UT-HYD-03 | IT-HYD-02, IT-HYD-04 | API-HYD-03 | | SIT-SYNC-01 |

### 4.2 Use Cases → Test Cases

| UC-ID | Use Case | Primary Tests |
|-------|----------|---------------|
| UC-01 | Send Prompt & Streamed Response | UT-STR-01..03, IT-STR-01..02, API-STR-01..04, UI-STR-01 |
| UC-02 | Accept/Reject Diff | UT-CM-01..04, IT-CM-01..03, API-CM-01..03, UI-CM-01..04 |
| UC-03 | Tool Execution + Terminal Log | UT-TLB-01..02, UT-ART-01, IT-ART-01, UI-TLB-01..02 |
| UC-04 | Context Monitoring & Pruning | UT-CTX-01..03, IT-CTX-01..02, API-CTX-01, UI-CTX-01..03 |
| UC-05 | Agent Selection & Slash Commands | UT-REG-01..02, IT-REG-01..02, UI-REG-01 |
| UC-06 | Permission Guard | UT-PG-01..04, IT-PG-01..04, API-PG-01..04, UI-PG-01..03 |
| UC-07 | IPC Bridge Connection | UT-IPC-01..02, IT-IPC-01..02, UI-IPC-01 |
| UC-08 | Service Offline Recovery | UT-IPC-03, IT-IPC-03, UI-IPC-02 |
| UC-09 | Concurrent Modification Detection | PBT-CM-01..02, UT-CM-01..03, IT-CM-01..02, UI-CM-01..03 |
| UC-10 | Context Pruning | UT-CTX-02..03, IT-CTX-01..02, UI-CTX-02..03 |
| UC-11 | **[v3]** Sync Multi-IDE Chat State (Hydration) | PBT-HYD-01, UT-HYD-01..03, IT-HYD-01..04, API-HYD-01..02, UI-HYD-01, SIT-SYNC-01 |

### 4.3 Security Findings → Test Cases

| Finding | Severity | Test Case(s) |
|---------|----------|-------------|
| #1 IPC Rate Limiting | Medium | PBT-SEC-01, UT-SEC-02, IT-SEC-02 |
| #2 Session Approval Scope | Medium | UT-PG-04, IT-PG-04, API-PG-04 |
| #3 PlantUML Local Rendering | Medium (CLOSED) | UT-DGR-01, IT-DGR-01 |
| #5 Terminal Command Validation | Low | UT-SEC-03, IT-SEC-03 |
| #6 Service Discovery Tampering | Low | UT-IPC-04 |
| #7 Nonce Entropy | Low | UT-SEC-01 |

---

## 5. Test Execution Flow

### 5.1 Execution Order

```
Phase 1: PBT (Properties)
  ↓ All properties hold
Phase 2: UT (Unit Tests)
  ↓ ≥80% coverage
Phase 3: IT (Integration)
  ↓ All cross-module flows pass
Phase 4: E2E-API (Protocol)
  ↓ Message contracts verified
Phase 5: E2E-UI (Scenarios)
  ↓ User journeys pass
Phase 6: SIT (System)
  ↓ Visual/perf/security validated
```

### 5.2 Automation vs Manual

| Level | Automated | Manual | Notes |
|-------|-----------|--------|-------|
| PBT | 100% | 0% | fast-check generates inputs |
| UT | 100% | 0% | Vitest CI |
| IT | 100% | 0% | Mock servers |
| E2E-API | 100% | 0% | Contract tests |
| E2E-UI | 90% | 10% | Playwright; manual for edge cases |
| SIT | 20% | 80% | Visual inspection, performance profiling |

### 5.3 CI/CD Integration

```yaml
# .github/workflows/ci-sa4e-85.yml
test-phases:
  - name: PBT + UT
    command: vitest run --coverage
    gate: coverage >= 80%
  - name: IT
    command: vitest run --project integration
    gate: all pass
  - name: E2E-API
    command: vitest run --project e2e-api
    gate: all pass
  - name: E2E-UI
    command: playwright test
    gate: all pass
  - name: Bundle Size
    command: vite build && gzip -c dist/webview.js | wc -c
    gate: <= 15360 bytes
```

---

## 6. Test Cases Summary by Level

### 6.1 PBT — Property-Based Tests (11 cases)

| ID | Property | Generator |
|----|----------|-----------|
| PBT-CM-01 | Hash equality is reflexive: hash(f) == hash(f) always | Random file content |
| PBT-CM-02 | Dirty file always blocked (hash mismatch → no apply) | Random mutations |
| PBT-REG-01 | Invalid YAML never crashes registry (graceful skip) | Arbitrary strings as YAML |
| PBT-IPC-01 | Backoff delays follow 2^n pattern, max 16s | Random retry counts 0..20 |
| PBT-IPC-02 | Non-localhost endpoints always rejected | Random URL strings |
| PBT-PERF-01 | Virtual list renders ≤20 DOM nodes for any message count | Random 1..2000 msgs |
| PBT-SEC-01 | Rate limiter drops messages beyond threshold | Random burst sizes |
| PBT-ART-01 | Artifact regex matches known patterns, rejects unknown | Random paths |
| PBT-STR-01 | Token buffering flushes before STREAM_END | Random token sequences |
| PBT-CTX-01 | Pruning never removes locked files | Random lock states |
| PBT-HYD-01 | **[v3.1]** thread_id always valid UUID v4 format (từ Backend KB createThread) | Random JSON payloads |

### 6.2 UT — Unit Tests (48 cases)

| Group | Count | Focus |
|-------|-------|-------|
| UT-STR (Streaming) | 3 | Store state transitions |
| UT-CM (Concurrent Mod) | 4 | Hash, stale, conflict, undo |
| UT-PG (Permission Guard) | 4 | Approve, deny, timeout, session |
| UT-CTX (Context) | 3 | Badge, prune, clear |
| UT-REG (Registry) | 2 | Hot-reload, invalid YAML |
| UT-IPC (IPC Bridge) | 4 | Backoff, localhost, dispose, discovery |
| UT-TLB (Terminal Log) | 2 | Height limit, collapse |
| UT-ART (Artifacts) | 1 | Regex detection |
| UT-DL (Deep Link) | 1 | Button render |
| UT-DGR (Diagrams) | 1 | SVG render + cache |
| UT-TEL (Telemetry) | 1 | Local-only append |
| UT-SEC (Security) | 3 | CSP nonce, rate limit, cmd allowlist |
| UT-A11Y (Accessibility) | 1 | ARIA labels, keyboard nav |
| UT-PERF (Performance) | 1 | Virtual list DOM count |
| UT-LINT (Code Quality) | 1 | Component line count ≤200 |
| UT-HYD (Hydration) [v3.1] | 4 | chatStore hydration, REQUEST_SYNC_STATE onMount, thread_id parse, RemoteCheckpointer HTTP (getTuple/put) |

### 6.3 IT — Integration Tests (29 cases)

| Group | Count | Focus |
|-------|-------|-------|
| IT-STR (Streaming) | 2 | MessageRouter → chatStore full flow |
| IT-CM (Concurrent Mod) | 3 | ToolHandler → FileSystem → WorkspaceEdit |
| IT-PG (Permission) | 4 | Webview ↔ Extension Host round-trip |
| IT-CTX (Context) | 2 | ContextManager → Store → Badge |
| IT-REG (Registry) | 2 | FileWatcher → Parse → Event |
| IT-IPC (IPC Bridge) | 3 | WebSocket server ↔ IpcBridge lifecycle |
| IT-DL (Deep Link) | 1 | ToolResult → ArtifactLinkButton |
| IT-ART (Artifacts) | 1 | Shell output → ArtifactDetector → UI |
| IT-DGR (Diagrams) | 1 | PlantUML JAR → SVG → DOMPurify → render |
| IT-TEL (Telemetry) | 1 | Actions → TelemetryService → .jsonl file |
| IT-SEC (Security) | 3 | CSP enforcement, rate limit, cmd validate |
| IT-PERF (Performance) | 2 | First render timing, activation timing |
| IT-HYD (Hydration) [v3.1] | 4 | Full hydration flow, Pub/Sub broadcast, KB Checkpointer persistence (HTTP), interrupt/resume |

### 6.4 E2E-API — Protocol Tests (20 cases)

| Group | Count | Focus |
|-------|-------|-------|
| API-STR (Streaming) | 4 | STREAM_START/TOKEN/END/ERROR contracts |
| API-CM (Concurrent Mod) | 3 | ACCEPT/REJECT/REGENERATE messages |
| API-PG (Permission) | 4 | TOOL_CALL_REQUEST/RESPONSE lifecycle |
| API-CTX (Context) | 1 | CONTEXT_UPDATE + CONTEXT_UNPIN_FILE |
| API-DL (Deep Link) | 1 | MCP_TOOL_RESULT with deepLinkUri |
| API-VALIDATE | 5 | Invalid messages dropped/rejected |
| API-HYD (Hydration) [v3] | 2 | REQUEST_SYNC_STATE + SYNC_CHAT_HISTORY contracts |

### 6.5 E2E-UI — Gherkin Scenarios (21 cases)

| ID | Scenario Title |
|----|----------------|
| UI-STR-01 | Developer sends prompt and sees streamed response |
| UI-CM-01 | Developer accepts clean diff successfully |
| UI-CM-02 | Developer sees stale warning after 5min |
| UI-CM-03 | Developer blocked on concurrent mod, regenerates |
| UI-CM-04 | Developer rejects diff, undo available |
| UI-PG-01 | Developer approves dangerous tool |
| UI-PG-02 | Permission auto-denied after 60s timeout |
| UI-PG-03 | Allow All Session approves subsequent same-type tools |
| UI-CTX-01 | Token badge pulses at >80% |
| UI-CTX-02 | Auto-suggest shown at >90%, unpin reduces tokens |
| UI-CTX-03 | /clear confirms and resets context |
| UI-TLB-01 | Terminal log streams output with 300px limit |
| UI-TLB-02 | Terminal collapses after completion |
| UI-DL-01 | Deep-link button opens external IDE |
| UI-ART-01 | Artifact detected, button rendered |
| UI-IPC-01 | Service connected, green indicator shown |
| UI-IPC-02 | Service offline, auto-start button works |
| UI-REG-01 | Agent added via hot-reload, appears in dropdown |
| UI-PERF-01 | 1000 messages scroll at 60fps |
| UI-A11Y-01 | Full keyboard navigation through chat |
| UI-HYD-01 | **[v3]** IDE opens → chat history restored automatically from backend |

### 6.6 SIT — System Integration Tests (12 cases)

| ID | Test Focus | Method |
|----|-----------|--------|
| SIT-PERF-01 | Bundle size ≤15KB gzipped | Build + measure |
| SIT-PERF-02 | First render <100ms | Chrome DevTools Performance |
| SIT-PERF-03 | Activation impact <200ms | Extension Host profiling |
| SIT-PERF-04 | 1000 msgs smooth scroll | Visual + FPS counter |
| SIT-PERF-05 | Diagram renderer ≤5KB bundle impact | Build analysis |
| SIT-CTX-01 | Badge visual states (green/yellow/red) | Visual inspection |
| SIT-REG-01 | Hot-reload <2s real-time | Stopwatch measurement |
| SIT-IPC-01 | Localhost-only enforcement in production | Network inspector |
| SIT-SEC-01 | CSP blocks inline script injection | DevTools Console |
| SIT-TLB-01 | Terminal monospace font rendering | Visual inspection |
| SIT-A11Y-01 | Screen reader compatibility | NVDA/VoiceOver manual |
| SIT-SYNC-01 | **[v3]** Multi-IDE sync: 2 IDEs see same chat history | Manual 2-IDE setup |

---

## 7. Defect Management

### 7.1 Severity Classification

| Severity | Definition | SLA |
|----------|-----------|-----|
| Critical | Extension crashes, data loss, security bypass | Fix within 4h |
| High | Feature non-functional, blocking workflow | Fix within 1 day |
| Medium | Feature degraded, workaround exists | Fix within sprint |
| Low | Cosmetic, minor UX issue | Backlog |

### 7.2 Defect Tracking

- Tool: Jira (linked to SA4E-85)
- Template: Bug type, steps to reproduce, expected/actual, screenshot
- Regression: All fixed defects get regression test case added

---

## 8. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| PlantUML JAR not available in CI | Medium | Diagram tests skip | Docker image with Java + plantuml.jar |
| WebSocket flaky in CI | Low | IT-IPC tests intermittent | Retry + increased timeout |
| Svelte version mismatch | Low | Component tests fail | Pin exact Svelte 4.x version |
| Performance varies by machine | Medium | SIT-PERF thresholds | Run on standardized CI runner |
| Extension Host startup overhead | Low | Activation test flaky | Warm-up run before measurement |

---

## Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |
