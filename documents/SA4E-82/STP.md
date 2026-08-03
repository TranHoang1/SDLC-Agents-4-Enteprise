# Software Test Plan (STP)

## SDLC Agents 4 Enterprise — SA4E-82: [Pega MCP] Register 8 Pega tools as hidden local tools (find_tools/execute_dynamic_tool)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-82 |
| Title | [Pega MCP] Register 8 Pega tools as hidden local tools (find_tools/execute_dynamic_tool) |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-07-31 |
| Status | Approved (backfill) |
| Related BRD | documents/SA4E-82/BRD.md |
| Related FSD | documents/SA4E-82/FSD.md |
| Related TDD | N/A — backfill ticket; no TDD published (implementation verified directly) |

> **QA Note:** This is a **backfill** test plan. The implementation for SA4E-82 was already completed and verified (unit suite + live MCP verification on port 9181) before this STP was written. All test cases in the companion STC reflect **actual executed results** (status = PASS with evidence), not planned-but-unexecuted scenarios.

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | QA Agent – QA Engineer | Create document (backfill of executed verification) |
| Peer Reviewer | SA Agent – Solution Architect | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-31 | QA Agent | Initiate document — backfill of the test plan covering the already-implemented and verified SA4E-82 feature |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm the test plan in this STP |
| | ☐ I agree and confirm the test plan in this STP |

---

## 1. Introduction

### 1.1 Purpose

This test plan defines the strategy, scope, environment, and evidence for verifying SA4E-82: the registration of **8 Pega MCP tools** (`pega_get_session_context`, `pega_get_rule`, `pega_query_rule`, `pega_list_rules`, `pega_save_rule`, `pega_checkout_rule`, `pega_run_tests`, `pega_create_branch`) as **hidden local tools** in the SDLC Agents 4 Enterprise VS Code extension.

The feature makes the 8 Pega tools:

- **Executable locally** — dispatched by the extension's local tool registry (`backend-local-tools.ts`), no backend round-trip;
- **Discoverable via `find_tools`** — local definitions (including hidden ones) are merged into the backend `find_tools` response;
- **Hidden from `tools/list`** — `getVisibleLocalToolDefinitions()` filters out `hidden: true` entries so the LLM's default tool surface stays clean (12 visible tools).

The plan is written as a backfill: implementation and verification are complete (589 extension tests passed, live MCP checks on port 9181 succeeded). This STP documents what was tested and how, per the FSD (§3.1–§3.5) and BRD (Story 1 & 2 acceptance criteria).

### 1.2 Test Objectives

