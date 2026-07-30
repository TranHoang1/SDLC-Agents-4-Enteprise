# Software Test Cases (STC)

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
| Related STP | STP-v1-SA4E-56.docx |
| Related FSD | FSD-v1-SA4E-56.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-26 | QA Agent | Initiate document — auto-generated from FSD use cases and business rules |

---

## Test Case Summary

| Category | ID Range | Count | Priority |
|----------|----------|-------|----------|
| Unit Testing — Backend Parsers | UT-001 to UT-015 | 15 | High |
| Unit Testing — Extension Services | UT-016 to UT-020 | 5 | High |
| Integration Testing — API | IT-001 to IT-010 | 10 | High |
| Integration Testing — Extension | IT-011 to IT-015 | 5 | High |
| System Testing — E2E API | ST-001 to ST-006 | 6 | High |
| System Testing — E2E Extension | ST-007 to ST-010 | 4 | Medium |
| Security Testing | SEC-001 to SEC-005 | 5 | Critical |
| Performance Testing | PERF-001 to PERF-005 | 5 | Medium |
| UAT Scenarios | UAT-001 to UAT-003 | 3 | High |
| **Total** | | **58** | |

---

## 1. Unit Testing — Backend Parsers (UT-001 to UT-015)

### UT-001: PegaFileParser — Valid .pega JSON produces 1 pega-rule symbol and relationships

| Field | Value |
|-------|-------|
| **ID** | UT-001 |
| **Priority** | High |
| **Type** | Unit |
| **Level** | UT |
| **Requirement** | UC-03, BR-20, BR-23 |
| **Preconditions** | PegaFileParser is instantiated; valid .pega JSON content is available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create PegaFileParser instance | Instance created without error |
| 2 | Call `parse(source, "Work-Order.CreateOrder.Rule-Obj-Activity.pega")` with valid Activity JSON containing pxObjClass, pyClassName, pyActivityName, steps with Call methods | Returns ParseResult |
| 3 | Inspect `result.symbols` | Exactly 1 symbol; `kind` = `"pega-rule"`; `name` = value of pyActivityName; `signature` contains ruleType, className, ruleset |
| 4 | Inspect `result.relationships` | At least 1 relationship; `kind` = `"references"`; `sourceSymbol` = filePath; `targetSymbol` = resolved .pega path |

**Test Data:** `testdata/create-pega-testdata.csv` — row with valid Activity JSON (pxObjClass: "Rule-Obj-Activity", pyActivityName: "CreateOrder", steps with Call steps)
**Postconditions:** ParseResult returned; no errors in `errors` array

---

### UT-002: PegaFileParser — Invalid JSON returns ParseResult with error

| Field | Value |
|-------|-------|
| **ID** | UT-002 |
| **Priority** | High |
| **Type** | Unit |
| **Level** | UT |
| **Requirement** | UC-03 EF-01 |
| **Preconditions** | PegaFileParser is instantiated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `parse("not valid json{{{", "test.pega")` | Returns ParseResult with empty symbols and relationships |
| 2 | Inspect `result.errors` | 1 error with message "Invalid JSON in .pega file", line: 1, column: 0 |

**Test Data:** Malformed JSON string `not valid json{{{`
**Postconditions:** No exception thrown; error is returned gracefully

---

### UT-003: PegaFileParser — Empty or non-object JSON returns error

| Field | Value |
|-------|-------|
| **ID** | UT-003 |
| **Priority** | High |
| **Type** | Unit |
| **Level** | UT |
| **Requirement** | UC-03 EF-02 |
| **Preconditions** | PegaFileParser is instantiated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `parse("[]", "test.pega")` | Returns error: "Empty or non-object JSON" |
| 2 | Call `parse('"just a string"', "test.pega")` | Returns error: "Empty or non-object JSON" |
| 3 | Call `parse("null", "test.pega")` | Returns error: "Empty or non-object JSON" |

**Test Data:** JSON array `[]`, JSON string `"just a string"`, JSON null `null`
**Postconditions:** No exception thrown; errors returned gracefully

---

### UT-004: PegaFileParser — Rule name extraction priority order

| Field | Value |
|-------|-------|
| **ID** | UT-004 |
| **Priority** | Medium |
| **Type** | Unit |
| **Level** | UT |
| **Requirement** | BR-21 |
| **Preconditions** | PegaFileParser is instantiated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse JSON with `pyRuleName: "RuleName", pyActivityName: "ActivityName"` | `name` = "RuleName" (pyRuleName wins) |
| 2 | Parse JSON with only `pyActivityName: "ActivityName"` | `name` = "ActivityName" |
| 3 | Parse JSON with only `pyModelName: "ModelName"` | `name` = "ModelName" |
| 4 | Parse JSON with no name fields; filePath = "MyRule.Rule-Obj-Activity.pega" | `name` = "MyRule.Rule-Obj-Activity" (filename fallback) |

**Test Data:** Multiple JSON objects testing each name field priority
**Postconditions:** Rule name extracted correctly per BR-21 priority order

---

### UT-005: PegaRuleAstParser — 20+ Rule Type Builders produce valid AST

| Field | Value |
|-------|-------|
| **ID** | UT-005 |
| **Priority** | High |
| **Type** | Unit |
| **Level** | UT |
| **Requirement** | BR-24 |
| **Preconditions** | PegaRuleAstParser is instantiated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create PegaRuleAstParser instance | Instance created |
| 2 | For each rule type (Activity, DataTransform, Flow, FlowAction, Class, Property, When, Decision, Declare, Connector, Service, UI, Parse, Access, Async, Test, File, Admin, Utility, Edit, Correspondence, Survey, Generic): call `parse()` with appropriate JSON | Each returns valid PegaRuleAst with correct ruleType, properties, children structures |
| 3 | For Generic fallback: pass JSON with unknown pxObjClass | `getBuilder` returns `buildGeneric`; AST returned without error |

**Test Data:** 23 JSON fixtures in `testdata/pega-rule-types.json`
**Postconditions:** All 20+ rule types parse without error; each AST has correct ruleType

---

### UT-006: PegaRuleAstParser — Reference extraction from Activity with Call steps

| Field | Value |
|-------|-------|
| **ID** | UT-006 |
| **Priority** | High |
| **Type** | Unit |
| **Level** | UT |
| **Requirement** | BR-23, BR-24 |
| **Preconditions** | PegaRuleAstParser is instantiated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse Activity JSON with 2 Call steps: `Call Work-Cover-Jira.ValidateData` and `Call @baseclass.SendNotification` | `ast.references` contains 2 references with role "calls" |
| 2 | Verify first reference | `ruleName` = "ValidateData", `className` = "Work-Cover-Jira" |
| 3 | Verify second reference | `ruleName` = "SendNotification", `className` = "@baseclass" |

**Test Data:** Activity with steps array containing Call methods
**Postconditions:** All Call references extracted; visited Set prevents duplicates

---

### UT-007: PegaRuleAstParser — Reference extraction with Branch, When, FlowAction

| Field | Value |
|-------|-------|
| **ID** | UT-007 |
| **Priority** | Medium |
| **Type** | Unit |
| **Level** | UT |
| **Requirement** | BR-23 |
| **Preconditions** | PegaRuleAstParser is instantiated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse JSON with step having `pyMethod: "Branch"` and `pyMethodParameters: "Work-Cover-Jira.NeedsReview"` | Reference with role "calls" extracted |
| 2 | Parse JSON with step having `pyWhenCondition: "IsHighPriority"` | Reference with role "guards" extracted |
| 3 | Parse JSON with step having `pyFlowActionName: "NewAssignment"` | Reference with role "flow-action" extracted |
| 4 | Parse JSON with `pxRuleReferences` array containing entries | References with role "references" extracted |

**Test Data:** Activity JSON with Branch step, When condition, FlowAction name, and pxRuleReferences
**Postconditions:** All reference types extracted with correct roles

---

### UT-008: PegaRuleAstParser — Circular references handled by visited set

