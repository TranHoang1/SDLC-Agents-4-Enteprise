# Test Execution Report — SA4E-185

## LSP Diagnostics Feed — Realtime errors into agent loop

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-185 |
| Title | LSP Diagnostics Feed — Realtime errors into agent loop |
| Executed By | QA Agent |
| Date | 2026-08-20 |
| Environment | extension/ (VS Code extension, TypeScript + LangGraph + vitest 4.1.10); Windows 11; Node v22.19.0 |
| Browser | N/A (E2E-UI extension-host level not delivered — see §2.3 / §4) |
| Overall Verdict | **⚠️ CONDITIONAL PASS — core implementation verified; test-scope delivery gaps must be closed** |
| Re-test Rounds | 0 (first execution round; no fixes applied during this run) |

> **VERDICT RATIONALE:** All 57 executed diagnostics-suite tests + 25 hook-suite tests pass; type-check clean; security blockers **B1/B2/B3/B5 are closed** (source-verified + test-verified); **B3/C-3 (path containment), C-2 (approval gate), C-1 (fence) confirmed working**. However the STC/STP declared **71 automated test cases across 6 levels**; the delivered implementation covers them partially — **15 automated cases are not implemented, 5 are `describe.skip`, 1 is a vacuous placeholder** (STC-45). E2E-UI (6 cases) was not delivered at all. These are coverage/quality defects, not functional regressions of the delivered core.

---

## 1. Executive Summary

SA4E-185 execution covered: (a) full automated suite `npx vitest run` in `extension/` — **1444 pass / 31 fail / 11 skip / 10 todo**, all failures pre-existing and unrelated to SA4E-185; (b) `npx tsc --noEmit` — **clean**; (c) **security blocker B5** — full hook suite (`hook-loader` + `hook-executor`) **25/25 PASS** confirming DR-1 introduces no command-hook auto-fire on `write_file`; (d) manual source-verification of diagnostics feed service, inject-diagnostics-node, chat-graph fence (F-01), approval gate (F-02), and path containment (F-03) — **all match the security review's closed-condition requirements**.

The SA4E-185 diagnostics suite (**6 files, 62 tests, 57 passed, 5 skipped**) is green. The **5 skipped** are STC-declared unit tests (`describe.skip(… "requires integration env")`) whose scenarios were never re-implemented at IT level. **Defect D2/D3/D4** quantify the resulting coverage gaps. Blocking security conditions from SECURITY-CODE-REVIEW are resolved as follows: **B1 ✅, B2 ✅, B3 ✅, B5 ✅**; **B4 (C-6 product decision) remains OPEN** (SM/PM decision required, tracked as SIT-76).

| Level | Planned | Full PASS | Partial | Skipped | Missing | Vacuous | Verdict |
|-------|---------|-----------|---------|---------|---------|---------|---------|
| PBT (STC-01..08) | 8 | 1 | 6 | 0 | 1 | 0 | ⚠️ NOT AS SPECIFIED (no fast-check properties; UT analogs) |
| UT (STC-09..37) | 29 | 20 | 2 | 5 | 2 | 0 | ⚠️ CONDITIONAL |
| IT (STC-38..53) | 16 | 3 | 9 | 0 | 3 | 1 | ⚠️ CONDITIONAL (vacuous + missing race tests) |
| E2E-API (STC-54..65) | 12 | 2 | 7 | 0 | 3 | 0 | ❌ GAP (2 genuine + 7 partial) |
| E2E-UI (STC-66..71) | 6 | 0 | 0 | 0 | 6 | 0 | ❌ NOT DELIVERED |
| SIT (STC-72..78) | 7 | 0 | 0 | 0 | 7 | 0 | 📋 NOT RUN (manual, deferred) |
| **Total** | **78** | **26** | **24** | **5** | **23+1*** | **1** | |

\* 15 missing automated (STC-05, 26, 37, 46, 47, 52, 54, 55, 65, 66..71) + 7 SIT not-run + 1 vacuous (STC-45) = 23 counted as *not truly passing* (26 PASS + 24 PARTIAL = 50 executing meaningful cases; 5 skipped; 23 open/none).

**Effective automation delivery:** 50/71 planned automated cases genuinely execute and assert (70.4% parity — 26 full + 24 partial). Pass rate of *executed* meaningful automated diagnostics/hook/approval tests: **100%** (0 failures in all SA4E-185 files).