- Verify all 8 `pega_*` tools are registered in the local tool registry with `hidden: true` (FSD UC-001, BR-001).
- Verify `tools/list` excludes the hidden Pega tools and remains at **12 visible tools** (FSD UC-004, BR-012/BR-014; BRD Story 1 AC-1).
- Verify `find_tools` merges **all 10 local definitions** (including the 8 hidden `pega_*`) into the backend result — **60 tools total**, no duplicates (FSD UC-002, BR-006/BR-007/BR-008; BRD Story 1 AC-2).
- Verify `execute_dynamic_tool({ tool_name: "pega_*" })` routes to local handlers and executes against the **real Pega server** (FSD UC-003, BR-009; BRD Story 2 AC-1/AC-2).
- Verify direct `tools/call pega_*` still routes locally (FSD UC-005, BR-015/BR-016).
- Verify the MCP text-result envelope shape `{ isError, content: [{ type: "text", text }] }` (FSD §3.3.4, §4.2).
- Verify non-Pega dynamic tools still forward to the backend (regression — BRD §1.2, FSD AF-003-2).
- Verify error handling: `success: false → isError: true`, thrown handler errors captured, unknown local tool message, backend-down fallback (FSD §3.3, §3.4, §9.1).
- Verify NFR targets: merge latency, registry O(1) lookup, non-fatal registration failure, protocol negotiation unaffected (FSD §8).

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | documents/SA4E-82/BRD.md |
| FSD | documents/SA4E-82/FSD.md |
| Pega tool registration source | extension/src/mcp/pega-local-tools.ts |
| Local tool registry | extension/src/backend-local-tools.ts |
| MCP wrapper server | extension/src/services/WrapperServer.ts |
| Pega operations facade | extension/src/mcp/PegaMcpTools.ts |
| Unit tests (new) | extension/src/__tests__/pega-local-tools.test.ts, backend-local-tools.test.ts, wrapper-server.test.ts |
| Test cases (this plan) | documents/SA4E-82/STC.md |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Responsibility | Tools |
|-------|-------|---------------|-------|
| Unit Testing (UT) | Registration, hidden-flag filtering, definition schemas, local execution, envelope wrapping, error mapping, routing | Developer + QA | Vitest (extension/src/__tests__/) |
| Integration Testing (IT) | WrapperServer MCP JSON-RPC behavior — `find_tools` merge (TC-37), `execute_dynamic_tool` local routing (TC-38), response rewrite (TC-25) | Developer + QA | Vitest in-process HTTP (wrapper-server.test.ts) |
| System Verification (SIT, live) | Live MCP calls against the running extension on port 9181 + real Pega server | QA | VS Code extension host (port 9181), MCP JSON-RPC over HTTP |
| Regression | Existing local tools (stream_write_file, embed_image), non-Pega dynamic tool forwarding, MCP protocol handshake | QA | Unit suite + live spot checks |

**Backfill note:** All levels were executed during implementation verification. The unit/IT levels are fully automated (589/589 tests passed, 40 files — up from 579). The live SIT checks were executed manually against the re-installed VSIX with the extension host running on port 9181.

### 2.2 Test Types

| Type | Description | Applicable |
|------|-------------|------------|
| Functional Testing | 8 Pega tool registration, visibility, discovery, execution, envelope shape | Yes |
| Regression Testing | Existing local tools, backend forwarding, MCP handshake | Yes |
| Performance Testing | Local merge latency (< 50 ms), registry O(1) lookup (< 10 ms dispatch) | Partial — verified by design + live response times |
| Security Testing | Credentials from SecretStorage only; no credential leak in payloads/logs | Yes (inspection + BR-005) |
| Usability Testing | N/A — MCP-level feature, no user-facing UI (FSD §3.1.5) | No |
| Compatibility Testing | MCP protocol versions 2025-06-18, 2025-03-26, 2024-11-05 negotiation unaffected | Yes (mcp-handshake regression suite) |

### 2.3 Test Approach

- **Risk-based, evidence-driven backfill:** because the feature is already implemented and verified, the approach documents the executed verification: automated unit/IT suite + live MCP checks.
- **Automated first:** all registry/registration/visibility/routing behavior is covered by Vitest (pega-local-tools.test.ts — 8 scenario blocks; wrapper-server.test.ts — TC-25, TC-37, TC-38; backend-local-tools.test.ts — registry & unknown-tool cases). Full suite: **589 tests / 40 files, compile clean, esbuild OK**.
- **Live verification for end-to-end confidence:** after VSIX reinstall + extension reload, MCP JSON-RPC requests are sent to `http://localhost:9181/mcp`:
  - `tools/list` → 12 visible tools (Pega excluded);
  - `find_tools("pega create branch")` → 60 tools total (8 Pega + existing backend/local tools);
  - `execute_dynamic_tool(pega_get_session_context)` → real operator `SSA@TGB`, application `HRAppsV2`;
  - `pega_list_rules` → live Pega rule listing.
- **Traceability:** every STC test case maps to an FSD use case / business rule / BRD acceptance criterion (RTM in STC §10).

### 2.4 Entry Criteria

| Level | Entry Criteria |
|-------|---------------|
| UT / IT (automated) | Source code compiles; test files committed; VSIX build (esbuild) OK |
| SIT (live) | VSIX re-installed in VS Code dev host; extension activated; WrapperServer listening on port 9181; backend reachable; Pega Platform reachable with operator credentials in SecretStorage |

