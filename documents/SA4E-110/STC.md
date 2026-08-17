# System Test Cases (STC)

## SA4E — SA4E-110: Integrate Atlassian MCP Server as Child Server in Orchestrator

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-110 |
| Title | Integrate Atlassian MCP Server as Child Server in Orchestrator |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-08-14 |
| Status | Draft |
| Related STP | STP-v1-SA4E-110.docx |
| Total Test Cases | 60 |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-14 | QA Agent | Initial STC — 60 test cases across PBT, UT, IT, E2E-API, SEC levels |

---

## Test Case Summary

| Level | Count | Automation |
|-------|-------|------------|
| PBT (Property-Based) | 8 | 100% automated |
| UT (Unit) | 22 | 100% automated |
| IT (Integration) | 14 | 100% automated |
| E2E-API (End-to-End API) | 9 | 100% automated |
| E2E-UI | 0 | N/A |
| SIT | 0 | N/A |
| SEC (Security) | 7 | 100% automated |
| **Total** | **60** | **100% automated** |

---

## 1. PBT — Property-Based Test Cases

### PBT-01: Levenshtein Distance Properties

| Field | Value |
|-------|-------|
| **ID** | PBT-01 |
| **Module** | utils/levenshtein.ts |
| **Req** | BR-03 |
| **Priority** | Critical |

**Properties:**

| # | Property | Generator | Assertion |
|---|----------|-----------|-----------|
| 1 | Non-negativity | fc.string(), fc.string() | levenshtein(a, b) >= 0 |
| 2 | Identity | fc.string() | levenshtein(a, a) === 0 |
| 3 | Symmetry | fc.string(), fc.string() | levenshtein(a, b) === levenshtein(b, a) |
| 4 | Triangle inequality | fc.string() x3 | levenshtein(a, c) <= levenshtein(a, b) + levenshtein(b, c) |
| 5 | Upper bound | fc.string(), fc.string() | levenshtein(a, b) <= Math.max(a.length, b.length) |

**Runs:** 1000 iterations per property

---

### PBT-02: Token Bucket Rate Limiter Invariants

| Field | Value |
|-------|-------|
| **ID** | PBT-02 |
| **Module** | clients/rate-limiter.ts |
| **Req** | BR-15 |
| **Priority** | High |

**Properties:**

| # | Property | Generator | Assertion |
|---|----------|-----------|-----------|
| 1 | Tokens never negative | fc.nat(200) (acquire count) | After N acquires, getAvailableTokens() >= 0 |
| 2 | Tokens never exceed max | fc.nat(1000) (time advance ms) | After refill, tokens <= maxTokens |
| 3 | Monotonic refill | fc.nat(60000) (elapsed ms) | If no acquire: tokens(t+dt) >= tokens(t) |

**Runs:** 500 iterations per property

---

### PBT-03: Normalize String Idempotence

| Field | Value |
|-------|-------|
| **ID** | PBT-03 |
| **Module** | utils/normalize.ts |
| **Req** | BR-03 |
| **Priority** | Medium |

**Properties:**

| # | Property | Generator | Assertion |
|---|----------|-----------|-----------|
| 1 | Idempotent | fc.string() | normalize(normalize(x)) === normalize(x) |
| 2 | Lowercase | fc.string() | normalize(x) === normalize(x).toLowerCase() |
| 3 | Trim | fc.string() | normalize(x) === normalize(x).trim() |

---

### PBT-04: Path Validator Containment

| Field | Value |
|-------|-------|
| **ID** | PBT-04 |
| **Module** | utils/path-validator.ts |
| **Req** | SEC-#3, UC-04 |
| **Priority** | Critical |

**Properties:**

| # | Property | Generator | Assertion |
|---|----------|-----------|-----------|
| 1 | Valid subpath always resolves within root | fc.array(fc.stringOf(fc.constantFrom(...safeChars))) | validateFilePath(join(segments)) resolves to path starting with root |
| 2 | Traversal always rejected | fc.constantFrom('../', '..\\', '..%2f') prefixed | validateFilePath throws VALIDATION_ERROR |
| 3 | Null byte always rejected | fc.string() + '\0' | validateFilePath throws VALIDATION_ERROR |

---

### PBT-05: Credential Schema Round-Trip

| Field | Value |
|-------|-------|
| **ID** | PBT-05 |
| **Module** | credentials/credential-schemas.ts |
| **Req** | UC-07 |
| **Priority** | Medium |

**Properties:**

| # | Property | Generator | Assertion |
|---|----------|-----------|-----------|
| 1 | Valid messages parse | fc.record({type, requestId: fc.uuid(), ...}) | CredentialResponseSchema.safeParse(msg).success === true |
| 2 | Invalid type rejects | fc.string().filter(s => s !== 'credentials') | CredentialResponseSchema.safeParse({type: s}).success === false |

---

### PBT-06: Issue Key Pattern Validation

| Field | Value |
|-------|-------|
| **ID** | PBT-06 |
| **Module** | models/jira-schemas.ts |
| **Req** | BR-01 |
| **Priority** | High |

**Properties:**