---

## 2. Automated Test Results

### 2.1 Execution

```
cd extension
npx vitest run                  # full suite (all *.test.ts incl. e2e)
npx tsc --noEmit                # type-check
```

| Metric | Result |
|--------|--------|
| **Full suite** (`npx vitest run`) | 139 files · **1444 passed / 31 failed / 11 skipped / 10 todo** |
| **Type-check** (`tsc --noEmit`) | **PASS (0 errors)** |
| **SA4E-185 diagnostics suite** (6 files) | **57 passed / 5 skipped / 62 total** |
| **Blocker B5 — full hook suite** (2 files) | **25/25 PASS** |
| **Approval-gate suite** (`executeSingleTool-approval`) + classifier | PASS (in full-suite run) |
| Duration | 184.97 s (full suite) / 2.72 s (diagnostics) / 0.54 s (hook suite) |

### 2.2 SA4E-185 Test Files — Execution Result

| Test file | Level(s) | Result |
|-----------|----------|--------|
| `src/langgraph/diagnostics/__tests__/diagnostics-feed-service.test.ts` | PBT-analog + UT | ✅ 37 pass + 5 skip |
| `src/langgraph/diagnostics/__tests__/inject-diagnostics-node.test.ts` | UT (STC-29/30) | ✅ 4 pass |
| `src/langgraph/__tests__/diagnostics-state-channel.test.ts` | UT/IT (STC-31) | ✅ 4 pass |
| `src/langgraph/__tests__/chat-graph-diagnostics.integration.test.ts` | IT + E2E-API-analog | ✅ 12 pass |
| `src/langgraph/__tests__/hook-loader.test.ts` + `hook-executor.test.ts` | IT (B5 / STC-38/53) | ✅ 25 pass |
| `src/chat/engine/__tests__/tool-approval-classifier.test.ts` | UT (STC-62) | ✅ 8 pass |
| `src/langgraph/subgraphs/__tests__/executeSingleTool-approval.test.ts` | IT (STC-61/62) | ✅ 5 pass |
| `src/langgraph/diagnostics/__tests__/diagnostics-feed-config.test.ts` | UT (STP §2.3) | ❌ **FILE NOT CREATED** |
| `src/langgraph/__tests__/feed-extension-host.e2e.test.ts` | E2E-UI (STP §2.3) | ❌ **FILE NOT CREATED** |

**2 of the 6 test files declared in STP §2.3 do not exist** (`diagnostics-feed-config.test.ts`, `feed-extension-host.e2e.test.ts`).

### 2.3 Non-SA4E-185 Failures (Excluded — pre-existing / environment)

| Suite | Failures | Reason excluded |
|-------|----------|-----------------|
| `src/__tests__/powershell-transport.test.ts` | 14 | Pre-existing SA4E-81 proxy/PowerShell transport tests; mocks not intercepting under Node v22 — unrelated to diagnostics feed |
| `src/webview/__tests__/slash-menu.integration.test.ts` + `slash-menu.unit.test.ts` | 6 + 4 | **Pre-existing** — documented in STATUS.json devops note (`12 pre-existing failures in auth/slash-menu`); agent list grew 6→9 |
| `src/proxy/__tests__/proxy-detection-service.test.ts` | 4 | Pre-existing Windows registry-proxy parsing mocks — unrelated |
| `src/auth/__tests__/auth-manager.test.ts` | 2 | **Pre-existing** auth session-mock failures |
| `src/langgraph/__tests__/chat-workspace-review-real-llm.test.ts` | 1 | Requires a real LLM (localhost:1234/v1); recursion-limit on real repo — integration env test, unrelated |
| `src/__tests__/cross-process.e2e.test.ts` + `drawio-convert.e2e.test.ts` | 2 suites (failed to start) | Environment: `backend/node_modules/tsx/dist/cli.mjs` missing (backend deps not installed). Not part of default `npm test` (excluded `**/*.e2e.test.ts`). |

**None of the 31 failures touch SA4E-185 code or its test files. SA4E-185 regression impact: 0.**

### 2.4 Blocker B5 — Full Hook Suite (SECURITY-CODE-REVIEW B5 / C-8)

