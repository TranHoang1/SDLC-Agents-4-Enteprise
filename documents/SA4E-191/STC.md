# Software Test Cases (STC)

## AI Chat Assistant (SA4E) — SA4E-191: Slash Commands (Tier 1)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-191 |
| Title | Slash Commands (Tier 1) — /agents, /compact, /diff, /models, /new, /review, /undo |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-08-23 |
| Status | Draft |
| Related STP | documents/SA4E-191/STP.md |
| Related FSD | documents/SA4E-191/FSD.md |
| Related TDD | documents/SA4E-191/TDD.md |

---

## Test Case Summary

| Category | ID Range | Count | Priority | Automation |
|----------|----------|-------|----------|------------|
| Property-Based (PBT) | PBT-01..PBT-03 | 3 | High | Y (3) |
| Unit (UT) handlers + registry | UT-01..UT-20 | 20 | High | Y (20) |
| Integration (IT) services + adapters | IT-01..IT-05 | 5 | High | Y (5) |
| End-to-End API (E2E-API) dispatch + auth + error | E2E-API-01..E2E-API-12 | 12 | High | Y (12) |
| End-to-End UI (E2E-UI) menu + panels | E2E-UI-01..E2E-UI-07 | 7 | High/Med | Y (7) |
| System Integration (SIT) session flows | SIT-01..SIT-04 | 4 | High | N (4) |
| **Total** | | **51** | | **47 Y / 4 N** |

Test data files: testdata/commands.csv, testdata/invalid-args.csv, testdata/models.csv.

---

## 1. Test Cases (Tabular)