| # | Property | Generator | Assertion |
|---|----------|-----------|-----------|
| 1 | Valid keys pass | fc.tuple(fc.stringOf(fc.constantFrom('A'-'Z'), {minLength:1, maxLength:10}), fc.nat({min:1})) | IssueKeySchema.safeParse(`${prefix}-${num}`).success === true |
| 2 | Lowercase rejected | fc.string({minLength:1}).map(s => s.toLowerCase() + '-1') | IssueKeySchema.safeParse(key).success === false |

---

### PBT-07: Exponential Backoff Bounds

| Field | Value |
|-------|-------|
| **ID** | PBT-07 |
| **Module** | clients/base-client.ts |
| **Req** | BR-16 |
| **Priority** | Medium |

**Properties:**

| # | Property | Generator | Assertion |
|---|----------|-----------|-----------|
| 1 | Backoff always positive | fc.nat({min:0, max:10}) (attempt) | exponentialBackoff(attempt) > 0 |
| 2 | Backoff increases | fc.nat({min:0, max:9}) | exponentialBackoff(n+1) >= exponentialBackoff(n) |
| 3 | Backoff capped | fc.nat({min:0, max:20}) | exponentialBackoff(n) <= MAX_BACKOFF |

---

### PBT-08: JQL Length Boundary

| Field | Value |
|-------|-------|
| **ID** | PBT-08 |
| **Module** | models/jira-schemas.ts |
| **Req** | SEC-#2 |
| **Priority** | High |

**Properties:**

| # | Property | Generator | Assertion |
|---|----------|-----------|-----------|
| 1 | Under limit passes | fc.string({maxLength: 2000}) | JqlSchema.safeParse(jql).success === true |
| 2 | Over limit fails | fc.string({minLength: 2001, maxLength: 5000}) | JqlSchema.safeParse(jql).success === false |

---

## 2. UT — Unit Test Cases

### UT-01: Jira Tool Name Convention Validation

| Field | Value |
|-------|-------|
| **ID** | UT-01 |
| **Module** | server.ts |
| **Req** | BR-01 |
| **Priority** | High |
| **Precondition** | Tool registration array loaded |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Get all registered Jira tool names | Array of 42 tool names |
| 2 | Assert each name matches /^jira_[a-z_]+$/ | All 42 names match pattern |
| 3 | Assert no duplicate names | Set(names).size === names.length |

---

### UT-02: Confluence Tool Name Convention Validation

| Field | Value |
|-------|-------|
| **ID** | UT-02 |
| **Module** | server.ts |
| **Req** | BR-02 |
| **Priority** | High |
| **Precondition** | Tool registration array loaded |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Get all registered Confluence tool names | Array of 23 tool names |
| 2 | Assert each name matches /^confluence_[a-z_]+$/ | All 23 names match pattern |
| 3 | Assert no duplicate names | Set(names).size === names.length |

---

### UT-03: Levenshtein Fuzzy Match — Known Pairs

| Field | Value |
|-------|-------|
| **ID** | UT-03 |
| **Module** | utils/levenshtein.ts |
| **Req** | BR-03 |
| **Priority** | Critical |
| **Precondition** | None |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | levenshtein("Review Docs", "Review Docs") | 0 (exact match) |
| 2 | levenshtein("review docs", "Review Docs") (after normalize) | 0 (case-insensitive) |
| 3 | levenshtein("Review Doc", "Review Docs") | 1 (1 char difference) |
| 4 | levenshtein("Reveiw Docs", "Review Docs") | 2 (transposition) |
| 5 | levenshtein("Implement", "Review Docs") | >= 8 (unrelated) |
| 6 | levenshtein("", "abc") | 3 |
| 7 | levenshtein("", "") | 0 |

---

### UT-04: File Size Validation (50MB Limit)

| Field | Value |
|-------|-------|
| **ID** | UT-04 |
| **Module** | tools/jira-attachment-tools.ts |
| **Req** | BR-04 |
| **Priority** | High |
| **Precondition** | Mock fs.stat |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Validate file of 1MB | Passes validation |
| 2 | Validate file of 49.9MB | Passes validation |
| 3 | Validate file of 50MB exactly | Passes validation (boundary) |
| 4 | Validate file of 50.1MB | Throws VALIDATION_ERROR with size info |
| 5 | Validate file of 100MB | Throws VALIDATION_ERROR |

---

### UT-05: Credential Manager — IPC Message Handling

| Field | Value |
|-------|-------|
| **ID** | UT-05 |
| **Module** | credentials/credential-manager.ts |
| **Req** | BR-05, UC-07 |
| **Priority** | Critical |
| **Precondition** | Mock process.send / process.on('message') |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call initialize() | Sends IPC: {type:'getCredentials', requestId: uuid} |
| 2 | Receive valid credential response with matching requestId | Credentials cached, isValidated() = true |
| 3 | Receive response with wrong requestId | Ignored — credentials not updated |
| 4 | Receive response with timestamp > 5s old | Ignored — stale message |
| 5 | Call getAuthHeaders() after valid receipt | Returns correct Basic/Bearer auth header |
| 6 | Call onRefresh(cb) + trigger refresh | Callback invoked |

---

### UT-06: Health Check Config Defaults

| Field | Value |
|-------|-------|
| **ID** | UT-06 |
| **Module** | config.ts |
| **Req** | BR-06 |
| **Priority** | Medium |
| **Precondition** | None |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Read default health config | interval = 60000 (60s) |
| 2 | Verify config matches PRODUCTION_HEALTH_CONFIG | Values identical |

---