| Check | Result | Evidence |
|-------|--------|----------|
| `npx vitest run src/langgraph/__tests__/hook-loader.test.ts src/langgraph/__tests__/hook-executor.test.ts` | ✅ **25/25 PASS** | 2 files, 0 failures |
| DR-1 does not break existing hook definitions | ✅ | loader/executor regressions green |
| No shipped default `runCommand` hook matches `write_file` | ✅ | hook suites assert no command hooks auto-fire for the write family (C-8) |
| `write_file: "write"` classification present (OI-1) | ✅ | `hook-tool-matcher.ts:14` (source-verified) |

**B5 verdict: ✅ CLOSED — full hook suite passes after DR-1.**

---

## 3. Pass/Fail per STC (78 cases)

> Status legend: ✅ PASS (genuine assertion) · ⚠️ PARTIAL (weaker/other-level) · ⏭️ SKIPPED (`describe.skip`) · ❌ MISSING (no automated test) · 🟥 VACUOUS (no real assertion) · 📋 NOT RUN (SIT manual).

### 3.1 PBT — Property-Based Testing (planned 8)

| STC | Scenario | Status | Evidence / Note |
|-----|----------|--------|-----------------|
| STC-01 | Summary ≤ 8000 chars | ⚠️ PARTIAL | Invariant covered by fixed-value unit test (STC-19 analog). **No fast-check property in diagnostics suite.** |
| STC-02 | Caps 20/file, 50 total + marker | ⚠️ PARTIAL | Covered by UT STC-18 analog. Not property-based. |
| STC-03 | Dedupe (file,line,code) | ⚠️ PARTIAL | Covered by UT STC-17 analog. |
| STC-04 | Filter → touched files only | ⚠️ PARTIAL | Covered by UT STC-13 analog. |
| STC-05 | Severity mapping totality | ❌ MISSING | No test; `mapSeverity` unmapped-value exclusion untested. |
| STC-06 | sanitizeMessage (C-1) | ⚠️ PARTIAL | Covered by UT STC-33 analog (control chars, directives, secrets). |
| STC-07 | toWorkspaceRelative containment (C-3) | ✅ PASS | 4-case unit block: `../`, absolute, UNC, in-workspace (test :420-440). |
| STC-08 | Line clamp 1..lineCount | ⚠️ PARTIAL | Test covers unknown-lineCount (no clamp); known-line clamp source-verified only. |

### 3.2 UT — Unit Testing (planned 29)

| STC | Scenario | Status | Evidence / Note |
|-----|----------|--------|-----------------|
| STC-09 | Subscription lifecycle | ⚠️ PARTIAL | `start()` listener asserted; `stop()` only "does not throw" — detachment/dispose not asserted. |
| STC-10 | Debounce burst → 1 batch | ⏭️ SKIPPED | `describe.skip(…"requires integration env")` — NOT covered at any level. **D2** |
| STC-11 | No flush before 300 ms | ⏭️ SKIPPED | Same — no coverage. **D2** |
| STC-12 | Workspace/file-scheme scope | ⏭️ SKIPPED | Same — no coverage. **D2** |
| STC-13 | Touched-file filter | ✅ PASS | UT test keeps only touched file. |
| STC-14 | markTouchedFromTool all write tools (OI-1) | ✅ PASS | write_file/fs_write/stream_write_file/str_replace/idempotent. |
| STC-15 | Non-write tools ignored | ✅ PASS | read_file/web_search/no-path skipped. |
| STC-16 | Summary line format | ✅ PASS | with/without code, single-space, five fields. |
| STC-17 | Dedupe + line clamp | ✅ PASS | |
| STC-18 | Caps N/M + marker | ✅ PASS | ≤50 lines + "more diagnostics suppressed". |
| STC-19 | Budget guard ≤ 8000 | ✅ PASS | pathological 10k-char message truncated. |
| STC-20 | Toggle off mid-window | ✅ PASS | epoch/timer/pending cleared, take→null. |
| STC-21 | Toggle resume false→true | ⏭️ SKIPPED | No coverage. **D2** |
| STC-22 | Toggle discards pending batch | ✅ PASS | |
| STC-23 | Default enabled | ✅ PASS | isEnabled true on missing config. |
| STC-24 | takePendingSummary read-once | ✅ PASS | |
| STC-25 | Headless → disabled, no throw | ⚠️ PARTIAL | construction+disabled asserted; event-ignored path not asserted. |
| STC-26 | classifyTool("write_file")==="write" | ❌ MISSING | Fix at `hook-tool-matcher.ts:14`, **no regression test**. **D6** |
| STC-27 | Epoch guard RC-1 | ✅ PASS | stale flush aborted. |
| STC-28 | clearSession resets RC-6 | ✅ PASS | |
| STC-29 | inject node no-op (E-8) | ✅ PASS | null + undefined. |
| STC-30 | inject node read-once (E-7) | ✅ PASS | |
| STC-31 | Channel default "" + LWW | ✅ PASS | 4 tests incl. fresh-default-per-invocation. |
| STC-32 | Auto-fix severity-token trigger (C-1) | ✅ PASS | Graph-level real assertion in IT STC-43 (case 3) + source regex `/^\S+:\d+ error /m` (`chat-graph.ts:264`). |
| STC-33 | sanitizeMessage C-1 | ✅ PASS | control chars + directive neutralization. |
| STC-34 | Header reflects toggle | ✅ PASS | on/off. |
| STC-35 | Buffer caps C-4 | ⏭️ SKIPPED | Overflow/touched-bound not tested (caps source-verified: 256/500). **D2** |
| STC-36 | Secret shielding C-5 | ✅ PASS | sk-/AKIA/PEM redacted. |
| STC-37 | Per-tab scoping C-7 | ❌ MISSING | Mitigation source-verified (`clearSession()` per invoke, engine:341); NF-4 residual open. **D8** |