### 2.5 Exit Criteria

| Level | Exit Criteria |
|-------|--------------|
| UT / IT (automated) | 100% of new tests pass; full extension suite green (589 passed / 40 files); no compile errors |
| SIT (live) | `tools/list` = 12 tools; `find_tools` = 60 tools incl. 8 Pega; `execute_dynamic_tool(pega_get_session_context)` returns real operator/application; `pega_list_rules` returns live rules; no Pega tools leaked into `tools/list` |
| Overall | 0 Critical/Major defects open; all STC cases PASS; RTM coverage 100% |

---

## 3. Test Scope

### 3.1 Features In Scope

| # | Feature / Story | Priority | FSD Reference | Test Type |
|---|----------------|----------|---------------|-----------|
| 1 | Register 8 Pega tools as hidden local tools (registration + `hidden: true`) | High | UC-001, BR-001, BR-004 | Functional (UT) |
| 2 | `tools/list` excludes hidden Pega tools (12 visible) | High | UC-004, BR-002, BR-012, BR-014 | Functional (UT + SIT) |
| 3 | `find_tools` merges all 10 local definitions (incl. hidden) | High | UC-002, BR-003, BR-006–BR-008 | Functional (IT + SIT) |
| 4 | `execute_dynamic_tool` routes `pega_*` to local handlers | High | UC-003, BR-009–BR-011 | Functional (IT + SIT) |
| 5 | Direct `tools/call pega_*` routes locally (backward compat) | High | UC-005, BR-015, BR-016 | Functional (UT) |
| 6 | Result envelope shape `{ isError, content: [{type:"text",text}] }` | High | §3.3.4, §4.2, BR-010 | Functional (UT) |
| 7 | Error handling (success:false, thrown errors, unknown tool, backend-down) | High | §3.3 EF-003, §3.4 AF-004-1, §9.1 | Functional / Negative (UT + SIT) |
| 8 | Schema completeness (required params: `ruleJson`, `rulesetName`, `insKey`, etc.) | High | §4.2 data dictionary, BRD §2.3 validation rules | Functional (UT) |
| 9 | Non-Pega dynamic tools still forward to backend (regression) | High | AF-003-2, BRD §1.2 | Regression (IT) |
| 10 | MCP protocol negotiation unaffected | Medium | FSD §8 Compatibility, FSD TC-12 | Regression (UT) |

### 3.2 Features Out of Scope

| # | Feature | Reason |
|---|---------|--------|
| 1 | Pega integration services themselves (`PegaHttpClient`, `PegaRuleSetResolverService`) | Pre-date this ticket (SA4E-56 parent) — consumed unchanged by `PegaMcpTools` (FSD §1.2) |
| 2 | Backend-side `find_tools` / `execute_dynamic_tool` implementation | Backend core tools (`backend/src/config/CoreTools.ts`) — out of scope (FSD §1.2) |
| 3 | New user-facing UI | None added (FSD §3.1.5) |
| 4 | Pega Platform server-side changes | No Pega server changes (BRD §1.2) |
| 5 | Performance load testing (>1k concurrent MCP requests) | NFR targets verified by design (O(1) registry) + live single-call latency; load soak not required for backfill |
| 6 | Live Pega write operations (save/checkout/branch) | Read-only live checks executed (session context, list rules); write operations verified at unit level with mocked handlers to avoid mutating the shared Pega environment — see Risk R3 |

---

## 4. Test Environment

### 4.1 Environment Requirements

| Environment | URL / Port | Dependency | Purpose |
|-------------|-----------|------------|---------|
| VS Code extension dev host | Local (VS Code Extension Development Host) | VSIX re-installed + reloaded | Hosts WrapperServer + local tool registry |
| WrapperServer (MCP) | http://localhost:9181/mcp | Extension activated | MCP JSON-RPC endpoint under test |
| Remote backend | http://localhost:48721 | Backend running with auth | Source of backend tools + `find_tools` / `execute_dynamic_tool` |
| Pega Platform | Pega REST endpoint (per SecretStorage config) | Operator credentials | Real target of the 8 Pega operations |