### UT-07: Max Retries Configuration

| Field | Value |
|-------|-------|
| **ID** | UT-07 |
| **Module** | config.ts |
| **Req** | BR-07 |
| **Priority** | Medium |
| **Precondition** | None |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Read default maxRetries | 10 |
| 2 | Override via config object | Custom value accepted |

---

### UT-08: File/Function Size Lint Check

| Field | Value |
|-------|-------|
| **ID** | UT-08 |
| **Module** | All files in backend/src/servers/atlassian/ |
| **Req** | BR-11, BR-12 |
| **Priority** | Medium |
| **Precondition** | Source code exists |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Count lines in each .ts file | All <= 200 lines |
| 2 | Parse AST, count lines per function | All functions <= 20 lines |

---

### UT-09: Zero Any Types (TypeScript Strict)

| Field | Value |
|-------|-------|
| **ID** | UT-09 |
| **Module** | All files in backend/src/servers/atlassian/ |
| **Req** | BR-13 |
| **Priority** | Medium |
| **Precondition** | Source code exists |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run tsc --noEmit --strict | Zero errors |
| 2 | Run eslint with no-explicit-any rule | Zero violations |

---

### UT-10: Rate Limiter — Token Bucket Behavior

| Field | Value |
|-------|-------|
| **ID** | UT-10 |
| **Module** | clients/rate-limiter.ts |
| **Req** | BR-15 |
| **Priority** | High |
| **Precondition** | vi.useFakeTimers() |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create limiter with maxTokens=100, refillRate=100/60000 | Initial tokens = 100 |
| 2 | Call acquire() 100 times | All resolve immediately, tokens = 0 |
| 3 | Call acquire() at tokens=0 | Promise pending (waiting for refill) |
| 4 | Advance timer by 600ms | 1 token refilled, pending acquire resolves |
| 5 | Call reset() | Tokens back to 100 |
| 6 | getAvailableTokens() | Returns current count |

---

### UT-11: Base Client — Retry on 401 (Auth Refresh)

| Field | Value |
|-------|-------|
| **ID** | UT-11 |
| **Module** | clients/base-client.ts |
| **Req** | BR-16 |
| **Priority** | High |
| **Precondition** | Mock fetch, mock credentialManager |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | First request returns 401 | Calls credentialManager.refresh() |
| 2 | Retry with new credentials returns 200 | Request succeeds, returns data |
| 3 | Both attempts return 401 | Throws AUTH_FAILED error (no infinite loop) |

---

### UT-12: Base Client — Retry on 429 (Rate Limited)

| Field | Value |
|-------|-------|
| **ID** | UT-12 |
| **Module** | clients/base-client.ts |
| **Req** | BR-15, SEC-#2 |
| **Priority** | High |
| **Precondition** | Mock fetch with Retry-After header |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Request returns 429 with Retry-After: 5 | Waits 5 seconds |
| 2 | Retry after wait returns 200 | Request succeeds |
| 3 | Request returns 429 without Retry-After | Uses default backoff |

---

### UT-13: Path Validator — Traversal Prevention

| Field | Value |
|-------|-------|
| **ID** | UT-13 |
| **Module** | utils/path-validator.ts |
| **Req** | SEC-#3, UC-04 |
| **Priority** | Critical |
| **Precondition** | Workspace root = /tmp/test-workspace |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | validateFilePath("documents/file.docx", root) | Resolves to valid path |
| 2 | validateFilePath("../../etc/passwd", root) | Throws VALIDATION_ERROR |
| 3 | validateFilePath("/etc/passwd", root) | Throws VALIDATION_ERROR (absolute) |
| 4 | validateFilePath("file:///etc/shadow", root) | Throws VALIDATION_ERROR (protocol) |
| 5 | validateFilePath("valid/path\0../../secret", root) | Throws VALIDATION_ERROR (null byte) |
| 6 | validateFilePath("\\\\server\\share\\file", root) | Throws VALIDATION_ERROR (UNC) |
| 7 | validateFilePath("documents/../../../etc/hosts", root) | Throws VALIDATION_ERROR |
| 8 | validateFilePath("documents/subdir/file.pdf", root) | Resolves to valid path |

---

### UT-14: IPC Message Validation (requestId + Timestamp)

| Field | Value |
|-------|-------|
| **ID** | UT-14 |
| **Module** | credentials/credential-manager.ts |
| **Req** | SEC-#4 |
| **Priority** | High |
| **Precondition** | CredentialManager initialized with known requestId |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Receive message with correct requestId + fresh timestamp | Credentials accepted |
| 2 | Receive message with wrong requestId | Message ignored, warning logged |
| 3 | Receive message with timestamp > 5000ms ago | Message ignored (stale) |
| 4 | Receive message with missing requestId field | Message ignored |
| 5 | Receive message with future timestamp (>1s ahead) | Message accepted (clock skew tolerance) |

---

### UT-15: Rate Limiter — Conservative Init After Reconnect

| Field | Value |
|-------|-------|
| **ID** | UT-15 |
| **Module** | clients/rate-limiter.ts |
| **Req** | SEC-#5 |
| **Priority** | High |
| **Precondition** | None |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create limiter with isReconnect=false | Initial tokens = 100 (full) |
| 2 | Create limiter with isReconnect=true | Initial tokens = 25 (25% of max) |
| 3 | After reconnect, wait 60s | Tokens refill to 100 |

