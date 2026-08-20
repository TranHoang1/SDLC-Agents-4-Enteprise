# Security Design Review — SA4E-183

## Document Information

| Field | Value |
|-------|-------|
| Ticket | SA4E-183 |
| Feature | File Change Tracking — Session-wide diff summary visualization |
| Reviewed Document | TDD.md v1.0 |
| Reviewer | Security Agent |
| Date | 2025-07-27 |
| Overall Risk Rating | **Low** |

---

## Executive Summary

The File Change Tracking feature (SA4E-183) operates entirely within the VS Code extension sandbox with **no network calls, no persistence, no authentication, and no external data flow**. The attack surface is minimal — constrained to VS Code's PostMessage IPC between extension host and webview, plus a custom `TextDocumentContentProvider` URI scheme.

The design demonstrates good security awareness:
- Memory caps prevent resource exhaustion (100 entries, 2MB per diff, 10MB total)
- The `diff-original:` provider only serves content from an internal Map (no arbitrary FS access)
- File paths in `DIFF_OPEN_FILE` are validated against workspace bounds
- No sensitive data is logged or persisted

**No Critical or High severity findings.** Three Medium and two Low/Informational findings identified — all are hardening recommendations rather than exploitable vulnerabilities.

---

## Findings Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 3 |
| Low | 1 |
| Informational | 1 |

---

## Detailed Findings

### Finding #1: Path Traversal via DIFF_OPEN_FILE PostMessage

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Category** | Input Validation |
| **CWE** | CWE-22: Path Traversal |
| **Location** | TDD §6.3 — DIFF_OPEN_FILE handler in ChatEngineAdapter |
| **Status** | Design Recommendation |

**Description:**

The TDD states `DIFF_OPEN_FILE.filePath` is "validated within workspace folder bounds" using `Uri.joinPath` resolution. However, the design does not explicitly specify:
1. Rejection of absolute paths (e.g., `C:\Windows\System32\config\SAM` or `/etc/passwd`)
2. Rejection of `..` traversal sequences that escape the workspace root
3. What happens if the workspace has multiple root folders (multi-root workspace)

While the webview is sandboxed and the PostMessage source is trusted (same extension), a malicious webview script (via XSS in rendered markdown or Svelte component injection) could craft a `DIFF_OPEN_FILE` message with a path outside workspace bounds.

**Impact:**

An attacker who achieves code execution in the webview context could open arbitrary files in VS Code's editor — information disclosure of files outside workspace.

**Remediation Recommendation:**

```typescript
// In handleDiffOpenFile:
private handleDiffOpenFile(msg: DiffOpenFileMessage): void {
  const wsFolder = vscode.workspace.workspaceFolders?.[0];
  if (!wsFolder) return;

  // Normalize and resolve the path
  const resolvedPath = path.resolve(wsFolder.uri.fsPath, msg.filePath);

  // SECURITY: Ensure resolved path is within workspace bounds
  if (!resolvedPath.startsWith(wsFolder.uri.fsPath + path.sep) &&
      resolvedPath !== wsFolder.uri.fsPath) {
    logger.warn(`[Security] DIFF_OPEN_FILE rejected — path outside workspace: ${msg.filePath}`);
    return;
  }

  // Also verify the file exists in DiffTracker entries (defense-in-depth)
  if (!this.deps.diffTracker.getOriginalContent(msg.filePath) &&
      !this.deps.diffTracker.getSummary().entries.find(e => e.filePath === msg.filePath)) {
    logger.warn(`[Security] DIFF_OPEN_FILE rejected — not a tracked file: ${msg.filePath}`);
    return;
  }

  // Proceed with diff/open
}
```

---

### Finding #2: DiffOriginalProvider — Lack of URI Validation

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Category** | Access Control |
| **CWE** | CWE-284: Improper Access Control |
| **Location** | TDD §6.5 — DiffOriginalProvider.provideTextDocumentContent() |
| **Status** | Design Recommendation |

**Description:**

The `DiffOriginalProvider` implementation in TDD §6.5 shows:

```typescript
provideTextDocumentContent(uri: vscode.Uri): string {
  const filePath = uri.path;
  return this.diffTracker.getOriginalContent(filePath) ?? '';
}
```

The design correctly states "Provider only serves from DiffTracker's Map — no FS access." This is good. However:

1. **`uri.path` may need decoding** — on Windows, URI paths may be `/c:/Users/...` (with leading slash). The key in `DiffTracker.originalContents` might use OS-native paths (`c:\Users\...`). Mismatch = always returns `''` (functional bug, not security) OR if normalization is inconsistent, an attacker could probe path existence by observing whether content is returned.