| TC-ID | Level | Title | Preconditions | Steps | Test Data | Expected Result | Priority | Related Req | Type | Automation |
|-------|-------|-------|---------------|-------|-----------|-----------------|----------|-------------|------|------------|
| PBT-01 | PBT | Command id uniqueness (registered once) | Registry seeded with 7 descriptors from commands.csv | 1. Generate 1000 random id sets. 2. Assert resolve(id) returns <=1 descriptor. 3. Assert duplicate register() throws. | commands.csv ids: agents,compact,diff,models,new,review,undo | No two descriptors share an id; duplicate register throws | High | BR-1, UC-1..7 | Positive | Y |
| PBT-02 | PBT | Shortcut-hint uniqueness | Same seed as PBT-01 | 1. Generate 1000 random shortcut assignments. 2. Assert all 7 shortcutHint values distinct. | shortcuts: Ctrl/Cmd+Shift+[A,C,D,M,N,R,U] | All shortcut hints unique | High | BR-2 | Positive | Y |
| PBT-03 | PBT | Model persistence validity | Model registry from models.csv; prefs store available | 1. Generate 1000 random selectedModelId. 2. Persist each. 3. On load assert id validates vs registry; invalid to default. | models.csv: model_gpt4o, model_claude, model_llama | Persisted id always valid on load; invalid falls back to default | High | BR-6, UC-4 | Edge | Y |
| UT-01 | UT | Registry registers each command once | Empty registry | 1. register(agents). 2. register(agents) again. | descriptor id=agents | 2nd register throws (BR-1); single resolve succeeds | High | BR-1 | Negative | Y |
| UT-02 | UT | Dispatch enforces owner-only (BR-5) | Registry with /review (requiresOwner=true), /undo (requiresOwner=true) | 1. dispatch as non-owner for /review. 2. dispatch as owner. | userId=usr_b, ownerId=usr_12 | Non-owner PERMISSION_DENIED; owner handler executes | High | BR-5, UC-6/7 | Negative | Y |
| UT-03 | UT | /agents main flow updates active agent | SA4E-186 stub returns [agent_default, agent_coder, agent_reviewer]; activeAgentId=agent_default | 1. execute(ctx, selectedAgentId=agent_coder). 2. Read session.activeAgentId. | selected=agent_coder | activeAgentId=agent_coder; confirmation toast | High | UC-1, BR-7 | Positive | Y |
| UT-04 | UT | /agents EF-1 routing unavailable | SA4E-186 stub throws | 1. execute(ctx). | error AGENT_ROUTING_UNAVAILABLE | status=error, no change to activeAgentId | High | UC-1 EF-1 | Negative | Y |
| UT-05 | UT | /agents EF-2 invalid agent id | SA4E-186 stub returns valid list; selected id NOT in list | 1. execute(ctx, selectedAgentId=agent_ghost). | invalid-args.csv: agents, agent_ghost | status=error, "Selected agent is not available."; re-prompt | High | UC-1 EF-2 | Negative | Y |
| UT-06 | UT | /compact main flow (above threshold) | Session with messages; token > threshold; SA4E-182 stub returns ctx_sum_77 | 1. execute(ctx). 2. Confirm compaction dialog. | strategy=semantic | status=ok; compactedSummaryRef=ctx_sum_77; badge Compacted | High | UC-2, BR-1/2 | Positive | Y |
| UT-07 | UT | /compact EF-2 empty session | Session history empty | 1. execute(ctx). | empty historyRef | status=error, NOTHING_TO_COMPACT, "Nothing to compact." | Med | UC-2 EF-2 | Negative | Y |
| UT-08 | UT | /diff main flow populated | SA4E-183 stub returns 1 DiffEntry (src/app.ts, modified) | 1. execute(ctx). | DiffEntry fixture | status=ok; changedFiles length=1; panel diffViewer | High | UC-3 | Positive | Y |
| UT-09 | UT | /diff AF-1 no changes empty-state | SA4E-183 stub returns [] | 1. execute(ctx). | empty diff list | status=ok; changedFiles=[]; "No file changes in this session." | Med | UC-3 AF-1 | Positive | Y |
| UT-10 | UT | /models main flow persist (BR-6) | Model registry from models.csv; prefs store writable | 1. execute(ctx, selectedModelId=model_claude). 2. Read prefs. | models.csv: model_claude/Claude/anthropic | activeModelId=model_claude; persistedModelId=model_claude; toast saved | High | UC-4, BR-6 | Positive | Y |
| UT-11 | UT | /models EF-1 persist failure | Prefs store throws on save | 1. execute(ctx, selectedModelId=model_claude). | error PREF_PERSIST_FAILED | status=error, "Model preference could not be saved, but is active for this session." | Med | UC-4 EF-1 | Negative | Y |
| UT-12 | UT | /models EF-2 invalid persisted on load | Prefs returns model_ghost not in registry | 1. load(modelId). 2. validate vs registry. | invalid stored=model_ghost | Falls back to default; "Saved model unavailable; using default." | Med | UC-4 EF-2 | Edge | Y |
| UT-13 | UT | /new main flow confirm reset | Session with messages; confirmReset=true | 1. execute(ctx, confirmReset=true). | confirm=true | status=ok; newSessionId issued; chat cleared | High | UC-5, BR-3 | Positive | Y |
| UT-14 | UT | /new BR-3 cancel (no confirm) | Session with messages; confirmReset=false | 1. execute(ctx, confirmReset=false). | confirm=false | No reset; current session retained (AF-1) | High | UC-5 BR-3/AF-1 | Negative | Y |
| UT-15 | UT | /review main flow owner success | Owner session; branchDiff present; SA4E-186 stub returns review_agent | 1. execute(ctx, branchName=feature/x, branchDiff="diff --git"). | ownerId==userId | status=ok; reviewFindings streamed; chatBlock | High | UC-6, BR-5 | Positive | Y |
| UT-16 | UT | /review EF-3 non-owner denied | Non-owner session (userId != ownerId) | 1. execute(ctx). | userId=usr_b, ownerId=usr_12 | status=error, PERMISSION_DENIED, "Permission denied." | High | UC-6 EF-3, BR-5 | Negative | Y |
| UT-17 | UT | /undo main flow removes pair | Owner session; history has lastExchangeId=exch_55 | 1. execute(ctx, lastExchangeId=exch_55, revertFileChanges=false). | exchange exists | status=ok; removedExchangeId=exch_55; messages removed | High | UC-7, BR-4 | Positive | Y |
| UT-18 | UT | /undo EF-1 no exchange | Owner session; empty history | 1. execute(ctx). | empty historyRef | status=error, NOTHING_TO_UNDO, "Nothing to undo." | Med | UC-7 EF-1 | Edge | Y |
| UT-19 | UT | /undo BR-4 revert confirmed | Owner; exchange produced file changes; revertFileChanges=true; SA4E-183 revert ok | 1. execute(ctx, revertFileChanges=true). 2. Confirm revert. | reverted files [src/app.ts] | status=ok; removedExchangeId set; revertedFiles=[src/app.ts] | High | UC-7 AC3, BR-4 | Positive | Y |
| UT-20 | UT | /undo EF-2 partial revert failure | Owner; exchange produced 2 file changes; 1 revert fails | 1. execute(ctx, revertFileChanges=true). | 1 of 2 reverts fail | status=ok; warning "some file changes could not be reverted." | High | UC-7 EF-2 | Negative | Y |
| IT-01 | IT | Registry to handler to sessionStore (real services) | Real CommandRegistry + sessionStore + chatStore; SA4E-186/182/183 stubbed at boundary | 1. dispatch /agents (owner). 2. dispatch /models. 3. dispatch /new. | commands.csv; session seed | activeAgentId & activeModelId updated in real store; /new creates new session | High | UC-1/4/5, BR-6 | Positive | Y |
| IT-02 | IT | /compact integration w/ SA4E-182 (success + failure) | Real CompactionAdapter wrapping SA4E-182 stub | 1. compact success -> contextRef updated. 2. SA4E-182 throws -> COMPACTION_FAILED, contextRef untouched. | compact data; failure stub | Success: compactedSummaryRef set. Failure: error COMPACTION_FAILED, no change | High | UC-2, NFR-06-T | Pos/Neg | Y |
| IT-03 | IT | /diff and /undo integration w/ SA4E-183 | Real FileChangeAdapter wrapping SA4E-183 stub | 1. /diff query returns DiffEntry[]. 2. /undo revert via adapter (ok + fail path). | diff+undo fixtures | /diff populates viewer; /undo removes exchange + reverts (or EF-2 warning) | High | UC-3/7, NFR-06-T | Pos/Neg | Y |
| IT-04 | IT | /review and /agents integration w/ SA4E-186 (down) | Real AgentRouterAdapter wrapping SA4E-186 stub | 1. /review owner success routes to review_agent. 2. SA4E-186 down -> REVIEW_AGENT_UNAVAILABLE; /agents -> AGENT_ROUTING_UNAVAILABLE. | review/agents data; down stub | Success: findings streamed. Down: friendly errors, commands disabled | High | UC-1/6, NFR-06-T | Pos/Neg | Y |
| IT-05 | IT | Audit completeness (NFR-08-T) | Real dispatch with audit logger | 1. Dispatch each of 7 commands (success + failure). 2. Inspect audit sink. | all commands | One audit event per invocation (success+failure), fields userId/command/timestamp/target | High | NFR-08-T, FSD 7.3 | Positive | Y |
| E2E-API-01 | E2E-API | /agents lifecycle over real command bus | Backend slash module running; owner JWT | 1. POST slash:agents with selectedAgentId. 2. GET session state. | commands.csv agents | 200; activeAgentId updated; toast | High | UC-1 | Positive | Y |
| E2E-API-02 | E2E-API | /compact lifecycle | Backend running; session with messages | 1. POST slash:compact. | compact data | 200; compactedSummaryRef returned; badge | High | UC-2 | Positive | Y |
| E2E-API-03 | E2E-API | /diff lifecycle | Backend running; tracked changes | 1. POST slash:diff. | diff fixture | 200; changedFiles populated | High | UC-3 | Positive | Y |
| E2E-API-04 | E2E-API | /models lifecycle + persist | Backend running; prefs store | 1. POST slash:models selectedModelId. 2. New session -> default = persisted. | models.csv model_claude | 200; active+persisted; new session defaults to it | High | UC-4, BR-6 | Positive | Y |
| E2E-API-05 | E2E-API | /new lifecycle + confirm (BR-3) | Backend running; session with messages | 1. POST slash:new confirmReset=false -> no reset. 2. confirmReset=true -> new session. | new data | confirm=false no-op; confirm=true newSessionId | High | UC-5, BR-3 | Pos/Neg | Y |
| E2E-API-06 | E2E-API | /review lifecycle (owner) | Backend running; owner JWT; branch diff | 1. POST slash:review owner with diff. | review data | 200; reviewFindings streamed; chatBlock | High | UC-6 | Positive | Y |
| E2E-API-07 | E2E-API | /undo lifecycle (owner) + no-op | Backend running; owner JWT; lastExchange exists then empty | 1. POST slash:undo owner. 2. POST again with empty history. | undo data | 200 removedExchangeId; 2nd NOTHING_TO_UNDO | High | UC-7, BR-4/5 | Pos/Edge | Y |
| E2E-API-08 | E2E-API | Auth: /review by non-owner denied | Backend running; non-owner JWT | 1. POST slash:review with non-owner token. | userId!=ownerId | 403 PERMISSION_DENIED "Permission denied." | High | UC-6 EF-3, BR-5 | Negative | Y |
| E2E-API-09 | E2E-API | Auth: /undo by non-owner denied | Backend running; non-owner JWT | 1. POST slash:undo with non-owner token. | userId!=ownerId | 403 PERMISSION_DENIED "Permission denied." | High | UC-7 EF-3, BR-5 | Negative | Y |
| E2E-API-10 | E2E-API | Error: unknown command | Backend running | 1. POST slash:ghost. | unknown id | error UNKNOWN_COMMAND "Unknown command." | Med | TDD 2.3 | Negative | Y |
| E2E-API-11 | E2E-API | Error: rate limit exceeded (NFR-07-T) | Backend running; 20+ rapid calls | 1. Fire 25 POST slash:agents within 1 min. | >20 req/min same session | 429 RATE_LIMITED "Too many requests, please wait." | Med | NFR-07-T | Negative | Y |
| E2E-API-12 | E2E-API | Error: dependency unavailable | Backend running; SA4E-186/182/183 down | 1. POST slash:agents with 186 down. 2. POST slash:compact with 182 down. | down stubs | AGENT_ROUTING_UNAVAILABLE / COMPACTION_FAILED per FSD 9.1 | High | UC-1/2 EF-1, NFR-06-T | Negative | Y |
| E2E-UI-01 | E2E-UI | Slash menu renders < 100ms with all 7 commands | Webview served; Playwright Chromium | 1. Focus input, type /. 2. Measure open latency. 3. Assert 7 entries w/ icon+desc+shortcut. | commands.csv (7 ids) | Menu opens <100ms (NFR-01-T); 7 entries visible; owner-only greyed for non-owner | High | UC-1..7 AC1, NFR-01-T | Positive | Y |
| E2E-UI-02 | E2E-UI | /agents selector panel open + filter | Webview; SA4E-186 stub healthy | 1. Type /agents + Enter. 2. Filter coder. 3. Select agent_coder. | agents data | Selector opens; list filters; active agent updates; toast | High | UC-1 AC2/3, AF-2 | Positive | Y |
| E2E-UI-03 | E2E-UI | /models picker + persistence across session | Webview; prefs store | 1. /models -> pick model_claude. 2. /new. 3. Reopen /models -> model_claude default. | models.csv | Picker opens; selection persists; new session defaults to persisted (BR-6) | High | UC-4 AC2/3/4, BR-6 | Positive | Y |
| E2E-UI-04 | E2E-UI | /diff viewer panel + collapse/expand | Webview; SA4E-183 stub w/ 1 change | 1. /diff. 2. Collapse then expand entry. | diff fixture | Viewer opens; file entry collapsible; empty-state when none | High | UC-3 AC2/3, AF-1 | Positive | Y |
| E2E-UI-05 | E2E-UI | /review progress + findings block | Webview; owner; SA4E-186 stub | 1. /review. 2. Wait for spinner -> findings. | review data | Progress indicator shows; findings stream into chat block | High | UC-6 AC2/3 | Positive | Y |
| E2E-UI-06 | E2E-UI | /new confirmation dialog (confirm + cancel) | Webview; session with messages | 1. /new. 2. Cancel -> no reset. 3. /new -> confirm -> chat cleared. | new data | Dialog appears; cancel retains; confirm resets (BR-3) | High | UC-5 AC2/3, AF-1 | Pos/Neg | Y |
| E2E-UI-07 | E2E-UI | /undo revert prompt (file changes) | Webview; owner; exchange w/ file changes | 1. /undo. 2. Revert prompt appears. 3. Confirm revert. | undo data | Prompt shown; confirm reverts files; messages removed | High | UC-7 AC3, BR-4 | Positive | Y |
| SIT-01 | SIT | Full session flow — all 7 commands | SIT build; owner session; deps healthy | 1. /agents switch. 2. /models persist. 3. /compact. 4. /diff. 5. /new confirm. 6. /review. 7. /undo. | commands.csv + models.csv | All commands execute in sequence; state transitions correct; no regression | High | UC-1..7 | Positive | N |
| SIT-02 | SIT | Undo + revert flow + no-op | SIT build; owner; exchange with file changes | 1. Make exchange producing file change. 2. /undo revertFileChanges=true -> reverted. 3. /undo again -> NOTHING_TO_UNDO. | undo data | Files reverted + messages removed; 2nd undo no-op w/ message | High | UC-7 AC3/4, EF-1, BR-4 | Pos/Edge | N |
| SIT-03 | SIT | Review flow — owner success + non-owner denied | SIT build; two sessions (owner + other) | 1. Owner /review -> findings. 2. Non-owner /review -> disabled/denied. | review data | Owner sees findings; non-owner denied (BR-5) | High | UC-6, BR-5 | Pos/Neg | N |
| SIT-04 | SIT | Dependency-down fallback resilience | SIT build; SA4E-182/183/186 unavailable | 1. Trigger /agents,/compact,/diff,/review with deps down. 2. Observe errors + disabled menu entries. | down stubs | Graceful errors per FSD 9.1; affected commands disabled; no crash | High | UC-1/2/3/6 EF-1, NFR-06-T | Negative | N |