### 3.3 IT — Integration Testing (planned 16)

| STC | Scenario | Status | Evidence / Note |
|-----|----------|--------|-----------------|
| STC-38 | HookEngine file hooks fire for write_file | ⚠️ PARTIAL | Hook suites pass (B5); direct write_file→fileHook assertion absent. |
| STC-39 | executeSingleTool → markTouchedFromTool | ⚠️ PARTIAL | Source-verified (`chat-graph-nodes.ts:351`) — no dedicated test. |
| STC-40 | Feed never via injectedPrompts (OI-2) | ⚠️ PARTIAL | Source-verified (`chat-graph-nodes.ts:341-344`) — no dedicated test. |
| STC-41 | Consume-once end-to-end | ✅ PASS | Turn1 has feed, turn2 doesn't. |
| STC-42 | Loop re-entry freshness | ⚠️ PARTIAL | Asserts `pendingSummary` ready; not full next-turn prompt injection. |
| STC-43 | Auto-fix advisory errors-only | ✅ PASS | 3 cases incl. warning-with-"error" real assertion; also asserts B1 wording + B3 boundary sentence + fence delimiters. |
| STC-44 | Iteration bound at 12 | ⚠️ PARTIAL | Asserts `agentIterations ≥ 11`; does not assert `routeAfterToolExec → synthesize`. |
| STC-45 | No-op when disabled | 🟥 **VACUOUS** | `expect(true).toBe(true)` placeholder. **D1** |
| STC-46 | Injection race E-9/RC-3 | ❌ MISSING | No test. **D2** |
| STC-47 | Multiple flushes → one summary RC-4 | ❌ MISSING | No test. **D2** |
| STC-48 | Prompt ordering kbContext → feed | ⚠️ PARTIAL | Feed-block presence asserted; kbContext ordering not. |
| STC-49 | Both graph variants wired | ⚠️ PARTIAL | Only asserts graph compiles (both variants). |
| STC-50 | agent_step clears all paths F-10 | ⚠️ PARTIAL | Text path only; source has `diagnosticsContext:""` at 6 sites vs STC "7 paths". **D7** |
| STC-51 | routeAfterToolExec → inject_diagnostics | ⚠️ PARTIAL | Asserts toolCalls defined — weak. |
| STC-52 | Cross-invocation hygiene RC-6 | ❌ MISSING | No dedicated test (channel fresh-default covered by STC-31 test 4). |
| STC-53 | Full hook suite C-8 | ✅ PASS | B5 — 25/25. |

### 3.4 E2E-API — agent-tool / graph API level (planned 12)