| Field | Value |
|-------|-------|
| **ID** | UT-008 |
| **Priority** | Medium |
| **Type** | Unit |
| **Level** | UT |
| **Requirement** | BR-24 |
| **Preconditions** | PegaRuleAstParser is instantiated; JSON with duplicate references |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse JSON with 2 steps both calling `Work-Cover-Jira.ValidateData` | `ast.references` contains exactly 1 reference to ValidateData (no duplicate) |
| 2 | Parse JSON with the same reference appearing in both steps and pxRuleReferences | Deduplication via visited Set ensures unique references |

**Test Data:** JSON with duplicate reference `Work-Cover-Jira.ValidateData` in multiple places
**Postconditions:** No duplicate references in output; visited set works correctly

---

### UT-009: DependencyResolver — TS/JS relative imports resolved

| Field | Value |
|-------|-------|
| **ID** | UT-009 |
| **Priority** | High |
| **Type** | Unit |
| **Level** | UT |
| **Requirement** | UC-02, BR-10, BR-11 |
| **Preconditions** | DependencyResolver is instantiated; workspace has `src/utils/helper.ts` with known content |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `resolve("import { process } from './processor';", "src/services/main.ts", workspace)` | Returns 1 dep: `{ path: "src/services/processor.ts", expectedHash: "...", sourceType: "local" }` |
| 2 | Call `resolve("import { X } from 'lodash';", "src/main.ts", workspace)` | Returns empty array (non-relative import skipped) |
| 3 | Call `resolve("const x = require('./utils');", "src/main.ts", workspace)` | Tries extensions: utils.ts → utils.tsx → ... → utils/index.ts |

**Test Data:** `testdata/create-source-testdata.csv` — source content with relative imports
**Postconditions:** Only relative imports resolved; extension priority honored

---

### UT-010: DependencyResolver — Java imports exclude JDK/library packages

| Field | Value |
|-------|-------|
| **ID** | UT-010 |
| **Priority** | High |
| **Type** | Unit |
| **Level** | UT |
| **Requirement** | UC-02, BR-10 |
| **Preconditions** | DependencyResolver is instantiated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `resolve("import java.util.List;\nimport com.myapp.Service;", "src/MyApp.java", workspace)` | Only `com/myapp/Service.java` in deps (java.util.List is excluded) |
| 2 | Verify java.util.List | NOT in deps array (JDK import skipped) |
| 3 | Verify com.myapp.Service | IS in deps array with `path: "com/myapp/Service.java"` |

**Test Data:** Java source with JDK imports (`java.util.List`, `javax.servlet.*`) and app imports (`com.myapp.Service`)
**Postconditions:** JDK/library imports excluded; application imports included

---

### UT-011: DependencyResolver — Pega references resolved to file paths with hashes

| Field | Value |
|-------|-------|
| **ID** | UT-011 |
| **Priority** | High |
| **Type** | Unit |
| **Level** | UT |
| **Requirement** | UC-02, BR-13, BR-14 |
| **Preconditions** | DependencyResolver is instantiated; workspace has a target .pega file at `Work-Cover-Jira.ValidateData.Rule-Obj-Activity.pega` |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse Pega reference ref: `{ ruleType: "Rule-Obj-Activity", className: "Work-Cover-Jira", ruleName: "ValidateData" }` | `pegaRefToFilePath()` returns `"Work-Cover-Jira.ValidateData.Rule-Obj-Activity.pega"` |
| 2 | Call `resolvePega()` with JSON containing references | If target file exists locally: `sourceType: "local"` with expectedHash; if not: `sourceType: "remote"` with empty hash |

**Test Data:** `testdata/create-pega-testdata.csv` — Pega JSON with reference to an existing local .pega file
**Postconditions:** Dependencies resolved with correct path format; hash computed for local files

---

### UT-012: DependencyResolver — Unsupported extension returns empty array; no imports returns empty

| Field | Value |
|-------|-------|
| **ID** | UT-012 |
| **Priority** | Medium |
| **Type** | Unit |
| **Level** | UT |
| **Requirement** | UC-02 AF-02, AF-03 |
| **Preconditions** | DependencyResolver is instantiated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `resolve("some content", "file.go", workspace)` | Returns `[]` (unsupported extension) |
| 2 | Call `resolve("const x = 1;", "file.ts", workspace)` | Returns `[]` (no imports found) |
| 3 | Call `resolve("import java.util.List;", "file.java", workspace)` | Returns `[]` (only JDK import, excluded) |

**Test Data:** `.go` file content, TS without imports, Java with only JDK imports
**Postconditions:** Empty array returned for unsupported/no imports

---

### UT-013: DependencyResolver — Invalid .pega JSON returns empty dependencies

| Field | Value |
|-------|-------|
| **ID** | UT-013 |
| **Priority** | Medium |
| **Type** | Unit |
| **Level** | UT |
| **Requirement** | UC-02 AF-04 |
| **Preconditions** | DependencyResolver is instantiated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `resolve("not valid json", "file.pega", workspace)` | Returns `[]` (JSON parse error caught, returns empty) |
| 2 | Verify no exception thrown | Error caught and handled gracefully |

**Test Data:** Invalid JSON string
**Postconditions:** Empty dependencies returned; no crash

---

### UT-014: Grammar Registry — .pega mapping and parser loading

| Field | Value |
|-------|-------|
| **ID** | UT-014 |
| **Priority** | High |
| **Type** | Unit |
| **Level** | UT |
| **Requirement** | FSD §3.3 (File Scanner), TDD §5.2 |
| **Preconditions** | GrammarRegistry is initialized |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `getLanguageId("file.pega")` | Returns `"pega"` |
| 2 | Call `getParser("file.pega")` | Returns PegaFileParser instance |
| 3 | Call `isAvailable("pega")` | Returns `true` |

**Test Data:** File path `"file.pega"`
**Postconditions:** pega language mapped; PegaFileParser loaded

---

### UT-015: PegaRuleAstParser — toPromptContext generates readable output

| Field | Value |
|-------|-------|
| **ID** | UT-015 |
| **Priority** | Low |
| **Type** | Unit |
| **Level** | UT |
| **Requirement** | TDD §5.2 |
| **Preconditions** | PegaRuleAstParser is instantiated; parsed AST is available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse an Activity JSON and call `toPromptContext(ast)` | Returns multi-line string |
| 2 | Verify output contains rule type, name, className | Output contains "Rule-Obj-Activity", "ResolveTicket", "Work-Cover-Jira" |
| 3 | Verify output contains references section | Output contains "References" section with role, rule type, class, name |

**Test Data:** Activity AST from UT-001
**Postconditions:** Human-readable context generated; all key fields present

---

## 2. Unit Testing — Extension Services (UT-016 to UT-020)

### UT-016: AuthManager — getLastUsername persists across sessions

| Field | Value |
|-------|-------|
| **ID** | UT-016 |
| **Priority** | High |
| **Type** | Unit |
| **Level** | UT |
| **Requirement** | FSD §7.1, AuthManager code |
| **Preconditions** | Mock SecretStorage; AuthManager initialized |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `login("admin", "password123")` with mock backend returning success | Auth state transitions: UNAUTHENTICATED → AUTHENTICATING → AUTHENTICATED |
| 2 | Call `getLastUsername()` | Returns `"admin"` |
| 3 | Create new AuthManager instance (simulate new session) | |
| 4 | Call `getLastUsername()` on new instance | Returns `"admin"` (persisted in SecretStorage) |

**Test Data:** Mock credentials: username = "admin", password = "password123"
**Postconditions:** Last username persisted; survives AuthManager re-initialization

---

### UT-017: AuthManager — Token lifecycle (acquire, refresh, expire, logout)