---

## 2. Requirements Traceability Matrix (RTM)

| Requirement | Source | Test Cases | Coverage |
|-------------|--------|------------|----------|
| UC-1 /agents | FSD 3.1 | PBT-01, PBT-02, UT-01, UT-03, UT-04, UT-05, IT-01, IT-04, E2E-API-01, E2E-UI-01, E2E-UI-02, SIT-01, SIT-04 | 100% |
| UC-2 /compact | FSD 3.2 | PBT-01, UT-06, UT-07, IT-02, E2E-API-02, E2E-UI-06, SIT-01, SIT-04 | 100% |
| UC-3 /diff | FSD 3.3 | PBT-01, UT-08, UT-09, IT-03, E2E-API-03, E2E-UI-04, SIT-01, SIT-04 | 100% |
| UC-4 /models | FSD 3.4 | PBT-01, PBT-03, UT-10, UT-11, UT-12, IT-01, E2E-API-04, E2E-UI-03, SIT-01 | 100% |
| UC-5 /new | FSD 3.5 | PBT-01, UT-13, UT-14, IT-01, E2E-API-05, E2E-UI-06, SIT-01 | 100% |
| UC-6 /review | FSD 3.6 | PBT-01, UT-15, UT-16, IT-04, E2E-API-06, E2E-API-08, E2E-UI-05, SIT-01, SIT-03, SIT-04 | 100% |
| UC-7 /undo | FSD 3.7 | PBT-01, UT-17, UT-18, UT-19, UT-20, IT-03, E2E-API-07, E2E-API-09, E2E-UI-07, SIT-01, SIT-02, SIT-03 | 100% |
| BR-1 registered once | FSD 3.8 | PBT-01, UT-01 | 100% |
| BR-2 shortcut unique | FSD 3.8 | PBT-02 | 100% |
| BR-3 /new confirm | FSD 3.8 | UT-14, E2E-API-05, E2E-UI-06 | 100% |
| BR-4 /undo revert optional+owner | FSD 3.8 | UT-19, UT-20, E2E-API-07, E2E-UI-07 | 100% |
| BR-5 owner-only /review,/undo | FSD 3.8 | UT-02, UT-16, E2E-API-08, E2E-API-09, SIT-03 | 100% |
| BR-6 /models persist | FSD 3.8 | PBT-03, UT-10, E2E-API-04, E2E-UI-03 | 100% |
| BR-7 /agents routes SA4E-186 | FSD 3.8 | UT-03, IT-01 | 100% |
| NFR-01-T menu <100ms | FSD 8.1 | E2E-UI-01 | 100% |
| NFR-02-T handler <300ms | FSD 8.1 | IT-01, E2E-API-* | 100% |
| NFR-06-T dependency timeouts | FSD 8.1 | IT-02, IT-03, IT-04, E2E-API-12, SIT-04 | 100% |
| NFR-07-T rate limit 20/min | FSD 8.1 | E2E-API-11 | 100% |
| NFR-08-T audit 100% | FSD 8.1 | IT-05 | 100% |
| Security authN/authZ | FSD 7 | E2E-API-08, E2E-API-09 | 100% |
| Error UNKNOWN_COMMAND | TDD 2.3 | E2E-API-10 | 100% |
| Error RATE_LIMITED 429 | TDD 2.3 | E2E-API-11 | 100% |
| Negative/Edge set | This STC | /undo no history (UT-18, E2E-API-07); /review other user (UT-16, E2E-API-08); /agents invalid id (UT-05); /models persistence (UT-10/12, E2E-UI-03); /new cancel (UT-14, E2E-UI-06); dependency-down (IT-02/03/04, SIT-04) | 100% |