| STC | Scenario | Status | Evidence / Note |
|-----|----------|--------|-----------------|
| STC-54 | Full pipeline happy path (AC-1/2/3) | ❌ MISSING | No full write→LSP→debounce→filter→inject→turn test. **D3** |
| STC-55 | Auto-fix re-feed loop (AC-7) | ❌ MISSING | No test. **D3** |
| STC-56 | Auto-fix bounded at 12 (E2E) | ⚠️ PARTIAL | Only STC-44 partial IT coverage. |
| STC-57 | Toggle off/on in pipeline (AC-6) | ⚠️ PARTIAL | UT-level only; graph-level toggle untested. |
| STC-58 | Toggle discards pending (E2E) | ⚠️ PARTIAL | UT-level only (STC-22). |
| STC-59 | Caps in real pipeline | ⚠️ PARTIAL | UT-level only (STC-18). |
| STC-60 | Prompt-injection fence E2E (C-1) | ✅ PASS | Fence delimiters + boundary sentence asserted at graph level (IT STC-43) + sanitize at STC-33; hostile payloads neutralized. |
| STC-61 | Approval gate at production wiring (C-2) | ⚠️ PARTIAL | Node-level wiring test (real gate + `createExecuteToolsNode`) + **source-verified production chain** engine→builder→router→chat-graph→execute_tools. Not a full graph invoke. |
| STC-62 | fs_write/str_replace/fs_append dangerous (C-2) | ✅ PASS | classifier test + `it.each` approval-wait test — both green. |
| STC-63 | Path-traversal containment E2E (C-3) | ⚠️ PARTIAL | Unit-level C-3 + `markTouchedFromTool` rejection; no full-pipeline E2E. |
| STC-64 | Consume-once across invocations | ⚠️ PARTIAL | STC-31 "fresh default per invocation" test. |
| STC-65 | No per-event LLM round-trip | ❌ MISSING | No LLM-call-count assertion. **D3** |

### 3.5 E2E-UI — VS Code Extension Host level (planned 6)

| STC | Scenario | Status | Evidence / Note |
|-----|----------|--------|-----------------|
| STC-66 | Setting registered, default true | ❌ MISSING | Source-verified only (`package.json:222-226` default `true`). No extension-host test. **D4** |
| STC-67 | Settings-UI toggle, no reload | ❌ MISSING | Watcher source-verified (`extension.ts:207-211`). **D4** |
| STC-68 | Real editor diagnostics reach agent | ❌ MISSING | **D4** |
| STC-69 | Agent self-corrects real error | ❌ MISSING | **D4** |
| STC-70 | Toggle off → loop unchanged | ❌ MISSING | **D4** |
| STC-71 | Restart clears session state | ❌ MISSING | **D4** |

> `feed-extension-host.e2e.test.ts` (STP §2.3) does not exist; `@vscode/test-electron`/Playwright are not in `extension/package.json` devDependencies.

### 3.6 SIT — System Integration (manual, planned 7)

| STC | Scenario | Status |
|-----|----------|--------|
| STC-72 | Summary formatting readability | 📋 NOT RUN (needs human/visual + packaged VSIX) |
| STC-73 | Injection latency perception ≤ 500 ms | 📋 NOT RUN |
| STC-74 | Chat-panel indicator (deferred nice-to-have) | 📋 NOT RUN (mark SKIPPED if not shipped) |
| STC-75 | Long session / memory | 📋 NOT RUN |
| STC-76 | Workspace-trust decision (C-6 / B4) | 📋 NOT RUN — **product decision pending (SM/PM)** |
| STC-77 | Cross-platform Windows + macOS | 📋 NOT RUN (Windows verified at source/unit level only) |
| STC-78 | Memory stability | 📋 NOT RUN |

---

## 4. Defect Summary

> **8 defects found during execution (0 Critical, 4 Major, 4 Minor). All are test-coverage / test-quality defects — no functional defect was found in the delivered core implementation.** Core functional code is verified by passing tests + source inspection; the security controls (C-1/C-2/C-3) are confirmed implemented and covered by genuinely asserting tests.

<a id="bug-d1"></a>
### D1: STC-45 "No-op when disabled" is a vacuous test — 🟥 OPEN

| Field | Value |
|-------|-------|
| Severity | Major |
| Priority | P2 |
| Test Case | STC-45 |
| Component | `chat-graph-diagnostics.integration.test.ts` (STC-45 block) |
| Status | **OPEN** |
| Found | Round 1 (2026-08-20) |

**Description:** The only assertion is `expect(true).toBe(true)` with comment *"Placeholder - actual check would need state inspection"*. It passes without proving the scenario.
**Root cause:** Graph-state channel inspection was deferred instead of implemented.
**Fix (DEV):** Assert `diagnosticsContext` stays `""` across a disabled-feed graph invoke (or compare loop output vs baseline graph with no feed wired).