---

### UT-16: Base Client — No Retry on 400/403/404

| Field | Value |
|-------|-------|
| **ID** | UT-16 |
| **Module** | clients/base-client.ts |
| **Req** | TDD S6.4 |
| **Priority** | High |
| **Precondition** | Mock fetch |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Request returns 400 | Throws VALIDATION_ERROR immediately (no retry) |
| 2 | Request returns 403 | Throws PERMISSION_DENIED immediately |
| 3 | Request returns 404 | Throws NOT_FOUND immediately |

---

### UT-17: Base Client — Retry on 500 with Exponential Backoff

| Field | Value |
|-------|-------|
| **ID** | UT-17 |
| **Module** | clients/base-client.ts |
| **Req** | TDD S6.1 |
| **Priority** | High |
| **Precondition** | Mock fetch, vi.useFakeTimers() |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | First request returns 500 | Waits ~1s, retries |
| 2 | Second retry returns 500 | Waits ~2s, retries |
| 3 | Third retry returns 500 | Throws SERVER_ERROR (max retries) |
| 4 | First returns 500, second returns 200 | Succeeds on second attempt |

---

### UT-18: MIME Type Mapping

| Field | Value |
|-------|-------|
| **ID** | UT-18 |
| **Module** | utils/mime-types.ts |
| **Req** | UC-04 |
| **Priority** | Medium |
| **Precondition** | None |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | getMimeType("file.docx") | "application/vnd.openxmlformats-officedocument.wordprocessingml.document" |
| 2 | getMimeType("report.xlsx") | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" |
| 3 | getMimeType("doc.pdf") | "application/pdf" |
| 4 | getMimeType("screenshot.png") | "image/png" |
| 5 | getMimeType("diagram.drawio") | "application/xml" |
| 6 | getMimeType("unknown.xyz") | "application/octet-stream" (fallback) |

---

### UT-19: Error Response Sanitization

| Field | Value |
|-------|-------|
| **ID** | UT-19 |
| **Module** | models/error-schemas.ts |
| **Req** | SEC-#7, TDD S6.4 |
| **Priority** | Medium |
| **Precondition** | None |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | sanitizeJiraError({errorMessages: ["customfield_10001 required"]}) | "[field] required" |
| 2 | sanitizeJiraError({errorMessages: ["user@company.com not found"]}) | "[email] not found" |
| 3 | sanitizeJiraError(very long error string 1000+ chars) | Truncated to 500 chars |
| 4 | sanitizeJiraError(null) | Generic error message |

---

### UT-20: JQL Schema Validation

| Field | Value |
|-------|-------|
| **ID** | UT-20 |
| **Module** | models/jira-schemas.ts |
| **Req** | SEC-#2 |
| **Priority** | High |
| **Precondition** | None |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | JiraSearchRequestSchema.parse({jql: "project = SA4E", maxResults: 50}) | Valid |
| 2 | JiraSearchRequestSchema.parse({jql: ""}) | Fails (minLength 1) |
| 3 | JiraSearchRequestSchema.parse({jql: "a".repeat(2001)}) | Fails (maxLength 2000) |
| 4 | JiraSearchRequestSchema.parse({jql: "project = X", maxResults: 200}) | Fails (maxResults > 100) |
| 5 | JiraSearchRequestSchema.parse({jql: "project = X", maxResults: 0}) | Fails (min 1) |

---

### UT-21: Credential Manager — Auth Header Generation

| Field | Value |
|-------|-------|
| **ID** | UT-21 |
| **Module** | credentials/credential-manager.ts |
| **Req** | UC-07 |
| **Priority** | High |
| **Precondition** | Credentials cached |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Cloud credentials (email + token) | Returns "Basic base64(email:token)" |
| 2 | Server/DC credentials (username + PAT) | Returns "Bearer {PAT}" |
| 3 | No credentials cached | Throws CREDENTIALS_NOT_CONFIGURED |

---

### UT-22: Base Client — Timeout Handling

| Field | Value |
|-------|-------|
| **ID** | UT-22 |
| **Module** | clients/base-client.ts |
| **Req** | BR-10 |
| **Priority** | High |
| **Precondition** | Mock fetch that never resolves |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Request with default timeout (3000ms) | Throws CONNECTION_TIMEOUT after 3s |
| 2 | Request with custom timeout (60000ms for upload) | Throws after 60s |
| 3 | Timeout request is retryable | Retries up to maxRetries |

---

## 3. IT — Integration Test Cases

### IT-01: jira_transition_by_name — Fuzzy Match Pipeline

| Field | Value |
|-------|-------|
| **ID** | IT-01 |
| **Module** | tools/jira-transition-tools.ts (full pipeline) |
| **Req** | BR-03, UC-02 |
| **Priority** | Critical |
| **Precondition** | Mock Jira API returns transitions: ["Review Docs", "Implement", "Review code", "Verify", "Complete"] |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call with transition_name="Review Docs" (exact) | Transitions with id for "Review Docs" |
| 2 | Call with transition_name="review docs" (case diff) | Matches "Review Docs" |
| 3 | Call with transition_name="Review Doc" (1 char off) | Fuzzy matches "Review Docs" (distance=1) |
| 4 | Call with transition_name="Reveiw Docs" (typo) | Fuzzy matches "Review Docs" (distance=2) |
| 5 | Call with transition_name="Deploy" (no match) | Error with available transitions list |
| 6 | Call with transition_name="Re" (ambiguous) | Error with multiple matches |
| 7 | Call with fields={resolution:{name:"Done"}} | Fields included in POST body |
| 8 | Call with comment="Moving" | Comment added after transition |