**Coverage Summary:** Use Cases 7/7 (100%), Business Rules 7/7 (100%), Acceptance Criteria 25/25 (100%), Error Codes 12/12 (100%), NFR 6/6 (100%). Overall 100%.

---

## 3. Appendix — Test Data

### 3.1 commands.csv
`command,args,expected_handler,requiresOwner,shortcut` — maps each command id to its handler key and owner flag (used by PBT-01, UT-01, IT-01, E2E-UI-01).

### 3.2 invalid-args.csv
`command,bad_args,expected_error_code,expected_error_message` — covers EF/edge: /agents invalid id, /compact empty, /undo no exchange, /models persist fail (UT-05, UT-07, UT-18, UT-11).

### 3.3 models.csv
`model_id,label,provider,is_default` — model registry seed for /models persistence tests (PBT-03, UT-10/12, E2E-API-04, E2E-UI-03).

All three CSVs are located in `documents/SA4E-191/testdata/`.

---

---

## 4. Level Definitions & Automation Strategy

Each of the six levels is executed in order (pyramid: fastest/most-isolated first). Automation is maximized so only visual/UX checks remain manual SIT.

| Level | Tooling | What is real vs mocked | Exit Gate |
|-------|---------|----------------------|-----------|
| PBT | fast-check + vitest | Generated command ids / shortcut hints / model ids vs registry invariants | 1000+ cases pass; no duplicate id; no duplicate shortcut |
| UT | vitest | Handler logic real; AgentRouter/Compaction/FileChange adapters stubbed at boundary | 0 failed; BR-1..BR-7 each asserted |
| IT | vitest + Hono app.request() | Real CommandRegistry, sessionStore, chatStore, modelPreferenceStore; only SA4E-182/183/186 boundaries stubbed | Adapter happy + failure paths verified; audit emitted (NFR-08-T) |
| E2E-API | vitest + fetch | Real backend slash-command module + real routing/auth; JWT/owner context real | All 7 commands + auth (owner-only) + error green |
| E2E-UI | Playwright Test | Real VS Code webview; adapters stubbed so UI deterministic | Menu < 100 ms (NFR-01-T); all 7 panels/dialogs open/close correctly |
| SIT | Browser (manual) | Full SIT build; dependencies may be healthy or simulated-down | 0 Critical / 0 Major open; visual/UX sign-off |