| Field | Value |
|-------|-------|
| **ID** | UT-017 |
| **Priority** | High |
| **Type** | Unit |
| **Level** | UT |
| **Requirement** | FSD §7.1, TDD §7.1 |
| **Preconditions** | Mock SecretStorage; mock backend with controllable responses |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `login("admin", "password")` | Token stored in SecretStorage; `isAuthenticated` = true |
| 2 | Call `getAccessToken()` immediately | Returns valid token |
| 3 | Simulate expired token (advance time past expiry) | `isAuthenticated` transitions to false; token null |
| 4 | Call `logout()` | Token deleted from SecretStorage; state = UNAUTHENTICATED |
| 5 | Call `getAccessToken()` after logout | Returns null |

**Test Data:** Mock token with configurable expiry
**Postconditions:** Token lifecycle fully functional; SecretStorage properly managed

---

### UT-018: ProviderConfigService — Pega credentials stored in SecretStorage, not settings.json

| Field | Value |
|-------|-------|
| **ID** | UT-018 |
| **Priority** | Critical |
| **Type** | Security / Unit |
| **Level** | UT |
| **Requirement** | FSD §7.2, BR-07 |
| **Preconditions** | Mock SecretStorage; Mock VS Code configuration |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `updatePegaConfig("http://pega:8080", "pegaAdmin", "secretPassword")` | Endpoint + username stored in settings; password NOT in settings |
| 2 | Check settings (`pegaEndpoint`) | `"http://pega:8080"` stored in settings |
| 3 | Check settings (`pegaUsername`) | `"pegaAdmin"` stored in settings |
| 4 | Check SecretStorage (`SECRET_KEYS.pega`) | `"secretPassword"` stored in SecretStorage |
| 5 | Verify settings.json does NOT contain password | `secrets.store()` is the ONLY write for password |

**Test Data:** Pega endpoint = "http://pega:8080", username = "pegaAdmin", password = "secretPassword"
**Postconditions:** Password stored only in SecretStorage; never in settings.json

---

### UT-019: SettingsMessageHandler — Pega config save and connection test handlers

| Field | Value |
|-------|-------|
| **ID** | UT-019 |
| **Priority** | High |
| **Type** | Unit |
| **Level** | UT |
| **Requirement** | UC-04, FSD §3.4.3 |
| **Preconditions** | SettingsMessageHandler instantiated with mock dependencies |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send message `{ type: "savePegaConfig", endpoint: "http://pega:8080", username: "admin", password: "pass" }` | `handle()` calls `configService.updatePegaConfig()`; posts `{ type: "pegaSaved", success: true }` |
| 2 | Send message `{ type: "savePegaConfig" }` with empty password | Password not stored (empty string skipped) |
| 3 | Send message `{ type: "testPegaConnection" }` with valid mock | Posts `{ type: "pegaTestResult", success: true, message: "Connected as ..." }` |
| 4 | Send message `{ type: "testPegaConnection" }` with failing mock | Posts `{ type: "pegaTestResult", success: false, message: "Connection failed: ..." }` |

**Test Data:** Message objects simulating webview postMessage calls
**Postconditions:** Handlers process correctly; appropriate messages posted back

---

### UT-020: Login Panel — Password visibility toggle and username pre-fill

| Field | Value |
|-------|-------|
| **ID** | UT-020 |
| **Priority** | Medium |
| **Type** | Unit |
| **Level** | UT |
| **Requirement** | FSD §3.4.3, Login Panel code |
| **Preconditions** | Mock AuthManager returning lastUsername = "admin" from getLastUsername() |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `show()` | Panel HTML is generated; username input value = "admin" (pre-filled) |
| 2 | Inspect password input HTML | Input type = "password" (masked by default) |
| 3 | Simulate toggle button click | Password input type toggles to "text" (visible) |
| 4 | Simulate toggle button click again | Password input type toggles back to "password" (masked) |
| 5 | Inspect toggle button text content | Changes between "🙈" (visible) and "👁️" (masked) |

**Test Data:** AuthManager mock with lastUsername = "admin"
**Postconditions:** Username pre-filled; password toggle functional

---

## 3. Integration Testing — API (IT-001 to IT-010)

### IT-001: POST /api/index/source — Happy path with TypeScript file

| Field | Value |
|-------|-------|
| **ID** | IT-001 |
| **Priority** | High |
| **Type** | Integration |
| **Level** | IT |
| **Requirement** | UC-01, BR-01, BR-05 |
| **Preconditions** | Backend server is running; valid Bearer token obtained; test workspace is clean |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST `/api/index/source` with valid `Authorization: Bearer {token}` header | HTTP 200 |
| 2 | Body: `{ files: [{ path: "src/index.ts", content: "export const x = 1;\nimport { helper } from './utils';" }] }` | |
| 3 | Verify response | `written: 1, skipped: 0, rejected: [], deps: [{ path: "src/utils.ts", ... }]`, projectId is set |
| 4 | Verify file written to workspace | `{workspace}/src/index.ts` exists with correct content |

**Test Data:** `testdata/create-source-testdata.csv` row for valid .ts file with import
**Postconditions:** File written and indexed; dependencies returned; response matches API contract

---

### IT-002: POST /api/index/source — .pega file indexing produces pega-rule symbol

| Field | Value |
|-------|-------|
| **ID** | IT-002 |
| **Priority** | High |
| **Type** | Integration |
| **Level** | IT |
| **Requirement** | UC-01, UC-03, BR-05, BR-20 |
| **Preconditions** | Backend server running; valid Bearer token; grammar registry loaded with pega parser |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST `/api/index/source` with valid .pega file content | HTTP 200 |
| 2 | Body includes file: `{ path: "Work-Order.CreateOrder.Rule-Obj-Activity.pega", content: "{ \"pxObjClass\": \"Rule-Obj-Activity\", \"pyClassName\": \"Work-Order\", \"pyActivityName\": \"CreateOrder\", \"steps\": [{ \"pyMethod\": \"Call\", \"pyMethodParameters\": \"Work-Order.ValidateAddress\" }] }" }` | |
| 3 | Verify response | `written: 1`; `deps` includes reference to `Work-Order.ValidateAddress.Rule-Obj-Activity.pega` |
| 4 | Query `symbols` table for kind = 'pega-rule' | 1 symbol found; `name` = "CreateOrder"; `kind` = "pega-rule"; `parameters` = "Rule-Obj-Activity" |

**Test Data:** `testdata/create-pega-testdata.csv` — Valid .pega Activity JSON with a Call reference
**Postconditions:** .pega file indexed; pega-rule symbol stored in database; dependency resolved

---

### IT-003: POST /api/index/source — Dedup with same gitHash skips file

| Field | Value |
|-------|-------|
| **ID** | IT-003 |
| **Priority** | High |
| **Type** | Integration |
| **Level** | IT |
| **Requirement** | UC-08, BR-30, BR-31, BR-33 |
| **Preconditions** | Backend running; file already indexed in DB; first 16 chars of gitHash match stored content_hash |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | First call: POST `/api/index/source` with file + gitHash | `written: 1, skipped: 0` |
| 2 | Second call: POST same file with same gitHash | `written: 0, skipped: 1` |
| 3 | Verify file NOT written to disk (content unchanged) | File timestamp unchanged |
| 4 | Third call: POST same file with DIFFERENT gitHash | `written: 1, skipped: 0` (file re-indexed) |

**Test Data:** `testdata/create-source-testdata.csv` — row with known gitHash "a1b2c3d4e5f67890"
**Postconditions:** Dedup works: same hash = skip; different hash = re-indexed

---

### IT-004: POST /api/index/source — Path traversal rejected

| Field | Value |
|-------|-------|
| **ID** | IT-004 |
| **Priority** | Critical |
| **Type** | Integration / Security |
| **Level** | IT |
| **Requirement** | UC-01, BR-02, BR-06, FSD §7.3 |
| **Preconditions** | Backend running; valid token |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST `/api/index/source` with file `path: "../../etc/passwd"` | File in `rejected` array |
| 2 | POST with file `path: "..\\..\\windows\\system32\\config"` | File in `rejected` array |
| 3 | POST with file `path: "valid/path/../file.ts"` | File in `rejected` array (normalized traversal) |
| 4 | Verify other files in the same batch still processed | Valid files are `written`; invalid files are `rejected`; batch continues |