### 4.2 Browser / Device Requirements

| Browser | Version | OS | Required |
|---------|---------|-----|----------|
| N/A (VS Code extension — no browser UI) | — | Windows | No |

### 4.3 Test Data Requirements

| Data Type | Description | Source | Preparation |
|-----------|-------------|--------|-------------|
| Pega operator credentials | operator ID (SSA@TGB), password/token, app (HRAppsV2) | VS Code SecretStorage | Stored once via VS Code secret storage API; never passed as tool args (BR-005) |
| Pega rule insKey | e.g. `RULE-OBJ-ACTIVITY MyClass!MyRule` | Pega Platform | Real rule instance for get/query/checkout verification |
| Rule class for listing | e.g. `Rule-Obj-Activity` (default) | Pega Platform | Default class for `pega_list_rules` |
| Mock tool handlers (unit) | `{ success, data?, context?, error? }` fixtures | pega-local-tools.test.ts `mockPegaTools()` | In-memory Vitest mocks |
| Backend tool list (IT) | WrapperServer test fixtures | wrapper-server.test.ts `restGetToolsMock` | In-memory HTTP test server |

### 4.4 External Dependencies

| System | Dependency | Mock/Stub Available |
|--------|-----------|---------------------|
| Remote backend (48721) | Serves `/api/tools` + `/api/tools/execute` | Yes — Vitest `restGetToolsMock` / `restCallToolMock` (IT); live backend used for SIT |
| Pega Platform | Executes the 8 Pega operations | Partial — `PegaMcpTools` handlers mocked at UT/IT level; **real** Pega used for live SIT (session context, list rules) |
| VS Code SecretStorage | Supplies Pega credentials | Yes — mocked in unit tests; real SecretStorage in live dev host |

---

## 5. Test Schedule

> **Backfill note:** the phases below reflect the actual, already-completed verification timeline (all in 2026-07-31).

| Phase | Start Date | End Date | Duration | Milestone |
|-------|-----------|----------|----------|-----------|
| Test Planning (backfill) | 2026-07-31 | 2026-07-31 | 1 day | STP + STC approved |
| Test Data Preparation | 2026-07-31 | 2026-07-31 | <1 day | Pega credentials in SecretStorage; VSIX installed; backend up |
| UT/IT Execution (automated) | 2026-07-31 | 2026-07-31 | <1 day | 589/589 extension tests pass (was 579 pre-change); compile clean |
| SIT Execution (live MCP on 9181) | 2026-07-31 | 2026-07-31 | <1 day | tools/list=12; find_tools=60; execute_dynamic_tool live Pega OK |
| Defect Fix & Retest | 2026-07-31 | 2026-07-31 | — | 0 defects open (backfill) |
| Go-Live / Sign-off | 2026-07-31 | 2026-07-31 | — | STP/STC Approved (backfill) |

---

## 6. Resources & Responsibilities

| Role | Name | Responsibility |
|------|------|---------------|
| Test Lead | QA Agent | Test planning, verification execution, evidence capture, reporting |
| QA Engineer | QA Agent | STC design/execution, live MCP verification, defect reporting |
| BA | BA Agent | BRD acceptance criteria alignment (backfill) |
| Developer | DEV Agent | Implementation, unit test coverage (589 tests), bug fixing |
| Solution Architect | SA Agent | FSD review, technical verification support |

---