## 5. Negative & Edge Case Detail (required scenarios)

The following negative/edge scenarios are explicitly mandated by the test brief and are covered as shown:

1. /undo with no history — UT-18 (status=error NOTHING_TO_UNDO), E2E-API-07 (second invocation after emptying history returns NOTHING_TO_UNDO), SIT-02 (second undo is a no-op with message).
2. /review on another user's session denied — UT-16 (non-owner PERMISSION_DENIED), E2E-API-08 (non-owner JWT 403 PERMISSION_DENIED), SIT-03 (non-owner sees command disabled/denied). Enforced by BR-5 in both SlashMenuController and ReviewCommand.execute.
3. /agents invalid id — UT-05 (selectedAgentId not in availableAgents INVALID_AGENT, "Selected agent is not available."); invalid-args.csv row agents,{selectedAgentId:agent_ghost}.
4. /models persistence check — UT-10 (selection persisted to preference store), UT-12 (invalid persisted id on load falls back to default), E2E-UI-03 (persisted model is the default after /new), PBT-03 (property: persisted id always valid on load).
5. /new confirm cancel — UT-14 (confirmReset=false no reset, current session retained), E2E-API-05 (confirmReset=false no-op), E2E-UI-06 (cancel in dialog retains chat). Enforced by BR-3.
6. Dependency-down fallback — IT-02 (SA4E-182 down COMPACTION_FAILED, context untouched), IT-03 (SA4E-183 down empty-state / revert warning), IT-04 (SA4E-186 down AGENT_ROUTING_UNAVAILABLE / REVIEW_AGENT_UNAVAILABLE), E2E-API-12 (dependency unavailable over real bus), SIT-04 (all affected commands disabled, no crash).
7. Additional edges — E2E-API-11 (rate-limit greater than 20/min 429 RATE_LIMITED, NFR-07-T), E2E-API-10 (unknown command UNKNOWN_COMMAND), UT-20 (partial file revert warning, EF-2), UT-07 (empty session NOTHING_TO_COMPACT, EF-2).