**Test Data:** Paths: `../../etc/passwd`, `..\..\windows\system32\config`, `valid/path/../file.ts`
**Postconditions:** Traversal paths rejected; other files in batch continue; security warning logged

---

### IT-005: POST /api/index/source — Without Authorization returns 401

| Field | Value |
|-------|-------|
| **ID** | IT-005 |
| **Priority** | Critical |
| **Type** | Integration / Security |
| **Level** | IT |
| **Requirement** | UC-01 EF-01, BR-01 |
| **Preconditions** | Backend running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST `/api/index/source` with no Authorization header | HTTP 401 `{ error: "Unauthorized" }` |
| 2 | POST with `Authorization: Bearer invalid_token` | HTTP 401 `{ error: "Unauthorized" }` |
| 3 | POST with `Authorization: Basic not_bearer` | HTTP 401 `{ error: "Unauthorized" }` |

**Test Data:** No token, invalid token, wrong auth type
**Postconditions:** Unauthenticated requests rejected; system not exposed

---

### IT-006: POST /api/index/source — Missing files array returns 400

| Field | Value |
|-------|-------|
| **ID** | IT-006 |
| **Priority** | High |
| **Type** | Integration |
| **Level** | IT |
| **Requirement** | UC-01 EF-02 |
| **Preconditions** | Backend running; valid token |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST with body `{}` | HTTP 400 `{ error: "files array required" }` |
| 2 | POST with body `{ "files": "not_array" }` | HTTP 400 `{ error: "files array required" }` |
| 3 | POST with body `{ "files": [] }` | HTTP 200 `{ written: 0, skipped: 0, rejected: [], deps: [], projectId: "..." }` |

**Test Data:** Empty body, wrong type for files, empty array
**Postconditions:** Invalid input returns 400; empty array returns 200 (BR-04)

---

### IT-007: POST /api/index/source — Partial failure: one bad file doesn't break batch

| Field | Value |
|-------|-------|
| **ID** | IT-007 |
| **Priority** | High |
| **Type** | Integration |
| **Level** | IT |
| **Requirement** | UC-01 EF-03..05, BR-06, FSD §8 (Availability) |
| **Preconditions** | Backend running; valid token |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST with 3 files: [valid.ts, ../../etc/passwd, another-valid.py] | `written: 2, skipped: 0, rejected: ["../../etc/passwd"]` |
| 2 | POST with 3 files where 1 has invalid JSON .pega | Valid files written and indexed; .pega file written but indexed with parse errors |
| 3 | Verify valid files processed despite errors in other files | Written count = 2; valid deps returned for valid files |

**Test Data:** Mixed batch: valid.ts, traversal attempt, valid.py
**Postconditions:** Batch processing continues despite partial failures; non-fatal error handling verified

---

### IT-008: POST /api/index/source — Dependency list deduplicated by path

| Field | Value |
|-------|-------|
| **ID** | IT-008 |
| **Priority** | Medium |
| **Type** | Integration |
| **Level** | IT |
| **Requirement** | UC-01 Main Flow Step 8 |
| **Preconditions** | Backend running; two source files both importing the same module |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST 2 files both importing `./common` | `deps` array has exactly 1 entry for `common.ts` (deduplicated by path) |
| 2 | Verify no duplicate paths in deps | No two deps with same `path` value |

**Test Data:** Two TS files: `a.ts` imports `./common`, `b.ts` imports `./common`
**Postconditions:** Dependency list deduplicated; no duplicate paths

---

### IT-009: POST /api/index/source — Missing X-Project-Id falls back to boot config

| Field | Value |
|-------|-------|
| **ID** | IT-009 |
| **Priority** | High |
| **Type** | Integration |
| **Level** | IT |
| **Requirement** | UC-01 AF-01, AF-02 |
| **Preconditions** | Backend running with boot config projectId = "default-project" |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST without X-Project-Id header | Response `projectId` = "default-project" |
| 2 | POST with X-Project-Id: "custom-project" | Response `projectId` = "custom-project" |
| 3 | POST without X-Workspace-Root header | Falls back to boot config workspace path |

**Test Data:** Headers with and without X-Project-Id, X-Workspace-Root
**Postconditions:** Fallback to boot config works; explicit header overrides boot config

---

### IT-010: POST /api/index/source — .pega file with deps returning remote sourceType for missing files

| Field | Value |
|-------|-------|
| **ID** | IT-010 |
| **Priority** | Medium |
| **Type** | Integration |
| **Level** | IT |
| **Requirement** | UC-02 AF-01, BR-13 |
| **Preconditions** | Backend running; .pega file references a target file that does NOT exist in workspace |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST .pega file with reference to a non-existent target | Response deps includes entry with `sourceType: "remote"` and empty `expectedHash` |
| 2 | Verify remote dependency | `path` = target.pega path; `expectedHash` = ""; `sourceType` = "remote" |

**Test Data:** .pega file referencing `MissingRule.SomeClass.Rule-Obj-Activity.pega` which does not exist
**Postconditions:** Non-existent dependencies return sourceType = "remote"

---

## 4. Integration Testing — Extension (IT-011 to IT-015)

### IT-011: PegaHttpClient — getOperatorContext with URL fallback

| Field | Value |
|-------|-------|
| **ID** | IT-011 |
| **Priority** | High |
| **Type** | Integration |
| **Level** | IT |
| **Requirement** | UC-05, TDD §6.1 |
| **Preconditions** | Mock Pega Platform server running; PegaHttpClient with valid credentials |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock: first URL (`/api/v1/data/D_OperatorID`) returns 404; second URL (`/PRRestService/api/v1/data/D_OperatorID`) returns 200 | |
| 2 | Call `getOperatorContext()` | Returns valid `PegaOperatorContext` with operatorId, accessGroup, currentApplication |
| 3 | Verify URL fallback worked | Second URL was called after first failed |
| 4 | Mock: both URLs return 401 | Throws "HTTP 401 Unauthorized" |
| 5 | Mock: both URLs timeout | Throws "Failed to connect to Pega Server" |

**Test Data:** Mock credentials: username = "pegaAdmin", password = "pegaPass"
**Postconditions:** URL fallback pattern works; 401/403 errors propagated; connection errors caught

---

### IT-012: PegaHttpClient — crawlPlan and crawlBatch integration

| Field | Value |
|-------|-------|
| **ID** | IT-012 |
| **Priority** | High |
| **Type** | Integration |
| **Level** | IT |
| **Requirement** | UC-07, TDD §3.3, TDD §3.4 |
| **Preconditions** | Backend running; PegaHttpClient instantiated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `crawlPlan({ projectId: "test", ruleKeys: ["RULE-OBJ-ACTIVITY WORKORDER CREATEORDER"], visitedKeys: [] })` | Returns `{ missing: [...], cached: [...] }` |
| 2 | Call `crawlBatch({ projectId: "test", rules: [{ pxObjClass: "Rule-Obj-Activity", pyRuleName: "CreateOrder" }], visitedKeys: ["RULE-OBJ-ACTIVITY WORKORDER CREATEORDER"] })` | Returns `{ stored: 1, nextBatch: [...] }` |
| 3 | Verify crawlBatch returns nextBatch with new keys to explore | `nextBatch` is not empty (triggers further BFS iterations) |

**Test Data:** Rule keys for a mock Pega application
**Postconditions:** crawlPlan correctly identifies missing vs cached rules; crawlBatch stores and returns next keys

---

### IT-013: IndexingService — No Pega project detected skips crawl

| Field | Value |
|-------|-------|
| **ID** | IT-013 |
| **Priority** | Medium |
| **Type** | Integration |
| **Level** | IT |
| **Requirement** | UC-07 AF-05 |
| **Preconditions** | Workspace root does NOT contain pega-project.json or Application.xml |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `indexPegaProject(root, report)` | Returns `null` (no Pega project detected) |
| 2 | Verify no Pega crawl initiated | No calls to PegaHttpClient.crawlPlan/crawlBatch |
| 3 | Verify normal code indexing proceeds | Other indexing operations continue unaffected |