---

### IT-02: jira_attach_file — Multipart Upload

| Field | Value |
|-------|-------|
| **ID** | IT-02 |
| **Module** | tools/jira-attachment-tools.ts |
| **Req** | BR-04, UC-04 |
| **Priority** | Critical |
| **Precondition** | Temp file created at workspace/test-file.docx (1KB), mock Jira API |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Attach valid .docx file | Returns attachment metadata (id, filename, size, mimeType) |
| 2 | Attach .png file | Correct MIME type in multipart headers |
| 3 | Attach file > 50MB | Throws VALIDATION_ERROR before HTTP call |
| 4 | Attach non-existent file | Throws FILE_NOT_FOUND error |
| 5 | Verify multipart/form-data content-type in request | Header includes boundary |
| 6 | Verify X-Atlassian-Token: no-check header | Required for attachment API |

---

### IT-03: Credential IPC — Full Flow

| Field | Value |
|-------|-------|
| **ID** | IT-03 |
| **Module** | credentials/credential-manager.ts + IPC channel |
| **Req** | BR-05, UC-07 |
| **Priority** | Critical |
| **Precondition** | Spawn child process with mock IPC parent |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Child sends getCredentials request | Parent receives IPC message |
| 2 | Parent responds with valid credentials | Child caches credentials |
| 3 | Child makes API call with cached auth headers | Request includes correct Authorization header |
| 4 | Parent sends credential update (hot-reload) | Child's next API call uses new credentials |
| 5 | Verify no credential appears in child stdout/stderr | Redaction working |

---

### IT-04: Health Check + Reconnect + Re-index

| Field | Value |
|-------|-------|
| **ID** | IT-04 |
| **Module** | McpClientManager + HealthMonitor + ReconnectManager |
| **Req** | BR-07, BR-14, UC-05 |
| **Priority** | Critical |
| **Precondition** | Orchestrator with atlassian child server connected |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Kill child server process | HealthMonitor detects (ping timeout) |
| 2 | Wait for reconnect trigger | ReconnectManager spawns new process |
| 3 | New child completes MCP handshake | State transitions: reconnecting -> connected |
| 4 | Call find_tools("jira") after reconnect | Returns 42+ tools (re-indexed) |
| 5 | Verify old tool entries cleared before re-index | No duplicate entries in mcp_tools |

---

### IT-05: Rate Limiter Under Load

| Field | Value |
|-------|-------|
| **ID** | IT-05 |
| **Module** | clients/rate-limiter.ts + base-client.ts |
| **Req** | BR-15, SEC-#5 |
| **Priority** | High |
| **Precondition** | Mock Jira API, real rate limiter instance |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Fire 100 requests in quick succession | All 100 proceed (full bucket) |
| 2 | Fire request #101 immediately | Request is delayed until token refills |
| 3 | Measure delay for #101 | Approximately 600ms (1 token/600ms) |
| 4 | After reconnect (isReconnect=true), fire 26 requests | 26th request is delayed (25% capacity) |

---

### IT-06: 401 → Credential Refresh → Retry

| Field | Value |
|-------|-------|
| **ID** | IT-06 |
| **Module** | clients/base-client.ts + credentials/credential-manager.ts |
| **Req** | BR-16 |
| **Priority** | High |
| **Precondition** | Mock API returns 401 then 200 after refresh |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Make request, API returns 401 | base-client triggers credential refresh |
| 2 | CredentialManager sends IPC refreshCredentials | IPC message sent |
| 3 | Mock parent responds with new credentials | Credentials updated |
| 4 | Automatic retry with new credentials | Returns 200 success |
| 5 | Second 401 after refresh | Throws AUTH_FAILED (no infinite loop) |

---

### IT-07: stdio Transport Verification

| Field | Value |
|-------|-------|
| **ID** | IT-07 |
| **Module** | index.ts + orchestration.json |
| **Req** | BR-17, SEC-#1 |
| **Priority** | Critical |
| **Precondition** | orchestration.json configured |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Read orchestration.json atlassian entry | transportType = "stdio" |
| 2 | Spawn child server via McpClientManager | Process spawned (not HTTP) |
| 3 | Verify no TCP port opened by child | netstat shows no listening port for child PID |
| 4 | Communication via stdin/stdout only | MCP messages flow over stdio |

---

### IT-08: Confluence Search — CQL + Text

| Field | Value |
|-------|-------|
| **ID** | IT-08 |
| **Module** | tools/confluence-search-tools.ts |
| **Req** | UC-03 |
| **Priority** | High |
| **Precondition** | Mock Confluence API |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | confluence_search({query: "type=page AND space=DEV"}) | CQL passed directly, results returned |
| 2 | confluence_search({query: "architecture guide"}) | Text converted to CQL, results returned |
| 3 | confluence_search({query: "test", space_key: "QA"}) | Space filter added to CQL |
| 4 | confluence_search({query: "test", limit: 10}) | Results limited to 10 |
| 5 | Verify response includes title, space, excerpt, URL | All fields present |

