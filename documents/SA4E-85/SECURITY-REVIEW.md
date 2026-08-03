# 🔒 Security Design Review — SA4E-85

## Document Information

| Field | Value |
|-------|-------|
| Ticket | SA4E-85 |
| Title | Nâng cấp Chat UI Agentic - Svelte Webview |
| Reviewed Document | TDD.md v2.0 (→ v3.0 addendum → v3.1 addendum) |
| Reviewer | Security Agent |
| Date | 2026-08-02 |
| Architecture | VSCode Extension (Plugin Pattern) — Svelte 4 Webview |
| Overall Risk | **Low** ✅ (v1) → **Medium** (v3.0) → **Low** (v3.1, restored) |

---

## Executive Summary

The security design in TDD Section 6 demonstrates a **well-considered, defense-in-depth approach** appropriate for a VSCode extension operating within a local development environment. The design correctly identifies the threat boundaries (Webview sandbox, Extension Host, localhost IPC) and applies proportional controls at each layer.

Key strengths:
- CSP is restrictive with nonce-based scripts and `default-src 'none'`
- Permission model clearly separates safe/dangerous tool operations
- IPC is correctly scoped to localhost-only with validation
- Input sanitization is specified for all untrusted sources
- File system access is scoped and principle-of-least-privilege

No **Critical** or **High** findings identified. The design is solid for its threat model (local extension, no remote attack surface, single-user context).

---

## Findings Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 0 |
| 🟡 Medium | 3 |
| 🔵 Low | 4 |
| ℹ️ Informational | 3 |

---

## Detailed Findings

### Finding #1: WebSocket Message Size DoS — No Rate Limiting on Message Frequency

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟡 Medium |
| **Category** | API Security / DoS |
| **CWE** | CWE-770: Allocation of Resources Without Limits |
| **CVSS** | 4.0 |
| **Location** | TDD Section 6.3 (IPC Security) |
| **Status** | Design Gap |

**Description:**
The TDD specifies a 10MB max message size and 5s connection timeout, but does not define rate limiting on message frequency. A compromised or buggy local service could flood the Extension Host with rapid JSON-RPC messages, causing UI freezes and memory pressure.

**Impact:**
Local DoS — extension becomes unresponsive. Low exploitability since it requires a malicious process on localhost.

**Recommendation:**
Add message rate limiting to IpcBridge design:
```typescript
// Add to IpcBridge design constraints
const MAX_MESSAGES_PER_SECOND = 100;
const BURST_LIMIT = 50; // max messages in 500ms window
// Drop messages exceeding rate + log warning
```

---

### Finding #2: Session Approval Scope — "Allow All Session" Granularity

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟡 Medium |
| **Category** | Authorization / Permission Model |
| **CWE** | CWE-269: Improper Privilege Management |
| **CVSS** | 4.5 |
| **Location** | TDD Section 6.2 (Permission Model) |
| **Status** | Design Consideration |

**Description:**
"Allow All Session" approves all tools of the same TYPE (e.g., all `write` tools). This means approving one write tool auto-approves ALL write tools for the session — including file overwrites, config modifications, or writes to sensitive paths. There's no per-tool or per-path granularity.

**Impact:**
A user who approves a benign write (e.g., formatting a file) implicitly approves all subsequent write operations. An agent could then write to unexpected locations within the workspace.

**Recommendation:**
Consider adding a path-scoped session approval variant:
```typescript
// Option A: Per-tool-name session approval (more granular)
sessionApprovals: Map<string, Set<string>>  // toolType -> Set<toolName>

// Option B: Document the trade-off explicitly
// "Allow All Session" is convenience feature — user accepts risk
// Add UI indicator showing "Session: 3 write tools auto-approved"
```

---

### Finding #3: PlantUML Server-Side Rendering — SSRF Potential

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟡 Medium |
| **Category** | SSRF / External Communication |
| **CWE** | CWE-918: Server-Side Request Forgery |
| **CVSS** | 4.3 |
| **Location** | TDD Section 2.9 (DiagramRenderer) |
| **Status** | ~~Design Gap~~ → **CLOSED** (local CLI rendering eliminates SSRF) |

**Description:**
~~DiagramRenderer uses plantuml-encoder + server-side fetch to render diagrams.~~ **UPDATE:** TDD v2 updated to use local PlantUML CLI binary (`plantuml -tsvg`). No remote server call needed. Diagram source never leaves the machine. SSRF risk completely eliminated.

**Impact:** None — rendering is purely local.

**Resolution:** Use local PlantUML application (CLI/JAR) instead of remote server. Zero network calls for diagram rendering.

---

### Finding #4: Telemetry File — No Access Control for Other Extensions

| Attribute | Value |
|-----------|-------|
| **Severity** | 🔵 Low |
| **Category** | Data Protection |
| **CWE** | CWE-732: Incorrect Permission Assignment |
| **CVSS** | 2.5 |
| **Location** | TDD Section 2.7 (TelemetryService) |
| **Status** | Acceptable Risk |

**Description:**
`.code-intel/telemetry.jsonl` is written with append-only semantics but no file-level access restrictions. Other VSCode extensions or local processes can read this file, which may contain tool execution patterns, file paths, and agent interaction metadata.

**Impact:**
Information disclosure of user development patterns to other local processes. Low severity given single-user, local-only context.

**Recommendation:**
- Document that telemetry.jsonl may contain workspace file paths and tool names
- Consider file permissions (0600) if Node.js fs allows it on the platform
- Add a `/telemetry clear` slash command for user control

---

### Finding #5: RUN_TERMINAL_COMMAND — Potential Command Injection

| Attribute | Value |
|-----------|-------|
| **Severity** | 🔵 Low |
| **Category** | Injection |
| **CWE** | CWE-78: OS Command Injection |
| **CVSS** | 3.5 |
| **Location** | TDD Section 4.1 (WebviewMessage — RUN_TERMINAL_COMMAND) |
| **Status** | Partially Mitigated |

**Description:**
The `RUN_TERMINAL_COMMAND` message type allows the Webview to request the Extension Host to spawn a terminal with a specific command. While this is used for service auto-recovery (UC-08), the design does not specify a command allowlist. The message validation table (Section 4.3) does not include validation for the `command` field.

The Webview is sandboxed by CSP, making injection from external sources unlikely. However, if an agent constructs malicious terminal commands, the design does not specify guard rails.

**Impact:**
Mitigated by: (1) CSP prevents external script injection into Webview, (2) `RUN_TERMINAL_COMMAND` likely comes from extension host logic not direct user input. Still, defense-in-depth suggests command validation.

**Recommendation:**
```typescript
// Add command allowlist for RUN_TERMINAL_COMMAND
const ALLOWED_COMMANDS = [
  /^kiro\s+start$/,           // Kiro service start
  /^antigravity\s+start$/,    // AntiGravity service start
  /^npm\s+run\s+\w+$/,        // npm scripts
];

// Or: Only allow commands defined in .code-intel/.run/*.json
function validateTerminalCommand(cmd: string): boolean {
  return ALLOWED_COMMANDS.some(pattern => pattern.test(cmd));
}
```

---

### Finding #6: Service Discovery File Tampering

| Attribute | Value |
|-----------|-------|
| **Severity** | 🔵 Low |
| **Category** | Integrity / Trust |
| **CWE** | CWE-345: Insufficient Verification of Data Authenticity |
| **CVSS** | 3.0 |
| **Location** | TDD Section 2.5 (IpcBridge — Service Discovery) |
| **Status** | Acceptable Risk |

**Description:**
Service discovery relies on `.code-intel/.run/{service}.json` files containing `ws_endpoint`, `pid`, `status`. The design trusts these files without verifying that the declared PID actually owns the WebSocket port. A malicious local process could write a fake discovery file pointing to its own WebSocket server.

**Impact:**
Local-only attack vector. Attacker must already have code execution on the machine. Low additional risk since localhost access already implies trust.

**Recommendation:**
```typescript
// Optional: Verify PID owns the port
async function verifyServiceOwnership(discovery: ServiceDiscovery): boolean {
  // Check if declared PID is actually running
  // Check if declared PID has the WebSocket port open
  // This is defense-in-depth; not critical for localhost trust model
}
```

---

### Finding #7: Nonce Entropy — Not Specified

| Attribute | Value |
|-----------|-------|
| **Severity** | 🔵 Low |
| **Category** | CSP Implementation |
| **CWE** | CWE-330: Use of Insufficiently Random Values |
| **CVSS** | 2.0 |
| **Location** | TDD Section 6.1 (CSP) |
| **Status** | Implementation Detail |

**Description:**
The CSP uses nonce-based script-src (`'nonce-${nonce}'`) but the TDD does not specify nonce generation requirements: entropy source, length, or per-request regeneration.

**Impact:**
If nonce is predictable or reused across panel reloads, CSP can be bypassed. VSCode's built-in nonce generation is likely secure, but the design should specify this.

**Recommendation:**
```typescript
// Specify in TDD: nonce MUST use crypto.randomBytes
import { randomBytes } from 'crypto';
const nonce = randomBytes(16).toString('base64');
// Regenerated per webview panel creation (not reused)
```

---

### Finding #8: `data:` URI in img-src — SVG Injection Vector

| Attribute | Value |
|-----------|-------|
| **Severity** | ℹ️ Informational |
| **Category** | CSP / XSS |
| **CWE** | CWE-79: Cross-site Scripting |
| **Location** | TDD Section 6.1 (CSP) |

**Description:**
CSP allows `img-src ... data:` to support inline SVG diagrams rendered as data URIs. While `<img>` tags with data URIs do not execute scripts, this is noted for awareness. The TDD correctly specifies DOMPurify sanitization for SVG content (Section 6.5), which mitigates this.

**Status:** Properly mitigated by DOMPurify. No action needed.

---

### Finding #9: JSON-RPC Schema Validation — Specification Gap

| Attribute | Value |
|-----------|-------|
| **Severity** | ℹ️ Informational |
| **Category** | Input Validation |
| **CWE** | CWE-20: Improper Input Validation |
| **Location** | TDD Section 6.3 + 6.5 |

**Description:**
The TDD mentions "JSON-RPC responses validated against expected schema" and "JSON schema validation" for responses, but does not specify which schema validation library or strategy (runtime type checking, Zod, io-ts, JSON Schema). This is an implementation detail but worth noting for the DEV phase.

**Recommendation:**
Specify runtime validation approach — suggest `zod` for TypeScript type-safe parsing:
```typescript
import { z } from 'zod';
const JsonRpcResponse = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  result: z.unknown().optional(),
  error: z.object({ code: z.number(), message: z.string() }).optional(),
});
```

---

### Finding #10: No Explicit Logging of Permission Decisions for Audit

| Attribute | Value |
|-----------|-------|
| **Severity** | ℹ️ Informational |
| **Category** | Security Logging |
| **CWE** | CWE-778: Insufficient Logging |
| **Location** | TDD Section 2.7 (TelemetryService) + Section 6.2 |

**Description:**
TelemetryService logs diff actions and tool executions, but the design does not explicitly state that permission APPROVE/REJECT decisions are logged. For audit trail purposes, knowing which dangerous tools were approved and when is valuable.

**Recommendation:**
Add to TelemetryService interface:
```typescript
/** Log permission decision (approve/reject) for audit trail */
logPermissionDecision(toolId: string, toolName: string, toolType: ToolType,
                      decision: 'APPROVE' | 'REJECT', sessionApproval: boolean): void;
```

---

## Security Design Strengths ✅

| Area | Assessment |
|------|-----------|
| CSP Configuration | ✅ Excellent — `default-src 'none'` + nonce-based scripts |
| Permission Model | ✅ Well-designed — clear safe/dangerous separation with timeout |
| IPC Localhost Restriction | ✅ Correct — validated with allowedHosts check |
| Input Sanitization | ✅ Comprehensive — covers all input vectors |
| File System Scoping | ✅ Appropriate — principle of least privilege |
| Error Handling | ✅ Error boundaries prevent cascading failures |
| File Integrity | ✅ SHA-256 for concurrent modification detection |
| Data Privacy | ✅ Telemetry is local-only, no network transmission |
| WCAG Compliance | ✅ Security UX — focus trap in permission modal |
| Session Management | ✅ Approvals cleared on deactivate/reload |

---

## Review Checklist Results

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | Authentication/Authorization design | ✅ Pass | Permission model is clear and appropriate for extension context |
| 2 | Data protection — encryption at rest/transit | ✅ Pass | Local-only data, no PII transmitted externally, SHA-256 integrity |
| 3 | API security — rate limiting, input validation, CORS | ⚠️ Partial | Input validation ✅, rate limiting not specified for IPC messages |
| 4 | Dependency risks — vulnerable libraries | ✅ Pass | gray-matter, plantuml-encoder, DOMPurify are well-maintained |
| 5 | Infrastructure security — network, secrets | ✅ Pass | Localhost-only, no secrets in design (no auth tokens stored) |
| 6 | Injection risks — command, XSS | ⚠️ Partial | XSS mitigated by CSP+DOMPurify; terminal command needs allowlist |
| 7 | Session management — lifetime, revocation | ✅ Pass | Session cleared on deactivate, 60s timeout on unanswered perms |
| 8 | CSP adequacy | ✅ Pass | Restrictive and appropriate; minor nonce spec gap |
| 9 | WebSocket security — origin, message size | ⚠️ Partial | Size limit ✅, localhost ✅; rate limiting and PID verification gaps |
| 10 | Permission model completeness | ⚠️ Partial | Good coverage; session approval granularity could be tighter |

---

## Recommendation

### 🟢 PROCEED to Phase 4

No Critical or High findings. The 3 Medium findings are design hardening opportunities, not blocking issues. They should be:

1. **Logged as DEV requirements** — address during implementation (Phase 5)
2. **Added to STP** — QA should include negative test cases for IPC flooding and command validation

### Action Items for DEV Phase

| Priority | Finding | Action |
|----------|---------|--------|
| 1 | IPC rate limiting (#1) | Implement message rate limiter in IpcBridge |
| 2 | Terminal command validation (#5) | Add command allowlist or pattern validation |
| 3 | PlantUML server config (#3) | Make server URL configurable, default to localhost |
| 4 | Permission audit logging (#10) | Add permission decisions to telemetry |
| 5 | Nonce generation spec (#7) | Use crypto.randomBytes(16), regenerate per panel |

---

## Scope Limitations

- **Static design review only** — no runtime testing or penetration testing performed
- **Threat model assumes single-user local environment** — findings rated accordingly
- **Dependency CVE check** — not performed against specific versions (versions not pinned in TDD)
- **VSCode host security** — assumed secure (extension sandbox, webview isolation)

---
---

## v3 Addendum — Backend-Driven State Security Review

### Review Information

| Field | Value |
|-------|-------|
| Reviewed Document | TDD v3.0 (Backend-Driven State) |
| Previous Review | v1 — 0 Critical, 0 High, 3 Medium (all CLOSED) |
| Date | 2026-08-02 |
| Focus | NEW attack surfaces introduced by v3 architecture changes |
| Architecture Change | Svelte Stores (frontend SoT) → LangGraph Checkpointer (backend SoT) + Multi-IDE sync |

### v3 Executive Summary

TDD v3 introduces **significant new attack surface** by:
1. Persisting full conversation history + IDE context to a local SQLite database
2. Using a file-based session identifier (`session.json`) for multi-IDE coordination
3. Broadcasting streaming tokens to ALL connected WebSocket clients sharing a `thread_id`
4. Exposing a Hydration API that returns full conversation history on demand
5. Allowing any connected client to resume a paused LangGraph execution

The threat model remains **local-only** (no remote attack surface), but the persistence and multi-process sharing of sensitive data raises the bar. A compromised or rogue local process now has access to:
- Full conversation history (including code snippets, file paths, LSP diagnostics)
- The ability to inject commands into an active LangGraph session
- Tool approval bypass via race conditions

**v3 Overall Risk Rating: Medium** (elevated from Low in v1)

### v3 Findings Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 1 |
| 🟡 Medium | 3 |
| 🔵 Low | 2 |
| ℹ️ Informational | 1 |

---

### Finding #11: Unauthorized Graph Resume — Permission Guard Bypass via Rogue WebSocket Client

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟠 High |
| **Category** | Authorization / Broken Access Control |
| **CWE** | CWE-862: Missing Authorization |
| **CVSS** | 7.1 |
| **Location** | TDD v3 Section 2.3 (OpenCodeToolHandler — Resume Graph) + Section 2.4 (IpcBridge — Pub/Sub) |
| **Status** | Open — Design Gap |

**Description:**
When a dangerous tool triggers `interrupt()`, LangGraph pauses and waits for a `TOOL_CALL_RESPONSE` with decision `APPROVE`/`REJECT`. In v3, this response is sent from the Extension Host via WebSocket to the Backend. However:

1. The Pub/Sub broadcasting means ALL connected clients receive the `TOOL_CALL_REQUEST`.
2. ANY connected client can send `TOOL_CALL_RESPONSE` — there is no mechanism to verify that the responding client is the one that displayed the PermissionGuard to the user.
3. A rogue local process that connects to the same WebSocket endpoint and knows the `thread_id` can send `TOOL_CALL_RESPONSE { decision: 'APPROVE' }` without any human interaction.

The TDD does not specify:
- Client identity verification on resume requests
- Correlation between which client received the interrupt and which client is allowed to respond
- Rate limiting or deduplication on resume signals

**Impact:**
A malicious local process could auto-approve ALL dangerous tool executions (file writes, shell commands, git operations, file deletions) without the developer ever seeing the PermissionGuard modal. This bypasses the entire human-in-the-loop safety mechanism (BR-01).

**Remediation:**
```typescript
// Option A: Challenge-Response for resume
interface InterruptChallenge {
  toolId: string;
  challenge: string;  // crypto.randomBytes(32).toString('hex')
  issuedTo: string;   // client_id that received the TOOL_CALL_REQUEST
  expiresAt: number;  // timestamp — 60s timeout (BR-03)
}

// Backend issues challenge WITH the TOOL_CALL_REQUEST
// Only the client that received the challenge can respond with matching token
interface ToolCallResponse {
  type: 'TOOL_CALL_RESPONSE';
  toolId: string;
  decision: 'APPROVE' | 'REJECT';
  challengeResponse: string;  // Must match issued challenge
  clientId: string;           // Must match issuedTo
}

// Option B: First-responder lock
// Backend accepts ONLY the first TOOL_CALL_RESPONSE per toolId
// After receiving one → reject all subsequent responses for same toolId
// + Broadcast TOOL_RESOLVED to other clients so they dismiss PermissionGuard
```

**References:**
- CWE-862: https://cwe.mitre.org/data/definitions/862.html
- OWASP A01:2021 — Broken Access Control

---

### Finding #12: SQLite Checkpointer — Unprotected Conversation History Database

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟡 Medium |
| **Category** | Data Protection / Confidentiality |
| **CWE** | CWE-311: Missing Encryption of Sensitive Data |
| **CVSS** | 5.5 |
| **Location** | TDD v3 Section 1.2 (`.code-intel/database/chat_history.db`) + Section 2.6 (LangGraphOrchestrator) |
| **Status** | Open — Design Gap |

**Description:**
The SQLite Checkpointer stores the FULL `LangGraphState` as serialized BLOB data. This includes:
- Complete conversation history (`messages: BaseMessage[]`)
- IDE context: active file paths, LSP diagnostics, workspace root
- Pending tool call details (including shell commands, file paths, code patches)
- Agent routing state

The database is stored at `.code-intel/database/chat_history.db` with no specified:
- File permission restrictions (0600 or equivalent)
- Encryption at rest (SQLite Encryption Extension or application-level encryption)
- Integrity verification (no HMAC or checksum on state records)
- Access control beyond filesystem permissions

Any local process with read access can extract the full conversation history. Any local process with write access can tamper with the state.

**Impact:**
- **Confidentiality:** Another VSCode extension, a compromised npm package in a pre-commit hook, or any user-level process can read the entire development conversation (code snippets, architectural decisions, security-sensitive discussion).
- **Integrity:** A malicious process could modify `messages` BLOB to inject tool calls or alter the `pending_tool_call` field, potentially causing LangGraph to execute unintended operations on resume.
- **Availability:** Concurrent write access from multiple processes without proper locking could corrupt the database (SQLite WAL mode helps but is not sufficient without proper connection management).

**Remediation:**
```typescript
// 1. File permissions — set on creation
import { chmod } from 'fs/promises';
await chmod('.code-intel/database/chat_history.db', 0o600); // owner-only
await chmod('.code-intel/database/chat_history.db-wal', 0o600);
await chmod('.code-intel/database/chat_history.db-shm', 0o600);

// 2. SQLite pragmas for integrity
const SQLITE_PRAGMAS = `
  PRAGMA journal_mode=WAL;          -- Better concurrent read performance
  PRAGMA busy_timeout=5000;         -- Wait 5s on lock contention
  PRAGMA integrity_check;           -- Verify on open
  PRAGMA foreign_keys=ON;
`;

// 3. Application-level integrity check (detect tampering)
import { createHmac } from 'crypto';

function computeStateHmac(state: LangGraphState, key: Buffer): string {
  return createHmac('sha256', key)
    .update(JSON.stringify(state))
    .digest('hex');
}
// Store HMAC alongside state — verify before loading
// Key stored in OS keychain (not filesystem)

// 4. Optional: SQLCipher for encryption at rest (if threat model warrants it)
// import Database from 'better-sqlite3-sqlcipher';
// db.pragma(`key='${encryptionKey}'`);
```

**References:**
- CWE-311: https://cwe.mitre.org/data/definitions/311.html
- OWASP A02:2021 — Cryptographic Failures

---

### Finding #13: Session Hijacking via `session.json` — No Integrity Protection

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟡 Medium |
| **Category** | Session Management / Integrity |
| **CWE** | CWE-384: Session Fixation |
| **CVSS** | 5.0 |
| **Location** | TDD v3 Section 2.6 (LangGraphOrchestrator — `createNewThread`) + BR-31 |
| **Status** | Open — Design Gap |

**Description:**
Multi-IDE session coordination relies on `.code-intel/.run/session.json` containing a `thread_id` (UUID). The design specifies:
- Any IDE reads this file to discover the active session
- Any IDE can call `getThreadState(threadId)` to hydrate state
- The file is written by `createNewThread()` without integrity protection

Attack vectors:
1. **Session Fixation:** A rogue process writes a known `thread_id` to `session.json` before the legitimate backend creates one. All IDEs then connect to the attacker-controlled thread.
2. **Session Hijack:** A process reads the `thread_id` from `session.json` and connects a WebSocket client — it can now receive all streamed responses (code, tool outputs, agent reasoning).
3. **Replay:** A process saves a previous `thread_id` and replays it into `session.json` to force IDEs to reconnect to an old/manipulated state.

The TDD does not specify:
- Who is authorized to write `session.json`
- Integrity verification (e.g., HMAC signature on the file content)
- Session rotation or invalidation mechanism
- File locking during write

**Impact:**
Combined with Finding #11, a rogue process can: (1) read `thread_id` from `session.json`, (2) connect to WebSocket, (3) receive tool approval requests, (4) auto-approve them — all without user awareness.

**Remediation:**
```typescript
// 1. Session file with integrity signature
interface SessionFile {
  thread_id: string;
  created_at: string;    // ISO timestamp
  created_by: string;    // PID of creating process
  signature: string;     // HMAC-SHA256 of thread_id+created_at+created_by
}

// 2. Backend validates session ownership on connect
function validateSession(session: SessionFile, signingKey: Buffer): boolean {
  const expected = createHmac('sha256', signingKey)
    .update(`${session.thread_id}:${session.created_at}:${session.created_by}`)
    .digest('hex');
  return timingSafeEqual(Buffer.from(expected), Buffer.from(session.signature));
}

// 3. File permissions (owner-only write)
await chmod('.code-intel/.run/session.json', 0o644); // read-all, write-owner
// Better: 0o600 if only extension host needs to read

// 4. PID validation — verify creating process is still alive
import { existsSync } from 'fs';
function isProcessAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch { return false; }
}
```

**References:**
- CWE-384: https://cwe.mitre.org/data/definitions/384.html
- OWASP A07:2021 — Identification and Authentication Failures

---

### Finding #14: Hydration API — Unrestricted Thread State Access (IDOR)

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟡 Medium |
| **Category** | Broken Access Control / IDOR |
| **CWE** | CWE-639: Authorization Bypass Through User-Controlled Key |
| **CVSS** | 4.8 |
| **Location** | TDD v3 Section 2.6 (`getThreadState(threadId)`) + FSD v3 UC-11 |
| **Status** | Open — Design Gap |

**Description:**
The Hydration API `getThreadState(threadId: string)` accepts any `thread_id` and returns the FULL conversation history + IDE context for that thread. The design does not specify:
- Authorization check: "Is this client allowed to access this thread?"
- Workspace binding: "Does this thread_id belong to this workspace?"
- Thread enumeration protection: UUIDs are guessable if low-entropy or leaked in logs

Attack scenario:
1. Developer A works on Project-A (creates thread `abc-123`).
2. Developer B (or a rogue extension) guesses/discovers `abc-123`.
3. Developer B calls `getThreadState("abc-123")` and receives Developer A's full conversation history, including code snippets, architectural decisions, and tool call details.

In a multi-user environment (shared workstation, corporate dev machines, remote dev containers), this is a real data leakage vector.

**Impact:**
Cross-workspace information disclosure. Severity is Medium because:
- UUID v4 has 122 bits of entropy (hard to guess randomly)
- But `thread_id` may leak via `.code-intel/.run/session.json` readable by any process
- Or via WebSocket broadcast messages if attacker is already connected

**Remediation:**
```typescript
// 1. Workspace-scoped thread validation
interface ILangGraphBackend {
  getThreadState(threadId: string, workspaceId: string): Promise<LangGraphState | null>;
}

// Backend stores workspace_id when creating thread
// On getThreadState: verify thread belongs to requesting workspace
function getThreadState(threadId: string, workspaceId: string): LangGraphState | null {
  const thread = db.get('SELECT * FROM threads WHERE id = ? AND workspace_id = ?',
    [threadId, workspaceId]);
  if (!thread) return null; // 404, not 403 (prevent enumeration)
  return deserializeState(thread.state);
}

// 2. Thread-to-workspace binding on creation
function createNewThread(workspaceId: string): string {
  const threadId = crypto.randomUUID(); // UUID v4 — 122 bits entropy
  db.run('INSERT INTO threads (id, workspace_id, created_at) VALUES (?, ?, ?)',
    [threadId, workspaceId, new Date().toISOString()]);
  return threadId;
}

// 3. Workspace ID derivation — use hash of workspace root path
const workspaceId = createHash('sha256')
  .update(vscode.workspace.workspaceFolders[0].uri.fsPath)
  .digest('hex')
  .substring(0, 16);
```

**References:**
- CWE-639: https://cwe.mitre.org/data/definitions/639.html
- OWASP A01:2021 — Broken Access Control

---

### Finding #15: Pub/Sub Token Broadcast — No Client Authentication on WebSocket Subscribe

| Attribute | Value |
|-----------|-------|
| **Severity** | 🔵 Low |
| **Category** | Authentication / Eavesdropping |
| **CWE** | CWE-306: Missing Authentication for Critical Function |
| **CVSS** | 3.8 |
| **Location** | TDD v3 Section 2.4 (IpcBridge — Pub/Sub Broadcasting) |
| **Status** | Open — Design Gap |

**Description:**
The Pub/Sub mechanism broadcasts `STREAM_TOKEN` and other messages to ALL connected WebSocket clients that share the same `thread_id`. The design does not specify any authentication or subscription authorization mechanism for WebSocket connections.

Any local process that:
1. Reads `.code-intel/.run/session.json` (to get `thread_id`)
2. Reads `.code-intel/.run/{service}.json` (to get WebSocket endpoint)
3. Opens a WebSocket connection to the backend

...will receive the FULL real-time stream of:
- All agent responses (code, explanations, architectural advice)
- All tool execution results (file contents, terminal output)
- All thinking/reasoning tokens
- Tool call requests (including file paths and intended operations)

**Impact:**
Passive eavesdropping on the developer's entire AI-assisted coding session. Lower severity than active attacks because:
- Requires local process access (already high trust environment)
- Read-only — cannot modify the stream
- No authentication credentials exposed (just development conversation)

**Remediation:**
```typescript
// 1. WebSocket connection authentication via one-time token
function generateConnectionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Extension Host generates token, passes to backend on connect
// Token stored in memory only (not in files)
// Backend validates token before adding client to Pub/Sub broadcast list

// 2. Client registration with capabilities
interface ClientRegistration {
  clientId: string;
  clientType: 'vscode' | 'kiro' | 'antigravity';
  threadId: string;
  connectionToken: string;
  capabilities: ('read_stream' | 'write_resume' | 'admin')[];
}

// 3. Subscriber filtering — only broadcast to authenticated clients
function broadcast(threadId: string, message: ExtensionMessage): void {
  const subscribers = this.clients
    .filter(c => c.threadId === threadId && c.authenticated);
  subscribers.forEach(c => c.ws.send(JSON.stringify(message)));
}
```

**References:**
- CWE-306: https://cwe.mitre.org/data/definitions/306.html
- OWASP A07:2021 — Identification and Authentication Failures

---

### Finding #16: SQLite Concurrent Access — Race Condition on State Write

| Attribute | Value |
|-----------|-------|
| **Severity** | 🔵 Low |
| **Category** | Data Integrity / Race Condition |
| **CWE** | CWE-362: Concurrent Execution Using Shared Resource |
| **CVSS** | 3.1 |
| **Location** | TDD v3 Section 2.6 (LangGraphOrchestrator — SQLite Checkpointer) |
| **Status** | Open — Design Consideration |

**Description:**
Multiple IDEs sharing the same `thread_id` can generate concurrent state writes to the SQLite Checkpointer:
- IDE-A sends `SEND_PROMPT` → Backend writes new message to state
- IDE-B sends `TOOL_CALL_RESPONSE` → Backend writes approval to state
- Both operations target the same thread simultaneously

SQLite in WAL mode handles concurrent READS well but only allows ONE writer at a time. The TDD does not specify:
- Write serialization strategy (queue, mutex, optimistic locking)
- Conflict resolution when two state updates arrive simultaneously
- What happens if `TOOL_CALL_RESPONSE` arrives while a new `SEND_PROMPT` is being processed

Additionally, if the Backend process crashes mid-write, the checkpointer state could be left in an inconsistent state (partially written BLOB).

**Impact:**
- Database lock contention causing timeout errors for one IDE
- State corruption on crash during write (mitigated by WAL journal)
- Lost updates if two IDEs send messages in the same millisecond

Severity is Low because:
- SQLite WAL mode handles this reasonably well with `busy_timeout`
- LangGraph's Checkpointer library likely has built-in serialization
- Single-developer usage makes true concurrent writes rare

**Remediation:**
```python
# LangGraph Backend — ensure proper SQLite configuration
import sqlite3

connection = sqlite3.connect(
    '.code-intel/database/chat_history.db',
    timeout=10.0,           # Wait up to 10s for lock
    isolation_level='DEFERRED'  # Only lock on write
)
connection.execute("PRAGMA journal_mode=WAL")
connection.execute("PRAGMA busy_timeout=10000")  # 10s busy wait
connection.execute("PRAGMA wal_autocheckpoint=1000")  # Checkpoint every 1000 pages

# Application-level write queue (if using async)
import asyncio
write_lock = asyncio.Lock()

async def write_state(thread_id: str, state: dict):
    async with write_lock:  # Serialize all writes
        checkpointer.put(thread_id, state)
```

**References:**
- CWE-362: https://cwe.mitre.org/data/definitions/362.html
- SQLite WAL mode: https://www.sqlite.org/wal.html

---

### Finding #17: LangGraph State Deserialization — Potential Injection via Message Content

| Attribute | Value |
|-----------|-------|
| **Severity** | ℹ️ Informational |
| **Category** | Deserialization / Injection |
| **CWE** | CWE-502: Deserialization of Untrusted Data |
| **Location** | TDD v3 Section 2.6 (LangGraphOrchestrator — state BLOB) |
| **Status** | Noted for Implementation Phase |

**Description:**
The LangGraph state is serialized as BLOB into SQLite and deserialized on every `getThreadState()` call. If the serialization format is Python pickle or similar unsafe format, a tampered database could lead to arbitrary code execution on deserialization.

However, LangGraph's standard Checkpointer implementations use JSON serialization (not pickle), which limits the attack to data integrity issues rather than code execution.

Additionally, `messages: BaseMessage[]` may contain user-provided content that gets stored and replayed. If any downstream processing of loaded messages interprets content as code/commands (e.g., template interpolation), this could be an injection vector.

**Impact:**
Low probability — requires:
1. Attacker has write access to `.code-intel/database/chat_history.db`
2. Serialization format is unsafe (unlikely with standard LangGraph)
3. Downstream processing doesn't sanitize restored messages

This is informational — verify during implementation that JSON serialization is used (not pickle).

**Recommendation:**
```python
# Verify serialization format during implementation
# LangGraph SQLite Checkpointer should use JSON, not pickle
from langgraph.checkpoint.sqlite import SqliteSaver

# If custom serialization is used, ensure it's safe:
import json

def serialize_state(state: dict) -> bytes:
    return json.dumps(state).encode('utf-8')  # Safe

def deserialize_state(data: bytes) -> dict:
    return json.loads(data)  # Safe — no code execution

# NEVER use pickle for state:
# import pickle
# pickle.loads(data)  # DANGEROUS — arbitrary code execution
```

**References:**
- CWE-502: https://cwe.mitre.org/data/definitions/502.html
- OWASP A08:2021 — Software and Data Integrity Failures

---

### v3 Security Design Strengths ✅

| Area | Assessment |
|------|-----------|
| Backend as SoT | ✅ Correct pattern — prevents frontend state tampering |
| interrupt() mechanism | ✅ Proper human-in-the-loop for dangerous tools |
| SHA-256 file integrity | ✅ Retained from v2 — concurrent modification detection |
| Localhost-only IPC | ✅ Still enforced — no remote attack surface |
| CSP configuration | ✅ Unchanged from v2 — strong nonce-based policy |
| 60s permission timeout | ✅ Auto-deny prevents indefinite graph pause |
| WorkspaceEdit integration | ✅ Preserves Undo/Redo — user can always revert |

---

### v3 Remediation Priority

| Priority | Finding | Severity | Effort | Impact |
|----------|---------|----------|--------|--------|
| 1 | #11 — Unauthorized Graph Resume | 🟠 High | Medium | Bypasses entire permission model |
| 2 | #12 — Unprotected SQLite DB | 🟡 Medium | Low | File permissions + pragmas |
| 3 | #13 — Session.json integrity | 🟡 Medium | Low | HMAC signature + file perms |
| 4 | #14 — Hydration API IDOR | 🟡 Medium | Medium | Workspace-scoped thread binding |
| 5 | #15 — Pub/Sub no client auth | 🔵 Low | Medium | Connection token scheme |
| 6 | #16 — SQLite concurrent access | 🔵 Low | Low | WAL pragmas + write queue |
| 7 | #17 — State deserialization | ℹ️ Info | Low | Verify JSON serialization |

---

### v3 Recommendations

#### Immediate Actions (High — Must address before Phase 5)

1. **Design a challenge-response mechanism for `TOOL_CALL_RESPONSE`** — Ensure only the client that displayed the PermissionGuard can approve/reject (Finding #11). This is the most critical gap because it undermines the entire human-in-the-loop safety model.

2. **Specify file permissions for `.code-intel/database/` directory** — Set `0700` on directory, `0600` on all db files. Document this in TDD Security section.

#### Short-term (Medium — Address during implementation)

3. **Add HMAC integrity to `session.json`** — Prevent session fixation/tampering.
4. **Bind threads to workspace** — `getThreadState` must validate workspace ownership.
5. **Add `busy_timeout` and WAL configuration** — Specify SQLite pragmas in TDD.

#### Long-term Hardening (Low — Post-MVP)

6. **WebSocket connection authentication** — One-time token for Pub/Sub subscription.
7. **Consider SQLCipher** — If threat model extends to multi-user machines or shared dev containers.
8. **Audit log for state access** — Log who called `getThreadState` and when.

---

### v3 Comparison with v1

| Aspect | v1 (TDD v2) | v3 (TDD v3) | Change |
|--------|-------------|-------------|--------|
| State location | In-memory Svelte stores | SQLite + Backend | Higher persistence risk |
| Session scope | Single IDE, ephemeral | Multi-IDE, file-based | Larger attack surface |
| Tool approval path | postMessage internal | WebSocket cross-process | Needs auth on resume |
| Data at rest | None (RAM only) | Full history in .db | Needs encryption/perms |
| Broadcasting | N/A | Pub/Sub to all clients | Needs subscriber auth |
| Overall risk | Low | **Medium** | ⬆️ Elevated |

---

### v3 Scope Limitations

- **Static design review only** — no runtime testing of LangGraph interrupt/resume behavior
- **LangGraph Checkpointer internals** — assumed to use standard JSON serialization (not verified)
- **Multi-user scenario** — findings assume single developer; shared machines increase severity
- **Network boundary** — assumed localhost-only; if backend ever exposed on network, all findings become Critical/High
- **SQLite library choice** — specific SQLite binding (better-sqlite3, sqlite3, etc.) not specified in TDD

---
---

## v3.1 Addendum — Backend-Driven Knowledge Security Review

### Review Information

| Field | Value |
|-------|-------|
| Reviewed Document | TDD.md v3.1 (Backend-Driven Knowledge) |
| Previous Review | v3.0 — 0 Critical, 1 High, 3 Medium, 2 Low, 1 Info |
| Date | 2026-08-02 |
| Focus | Re-evaluate ALL v3.0 findings under the v3.1 architecture change |
| Architecture Change | LangGraph Checkpointer (backend, SQLite) → **Backend Knowledge Service (KB) + RemoteCheckpointer (HTTP)**. LangGraph Runtime STAYS in Extension Host (in-process). `.code-intel/.run/session.json` is no longer the primary state source. |

### v3.1 Executive Summary

The v3.1 architecture **materially reduces** several v3.0 attack surfaces:

1. **SQLite Checkpointer removed as primary source** (v3.0 #12, #16, #17) — no local `chat_history.db` with unprotected conversation history. State now lives on the **Backend Knowledge Service**, which already has JWT auth + API key middleware (`backend/src/server/middleware/jwt-auth.ts`, `api-key-auth.ts`).
2. **LangGraph Runtime stays in-process** in the Extension Host — the v3.0 WebSocket Pub/Sub resume attack surface (v3.0 #11, #15) is **eliminated**. Tool approval (`TOOL_CALL_RESPONSE`) no longer travels over a broadcast WebSocket; it stays within Extension Host → in-process LangGraph → RemoteCheckpointer (HTTP).
3. **session.json no longer the source of truth** (v3.0 #13) — `thread_id` resolved from Backend KB, removing the session-fixation file vector.
4. **New attack surface introduced:** Backend Knowledge Service now holds full conversation state over HTTP. This requires **workspace-scoped thread binding** (v3.0 #14 remains relevant) + **transport authentication** on every KB endpoint (mitigated by existing JWT/API-key middleware, but MUST be explicitly applied to the new `/api/v1/threads*` routes).

**v3.1 Overall Risk Rating: Low** (restored from v3.0 Medium)

### v3.1 Findings Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 0 |
| 🟡 Medium | 2 |
| 🔵 Low | 3 |
| ℹ️ Informational | 2 |

---

### v3.1 Finding #18: KB Thread Enumeration via Hydration API (re-affirmed from v3.0 #14)

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟡 Medium |
| **Category** | Broken Access Control / IDOR |
| **CWE** | CWE-639: Authorization Bypass Through User-Controlled Key |
| **CVSS** | 4.8 |
| **Location** | TDD v3.1 Section 2.4c (BackendKnowledgeService — `GET /api/v1/threads/:id/messages`, `GET /api/v1/threads/:id/checkpoint`) |
| **Status** | Open — must be enforced during implementation |

**Description:**
Under v3.1 the Hydration API is now a REST endpoint on the Backend Knowledge Service. Any authenticated client (or rogue process that obtains a JWT/API key) could enumerate `thread_id` values and read full conversation history for threads it does not own.

**Impact:**
Cross-workspace information disclosure if KB is ever reachable beyond localhost, or if multiple dev workspaces share one backend instance.

**Remediation (mandatory before implementation):**
```typescript
// Workspace-scoped thread binding on ALL thread endpoints
interface IKnowledgeService {
  getMessages(threadId: string, workspaceId: string): Promise<Message[] | null>;
}
// Backend stores workspace_id when creating thread (POST /api/v1/threads)
// Verify thread.workspace_id === caller.workspace_id on every GET/PUT
// Return 404 (not 403) to prevent enumeration
// workspaceId = sha256(workspaceRoot).slice(0,16)
```

**References:**
- CWE-639: https://cwe.mitre.org/data/definitions/639.html
- OWASP A01:2021 — Broken Access Control

---

### v3.1 Finding #19: RemoteCheckpointer HTTP — Backend TLS/Auth Consistency

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟡 Medium |
| **Category** | Transport Security / Authentication |
| **CWE** | CWE-306: Missing Authentication for Critical Function |
| **CVSS** | 5.0 |
| **Location** | TDD v3.1 Section 2.4b (RemoteCheckpointer — HTTP) + Section 2.4c |
| **Status** | Design Requirement — enforce at implementation |

**Description:**
`RemoteCheckpointer` sends LangGraph checkpoints (full conversation + IDE context + pending tool state) to the backend over HTTP. The design must guarantee:
- All `/api/v1/threads*` routes are behind `jwtAuth` (existing middleware) — NOT only `apiKeyAuth`
- Localhost-only binding (reject non-local clients); if ever exposed beyond loopback → TLS required
- No secrets/checkpoint content in URL or query params (body only)

**Impact:**
If KB endpoints are reachable without auth, any local process can read/write full agent state — equivalent to v3.0 #11 severity but via REST instead of WebSocket.

**Remediation:**
```typescript
// 1. Register new KB routes behind jwtAuth in HttpServer.ts
//    (kb-api.ts already uses jwtAuth — MUST extend to thread/checkpoint routes)
app.use('/api/v1/threads/*', jwtAuth);

// 2. Bind backend to 127.0.0.1 only
serve({ fetch: app.fetch, hostname: '127.0.0.1', port });

// 3. Never log checkpoint bodies; validate content-type application/json
```

---

### v3.1 Finding #20: Tool Approval Challenge-Response (carried from v3.0 #11 — now IN-PROCESS)

| Attribute | Value |
|-----------|-------|
| **Severity** | 🔵 Low |
| **Category** | Authorization |
| **CWE** | CWE-862: Missing Authorization |
| **CVSS** | 3.5 |
| **Location** | TDD v3.1 Section 6.7 (Graph Resume Authorization) |
| **Status** | **Mitigated** — in-process; challenge-response still retained |

**Description:**
v3.0 #11 (rogue WebSocket client auto-approving tools) is **eliminated** because `TOOL_CALL_RESPONSE` stays inside the Extension Host process (Webview → Host → LangGraph in-process → RemoteCheckpointer). The v3.1 TDD still specifies the `InterruptChallenge` (crypto.randomBytes(32), first-responder lock, 60s expiry) in Section 6.7 — retained as defense-in-depth against webview-level injection.

**Impact:** Low — local process already has extension-host code execution to bypass; the challenge adds a boundary against webview/XSS-layer spoofing.

---

### v3.1 Finding #21: session.json Reduced Role (re-affirmed from v3.0 #13)

| Attribute | Value |
|-----------|-------|
| **Severity** | 🔵 Low |
| **Category** | Session Management / Integrity |
| **CWE** | CWE-384: Session Fixation |
| **CVSS** | 3.0 |
| **Location** | TDD v3.1 BR-31 (session.json is NOT primary source) |
| **Status** | **Mitigated** — thread_id resolved from Backend KB |

**Description:**
`.code-intel/.run/session.json` is no longer the source of truth (BR-31 v3.1). `thread_id` is created/resolved by `POST /api/v1/threads` on the backend. Any residual local session file is advisory only; tampering cannot redirect hydration because the authoritative thread list lives in the backend.

**Impact:** Low. Residual risk = if an attacker can reach the backend and create/alter threads, they can still influence which thread an IDE hydrates → covered by #18 workspace binding.

---

### v3.1 Finding #22: KB Data-at-Rest (replaces v3.0 #12 SQLite)

| Attribute | Value |
|-----------|-------|
| **Severity** | 🔵 Low |
| **Category** | Data Protection / Confidentiality |
| **CWE** | CWE-311: Missing Encryption of Sensitive Data |
| **CVSS** | 3.5 |
| **Location** | TDD v3.1 Section 2.4c (BackendKnowledgeService persistence) |
| **Status** | Acceptable Risk (localhost) — revisit if backend exposed |

**Description:**
The backend persistence layer (whatever store backs Knowledge Service) now holds full conversation history. v3.0 #12's unprotected `chat_history.db` is gone, but the same confidentiality concern transfers to the backend store.

**Impact:**
Low while backend is localhost-only. Elevated to High if the backend is ever shared/networked.

**Remediation:**
- Same directory/file permission hardening on backend store (`chmod 0600`)
- If backend exposed beyond localhost: encryption at rest + TLS + per-workspace isolation (mandatory)

---

### v3.1 Finding #23: KB API Rate Limiting & Body Limits (re-affirmed from v3.0 #1)

| Attribute | Value |
|-----------|-------|
| **Severity** | ℹ️ Informational |
| **Category** | API Security / DoS |
| **CWE** | CWE-770: Allocation of Resources Without Limits |
| **Location** | TDD v3.1 Section 2.4c (BackendKnowledgeService) |
| **Status** | Design Requirement |

**Description:**
Backend already has `rateLimiter` on `/api/admin/*` and `bodyLimit` 100MB. The new thread/checkpoint endpoints must reuse these: rate-limit `POST /api/v1/threads` and `PUT .../checkpoint`, and cap checkpoint body size (checkpoints can be large).

**Remediation:**
```typescript
app.use('/api/v1/threads/*', rateLimiter);          // reuse existing
// + smaller bodyLimit for checkpoint PUT (e.g., 10MB, not 100MB)
```

---

### v3.1 Findings Resolved / Carried Summary

| v3.0 Finding | v3.1 Status | Rationale |
|--------------|-------------|-----------|
| #11 Unauthorized Graph Resume (High) | ✅ **Resolved** → #20 Low | No WebSocket resume path; LangGraph in-process; challenge retained |
| #12 Unprotected SQLite DB (Medium) | ✅ **Resolved** → #22 Low | SQLite removed as primary source; KB behind JWT |
| #13 session.json hijack (Medium) | ✅ **Resolved** → #21 Low | session.json no longer source of truth |
| #14 Hydration IDOR (Medium) | 🔴 **Carried** → #18 Medium | REST endpoints need workspace binding |
| #15 Pub/Sub no auth (Low) | ✅ **Resolved** | No WebSocket broadcast in core flow |
| #16 SQLite concurrent access (Low) | ✅ **Resolved** | No local SQLite Checkpointer |
| #17 state deserialization (Info) | ✅ **Resolved** | JSON over HTTP; not pickle/BLOB |
| NEW | → #19 Transport/auth consistency | RemoteCheckpointer HTTP must be JWT-protected + localhost-bound |

### v3.1 Security Design Strengths ✅

| Area | Assessment |
|------|-----------|
| KB as SSOT | ✅ Correct — single authoritative store, removes client tampering |
| LangGraph in-process | ✅ Eliminates cross-process resume/broadcast attack surface |
| JWT + API-key middleware | ✅ Existing backend middleware must cover new routes |
| Challenge-response retained | ✅ Defense-in-depth for approval (TDD 6.7) |
| session.json de-emphasized | ✅ Removes session-fixation vector |
| RemoteCheckpointer contract | ✅ Reuses BaseCheckpointSaver — no engine rewrite |

### v3.1 Remediation Priority

| Priority | Finding | Severity | Effort | Action |
|----------|---------|----------|--------|--------|
| 1 | #18 — Workspace-scoped thread binding | 🟡 Medium | Medium | Bind thread to workspace_id; 404 on mismatch |
| 2 | #19 — KB route auth + localhost bind | 🟡 Medium | Low | jwtAuth on /api/v1/threads/* + bind 127.0.0.1 |
| 3 | #23 — Rate limit + body cap on KB | ℹ️ Info | Low | Reuse rateLimiter; cap checkpoint PUT body |
| 4 | #22 — Backend store file perms | 🔵 Low | Low | chmod 0600 on KB store files |
| 5 | #20 — Retain InterruptChallenge | 🔵 Low | Low | Already in TDD 6.7 — keep in implementation |

### v3.1 Gate Decision

### ✅ PROCEED to Phase 0 Implementation

No Critical/High. The 2 Medium findings (#18, #19) are **pre-implementation requirements** — they MUST be included in the BackendKnowledgeService design (TDD 2.4c) before DEV starts Phase 0. Security findings #18/#19/#23 are referenced by the Phase 0 task list (TDD Section 8 Phase 0).

### v3.1 Scope Limitations

- **Static design review only** — RemoteCheckpointer HTTP behavior not runtime-tested
- **KB store backend** (DB choice behind Knowledge Service) not yet specified — data-at-rest assessment deferred
- **localhost-only assumed** — any network exposure immediately elevates #18/#19/#22 to High/Critical
- **JWT/API-key distribution** — key provisioning for multi-IDE clients must be defined in Phase 0

---

## v3.1 POST-IMPLEMENTATION — Security Code Review (Phase 0 verified)

> Executed after Phase 0 v3.1 implementation. All design-level findings re-verified against actual code.

### Finding Resolution Status

| Finding | Severity | Status | Implementation Evidence |
|---------|----------|--------|-------------------------|
| #18 — Workspace-scoped thread binding | 🟡 Medium | ✅ **RESOLVED — verified in code** | `KnowledgeService.ts:52` — accessor returns `null` when `thread.workspace_id !== this.resolveWorkspaceId(ctx)`. `resolveWorkspaceId` precedence: `X-Project-Id` header > JWT `wid` claim > default. Enforced on GET/POST/PUT/DELETE thread, messages, checkpoint, events, artifacts. |
| #19 — KB route auth + localhost bind | 🟡 Medium | ✅ **RESOLVED — verified in code** | `routes.ts:41-43` — `api.use('*', localhostOnly)` + `jwtAuth` + `rateLimiter` applied to all `/api/v1/threads*`. `localhost-only.ts` rejects non-127.0.0.1/localhost/[::1] with 403 (unless `CODE_INTEL_HOST=0.0.0.0`). |
| #23 — Rate limit + body cap | ℹ️ Info | ✅ **RESOLVED — verified in code** | `routes.ts` — `rateLimiter` on all routes; `bodyLimit({maxSize: 10MB})` on PUT `/threads/:id/checkpoint` returning 413 `PAYLOAD_TOO_LARGE`. |
| #22 — Backend store file perms | 🔵 Low | ✅ **Carried** | Store files under backend data dir; CI/dev permissions acceptable. |
| #20 — Retain InterruptChallenge | 🔵 Low | ✅ **Verified** | `InterruptChallenge` preserved in extension; test IT-HYD-04 passes. |

### Runtime Re-verification

- ⚠️ `localhostOnly` has an escape hatch: if `CODE_INTEL_HOST=0.0.0.0` the localhost check is skipped. This is intentional for remote dev but **elevates #18/#19** if enabled — document in deployment guide: never set `CODE_INTEL_HOST=0.0.0.0` without also enabling `CODE_INTEL_REQUIRE_AUTH=true`.
- ⚠️ `jwtAuth` allows **anonymous mode** by default (`CODE_INTEL_REQUIRE_AUTH != 'true'`). In anonymous mode identity defaults to `'anonymous'` + `X-Project-Id` header. Multi-tenant isolation then relies **solely on #18 workspace binding** (which is enforced). For production multi-IDE: require `CODE_INTEL_REQUIRE_AUTH=true` (KB_TOKEN_SECRET must be set, enforced by `validateJwtConfig()`).
- ✅ `verifyJwtToken` SR-01: rejects JWT when secret not configured — prevents forged identity.
- ✅ No checkpoint body logging (`routes.ts` logs only `thread_id` + `version`).

### Gate

### ✅ PASS — Security Code Review complete. No Critical/High findings. 3 Medium design findings (#18/#19/#23) resolved in implementation. 2 operational notes above to document in deployment guide.

> Operational notes are non-blocking but MUST be captured in the Deployment Guide (DevOps phase).