2. **Any extension can open `diff-original:` URIs** — VS Code's URI scheme is globally registered. Another malicious extension could call `vscode.workspace.openTextDocument(Uri.parse('diff-original:/path/to/sensitive/file'))` to probe the DiffTracker's Map contents.

**Impact:**

Low practical impact because DiffTracker only stores content of files the user already modified in the current session. However, the cross-extension access vector should be acknowledged.

**Remediation Recommendation:**

```typescript
provideTextDocumentContent(uri: vscode.Uri): string {
  // Normalize URI path to OS-native format for consistent Map lookup
  const filePath = uri.fsPath || uri.path;
  const normalizedPath = path.normalize(filePath);

  const content = this.diffTracker.getOriginalContent(normalizedPath);
  if (content === undefined) {
    // SECURITY: Don't distinguish "not tracked" vs "empty file"
    // Return empty string for both cases (prevents enumeration)
    return '';
  }
  return content;
}
```

---

### Finding #3: originalContent May Contain Secrets

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Category** | Data Protection |
| **CWE** | CWE-200: Exposure of Sensitive Information |
| **Location** | TDD §7.2 — Data Protection table, §6.1 Pre-read Strategy |
| **Status** | Design Recommendation |

**Description:**

The TDD acknowledges in §7.2 that `originalContent` "may contain secrets" (risk: Low). The pre-read strategy in §6.1 captures file content **before** tool execution for ALL files in `DIFF_TRACKED_TOOLS`. This means:

- If the user edits `.env`, `secrets.json`, `credentials.yaml`, or any file containing API keys/tokens, the original content (with secrets) is held in memory and accessible via:
  1. The `diff-original:` URI scheme (any code that opens this URI)
  2. The `DIFF_SUMMARY_RESPONSE` PostMessage payload (`diffContent` field contains the unified diff which shows removed/added lines including secret values)

While this is all local and in-memory, the `diffContent` is transmitted to the webview via PostMessage and rendered in the `DiffSummaryPanel`. If the webview has any XSS vulnerability (unlikely but possible via rendered markdown), secrets would be exposed in DOM.

**Impact:**