---

### IT-09: MCP Handshake + tools/list

| Field | Value |
|-------|-------|
| **ID** | IT-09 |
| **Module** | index.ts + server.ts (full child server) |
| **Req** | UC-01, BR-08 |
| **Priority** | Critical |
| **Precondition** | Valid child server binary, mock credentials |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Spawn child process with stdio transport | Process starts |
| 2 | Send MCP initialize request | Receive serverInfo response |
| 3 | Send tools/list request | Receive 65+ tool definitions |
| 4 | Verify each tool has name, description, inputSchema | Schema validation passes |
| 5 | Total time from spawn to tools/list response | < 10s |

---

### IT-10: Tool Call Proxy — jira_get_issue

| Field | Value |
|-------|-------|
| **ID** | IT-10 |
| **Module** | Orchestrator -> McpClientManager -> Child Server |
| **Req** | UC-01 |
| **Priority** | High |
| **Precondition** | Child server connected, mock Jira API |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call execute_dynamic_tool("jira_get_issue", {issue_key: "SA4E-110"}) | Orchestrator routes to child |
| 2 | Child server calls GET /rest/api/2/issue/SA4E-110 | Mock returns issue JSON |
| 3 | Verify response format | {content: [{type:'text', text: JSON}], isError: false} |
| 4 | Call with non-existent issue | {content: [...], isError: true} with NOT_FOUND |

---

### IT-11: Tool Registration Count

| Field | Value |
|-------|-------|
| **ID** | IT-11 |
| **Module** | server.ts |
| **Req** | UC-01 |
| **Priority** | High |
| **Precondition** | Server fully initialized |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Count Jira tools registered | 42 tools |
| 2 | Count Confluence tools registered | 23 tools |
| 3 | Count custom tools (transition_by_name + attach_file) | Included in Jira count |
| 4 | Total tools returned by tools/list | >= 65 |

---

### IT-12: Credential Hot-Reload

| Field | Value |
|-------|-------|
| **ID** | IT-12 |
| **Module** | credentials/credential-manager.ts |
| **Req** | UC-07, AF-07.3 |
| **Priority** | High |
| **Precondition** | Child server running with initial credentials |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send IPC message with new credentials (different token) | Credentials updated in-memory |
| 2 | Next API call uses new Authorization header | New token in request |
| 3 | No restart required | Child process PID unchanged |

---

### IT-13: Transition by Name — With Comment and Fields

| Field | Value |
|-------|-------|
| **ID** | IT-13 |
| **Module** | tools/jira-transition-tools.ts |
| **Req** | UC-02, AF-02.1, AF-02.2 |
| **Priority** | High |
| **Precondition** | Mock Jira API |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Transition with comment="Moving to review" | POST body includes update.comment |
| 2 | Transition with fields={resolution:{name:"Done"}} | POST body includes fields object |
| 3 | Transition with both comment + fields | Both present in request |
| 4 | Verify response includes from_status and to_status | Status transition info returned |

---

### IT-14: Disconnected Server — Graceful Degradation

| Field | Value |
|-------|-------|
| **ID** | IT-14 |
| **Module** | Orchestrator tool routing |
| **Req** | UC-05, EF-01.1 |
| **Priority** | High |
| **Precondition** | Child server NOT connected |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call find_tools("jira") when child disconnected | Returns empty or warning message |
| 2 | Call execute_dynamic_tool("jira_get_issue", ...) | Returns error: server not connected |
| 3 | Other tools (non-atlassian) still work | No impact on other child servers |

---

## 4. E2E-API — End-to-End API Test Cases

### E2E-01: Full Startup -> find_tools Discovery

| Field | Value |
|-------|-------|
| **ID** | E2E-01 |
| **Req** | UC-01, BR-01, BR-02, BR-08 |
| **Priority** | Critical |
| **Precondition** | Clean orchestrator start, mock Jira API (msw) |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start orchestrator with atlassian in orchestration.json | Child server spawns |
| 2 | Wait for state = connected | Connection within 10s |
| 3 | Call find_tools("jira") | Returns >= 42 tools starting with jira_ |
| 4 | Call find_tools("confluence") | Returns >= 23 tools starting with confluence_ |
| 5 | Call find_tools("jira issue") | jira_get_issue in top 3 results |
| 6 | Call find_tools("agile board sprint") | Agile tools returned |
| 7 | Response time for find_tools | < 200ms |

---

### E2E-02: Tool Discovery Timing

| Field | Value |
|-------|-------|
| **ID** | E2E-02 |
| **Req** | BR-08 |
| **Priority** | High |
| **Precondition** | Clean orchestrator start |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start timer at orchestrator init | Timer started |
| 2 | Poll until find_tools("jira") returns results | Tools available |
| 3 | Record elapsed time | < 10 seconds |

---

### E2E-03: find_tools Performance Benchmark

| Field | Value |
|-------|-------|
| **ID** | E2E-03 |
| **Req** | BR-09 |
| **Priority** | High |
| **Precondition** | Orchestrator running, 65+ tools indexed |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call find_tools("jira search") 100 times | All succeed |
| 2 | Measure p50 latency | < 100ms |
| 3 | Measure p95 latency | < 200ms |
| 4 | Measure p99 latency | < 500ms |

---

### E2E-04: Simple GET Tool Latency