**Test Data:** Workspace without Pega project files
**Postconditions:** Pega crawl skipped; no error; other indexing unaffected

---

### IT-014: IndexingService — BFS crawl with circular references via visitedKeys

| Field | Value |
|-------|-------|
| **ID** | IT-014 |
| **Priority** | High |
| **Type** | Integration |
| **Level** | IT |
| **Requirement** | UC-07, TC-08 from FSD |
| **Preconditions** | Mock Pega Platform returns rules that reference each other in a cycle; pega-project.json exists |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Seed crawl with `["RULE-A", "RULE-B"]` where A → B → C → A (circular) | Crawl completes without infinite loop |
| 2 | Verify visitedKeys prevents re-visiting | Each rule fetched exactly once |
| 3 | Verify MAX_ITERATIONS not exceeded | Iterations < 1000 |

**Test Data:** Three rules forming a circular reference: A → B → C → A
**Postconditions:** BFS crawl terminates; visitedKeys set prevents infinite loops

---

### IT-015: IndexingService — BFS crawl with 1000+ rules hits MAX_ITERATIONS limit

| Field | Value |
|-------|-------|
| **ID** | IT-015 |
| **Priority** | Medium |
| **Type** | Integration / Performance |
| **Level** | IT |
| **Requirement** | UC-07 AF-08, TDD §1.5 |
| **Preconditions** | Mock Pega Platform returns new rule keys faster than they can be consumed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Seed with 100 keys; each crawlPlan returns 50 missing keys; each crawlBatch returns 50 nextBatch keys | Loop continues |
| 2 | After 1000 iterations | Crawl stops with partial results; summary reports rules processed |
| 3 | Verify no crash | Function returns gracefully with partial results string |

**Test Data:** Generative mock that always returns new keys (simulating large Pega project)
**Postconditions:** Crawl stops at 1000 iterations; reports partial results; no crash

---

## 5. System Testing — E2E API (ST-001 to ST-006)

### ST-001: E2E — Full indexing lifecycle: TS file → write → parse → deps → response

| Field | Value |
|-------|-------|
| **ID** | ST-001 |
| **Priority** | High |
| **Type** | System |
| **Level** | ST |
| **Requirement** | UC-01 (full main flow), FSD §6.1 |
| **Preconditions** | Clean database; backend running; valid token; workspace is empty |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST 3 files: `index.ts` (imports `./utils`), `utils.ts` (exports helper), `config.ts` (no imports) | HTTP 200 |
| 2 | Verify response: `written: 3, skipped: 0, rejected: [], deps: [...]` | All 3 files written |
| 3 | Verify deps: `index.ts` has dep on `utils.ts` and `config.ts` has none | File-level dependency graph correct |
| 4 | Query database: `files` table has 3 entries | all with correct relative_path and language |
| 5 | Query `symbols` table for each file | Symbols extracted correctly |

**Test Data:** `testdata/e2e-api-testdata.csv` — 3 TS files with known import relationships
**Postconditions:** Complete indexing lifecycle verified: API → write → parse → store → deps → response

---

### ST-002: E2E — Mixed batch with TS, Java, .pega files indexed together

| Field | Value |
|-------|-------|
| **ID** | ST-002 |
| **Priority** | High |
| **Type** | System |
| **Level** | ST |
| **Requirement** | BR-05 (all extensions through same endpoint), UC-01 |
| **Preconditions** | Backend running; valid token; all language parsers loaded |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST batch with: 1 .ts file, 1 .java file, 1 .pega file, 1 .py file | All 4 files written (`written: 4`) |
| 2 | Verify .ts deps resolved | Dependencies returned for .ts file |
| 3 | Verify .pega produces pega-rule symbol | Symbol in DB with kind = "pega-rule" |
| 4 | Verify .java deps resolved (non-JDK imports) | Only non-JDK imports in deps |
| 5 | Verify .py deps resolved | Dependencies returned for .py file |

**Test Data:** `testdata/e2e-mixed-testdata.csv` — 4 files of different languages
**Postconditions:** All language types processed through single endpoint; each correctly parsed per its language rules

---

### ST-003: E2E — Incremental indexing: first run full, second run dedup

| Field | Value |
|-------|-------|
| **ID** | ST-003 |
| **Priority** | High |
| **Type** | System |
| **Level** | ST |
| **Requirement** | UC-08, BR-30..33 |
| **Preconditions** | Clean database; backend running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | First POST: 5 files with gitHash values | `written: 5, skipped: 0` |
| 2 | Second POST: same 5 files with same gitHash values | `written: 0, skipped: 5` |
| 3 | Third POST: 3 files same, 2 files changed (different gitHash) | `written: 2, skipped: 3` |
| 4 | Fourth POST: 5 files without gitHash (no dedup) | `written: 5, skipped: 0` (all re-indexed) |

**Test Data:** 5 sample files with controlled gitHash values
**Postconditions:** Incremental indexing works: unchanged files skipped; changed files re-indexed; files without hash always indexed

---

### ST-004: E2E — POST /api/v1/pega/crawl-plan + crawl-batch lifecycle

| Field | Value |
|-------|-------|
| **ID** | ST-004 |
| **Priority** | Medium |
| **Type** | System |
| **Level** | ST |
| **Requirement** | UC-07, TDD §3.3, TDD §3.4 |
| **Preconditions** | Backend running; database clean |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST `/api/v1/pega/crawl-plan` with rule keys | Returns `data.missing` (uncached rules) |
| 2 | POST `/api/v1/pega/crawl-batch` with 50 rules | Returns `data.stored: 50`, `data.nextBatch` |
| 3 | POST `/api/v1/pega/crawl-plan` again with same keys + visited | Returns `data.cached` includes previously stored rules |
| 4 | POST `/api/v1/pega/crawl-batch` with 0 rules (empty array) | Returns `data.stored: 0` |

**Test Data:** 50 Pega rule objects with various rule types
**Postconditions:** crawl-plan identifies cache state; crawl-batch stores rules; subsequent plans show cached

---

### ST-005: E2E — AuthManager login → get token → use token for indexing

| Field | Value |
|-------|-------|
| **ID** | ST-005 |
| **Priority** | Critical |
| **Type** | System |
| **Level** | ST |
| **Requirement** | FSD §7.1, AuthManager code |
| **Preconditions** | Backend running with admin credentials; VS Code extension environment |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open login panel | Username field pre-filled with last username |
| 2 | Enter valid credentials, click Login | Login succeeds; token stored in SecretStorage |
| 3 | Trigger workspace indexing | Indexing API call uses stored Bearer token; succeeds |
| 4 | Logout | Token cleared from SecretStorage |
| 5 | Trigger workspace indexing | API call fails with 401 (no valid token) |

**Test Data:** Admin credentials: username = "admin", password = "admin123"
**Postconditions:** Token lifecycle works end-to-end: login → store → use → logout → expired

---

### ST-006: E2E — PegaPlatform connection test → fetch context → verify files

| Field | Value |
|-------|-------|
| **ID** | ST-006 |
| **Priority** | High |
| **Type** | System |
| **Level** | ST |
| **Requirement** | UC-04, UC-05, UC-06 |
| **Preconditions** | Mock Pega Platform running; workspace folder open in VS Code |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open Settings panel; navigate to Pega Platform section | Pega section visible with endpoint, username, password fields |
| 2 | Enter Pega endpoint, username, password; click Save | "pegaSaved" message received with `success: true` |
| 3 | Click "Test Connection" | "pegaTestResult" received; success with operator ID and app name |
| 4 | Click "Fetch Context" | "pegaContextFetched" received; pega-project.json and Application.xml created in workspace |
| 5 | Verify pega-project.json | Contains isPegaProject, applicationName, operatorId, caseTypes, fetchedAt |