Secrets visible in webview DOM. In normal operation this is acceptable (user's own machine), but defense-in-depth suggests not displaying full diffs of sensitive files.

**Remediation Recommendation:**

```typescript
// In DiffTracker or diff-utils:
const SENSITIVE_FILE_PATTERNS = [
  /\.env($|\.)/i,
  /secret/i,
  /credential/i,
  /\.pem$/i,
  /\.key$/i,
  /id_rsa/i,
];

function isSensitiveFile(filePath: string): boolean {
  const basename = path.basename(filePath);
  return SENSITIVE_FILE_PATTERNS.some(p => p.test(basename));
}

// In recordChange:
if (isSensitiveFile(input.filePath)) {
  entry.diffContent = '[Diff hidden — sensitive file]';
  // Still track the change, but redact diff content
}
```

---

### Finding #4: PostMessage Type Validation — Incomplete Specification

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **Category** | Input Validation |
| **CWE** | CWE-20: Improper Input Validation |
| **Location** | TDD §3.2 — PostMessage Protocol Extensions |
| **Status** | Design Recommendation |

**Description:**

The TDD specifies discriminated union types for PostMessage payloads, which is good. However, the design does not explicitly specify runtime validation of incoming PostMessage payloads from the webview. TypeScript types are erased at runtime — a compromised webview could send:

```json
{ "type": "DIFF_OPEN_FILE", "filePath": 12345, "operation": "exploit" }
```

Without runtime validation, the handler would process `filePath` as a number, potentially causing unexpected behavior.

**Impact:**

Minimal — VS Code's sandboxed webview makes this very unlikely. The PostMessage source is always the extension's own webview. This is a defense-in-depth concern.

**Remediation Recommendation:**

Add zod schema validation (aligns with project-wide code standards):

```typescript
import { z } from 'zod';

const DiffOpenFileSchema = z.object({
  type: z.literal('DIFF_OPEN_FILE'),
  filePath: z.string().min(1),
  operation: z.enum(['added', 'modified', 'deleted']),
});

// In message router:
const parsed = DiffOpenFileSchema.safeParse(msg);
if (!parsed.success) {
  logger.warn('[Security] Invalid DIFF_OPEN_FILE message:', parsed.error.message);
  return;
}
```

---

### Finding #5: Memory Exhaustion — Rapid Tool Execution Scenario

| Attribute | Value |
|-----------|-------|
| **Severity** | Informational |
| **Category** | Availability / DoS |
| **CWE** | CWE-400: Uncontrolled Resource Consumption |
| **Location** | TDD §8.2 — Memory Management |
| **Status** | Acknowledged — Adequately Mitigated |

**Description:**

The TDD addresses memory exhaustion with:
- Max 100 entries (eviction on overflow)
- 2MB per-entry diffContent cap
- 10MB total budget

However, the 100 entries × `originalContents` Map could theoretically hold up to 100 × 2MB = 200MB if every tracked file is 2MB. The TDD's 10MB total budget is stated as a target but enforcement mechanism is not explicitly designed (it relies on "100 entries × ~100KB avg").

**Impact:**

In practice, files modified by AI tools are typically source code (<100KB). A pathological case (agent modifying 100 large files) is unlikely in normal usage. The 2MB per-entry cap on `diffContent` does not apply to `originalContent` stored in the `originalContents` Map.

**Remediation Recommendation:**

Add an explicit size check when storing `originalContent`:

```typescript
private readonly MAX_ORIGINAL_SIZE = 2 * 1024 * 1024; // 2MB

recordChange(input: RecordChangeInput): void {
  // Cap originalContent to prevent memory bloat
  if (input.originalContent && input.originalContent.length > this.MAX_ORIGINAL_SIZE) {
    input.originalContent = input.originalContent.substring(0, this.MAX_ORIGINAL_SIZE);
    // Note: diff computation may be inaccurate for truncated files
  }
  // ... rest of logic
}
```

---

## Areas Reviewed — No Issues Found

### Authentication/Authorization
- **N/A** — Feature is local-only, no remote calls, no user authentication required. Operates within VS Code's extension activation trust boundary. ✅

### Encryption at Rest/Transit
- **N/A** — No data persisted to disk. PostMessage communication is internal IPC within the same VS Code process (not transmitted over network). ✅

### Rate Limiting / CORS
- **N/A** — No HTTP endpoints. No cross-origin concerns. The debounce mechanism (100ms) naturally throttles PostMessage frequency. ✅

### SQL/Command/LDAP Injection
- **N/A** — No database, no shell execution, no LDAP queries. All operations are in-memory TypeScript. ✅

### Session Management (Token/Refresh)
- **N/A** — No tokens. Session lifecycle is tied to VS Code's extension activation/deactivation and the chat session thread. `clearSession()` on `session:created` ensures clean state. ✅

### Infrastructure / Secrets Management
- **N/A** — No deployment infrastructure for this feature. It's bundled with the VS Code extension. No secrets consumed or managed. ✅

### Dependency Risks
- **`diff` npm package (^5.x)**: Well-maintained, ~12KB, minimal attack surface. No known CVEs for v5.x. Pure computation library with no network/FS access. ✅

---

## Security Design Strengths

The TDD demonstrates solid security-conscious design:

1. **Principle of Least Privilege** — DiffOriginalProvider only serves from internal Map, never accesses filesystem directly.
2. **Defense in Depth** — File path validation in DIFF_OPEN_FILE handler (workspace bounds check).
3. **Memory Bounds** — Explicit caps on entries (100), diff size (2MB), and total budget (10MB).
4. **No Persistence** — Session-scoped data eliminates data-at-rest concerns entirely.
5. **Sandboxed Communication** — Uses VS Code's standard PostMessage bridge (no custom networking).
6. **Feature Flag** — `sa4e183.diffTracker.enabled` allows runtime disable if issues discovered post-release.
7. **Graceful Degradation** — All error scenarios degrade silently without exposing internal state.

---

## Recommendations Summary

### Immediate Actions (before implementation)

None required — no Critical/High findings.

### Implementation-time Hardening (Medium findings)

1. **Finding #1** — Add explicit path traversal protection in `DIFF_OPEN_FILE` handler: normalize path, verify prefix within workspace root, optionally verify file exists in DiffTracker entries.
2. **Finding #2** — Normalize URI path in `DiffOriginalProvider` for cross-platform consistency; acknowledge cross-extension access as accepted risk.
3. **Finding #3** — Consider redacting `diffContent` for files matching sensitive patterns (`.env`, `.key`, `.pem`).

### Nice-to-Have (Low/Informational)

4. **Finding #4** — Add zod runtime validation for incoming PostMessage payloads (aligns with existing project zod patterns).
5. **Finding #5** — Cap `originalContent` size at 2MB (same as diffContent cap) for memory consistency.

---

## Verdict

| Decision | Rationale |
|----------|-----------|
| **PASS — Proceed to Phase 4** | No Critical or High findings. Medium findings are hardening recommendations that can be addressed during implementation without TDD revision. |

The design is security-appropriate for a local-only, in-memory, session-scoped VS Code extension feature. The threat model is inherently limited — the trust boundary is the VS Code extension host process, and all data flows are internal IPC.

DEV agent should implement the Medium-severity recommendations as part of the code:
- Path validation logic in `DIFF_OPEN_FILE` handler
- URI normalization in `DiffOriginalProvider`
- Optional sensitive file detection for diff redaction