| Field | Value |
|-------|-------|
| **ID** | E2E-04 |
| **Req** | BR-10 |
| **Priority** | High |
| **Precondition** | Child connected, mock Jira API (10ms response) |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call execute_dynamic_tool("jira_get_issue", {issue_key: "SA4E-1"}) | Success |
| 2 | Measure end-to-end latency | < 3s total (orchestrator overhead + API) |
| 3 | Repeat 10 times, measure average | Consistent < 1s with mock |

---

### E2E-05: Reconnect and Re-index End-to-End

| Field | Value |
|-------|-------|
| **ID** | E2E-05 |
| **Req** | BR-14, UC-05 |
| **Priority** | Critical |
| **Precondition** | Orchestrator with child connected |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify find_tools("jira") returns tools | Baseline working |
| 2 | Kill child server process (SIGKILL) | Process terminates |
| 3 | Wait for health check detection (up to 60s + timeout) | State -> unhealthy |
| 4 | Wait for reconnect | New process spawned, state -> connected |
| 5 | Call find_tools("jira") | Returns 42+ tools again |
| 6 | Call execute_dynamic_tool("jira_get_issue", ...) | Works post-reconnect |

---

### E2E-06: stdio Transport Isolation

| Field | Value |
|-------|-------|
| **ID** | E2E-06 |
| **Req** | BR-17, SEC-#1 |
| **Priority** | Critical |
| **Precondition** | Orchestrator running |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start orchestrator with atlassian child server | Child spawns via stdio |
| 2 | Check orchestration_status() | Transport shows "stdio" |
| 3 | Port scan localhost for child server ports | No new listening ports |
| 4 | Verify MCP communication works | tools/list returns results |

---

### E2E-07: Transition Lifecycle — Full Flow

| Field | Value |
|-------|-------|
| **ID** | E2E-07 |
| **Req** | UC-02 |
| **Priority** | Critical |
| **Precondition** | Mock Jira API with SA4E-1 in "To Do" status |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | find_tools("jira transition") | Returns jira_transition_by_name |
| 2 | execute_dynamic_tool("jira_transition_by_name", {issue_key:"SA4E-1", transition_name:"Review Docs"}) | Success: from="To Do", to="Docs Review" |
| 3 | execute_dynamic_tool("jira_transition_by_name", {issue_key:"SA4E-1", transition_name:"Implement"}) | Success: from="Docs Review", to="In Progress" |
| 4 | execute_dynamic_tool("jira_transition_by_name", {issue_key:"SA4E-1", transition_name:"NonExistent"}) | Error with available transitions |

---

### E2E-08: Confluence Search — Full Flow

| Field | Value |
|-------|-------|
| **ID** | E2E-08 |
| **Req** | UC-03 |
| **Priority** | High |
| **Precondition** | Mock Confluence API with 3 test pages |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | find_tools("confluence search") | Returns confluence_search |
| 2 | execute_dynamic_tool("confluence_search", {query: "architecture"}) | Returns matching pages |
| 3 | Verify result includes title, space, excerpt, url | All fields present |
| 4 | execute_dynamic_tool("confluence_search", {query: "nonexistent_xyz"}) | Empty results (not error) |

---

### E2E-09: File Attachment — Full Flow

| Field | Value |
|-------|-------|
| **ID** | E2E-09 |
| **Req** | UC-04 |
| **Priority** | Critical |
| **Precondition** | Temp .docx file created, mock Jira attachment API |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | find_tools("jira attach") | Returns jira_attach_file |
| 2 | execute_dynamic_tool("jira_attach_file", {issue_key:"SA4E-1", file_path:"test/report.docx"}) | Returns {id, filename, size, mimeType} |
| 3 | Verify uploaded content matches file content | Binary comparison |
| 4 | Attempt with path "../../etc/passwd" | Returns VALIDATION_ERROR |
| 5 | Attempt with file > 50MB | Returns VALIDATION_ERROR (no upload attempted) |

---

## 5. SEC — Security Test Cases

### SEC-01: Credential Exposure Prevention

| Field | Value |
|-------|-------|
| **ID** | SEC-01 |
| **Req** | BR-05, SECURITY-REVIEW #1 |
| **Priority** | Critical |
| **Precondition** | Child server running with real-format credentials |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Grep all .ts files for hardcoded credentials | Zero matches |
| 2 | Check orchestration.json for credential fields | No tokens/passwords |
| 3 | Capture child server stdout during operation | No credential values in output |
| 4 | Trigger error condition with invalid credentials | Error message has no token value |
| 5 | Verify orchestration.json transportType | "stdio" (not httpStream) |

---

### SEC-02: Path Traversal Attack Vectors

| Field | Value |
|-------|-------|
| **ID** | SEC-02 |
| **Req** | SEC-#3, UC-04 |
| **Priority** | Critical |
| **Precondition** | jira_attach_file tool available |

**Test vectors (from OWASP):**

| # | Input file_path | Expected |
|---|----------------|----------|
| 1 | `../../etc/passwd` | VALIDATION_ERROR |
| 2 | `..\..\windows\system32\config\sam` | VALIDATION_ERROR |
| 3 | `/etc/shadow` | VALIDATION_ERROR |
| 4 | `C:\windows\system32\drivers\etc\hosts` | VALIDATION_ERROR |
| 5 | `file:///etc/passwd` | VALIDATION_ERROR |
| 6 | `documents/valid/../../../etc/hosts` | VALIDATION_ERROR |
| 7 | `documents/file%00.txt../../secret` | VALIDATION_ERROR |
| 8 | `\\\\attacker\\share\\payload` | VALIDATION_ERROR |
| 9 | `....//....//etc/passwd` | VALIDATION_ERROR |
| 10 | `documents/legit/file.docx` | SUCCESS (valid path) |