## 7. Risk & Mitigation

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | `tools/list` accidentally exposes hidden Pega tools | High | Low | `getVisibleLocalToolDefinitions()` filters by `!d.hidden`; guarded by pega-local-tools.test.ts hidden-behavior tests + live check (12 tools) |
| 2 | `find_tools` merge regression (Pega tools not discoverable) | Medium | Low | Dedicated IT test TC-37 + live check (60 tools incl. 8 Pega) |
| 3 | Write operations against live Pega (save/checkout/branch) mutate shared environment | Medium | Medium | Live verification limited to read-only ops (session context, list rules); write ops covered by unit tests with mocked handlers; CRUD live tests deferred to controlled Pega tenant |
| 4 | Pega server unreachable during live execution | Medium | Medium | Handlers catch errors and return `{ success: false, error }`; session-context call doubles as connectivity check |
| 5 | Name collision with backend tools | Medium | Low | `pega_` prefix namespacing enforced in `PEGA_TOOL_SPECS`; duplicate-merge logic skips existing names (BR-007) |
| 6 | Credential leak into MCP payloads/logs | High | Low | Credentials only via SecretStorage (BR-005); security inspection of payloads + logs; never serialized into tool args |

---

## 8. Defect Management

### 8.1 Severity Levels

| Severity | Definition | Example |
|----------|-----------|---------|
| Critical | Extension crash, credential exposure, data loss | Pega credentials leaked into MCP payload |
| Major | Core feature broken, workaround exists | Pega tools not discoverable via find_tools |
| Minor | Edge-case behavioral deviation | Duplicate `pega_` prefix in handler-catch error text (FSD OI-2, cosmetic) |
| Trivial | Typo, cosmetic alignment | Tool description wording |

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

**Backfill status:** 0 defects found during verification. Known cosmetic issue tracked as FSD Open Issue OI-2 (`pega_pega_get_rule: ...` prefix in handler-catch error text) — accepted for next maintenance sprint, severity Minor / P4.

---

## 9. Test Metrics & Reporting

### 9.1 Metrics

| Metric | Formula | Target | Actual (SA4E-82) |
|--------|---------|--------|-------------------|
| Test Execution Rate | Executed / Total × 100% | 100% | 100% (27/27) |
| Pass Rate | Passed / Executed × 100% | ≥ 95% | 100% (27/27 PASS) |
| Defect Density | Defects / Test Cases | ≤ 0.1 | 0 |
| Critical Defect Count | Count of Critical severity | 0 | 0 |
| Defect Fix Rate | Fixed / Total Defects × 100% | ≥ 90% | N/A (0 defects) |
| Extension suite pass | Passed / Total | 100% | 589/589 (40 files), compile clean |

### 9.2 Reporting Schedule

| Report | Frequency | Audience |
|--------|-----------|----------|
| Test Status (backfill) | Once — 2026-07-31 | Project team |
| Defect Summary | Once — 0 defects | Dev team + PM |
| Test Completion Report | End of verification — STP/STC Approved | All stakeholders |

---

## 10. Appendix

### Glossary

| Term | Definition |
|------|------------|
| SIT | System Integration Testing |
| UT | Unit Testing |
| IT | Integration Testing |
| STP | Software Test Plan |
| STC | Software Test Cases |
| MCP | Model Context Protocol — JSON-RPC between LLM and tools |
| OCP | Open/Closed Principle — extend via registration, not modification |
| insKey | Pega rule instance key (e.g., `RULE-OBJ-ACTIVITY MyClass!MyRule`) |
| RuleSet / branch | Pega versioning mechanism used by save/checkout/create_branch |
| SecretStorage | VS Code encrypted per-extension secret storage API |

### Assumptions

- The 8 Pega tool handlers in `PegaMcpTools.ts` (SA4E-56 parent) are correct and require no changes (BRD §5.2).
- The default `tools/list` surface must remain **12 visible tools**; Pega tools stay hidden (BRD §5.2).
- `find_tools` remains the discovery mechanism for hidden tools (BRD §5.2).
- Backfill evidence (589 tests, live MCP checks) is authoritative for the PASS statuses recorded in STC.
- Write operations against live Pega are out of scope for this verification cycle (Risk R3) — covered at unit level only.