**Test Data:** Mock Pega credentials; mock operator context response
**Postconditions:** Settings saved; connection tested; context fetched; project files created

---

## 6. System Testing — E2E Extension (ST-007 to ST-010)

### ST-007: E2E — Login panel password toggle button works

| Field | Value |
|-------|-------|
| **ID** | ST-007 |
| **Priority** | Medium |
| **Type** | System / UI |
| **Level** | ST |
| **Requirement** | Login Panel code, FSD §3.4.3 |
| **Preconditions** | Login panel is open |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify password input type is "password" (masked) | Dots shown instead of characters |
| 2 | Click toggle password button (eye icon) | Password input type changes to "text" (visible characters) |
| 3 | Click toggle password button again | Password input type changes back to "password" (masked) |
| 4 | Verify toggle icon changes | Eye icon toggles between 👁️ and 🙈 |

**Test Data:** N/A — UI interaction
**Postconditions:** Password visibility toggle functional

---

### ST-008: E2E — Login error message displayed on failed auth

| Field | Value |
|-------|-------|
| **ID** | ST-008 |
| **Priority** | High |
| **Type** | System |
| **Level** | ST |
| **Requirement** | AuthManager code, FSD §9.1 |
| **Preconditions** | Backend running; login panel open |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enter invalid username/password | Login button shows "Logging in..."; disabled |
| 2 | Click Login | Error message displayed in red text |
| 3 | Verify error matches backend response | Error shows HTTP status or message from backend |
| 4 | Verify login button re-enabled | Button shows "Login" again; clickable |

**Test Data:** Invalid credentials: username = "bad", password = "invalid"
**Postconditions:** Error displayed; UI returns to usable state

---

### ST-009: E2E — Settings panel Pega config: empty password doesn't overwrite

| Field | Value |
|-------|-------|
| **ID** | ST-009 |
| **Priority** | Medium |
| **Type** | System |
| **Level** | ST |
| **Requirement** | UC-04, ProviderConfigService code |
| **Preconditions** | Pega config previously saved with password; Settings panel open |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open Settings panel; Pega section shows password as (saved) | `hasPegaPassword` = true |
| 2 | Change endpoint URL only; leave password field empty | |
| 3 | Click Save | Config saved; `updatePegaConfig` called with empty password → password not overwritten in SecretStorage |
| 4 | Verify existing password still valid | Test connection succeeds with existing password |

**Test Data:** Pre-existing password in SecretStorage; empty password field in save
**Postconditions:** Existing password preserved when empty string submitted

---

### ST-010: E2E — Workspace indexing with Pega project triggers BFS crawl

| Field | Value |
|-------|-------|
| **ID** | ST-010 |
| **Priority** | High |
| **Type** | System |
| **Level** | ST |
| **Requirement** | UC-07 |
| **Preconditions** | Workspace has pega-project.json; mock Pega Platform returns rules; backend running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger `indexWorkspace()` with Pega project detected | Pega crawl starts; progress notification shows "Pega Project Detected" |
| 2 | Wait for crawl to complete | Summary includes rules fetched and stored counts |
| 3 | Query backend database for Pega rules | Rules from crawl are stored in files/symbols tables |
| 4 | Verify crawl statistics | Rules fetched > 0; totalStoredInDb > 0 |

**Test Data:** pega-project.json with applicationName = "TestApp"; mock returning 100 rules
**Postconditions:** BFS crawl executed; Pega rules stored in backend database

---

## 7. Security Testing (SEC-001 to SEC-005)

### SEC-001: Path traversal with various patterns

| Field | Value |
|-------|-------|
| **ID** | SEC-001 |
| **Priority** | Critical |
| **Type** | Security |
| **Level** | Security |
| **Requirement** | FSD §7.3, BR-02, NFR from FSD §8 |
| **Preconditions** | Backend running; valid token |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST with `path: "../../../etc/passwd"` | Rejected |
| 2 | POST with `path: "..\\..\\..\\windows\\win.ini"` | Rejected |
| 3 | POST with `path: "valid/../../../etc/shadow"` | Rejected |
| 4 | POST with `path: "....//....//etc/passwd"` | Rejected |
| 5 | POST with `path: "%2e%2e%2fetc%2fpasswd"` (URL encoded) | Depends on normalization — verify resolvedWithinWorkspace |
| 6 | Verify backend logs contain WARN-level entry for each rejection | Logged with rejected paths |

**Test Data:** Multiple OS-specific path traversal patterns
**Postconditions:** All traversal patterns rejected; security warnings logged; no files written outside workspace

---

### SEC-002: Unauthorized access to all protected endpoints

| Field | Value |
|-------|-------|
| **ID** | SEC-002 |
| **Priority** | Critical |
| **Type** | Security |
| **Level** | Security |
| **Requirement** | BR-01, FSD §7.1 |
| **Preconditions** | Backend running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST `/api/index/source` without Authorization header | HTTP 401 |
| 2 | POST with malformed `Authorization: Bearer` (empty token) | HTTP 401 |
| 3 | POST with expired Bearer token | HTTP 401 |
| 4 | POST with token from another project/user | HTTP 401 (if scope validation) or 200 (if only auth is checked) |

**Test Data:** Missing token, empty token, expired token, invalid token
**Postconditions:** All unauthorized requests rejected; no data exposure

---

### SEC-003: Pega credentials never stored in settings.json

| Field | Value |
|-------|-------|
| **ID** | SEC-003 |
| **Priority** | Critical |
| **Type** | Security |
| **Level** | Security |
| **Requirement** | FSD §7.2, FSD §8 (NFR) |
| **Preconditions** | VS Code extension installed; settings configured with Pega credentials |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Save Pega config with password `SuperSecret123!` | |
| 2 | Read `settings.json` file contents | Does NOT contain "SuperSecret123!" or any pega password |
| 3 | Read SecretStorage via API | SecretStorage contains password for key `SECRET_KEYS.pega` |
| 4 | Check all log output streams | No log contains password value |

**Test Data:** Password = "SuperSecret123!"; endpoint = "http://pega:8080"
**Postconditions:** Password stored exclusively in SecretStorage; absent from settings.json and logs

---

### SEC-004: Injection attacks on file paths and content

| Field | Value |
|-------|-------|
| **ID** | SEC-004 |
| **Priority** | High |
| **Type** | Security |
| **Level** | Security |
| **Requirement** | FSD §7.4 |
| **Preconditions** | Backend running; valid token |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST with `path: "; rm -rf /"` | Written as filename (escaped); no command injection |
| 2 | POST with `content: "<script>alert('xss')</script>"` | Written as-is (source code); no XSS in backend responses |
| 3 | POST with `path: "CON"` (Windows reserved name) | Written or rejected (platform-dependent) |
| 4 | POST with very long path (> 4096 chars) | Handled gracefully (path normalization or 400) |

**Test Data:** Command injection attempt, XSS payload, Windows reserved names, long paths
**Postconditions:** No injection vulnerabilities; content treated as opaque data; paths sanitized

---

### SEC-005: Concurrent requests and race conditions

| Field | Value |
|-------|-------|
| **ID** | SEC-005 |
| **Priority** | Medium |
| **Type** | Security |
| **Level** | Security |
| **Requirement** | FSD §8, BR-33 |
| **Preconditions** | Backend running; valid token; clean database |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send 5 concurrent POST requests each indexing the same file | All 5 return HTTP 200 |
| 2 | Verify DB has exactly 1 entry for the file (not 5) | UNIQUE constraint on (project_id, path) prevents duplicates |
| 3 | Send 10 concurrent POST requests with different files | All files written; no corruption |
| 4 | Verify no database locked errors | All requests succeed within timeout |

**Test Data:** Same file sent in parallel; different files sent in parallel
**Postconditions:** Concurrent requests handled gracefully; no data corruption; unique constraint enforced

---

## 8. Performance Testing (PERF-001 to PERF-005)

### PERF-001: Single file indexing (100KB .ts file) < 1000ms

| Field | Value |
|-------|-------|
| **ID** | PERF-001 |
| **Priority** | Medium |
| **Type** | Performance |
| **Level** | Performance |
| **Requirement** | FSD §8 — Single file indexing < 1 second |
| **Preconditions** | Backend running; valid token; grammar registry loaded with all parsers |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create a 100KB .ts file with imports, classes, functions | |
| 2 | POST the file, measure response time | Response time < 1000ms |
| 3 | Repeat 10 times, calculate average | Average < 800ms |

**Test Data:** 100KB TypeScript file with realistic code
**Acceptance Criteria:** p95 < 1000ms; average < 800ms

---

### PERF-002: Batch of 50 files < 30 seconds

| Field | Value |
|-------|-------|
| **ID** | PERF-002 |
| **Priority** | Medium |
| **Type** | Performance |
| **Level** | Performance |
| **Requirement** | FSD §8 — Batch of 50 files < 30s |
| **Preconditions** | Backend running; valid token; grammar registry loaded |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Prepare 50 files of ~100KB each (mixed TS, JS, Python, Java) | |
| 2 | POST all 50 files, measure total time | Total time < 30,000ms |
| 3 | Verify all 50 files written and indexed | `written: 50` |

**Test Data:** 50 files ~100KB each
**Acceptance Criteria:** p95 < 30s; all files processed successfully

---

### PERF-003: Dedup check < 100ms per file

| Field | Value |
|-------|-------|
| **ID** | PERF-003 |
| **Priority** | Medium |
| **Type** | Performance |
| **Level** | Performance |
| **Requirement** | FSD §8 — Dedup < 100ms |
| **Preconditions** | Backend running; DB has file records; valid token |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST file with known gitHash (first call) | File indexed |
| 2 | POST same file again with same gitHash (dedup check) | Measure time for the dedup path |
| 3 | Verify dedup time < 100ms | Time from request to response < 100ms |

**Test Data:** File with known gitHash, already indexed
**Acceptance Criteria:** Dedup check returns in < 100ms

---

### PERF-004: BFS crawl handles 1000 rules within 5 minutes

| Field | Value |
|-------|-------|
| **ID** | PERF-004 |
| **Priority** | Medium |
| **Type** | Performance |
| **Level** | Performance |
| **Requirement** | FSD §8 — BFS crawl 1000 rules < 5 min |
| **Preconditions** | Mock Pega Platform with 1000+ rules; backend running; pega-project.json exists |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger `indexPegaProject()` with mock returning 1000 rules | |
| 2 | Measure total crawl time | Total time < 5 minutes |
| 3 | Verify all 1000+ rules stored in backend | stored count matches fetched count |

**Test Data:** Mock Pega Platform with 1000 generative rules; 50 rules per batch
**Acceptance Criteria:** Crawl completes within 300s; all rules stored

---

### PERF-005: Concurrent indexing of 10 requests does not degrade throughput

| Field | Value |
|-------|-------|
| **ID** | PERF-005 |
| **Priority** | Low |
| **Type** | Performance |
| **Level** | Performance |
| **Requirement** | FSD §8 |
| **Preconditions** | Backend running; valid token; clean database |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send 10 concurrent requests (each with 1 file of ~50KB) | All return HTTP 200 |
| 2 | Measure p95 response time across all 10 | p95 < 5x single-file time |
| 3 | Compare to sequential 10 requests | Concurrent throughput is not worse than 2x sequential |

**Test Data:** 10 unique files ∼50KB each
**Acceptance Criteria:** No crashes; p95 < 5s; no data corruption

---

## 9. UAT Scenarios (UAT-001 to UAT-003)

### UAT-001: Developer/CI user sends batch of files and receives expected response

| Field | Value |
|-------|-------|
| **ID** | UAT-001 |
| **Priority** | High |
| **Type** | UAT |
| **Level** | UAT |
| **Requirement** | UC-01 (full main flow) |
| **Preconditions** | Valid Bearer token; access to POST /api/index/source endpoint |

**UAT Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send a batch of 5 files from a typical project (2 TS, 1 JS, 1 JSON, 1 .pega) | All 5 indexed; response shows written count and deps |
| 2 | Verify deps list is useful — shows path, expectedHash, sourceType | Each dep is actionable: can tell if local or remote |
| 3 | Re-send with same gitHash values | Skipped count = 5; written count = 0 |
| 4 | Modify 1 file and re-send | Modified file re-indexed; others skipped |

**Postconditions:** Developer confirms the API is usable for CI pipeline; dedup saves time on re-indexing

---

### UAT-002: Pega Platform integration workflow (configure → test → fetch → crawl)

| Field | Value |
|-------|-------|
| **ID** | UAT-002 |
| **Priority** | High |
| **Type** | UAT |
| **Level** | UAT |
| **Requirement** | UC-04, UC-05, UC-06, UC-07 |
| **Preconditions** | VS Code extension installed; Pega Platform credentials available |

**UAT Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open Settings → Pega Platform section | Clear UI with endpoint, username, password fields |
| 2 | Enter credentials, click Save | "Pega configuration saved" confirmation |
| 3 | Click Test Connection | Shows "Connected as operatorId (AppName)" |
| 4 | Click Fetch Context | Pega project files created; success message shown |
| 5 | Trigger workspace indexing | Pega crawl starts automatically; progress shown |
| 6 | After crawl completes | Summary shows rules fetched and stored |

**Postconditions:** BA confirms the workflow is intuitive and matches BRD Story 3

---

### UAT-003: Error scenarios provide actionable feedback

| Field | Value |
|-------|-------|
| **ID** | UAT-003 |
| **Priority** | Medium |
| **Type** | UAT |
| **Level** | UAT |
| **Requirement** | FSD §9 |
| **Preconditions** | Extension installed; backend running |

**UAT Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Try to connect to Pega with wrong credentials | Error message: "Connection failed: HTTP 401 Unauthorized (Invalid Operator ID or Password)" |
| 2 | Try to index with expired token | Response: `{ "error": "Unauthorized" }` — clear that re-authentication is needed |
| 3 | Send a .pega file with invalid JSON | File indexed with parse errors; no crash; error count documented |
| 4 | Send a batch where one file has path traversal | That file rejected; other files processed; clear which file was rejected |

**Postconditions:** BA confirms error messages are user-friendly and actionable

---

## 10. Requirements Traceability Matrix (RTM)

| Requirement | Source | Test Cases | Status |
|-------------|--------|------------|--------|
| UC-01 — Unified Indexing API | FSD §3.1.2 | IT-001, IT-002, IT-004, IT-006, IT-007, IT-008, IT-009, ST-001, ST-002, ST-003, UAT-001 | ✅ |
| UC-01 AF-01 — No X-Project-Id | FSD §3.1.2 | IT-009 | ✅ |
| UC-01 AF-02 — No X-Workspace-Root | FSD §3.1.2 | IT-009 | ✅ |
| UC-01 AF-03 — Hash matches → skip | FSD §3.1.2 | IT-003 | ✅ |
| UC-01 AF-04 — No hash → always process | FSD §3.1.2 | IT-003, ST-003 | ✅ |
| UC-01 EF-01 — Auth fails → 401 | FSD §3.1.2 | IT-005, SEC-002 | ✅ |
| UC-01 EF-02 — Missing files array → 400 | FSD §3.1.2 | IT-006 | ✅ |
| UC-01 EF-03 — Path traversal rejected | FSD §3.1.2 | IT-004, SEC-001 | ✅ |
| UC-01 EF-04 — File write fails | FSD §3.1.2 | IT-007 | ✅ |
| UC-01 EF-05 — Index parse error | FSD §3.1.2 | IT-007 | ✅ |
| UC-02 — Dependency Resolution | FSD §3.2.2 | UT-009, UT-010, UT-011, UT-012, UT-013 | ✅ |
| UC-02 AF-01 — File not found | FSD §3.2.2 | IT-010 | ✅ |
| UC-02 AF-02 — No imports | FSD §3.2.2 | UT-012 | ✅ |
| UC-02 AF-03 — Unsupported extension | FSD §3.2.2 | UT-012 | ✅ |
| UC-02 AF-04 — Invalid .pega JSON | FSD §3.2.2 | UT-013 | ✅ |
| UC-03 — Pega Rule Parsing | FSD §3.3.2 | UT-001, UT-002, UT-003, UT-004, IT-002 | ✅ |
| UC-03 EF-01 — Invalid JSON | FSD §3.3.2 | UT-002 | ✅ |
| UC-03 EF-02 — Empty/non-object JSON | FSD §3.3.2 | UT-003 | ✅ |
| UC-04 — Configure Pega Platform | FSD §3.4.2 | UT-019, ST-006, ST-009, UAT-002 | ✅ |
| UC-05 — Test Pega Connection | FSD §3.4.2 | UT-019, IT-011, ST-006 | ✅ |
| UC-06 — Fetch Pega Context | FSD §3.4.2 | ST-006 | ✅ |
| UC-07 — BFS Crawl | FSD §3.4.2 | IT-012, IT-013, IT-014, IT-015, ST-004, ST-010 | ✅ |
| UC-07 AF-05 — No Pega project | FSD §3.4.2 | IT-013 | ✅ |
| UC-07 AF-06 — Connection fails | FSD §3.4.2 | IT-011 | ✅ |
| UC-07 AF-07 — Backend unavailable | FSD §3.4.2 | IT-012 | ✅ |
| UC-07 AF-08 — 1000 iterations | FSD §3.4.2 | IT-015, PERF-004 | ✅ |
| UC-08 — Version-Aware Dedup | FSD §3.5.2 | IT-003, ST-003, PERF-003 | ✅ |
| BR-01 — Auth required | FSD §3.1.3 | IT-005, SEC-002 | ✅ |
| BR-02 — Path traversal rejected | FSD §3.1.3 | IT-004, SEC-001 | ✅ |
| BR-03 — 16-char SHA-256 hash | FSD §3.1.3 | IT-003 | ✅ |
| BR-04 — Empty files array = 200 | FSD §3.1.3 | IT-006 | ✅ |
| BR-05 — All extensions accepted | FSD §3.1.3 | ST-002 | ✅ |
| BR-06 — Rejected logged, batch continues | FSD §3.1.3 | IT-004, IT-007 | ✅ |
| BR-10 — Relative imports only | FSD §3.2.3 | UT-009 | ✅ |
| BR-11 — Extension priority order | FSD §3.2.3 | UT-009 | ✅ |
| BR-12 — Index variants | FSD §3.2.3 | UT-009 | ✅ |
| BR-13 — AST-based Pega refs | FSD §3.2.3 | UT-006, UT-007, UT-011 | ✅ |
| BR-14 — SHA-256 first 16 hex | FSD §3.2.3 | UT-011 | ✅ |
| BR-20 — 1 symbol per .pega | FSD §3.3.3 | UT-001 | ✅ |
| BR-21 — Rule name priority order | FSD §3.3.3 | UT-004 | ✅ |
| BR-22 — pxObjClass determines rule type | FSD §3.3.3 | UT-005 | ✅ |
| BR-23 — Relationships kind = 'references' | FSD §3.3.3 | UT-001, UT-006 | ✅ |
| BR-24 — 20+ rule type builders | FSD §3.3.3 | UT-005 | ✅ |
| BR-30 — 16-char hash comparison | FSD §3.5.3 | IT-003 | ✅ |
| BR-31 — No hash → process always | FSD §3.5.3 | ST-003 | ✅ |
| BR-32 — Empty hash = absent | FSD §3.5.3 | IT-003 | ✅ |
| BR-33 — Dedup is per-file | FSD §3.5.3 | IT-003, ST-003 | ✅ |
| FSD §6.1 — Processing steps | FSD §6.1 | ST-001 | ✅ |
| FSD §6.2 — BFS crawl flow | FSD §6.2 | ST-010, IT-014, IT-015 | ✅ |
| FSD §7.1 — Auth & Authorization | FSD §7.1 | ST-005, SEC-002, UT-016, UT-017 | ✅ |
| FSD §7.2 — Credential protection | FSD §7.2 | UT-018, SEC-003 | ✅ |
| FSD §7.3 — Audit trail | FSD §7.3 | SEC-001 | ✅ |
| FSD §8 — NFR Performance | FSD §8 | PERF-001, PERF-002, PERF-003, PERF-004, PERF-005 | ✅ |
| FSD §8 — NFR Security | FSD §8 | SEC-001, SEC-002, SEC-003, SEC-004, SEC-005 | ✅ |
| FSD §8 — NFR Usability | FSD §8 | UAT-001, UAT-002, UAT-003 | ✅ |
| FSD §9 — Error Scenarios | FSD §9 | UAT-003 | ✅ |
| AuthManager — getLastUsername | Extension code | UT-016, UT-020 | ✅ |
| AuthManager — Token lifecycle | Extension code | UT-017, ST-005 | ✅ |
| Login Panel — Password toggle | Extension code | UT-020, ST-007 | ✅ |
| ProviderConfigService — SecretStorage | Extension code | UT-018 | ✅ |
| File Scanner — .pega mapping | Extension code | UT-014 | ✅ |
| Grammar Registry — pega loading | Extension code | UT-014 | ✅ |

**Coverage Summary:**

| Category | Total | Covered | Coverage % |
|----------|-------|---------|------------|
| Use Cases | 8 (UC-01 to UC-08) | 8 | 100% |
| Business Rules | 24 (BR-01 to BR-33) | 24 | 100% |
| Alternative Flows | 8 (AF-01 to AF-08) | 8 | 100% |
| Exception Flows | 5 (EF-01 to EF-05) | 5 | 100% |
| Error Codes | 4 (400, 401, 400, 500) | 4 | 100% |
| NFRs (FSD §8) | 6 | 6 | 100% |
| Security Req (FSD §7) | 3 | 3 | 100% |
| **Overall** | **58** | **58** | **100%** |

---

## 11. Appendix

### Test Data Setup Scripts

#### Pre-seeded Pega Platform Mock Fixtures

The following mock server responses are needed for extension integration tests:

**D_OperatorID Response:**
```json
{
  "pyUserIdentifier": "pegaAdmin",
  "pyUserName": "Pega Administrator",
  "pyAccessGroup": "MyApp:Operators",
  "pyOrganization": "MyOrg",
  "pyOrgDivision": "MyDiv",
  "pyOrgUnit": "MyUnit"
}
```

**CaseTypes Response:**
```json
{
  "caseTypes": [
    { "name": "WorkOrder", "caseTypeID": "MyApp-WorkOrder" },
    { "name": "ServiceRequest", "caseTypeID": "MyApp-ServiceRequest" }
  ]
}
```

**Applications Response:**
```json
{
  "applications": [
    { "name": "MyApp", "applicationName": "MyApp" }
  ]
}
```

#### Backend Test Database Setup

```sql
-- Clean database for testing
DELETE FROM relationships;
DELETE FROM symbols;
DELETE FROM files;

-- Pre-seed a file for dedup tests
INSERT INTO files (project_id, path, relative_path, language, content_hash, size_bytes, line_count, last_indexed)
VALUES ('test-project', 'src/existing-file.ts', 'src/existing-file.ts', 'typescript', 'a1b2c3d4e5f67890', 100, 5, datetime('now'));
```

### Environment Configuration

| Property | Test Value |
|----------|-----------|
| `config.projectId` | `test-project` |
| `config.workspace` | `./workspaces/test` |
| `kiroSdlc.pegaEndpoint` | `http://localhost:18080/prweb` (mock) |
| `kiroSdlc.pegaUsername` | `pegaAdmin` |
| `kiroSdlc.pegaPassword` | `mockPass123` (in SecretStorage) |
| `pega.crawl.maxIterations` | `1000` |
| `indexer.maxFileSize` | `1048576` |