---

<a id="bug-d2"></a>
### D2: 5 STC-declared unit scenarios skipped (`describe.skip`) with no replacement coverage — 🟥 OPEN

| Field | Value |
|-------|-------|
| Severity | Major |
| Priority | P2 |
| Test Case | STC-10, STC-11, STC-12, STC-21, STC-35 |
| Component | `diagnostics-feed-service.test.ts` (`describe.skip` blocks) |
| Status | **OPEN** |
| Found | Round 1 (2026-08-20) |

**Description:** STC assigns these to UT level (fake timers). The implementation marks them `"requires integration env"` and skips them; **no IT/E2E replacement covers debounce-burst timing (STC-10/11), workspace/file-scheme scoping (STC-12), toggle-resume (STC-21), or buffer-cap overflow (STC-35)** (STC-46 injection-race and STC-47 multi-flush-merge are also absent).
**Root cause:** Test implementation deviates from STC scope instead of re-baselining STC or providing IT-level coverage.
**Fix (QA+DEV):** Either implement the skipped tests at UT/IT level with the mocked-vscode emitter + fake timers as STC specifies, or formally re-baseline the STC with an explicit IT-level substitute and re-approve.

---

<a id="bug-d3"></a>
### D3: E2E-API level 9/12 cases not implemented — 🟥 OPEN

| Field | Value |
|-------|-------|
| Severity | Major |
| Priority | P2 |
| Test Case | STC-54, STC-55, STC-56(partial), STC-57/58/59(E2E), STC-63(E2E), STC-65 |
| Component | `chat-graph-diagnostics.integration.test.ts` (STP §2.3 "extended") |
| Status | **OPEN** |
| Found | Round 1 (2026-08-20) |

**Description:** STP declared E2E-API = 12 automated. Only STC-60 (fence, via IT), STC-61 (partial), STC-62 are meaningfully covered. Full-pipeline happy path, auto-fix re-feed loop, pipeline-level toggle/discard/caps, per-event LLM round-trip are not tested at graph level.
**Root cause:** STC was written beyond the implemented test scope; no dedicated E2E-API file was created.
**Fix (QA+DEV):** Add the missing E2E-API scenarios to `chat-graph-diagnostics.integration.test.ts` (full graph invoke with wired feed + scripted LLM) or formally reduce/re-scope the STC E2E-API level with SME sign-off.

---

<a id="bug-d4"></a>
### D4: E2E-UI level 0/6 cases delivered — 🟥 OPEN

| Field | Value |
|-------|-------|
| Severity | Major |
| Priority | P2 |
| Test Case | STC-66 .. STC-71 |
| Component | `feed-extension-host.e2e.test.ts` (missing); `extension/package.json` devDependencies |
| Status | **OPEN** |
| Found | Round 1 (2026-08-20) |

**Description:** STP §2.3 declares `feed-extension-host.e2e.test.ts` with `@vscode/test-electron`/Playwright. The file does not exist and the dependencies are absent. Setting default is verified by source inspection only (STC-66).
**Root cause:** E2E-UI infrastructure deps were never added to the extension.
**Fix (QA+DEV/DevOps):** Add `@vscode/test-electron` (+ Playwright) devDependencies, create the extension-host E2E file, wire to CI (`test:e2e` script), or explicitly de-scope E2E-UI to SIT manual with STC re-approval.

---

<a id="bug-d5"></a>
### D5: PBT level not implemented as property-based tests — 🟥 OPEN (Minor)

| Field | Value |
|-------|-------|
| Severity | Minor |
| Priority | P3 |
| Test Case | STC-01 .. STC-08 |
| Component | diagnostics suite (no `fast-check` usage) |
| Status | **OPEN** |
| Found | Round 1 (2026-08-20) |

**Description:** No `fc.*` property tests exist for `buildSummary`/`filter`/`sanitizeMessage`/`toWorkspaceRelative`. STC-05 (severity totality) uncovered; other properties only have fixed-value analogs.
**Root cause:** PBT frame planned in STP §2.1 not implemented.
**Fix (QA+DEV):** Add fast-check properties ≤ 20 lines each, or re-baseline STC PBT level as "covered by parametrized unit cases".

---

<a id="bug-d6"></a>
### D6: STC-26 (DR-1 classification) has no regression test — 🟥 OPEN (Minor)

| Field | Value |
|-------|-------|
| Severity | Minor |
| Priority | P3 |
| Test Case | STC-26 |
| Component | `hook-tool-matcher.ts:14` |
| Status | **OPEN** |
| Found | Round 1 (2026-08-20) |

**Description:** `write_file: "write"` fix is source-verified but no test pins `classifyTool("write_file") === "write"` or `WRITE_TOOL_NAMES` fallback — the OI-1 regression could silently reappear.

---

<a id="bug-d7"></a>
### D7: F-10 clear-path count discrepancy (STC "7 paths" vs source 6) — 🟥 OPEN (Minor)

| Field | Value |
|-------|-------|
| Severity | Minor |
| Priority | P3 |
| Test Case | STC-50 |
| Component | `chat-graph-nodes.ts` (125, 186, 190, 204, 221, 232) |
| Status | **OPEN** |
| Found | Round 1 (2026-08-20) |

**Description:** Source shows 6 `diagnosticsContext:""` clear sites; STC/F-10 documents 7. Terms must be reconciled (either 7th path was merged upstream, or STC overstates). Only the text path is tested.

---

<a id="bug-d8"></a>
### D8: STC-37 per-tab scoping untested; NF-4 singleton `pendingSummary` residual — 🟥 OPEN (Minor)

| Field | Value |
|-------|-------|
| Severity | Minor |
| Priority | P3 |
| Test Case | STC-37 |
| Component | `langgraph-engine.ts:64` (singleton feed) / `inject-diagnostics-node.ts` |
| Status | **OPEN** (security review NF-4 non-blocking) |
| Found | Round 1 (2026-08-20) |

**Description:** Mitigation via `clearSession()` per invoke is source-verified, but no test proves tab isolation; the singleton `pendingSummary` residual (NF-4) remains a documented Low/Minor cross-tab risk.

---

## 5. Test Metrics

| Metric | Target (STP §9) | Actual | Status |
|--------|-----------------|--------|--------|
| Full-suite pass | — | 1444/1496 (96.5%) | ⚠️ 31 pre-existing failures (0 SA4E-185) |
| SA4E-185 file pass rate | 100% | 100% (57 + 25 + 13 approval/classifier = 0 failures) | ✅ Met |
| Type-check | 0 errors | 0 errors | ✅ Met |
| Automation ratio (planned) | ≥ 90% (91%) | **70.4% executing meaningful** (50/71) | ❌ Not met |
| Automated cases fully PASS | 71 | 26 (36.6%) | ❌ Not met |
| Automated cases executing (PASS+PARTIAL) | 71 | 50 (70.4%) | ❌ Not met |
| Skipped/missing automated | 0 | 20 (5 skipped + 15 missing) | ❌ Not met |
| Critical defects | 0 | 0 | ✅ Met |
| Major defects | ≤ 1 open | 4 open (D1..D4 — test-coverage) | ❌ Not met |
| Security conditions C-1/C-2/C-3 | 100% | B1✅ B2✅ B3✅ B5✅ · B4 (C-6) open | ⚠️ 4/5 closed |
| Hook suite (B5/C-8) | all pass | 25/25 | ✅ Met |

---

## 6. Evidence Files

| File | Description | Section |
|------|-------------|---------|
| (runtime logs captured in execution transcript) | Full suite + diagnostics + hook suite outputs | §2.1/§2.2/§2.4 |
| `testdata/*.csv` (7 files) | Test-data fixtures per STC §8 | STC §8 |
| Source references (this report) | `chat-graph.ts:257-266` (fence), `diagnostics-feed-service.ts:312-344` (containment), `router-graph.ts:85` + `chat-graph-nodes.ts:311-312` (gate), `chat-graph-nodes.ts:351` (touch), `chat-graph-nodes.ts:341-344` (OI-2), `state.ts:68` (channel) | §7 |

> No screenshots taken — this round is automated + static source verification, no browser execution (E2E-UI infra not delivered, D4). SIT evidence (screenshots) to be captured when manual SIT runs.

---

## 7. Conclusion

**Manual source-verification results (task item 4):**

| Verify item | Result | Evidence |
|-------------|--------|----------|
| Diagnostics feed service | ✅ MATCH | Debounce 300 ms, epoch guard RC-1, read-once BR-7, caps 20/50/8000 (V13), buffer caps 256/500 (C-4), secret redaction (C-5), headless-fail-safe, `setEnabled` epoch++ |
| inject-diagnostics-node | ✅ MATCH | No-op when feed null (E-8), read-once transport (BR-7), single-writer of `diagnosticsContext`, channel LWW + default `""` (`state.ts:68`) |
| Chat-graph fence (F-01 / C-1) | ✅ MATCH | `<<<BEGIN/END_DIAGNOSTICS_DATA>>>` + authority-boundary sentence (B3) + severity-token auto-fix trigger `/^\S+:\d+ error /m` (B2, NF-1 closed) + advisory states real approval requirement (B1 wording) — `chat-graph.ts:257-266` |
| Approval gate (F-02 / C-2) | ✅ MATCH | Production chain verified: `langgraph-engine.ts:69` creates `ToolApprovalGate` → `graph-builder.ts:41` → `router-graph.ts:85` → `chat-graph.ts:298/321` → `chat-graph-nodes.ts:311-312` (`requestApproval`); `DANGEROUS_TOOL_PATTERNS` includes `fs_write`/`str_replace`/`fs_append` |
| Path containment (F-03 / C-3) | ✅ MATCH | `toWorkspaceRelative` total containment (traversal/absolute/UNC/`file://` → null), allowlist+classify for touched-set, prefix-sibling safe (`wsRootNorm + "/"`) |

**Security-blocker closure at QA gate:**

| Blocker | Status |
|---------|--------|
| B1 (C-2 approval gate wired + dangerous patterns) | ✅ **CLOSED** (source + tests) |
| B2 (C-1 severity-token trigger + real assertion) | ✅ **CLOSED** |
| B3 (C-1 authority-boundary sentence) | ✅ **CLOSED** |
| B4 (C-6 default-ON product decision) | ⏳ **OPEN — SM/PM decision + SIT-76** |
| B5 (C-8 full hook suite post-DR-1) | ✅ **CLOSED at QA gate (25/25)** |

| Metric | Result |
|--------|--------|
| SA4E-185 execution pass rate | 100% (executed diagnostics/hook/approval tests — 0 failures) |
| Full-suite regression | 0 SA4E-185-related failures (31 pre-existing excluded) |
| Type-check | PASS |
| STC automated-case parity | 50/71 executing (70.4%); 26/71 full PASS (36.6%) |
| Bugs found | 8 (0 Critical, 4 Major — test coverage, 4 Minor) |
| Bugs resolved | 0/8 (first round; fixes not applied) |
| RTM requirement coverage | **99/100 rows (99%)** — RC-4 (STC-47) has no executing test; all other requirement rows have ≥1 executing test |
| B4 product decision | OPEN — required before unconditional release |

**Recommendation:** ⚠️ **CONDITIONAL PASS, not yet release-ready per Phase-6 quality gate.** The core implementation and all security controls (C-1/C-2/C-3, blockers B1/B2/B3/B5) are verified. **Block release until**: (1) D1 vacuous test fixed, (2) D3/D4 coverage delivered or STC formally re-baselined and re-approved (STP/STC v1.1), (3) D2 skipped cases either implemented or re-baselined, (4) B4 (C-6) product decision recorded, (5) SIT STC-72..78 executed (manual). Defects D5-D8 are Minor/non-blocking for release but should be scheduled.

---

## Appendix A: Re-Test History

> No re-test rounds were performed in this execution (first execution round). The 8 defects above were found during Round 1 and are OPEN — no fixes applied, no re-runs executed.

```
Round 1 (2026-08-20) → 57/57 executed diagnostics PASS · hook suite 25/25 PASS · tsc clean ·
                       8 defects found (D1..D8) · verdict CONDITIONAL PASS
```

| Bug | Round 1 | Final |
|-----|---------|-------|
| D1 (STC-45 vacuous) | Found | OPEN |
| D2 (5 skipped UT) | Found | OPEN |
| D3 (E2E-API gaps) | Found | OPEN |
| D4 (E2E-UI absent) | Found | OPEN |
| D5 (PBT not property-based) | Found | OPEN (Minor) |
| D6 (STC-26 pin) | Found | OPEN (Minor) |
| D7 (F-10 count) | Found | OPEN (Minor) |
| D8 (STC-37 / NF-4) | Found | OPEN (Minor) |

*End of TEST-EXECUTION-REPORT — SA4E-185 v1.0 (2026-08-20).*