---

### SEC-03: JQL Injection Prevention

| Field | Value |
|-------|-------|
| **ID** | SEC-03 |
| **Req** | SEC-#2 |
| **Priority** | High |
| **Precondition** | jira_search tool available |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | JQL with length = 2000 chars | Accepted |
| 2 | JQL with length = 2001 chars | Rejected: exceeds max length |
| 3 | maxResults = 100 | Accepted |
| 4 | maxResults = 101 | Rejected or capped to 100 |
| 5 | JQL = "project = X ORDER BY created DESC" (normal) | Accepted, passes to Jira |

---

### SEC-04: IPC Message Integrity

| Field | Value |
|-------|-------|
| **ID** | SEC-04 |
| **Req** | SEC-#4 |
| **Priority** | High |
| **Precondition** | Credential manager initialized |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send credential response with wrong requestId | Rejected (not applied) |
| 2 | Send credential response with stale timestamp (>5s old) | Rejected |
| 3 | Send credential response with correct requestId + fresh timestamp | Accepted |
| 4 | Replay previously accepted message | Rejected (requestId consumed) |
| 5 | Send message with missing type field | Rejected |
| 6 | Send message with extra unexpected fields | Accepted (zod strips extras) |

---

### SEC-05: Rate Limiter Reconnect Behavior

| Field | Value |
|-------|-------|
| **ID** | SEC-05 |
| **Req** | SEC-#5 |
| **Priority** | High |
| **Precondition** | Child server that can be killed and restarted |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Fresh start: verify 100 tokens available | tokens = 100 |
| 2 | Kill child, trigger reconnect | New process spawned |
| 3 | After reconnect: check initial tokens | tokens = 25 (25% conservative) |
| 4 | Send 25 rapid requests after reconnect | All succeed |
| 5 | Send 26th request | Delayed (bucket empty at conservative level) |
| 6 | Wait for full refill (60s) | Tokens back to 100 |

---

### SEC-06: Error Response Information Leak Prevention

| Field | Value |
|-------|-------|
| **ID** | SEC-06 |
| **Req** | SEC-#7 |
| **Priority** | Medium |
| **Precondition** | Mock Jira API returning detailed errors |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger error with customfield_10001 in message | Response shows "[field]" not actual ID |
| 2 | Trigger error with user email in message | Response shows "[email]" not actual email |
| 3 | Trigger error with internal URL | Response does not contain internal hostname |
| 4 | Trigger very long error | Response truncated to 500 chars max |

---

### SEC-07: autoApprove Policy Validation

| Field | Value |
|-------|-------|
| **ID** | SEC-07 |
| **Req** | SEC-#8 |
| **Priority** | Low |
| **Precondition** | orchestration.json loaded |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Read autoApprove list from orchestration.json | List of tool names |
| 2 | Verify all tools in list are read-only (GET methods) | No write tools (create, update, delete, transition, attach) |
| 3 | Verify jira_create_issue NOT in autoApprove | Absent |
| 4 | Verify jira_delete_issue NOT in autoApprove | Absent |
| 5 | Verify jira_transition_by_name NOT in autoApprove | Absent |

---

## 6. Test Execution Order

```
Phase 1: PBT (parallel) — 8 test cases
  +-- levenshtein properties
  +-- rate-limiter invariants
  +-- normalize idempotence
  +-- path validator containment
  +-- credential schema round-trip
  +-- issue key pattern
  +-- backoff bounds
  +-- JQL length boundary

Phase 2: UT (parallel) — 22 test cases
  +-- Module unit tests (mocked dependencies)
  +-- Schema validation tests

Phase 3: IT (sequential) — 14 test cases
  +-- MCP handshake + tools/list
  +-- Tool call proxy
  +-- Transition fuzzy match pipeline
  +-- File attachment
  +-- Credential IPC flow
  +-- Reconnect + re-index
  +-- Rate limiter under load

Phase 4: SEC (sequential) — 7 test cases
  +-- Credential exposure
  +-- Path traversal
  +-- JQL injection
  +-- IPC integrity
  +-- Rate limiter reconnect
  +-- Error leak prevention
  +-- autoApprove policy

Phase 5: E2E-API (sequential) — 9 test cases
  +-- Full startup -> discovery
  +-- Transition lifecycle
  +-- File attachment flow
  +-- Confluence search flow
  +-- Reconnect + re-index flow
```

---

## 7. Defect Severity Classification

| Severity | Definition | Example |
|----------|-----------|---------|
| Critical | System crash, data loss, security breach | Path traversal allows file read, credentials exposed |
| High | Feature non-functional, major workflow blocked | Transition by name fails, reconnect doesn't re-index |
| Medium | Feature degraded, workaround exists | Rate limiter timing off by >10%, fuzzy match threshold too strict |
| Low | Cosmetic, minor inconvenience | Error message unclear, extra whitespace in response |

---

## 8. Diagrams

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |
