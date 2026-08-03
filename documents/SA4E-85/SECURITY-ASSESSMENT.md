# 🔒 Security Assessment Report

## Document Information

| Field | Value |
|-------|-------|
| Project | SDLC-Agents-4-Enterprise (VSCode Extension) |
| Scope | SA4E-85 — Phase 5.7 Security Code Review |
| Date | 2025-07-22 |
| Assessor | Security Agent |
| Version | 1.0 |

## Executive Summary

The SA4E-85 implementation demonstrates a security-conscious design overall. Key positives include SHA-256 with constant-time comparison for file integrity (preventing timing attacks), localhost-only WebSocket validation (BR-14), local-only telemetry with no network exfiltration, and a well-implemented permission guard with auto-deny timer.

However, static analysis identified **7 findings** across the 6 reviewed modules. No Critical-severity vulnerabilities were found. The most significant issues are: (1) lack of runtime type validation on incoming postMessage payloads enabling potential type confusion, (2) the deprecated IpcBridge module still present in the codebase as dead code with WebSocket dependencies, and (3) a TOCTOU race condition in the OpenCodeToolHandler's hash-then-apply workflow.

**Overall Risk Rating:** Medium

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 1 |
| 🟡 Medium | 4 |
| 🔵 Low | 2 |
| ℹ️ Informational | 0 |

## Findings by OWASP Top 10 (2021)

### A01:2021 — Broken Access Control

No issues found ✅ — PermissionGuard enforces tool-level approval with auto-deny; `RUN_TERMINAL_COMMAND` requires explicit user action.

### A02:2021 — Cryptographic Failures

No issues found ✅ — SHA-256 with `crypto.timingSafeEqual` correctly implemented in `fileHasher.ts`.

### A03:2021 — Injection

Finding #3 (Medium) — Potential command injection via `RUN_TERMINAL_COMMAND` postMessage without shell metacharacter sanitization.

### A04:2021 — Insecure Design

Finding #1 (High) — TOCTOU race in hash-check-then-apply workflow.

### A05:2021 — Security Misconfiguration

Finding #2 (Medium) — Deprecated IpcBridge module still importable/instantiable.
Finding #6 (Low) — TelemetryService does not restrict file path to workspace boundary.

### A06:2021 — Vulnerable and Outdated Components

Finding #7 (Low) — `ws` dependency in deprecated IpcBridge introduces unnecessary attack surface.

### A07:2021 — Identification and Authentication Failures

No issues found ✅ — N/A for this module set (no auth logic in scope).

### A08:2021 — Software and Data Integrity Failures

Finding #4 (Medium) — No runtime type validation on incoming WebviewMessage payloads before dispatch.
Finding #5 (Medium) — agentParser custom YAML parser doesn't enforce field length limits.

### A09:2021 — Security Logging and Monitoring Failures

No issues found ✅ — TelemetryService logs tool executions, permission decisions, and errors locally.

### A10:2021 — Server-Side Request Forgery (SSRF)

No issues found ✅ — IpcBridge (deprecated) enforces localhost-only via `isLocalhostEndpoint()`.

## Detailed Findings

---

### Finding #1: TOCTOU Race Condition in OpenCodeToolHandler

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟠 High |
| **OWASP Category** | A04:2021 — Insecure Design |
| **CWE** | CWE-367: Time-of-Check Time-of-Use |
| **CVSS Score** | 7.0 |
| **Location** | `extension/src/chat/tools/OpenCodeToolHandler.ts:47-56` |
| **Status** | Open |

**Description:**
The `applyDiff()` method performs a hash check on line 49 and then applies the edit on line 56. Between these two asynchronous operations, the file could be modified by another process, VS Code extension, or the user — leading to silent data corruption where the edit overwrites changes made after the hash was computed.

**Evidence:**
```typescript
async applyDiff(diff: DiffBlock): Promise<ApplyResult> {
  const fileExists = await this.checkFileExists(diff.filePath);
  if (!fileExists) {
    return { success: false, error: 'FILE_DELETED' };
  }

  const currentHash = await this.computeFileHash(diff.filePath);
  const hashMatch = hashesMatch(diff.fileHashAtGeneration, currentHash);

  if (!hashMatch) {
    return { success: false, error: 'CONFLICT' };
  }

  // ⚠️ TOCTOU gap: file can change between hash check and edit application
  return this.executeWorkspaceEdit(diff);
}
```

**Impact:**
An attacker or concurrent process could modify the file between `computeFileHash` and `executeWorkspaceEdit`, causing the patch to be applied on top of unexpected content. In a multi-extension VS Code environment, this could lead to data corruption or unintended code being committed. The window is small but non-negligible in async contexts.

**Remediation:**
```typescript
async applyDiff(diff: DiffBlock): Promise<ApplyResult> {
  const fileExists = await this.checkFileExists(diff.filePath);
  if (!fileExists) {
    return { success: false, error: 'FILE_DELETED' };
  }

  const currentHash = await this.computeFileHash(diff.filePath);
  const hashMatch = hashesMatch(diff.fileHashAtGeneration, currentHash);

  if (!hashMatch) {
    return { success: false, error: 'CONFLICT' };
  }

  const result = await this.executeWorkspaceEdit(diff);

  // Post-apply verification: re-hash and verify expected outcome
  if (result.success) {
    const postHash = await this.computeFileHash(diff.filePath);
    const expectedHash = hashBuffer(Buffer.from(diff.patch, 'utf-8'));
    if (!hashesMatch(postHash, expectedHash)) {
      // Concurrent modification detected after apply — undo
      await vscode.commands.executeCommand('undo');
      return { success: false, error: 'CONFLICT' };
    }
  }

  return result;
}
```

**References:**
- [CWE-367](https://cwe.mitre.org/data/definitions/367.html)
- VS Code WorkspaceEdit does not provide atomic file locking

---

### Finding #2: Deprecated IpcBridge Still Importable (Dead Code Attack Surface)

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟡 Medium |
| **OWASP Category** | A05:2021 — Security Misconfiguration |
| **CWE** | CWE-561: Dead Code |
| **CVSS Score** | 5.3 |
| **Location** | `extension/src/chat/ipc/IpcBridge.ts` (entire file) |
| **Status** | Open |

**Description:**
The IpcBridge module is documented as DEPRECATED (Phase 7 is cancelled — LangGraph is in-process). However, the module remains fully functional and importable. While not currently instantiated (`new IpcBridge` has zero references), it imports the `ws` WebSocket library and could be accidentally re-activated by future developers. The code opens WebSocket connections with backoff retry logic — if invoked against a malicious endpoint that passes localhost validation, it could enable local privilege escalation.

**Evidence:**
```typescript
// IpcBridge.ts — still exports full class
import { WebSocket } from 'ws';
// ...
export class IpcBridge implements IIpcBridge, vscode.Disposable {
  async connect(discovery: ServiceDiscovery): Promise<void> {
    // Opens WebSocket connections
  }
}
```

**Impact:**
- Increases the extension's compiled bundle size unnecessarily
- The `ws` dependency remains in the dependency tree (supply chain risk)
- A developer could accidentally use it, bypassing the in-process architecture
- If the localhost validation (`isLocalhostEndpoint`) has a bypass, the full WebSocket client is available

**Remediation:**
```typescript
// Option A: Remove entirely (recommended)
// Delete: extension/src/chat/ipc/IpcBridge.ts
// Delete: extension/src/chat/ipc/jsonRpcClient.ts
// Remove 'ws' from package.json dependencies

// Option B: If kept for future reference, add runtime guard
/**
 * @deprecated Phase 7 IPC is cancelled. LangGraph runs in-process.
 * This file is retained for reference only. DO NOT INSTANTIATE.
 */
export class IpcBridge implements IIpcBridge, vscode.Disposable {
  constructor() {
    throw new Error(
      'IpcBridge is deprecated. LangGraph is in-process. See SA4E-85 architecture.'
    );
  }
  // ... rest of interface stubs throwing
}
```

**References:**
- [CWE-561](https://cwe.mitre.org/data/definitions/561.html)
- SA4E-85 Architecture: IPC Bridge (Phase 7) is DEPRECATED

---

### Finding #3: Terminal Command Injection via postMessage

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟡 Medium |
| **OWASP Category** | A03:2021 — Injection |
| **CWE** | CWE-78: OS Command Injection |
| **CVSS Score** | 5.9 |
| **Location** | `extension/src/chat/tools/OpenCodeToolHandler.ts:88-93` |
| **Status** | Open |

**Description:**
The `RUN_TERMINAL_COMMAND` message type allows the Webview to send arbitrary shell commands to be executed in a VS Code terminal via `runTerminalCommand()`. While the Webview is sandboxed, if a prompt injection or XSS in the Webview crafts a `RUN_TERMINAL_COMMAND` message, it could execute arbitrary OS commands. No sanitization or allowlist is applied to the command string.

**Evidence:**
```typescript
// OpenCodeToolHandler.ts
runTerminalCommand(command: string, terminalName: string): void {
  const terminal = vscode.window.createTerminal(terminalName);
  terminal.show(true);
  terminal.sendText(command); // ⚠️ No sanitization or approval gate
}

// messages.ts — message from Webview
| { type: 'RUN_TERMINAL_COMMAND'; command: string; terminalName: string }
```

**Impact:**
If a malicious agent response or prompt injection causes the Webview to dispatch `RUN_TERMINAL_COMMAND` with destructive commands, the extension host will execute them in the user's terminal with full user privileges. The PermissionGuard is designed for `TOOL_CALL_REQUEST` messages but `RUN_TERMINAL_COMMAND` may bypass it depending on the message routing implementation.

**Remediation:**
```typescript
/** Safe command prefixes allowed without additional approval */
const ALLOWED_COMMAND_PREFIXES = [
  'npm ', 'yarn ', 'pnpm ', 'npx ',
  'gradle', './gradlew',
  'git status', 'git diff', 'git log',
];

runTerminalCommand(command: string, terminalName: string): void {
  const isAllowed = ALLOWED_COMMAND_PREFIXES.some(
    prefix => command.startsWith(prefix)
  );

  if (!isAllowed) {
    // Require explicit user approval for non-standard commands
    vscode.window.showWarningMessage(
      `Tool wants to run: ${command.slice(0, 100)}`,
      'Allow', 'Deny'
    ).then(choice => {
      if (choice === 'Allow') {
        const terminal = vscode.window.createTerminal(terminalName);
        terminal.show(true);
        terminal.sendText(command);
      }
    });
    return;
  }

  const terminal = vscode.window.createTerminal(terminalName);
  terminal.show(true);
  terminal.sendText(command);
}
```

**References:**
- [CWE-78](https://cwe.mitre.org/data/definitions/78.html)
- VS Code Extension Security Best Practices

---

### Finding #4: No Runtime Type Validation on Incoming postMessage

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟡 Medium |
| **OWASP Category** | A08:2021 — Software and Data Integrity Failures |
| **CWE** | CWE-20: Improper Input Validation |
| **CVSS Score** | 4.8 |
| **Location** | `extension/src/chat/bridge/PostMessageBridge.ts:72-73` |
| **Status** | Open |

**Description:**
The `handleIncoming` method casts incoming messages with `msg as WebviewMessage` without any runtime validation. TypeScript types are erased at runtime. If the Webview sends a malformed message (missing `type` field, wrong types for fields, extra properties), it will be dispatched to all listeners without validation, potentially causing undefined behavior or crashes in listeners that assume type safety.

**Evidence:**
```typescript
// PostMessageBridge.ts
attachPanel(panel: vscode.WebviewPanel): void {
  this.panel = panel;
  const sub = panel.webview.onDidReceiveMessage((msg: unknown) => {
    this.handleIncoming(msg as WebviewMessage); // ⚠️ Unsafe cast, no validation
  });
  this.disposables.push(sub);
}
```

**Impact:**
- A compromised or buggy Webview could send messages with unexpected shapes
- Listeners processing `ACTION_ACCEPT_DIFF` without validating `patch` field could apply empty/malicious patches
- Type confusion could lead to property access on undefined, causing extension crashes (DoS)
- In combination with Finding #3, a malformed message could bypass expected flow

**Remediation:**
```typescript
import type { WebviewMessage, WebviewMessageType } from '../types';

/** Valid message type discriminants */
const VALID_TYPES: Set<string> = new Set([
  'SEND_PROMPT', 'TOOL_CALL_RESPONSE', 'COMMAND_DISPATCH',
  'RUN_TERMINAL_COMMAND', 'ACTION_ACCEPT_DIFF', 'ACTION_REJECT_DIFF',
  'REGENERATE_PATCH', 'CONTEXT_UNPIN_FILE', 'CONTEXT_CLEAR',
]);

/** Validate incoming message has required shape */
function isValidWebviewMessage(msg: unknown): msg is WebviewMessage {
  if (!msg || typeof msg !== 'object') return false;
  const candidate = msg as Record<string, unknown>;
  if (typeof candidate.type !== 'string') return false;
  return VALID_TYPES.has(candidate.type);
}

// In attachPanel:
const sub = panel.webview.onDidReceiveMessage((msg: unknown) => {
  if (!isValidWebviewMessage(msg)) {
    console.warn('[PostMessageBridge] Invalid message dropped:', typeof msg);
    return;
  }
  this.handleIncoming(msg);
});
```

**References:**
- [CWE-20](https://cwe.mitre.org/data/definitions/20.html)
- VS Code Webview Security: https://code.visualstudio.com/api/extension-guides/webview#security

---

### Finding #5: Custom YAML Parser Without Field Length Limits

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟡 Medium |
| **OWASP Category** | A08:2021 — Software and Data Integrity Failures |
| **CWE** | CWE-400: Uncontrolled Resource Consumption |
| **CVSS Score** | 4.3 |
| **Location** | `extension/src/chat/registry/agentParser.ts:75-113` |
| **Status** | Open |

**Description:**
The `parseSimpleYaml()` function is a custom YAML parser that processes agent `.md` files from the workspace filesystem. It does not enforce any limits on field value lengths, number of array items, or total frontmatter size. A malicious `.md` file in the `.code-intel/agents/` directory with extremely large frontmatter content could cause memory exhaustion or performance degradation during the FileSystemWatcher scan.

**Evidence:**
```typescript
function parseSimpleYaml(yaml: string): RawAgentFrontmatter {
  const result: Record<string, string | string[]> = {};
  const lines = yaml.split('\n');
  // ⚠️ No limit on number of lines processed
  // ⚠️ No limit on individual value lengths
  // ⚠️ No limit on array item count
  for (const line of lines) {
    // ...processes unbounded input
  }
  return result as unknown as RawAgentFrontmatter;
}
```

**Impact:**
If an attacker can place a crafted `.md` file in the workspace's `.code-intel/agents/` directory (e.g., through a malicious git clone, npm postinstall script, or compromised dependency), they could cause the extension to allocate excessive memory during the debounced rescan. The 300ms debounce mitigates rapid re-triggering but doesn't prevent a single large file from consuming resources.

**Remediation:**
```typescript
/** Safety limits for YAML parsing */
const MAX_FRONTMATTER_BYTES = 8192; // 8KB max
const MAX_ARRAY_ITEMS = 50;
const MAX_VALUE_LENGTH = 500;

function extractFrontmatter(content: string): RawAgentFrontmatter | null {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) return null;

  const endIndex = trimmed.indexOf('---', 3);
  if (endIndex === -1) return null;

  const yamlBlock = trimmed.slice(3, endIndex).trim();
  if (!yamlBlock) return null;

  // Guard: reject oversized frontmatter
  if (yamlBlock.length > MAX_FRONTMATTER_BYTES) {
    throw new Error(`Frontmatter exceeds ${MAX_FRONTMATTER_BYTES} bytes`);
  }

  return parseSimpleYaml(yamlBlock);
}

// In parseSimpleYaml, add array length guard:
if (!currentArray) currentArray = [];
if (currentArray.length >= MAX_ARRAY_ITEMS) continue; // skip excess
currentArray.push(stripQuotes(value).slice(0, MAX_VALUE_LENGTH));
```

**References:**
- [CWE-400](https://cwe.mitre.org/data/definitions/400.html)

---

### Finding #6: TelemetryService File Path Not Scoped to Workspace

| Attribute | Value |
|-----------|-------|
| **Severity** | 🔵 Low |
| **OWASP Category** | A05:2021 — Security Misconfiguration |
| **CWE** | CWE-22: Path Traversal |
| **CVSS Score** | 3.1 |
| **Location** | `extension/src/chat/telemetry/TelemetryService.ts:38` |
| **Status** | Open |

**Description:**
The `TelemetryService` constructor accepts `workspaceRoot` and constructs the telemetry file path using `path.join(workspaceRoot, '.code-intel', 'telemetry.jsonl')`. If `workspaceRoot` is somehow manipulated or the service is instantiated with a path containing `..` segments, it could write telemetry data outside the intended workspace boundary. The risk is low because `workspaceRoot` is typically provided by VS Code's trusted workspace API.

**Evidence:**
```typescript
constructor(workspaceRoot: string) {
  // No validation that workspaceRoot is canonical/absolute
  this.filePath = path.join(workspaceRoot, '.code-intel', 'telemetry.jsonl');
  this.startFlushTimer();
}
```

**Impact:**
Minimal in practice — `workspaceRoot` comes from `vscode.workspace.workspaceFolders[0].uri.fsPath` which is trusted. However, if the service is ever reused in a test context or refactored with untrusted input, telemetry data could be written to arbitrary paths.

**Remediation:**
```typescript
constructor(workspaceRoot: string) {
  const resolvedRoot = path.resolve(workspaceRoot);
  this.filePath = path.join(resolvedRoot, '.code-intel', 'telemetry.jsonl');

  // Defense-in-depth: verify path is within workspace
  if (!this.filePath.startsWith(resolvedRoot)) {
    throw new Error('Telemetry path escapes workspace boundary');
  }
  this.startFlushTimer();
}
```

**References:**
- [CWE-22](https://cwe.mitre.org/data/definitions/22.html)

---

### Finding #7: Unnecessary `ws` Dependency from Deprecated Module

| Attribute | Value |
|-----------|-------|
| **Severity** | 🔵 Low |
| **OWASP Category** | A06:2021 — Vulnerable and Outdated Components |
| **CWE** | CWE-1104: Use of Unmaintained Third-Party Components |
| **CVSS Score** | 2.5 |
| **Location** | `extension/src/chat/ipc/IpcBridge.ts:3` |
| **Status** | Open |

**Description:**
The deprecated `IpcBridge.ts` imports the `ws` WebSocket library. This dependency remains in the project's dependency tree despite the module being deprecated. Each additional dependency increases supply chain attack surface.

**Evidence:**
```typescript
import { WebSocket } from 'ws';
```

**Impact:**
If a CVE is discovered in the `ws` library, this extension would be affected even though the library is not actively used. Supply chain attacks targeting `ws` would affect the extension's compiled output.

**Remediation:**
Remove the `ws` dependency when removing the deprecated IpcBridge module (see Finding #2).

**References:**
- [CWE-1104](https://cwe.mitre.org/data/definitions/1104.html)

---

## Security Positives ✅

| Module | Security Measure |
|--------|-----------------|
| `fileHasher.ts` | SHA-256 + `crypto.timingSafeEqual()` prevents timing attacks |
| `IpcBridge.ts` | BR-14 localhost-only WebSocket validation |
| `PermissionGuard.svelte` | 60s auto-deny timer, focus trap, risk classification, WCAG aria-modal |
| `TelemetryService.ts` | Local-only JSONL (no network exfiltration), privacy-first design |
| `PostMessageBridge.ts` | Token buffering reduces cross-boundary message frequency |
| `KiroAgentRegistry.ts` | 300ms debounced watcher prevents resource exhaustion, proper dispose() |
| `OpenCodeToolHandler.ts` | WorkspaceEdit preserves undo/redo for recoverability |
| `TokenBuffer.ts` | Proper timer cleanup in dispose(), prevents memory leaks |

## Remediation Priority

| Priority | Finding | Effort | Impact |
|----------|---------|--------|--------|
| 1 | #1 — TOCTOU race in applyDiff | Medium | Prevents silent data corruption |
| 2 | #4 — No runtime type validation on postMessage | Low | Prevents type confusion and potential bypass |
| 3 | #3 — Terminal command injection | Medium | Prevents arbitrary command execution |
| 4 | #2 — Remove deprecated IpcBridge | Low | Reduces attack surface and bundle size |
| 5 | #5 — YAML parser limits | Low | Prevents resource exhaustion |
| 6 | #6 — Telemetry path validation | Low | Defense-in-depth |
| 7 | #7 — Remove `ws` dependency | Low | Reduces supply chain risk |

## Recommendations Summary

### Immediate Actions (High)
1. Add post-apply hash verification to `OpenCodeToolHandler.applyDiff()` to close the TOCTOU window
2. Add runtime type guard in `PostMessageBridge.handleIncoming()` before dispatching to listeners

### Short-term Improvements (Medium)
3. Add command allowlist or secondary approval for `RUN_TERMINAL_COMMAND` messages
4. Delete the deprecated `IpcBridge.ts` module and remove the `ws` dependency
5. Add size/length limits to the custom YAML parser in `agentParser.ts`

### Long-term Hardening (Low)
6. Add path canonicalization in `TelemetryService` constructor
7. Consider migrating agentParser to a well-maintained YAML library with built-in size limits
8. Add integration tests verifying PermissionGuard blocks `RUN_TERMINAL_COMMAND` without prior approval

## Appendix

### A. Tools & Methodology
- Static code analysis (manual review of 12 TypeScript/Svelte source files)
- Dependency import analysis
- Data flow tracing (postMessage → handler → side-effect)
- OWASP Testing Guide v4.2 methodology adapted for VS Code extensions

### B. Scope Limitations
- **NOT tested:** Runtime/dynamic behavior, actual WebSocket connections, VS Code CSP enforcement
- **NOT tested:** Penetration testing against running extension
- **NOT tested:** Build pipeline security, npm package integrity
- **Assumption:** VS Code API (`vscode.workspace.workspaceFolders`) returns trusted values
- **Assumption:** Svelte Webview compiles without introducing CSP violations

### C. Files Reviewed

| # | File | Lines | Purpose |
|---|------|-------|---------|
| 1 | `extension/src/chat/tools/OpenCodeToolHandler.ts` | 115 | Diff application with conflict detection |
| 2 | `extension/src/chat/ipc/IpcBridge.ts` | 148 | DEPRECATED WebSocket IPC bridge |
| 3 | `extension/src/chat/bridge/PostMessageBridge.ts` | 92 | Webview↔Extension messaging |
| 4 | `extension/src/webview/components/PermissionGuard.svelte` | 213 | Tool approval UI modal |
| 5 | `extension/src/chat/telemetry/TelemetryService.ts` | 89 | Local JSONL logging |
| 6 | `extension/src/chat/registry/KiroAgentRegistry.ts` | 143 | Agent discovery via FileSystemWatcher |
| 7 | `extension/src/chat/tools/fileHasher.ts` | 54 | SHA-256 hash utility |
| 8 | `extension/src/chat/bridge/TokenBuffer.ts` | 88 | Stream token batching |
| 9 | `extension/src/chat/registry/agentParser.ts` | 131 | YAML frontmatter parser |
| 10 | `extension/src/chat/ipc/serviceDiscovery.ts` | 112 | Localhost validation + file watcher |
| 11 | `extension/src/chat/types/messages.ts` | 104 | Message type definitions |
| 12 | `extension/src/chat/telemetry/types.ts` | 76 | Telemetry event types |

### D. Glossary
- **CVSS**: Common Vulnerability Scoring System
- **CWE**: Common Weakness Enumeration
- **OWASP**: Open Web Application Security Project
- **TOCTOU**: Time-of-Check Time-of-Use
- **CSP**: Content Security Policy
- **DoS**: Denial of Service