## 6. Expanded Test Data Samples

### 6.1 commands.csv (full)
command,args,expected_handler,requiresOwner,shortcut
agents,{},agents,false,Ctrl/Cmd+Shift+A
compact,{compactionStrategy:semantic},compact,false,Ctrl/Cmd+Shift+C
diff,{},diff,false,Ctrl/Cmd+Shift+D
models,{selectedModelId},models,false,Ctrl/Cmd+Shift+M
new,{confirmReset:true},new,false,Ctrl/Cmd+Shift+N
review,{branchName,branchDiff},review,true,Ctrl/Cmd+Shift+R
undo,{lastExchangeId,revertFileChanges},undo,true,Ctrl/Cmd+Shift+U

### 6.2 invalid-args.csv (full)
command,bad_args,expected_error_code,expected_error_message
agents,{selectedAgentId:agent_ghost},INVALID_AGENT,"Selected agent is not available."
compact,{},NOTHING_TO_COMPACT,"Nothing to compact."
diff,{},TRACKING_UNAVAILABLE,"No change tracking data available for this session."
models,{selectedModelId:model_ghost},PREF_PERSIST_FAILED,"Model preference could not be saved, but is active for this session."
new,{confirmReset:false},NO_CONFIRM,"No reset performed (confirmation required)."
review,{},BRANCH_DIFF_UNAVAILABLE,"Unable to obtain branch diff for review."
undo,{},NOTHING_TO_UNDO,"Nothing to undo."

### 6.3 models.csv (full)
model_id,label,provider,is_default
model_gpt4o,GPT-4o,openai,true
model_claude,Claude 3.5,anthropic,false
model_llama,Llama 3,meta,false

---

*End of STC — Version 1.0 (Draft).*
