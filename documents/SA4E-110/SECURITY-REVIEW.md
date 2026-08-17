# 🔒 Security Design Review — SA4E-110

## Document Information

| Field | Value |
|-------|-------|
| Ticket | SA4E-110 |
| Feature | Integrate Atlassian MCP Server as Child Server in Orchestrator |
| Reviewed Document | TDD.md v1.0 (2026-08-13) |
| Reviewer | Security Agent |
| Date | 2026-08-14 |
| Status | Review Complete |

---

## Executive Summary

The design for SA4E-110 demonstrates **good security awareness** in several areas: credentials never touch disk (BR-05), IPC-based delivery, token redaction in logs, and process isolation via stdio. However, the review identified **1 High**, **4 Medium**, and **3 Low** severity findings that should be addressed before or during implementation.

**Overall Risk Rating:** Medium

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 1 |
| 🟡 Medium | 4 |
| 🔵 Low | 3 |
| ℹ️ Informational | 2 |

---

## Findings Summary

| # | Finding | Severity | OWASP | Location |
|---|---------|----------|-------|----------|
| 1 | Transport mismatch: TDD says stdio but orchestration.json uses httpStream | 🟠 High | A05 | orchestration.json / TDD §1.2 |
| 2 | JQL injection — user-controlled query passed directly to Jira API | 🟡 Medium | A03 | TDD §7.2, tools/jira-search-tools.ts |
| 3 | Path traversal in jira_attach_file — insufficient specification of boundary validation | 🟡 Medium | A01 | TDD §7.2, tools/jira-attachment-tools.ts |
| 4 | IPC credential message lacks integrity verification | 🟡 Medium | A02 | TDD §5.1, credentials/credential-manager.ts |
| 5 | Rate limiter is per-process only — no coordination across reconnections | 🟡 Medium | A05 | TDD §6.2, clients/rate-limiter.ts |
| 6 | Missing credential rotation/expiry for PAT tokens | 🔵 Low | A07 | TDD §7.1 |
| 7 | Error response may leak Jira internal structure | 🔵 Low | A05 | TDD §6.4 |
| 8 | autoApprove list bypasses confirmation for write operations | 🔵 Low | A01 | orchestration.json |
| 9 | Native fetch — no certificate pinning for Atlassian endpoints | ℹ️ Info | A02 | TDD §1.2 |
| 10 | No audit logging of tool invocations with user context | ℹ️ Info | A09 | TDD §7 |

---

## Detailed Findings

### Finding #1: Transport Mismatch — TDD vs Orchestration Config

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟠 High |
| **OWASP Category** | A05:2021 — Security Misconfiguration |
| **CWE** | CWE-16: Configuration |
| **CVSS Score** | 7.3 |
| **Location** | TDD §1.2 vs `.code-intel/orchestration.json` |
| **Status** | Open |

**Description:**

The TDD explicitly states transport = `stdio` (process spawn, no network exposure) as a key architectural decision for process isolation (BR-17). However, the current `orchestration.json` defines the atlassian server as `httpStream` with `url: "http://localhost:3061/mcp"`.

This is a **fundamental security property inconsistency**. If the actual implementation uses httpStream:
- The child server listens on a TCP port (localhost:3061), exposing it to any local process
- Any application on the same host can connect and invoke Jira tools without authentication
- The MCP protocol over HTTP has no built-in authentication layer

**Evidence:**

```json
// orchestration.json — ACTUAL
{
  "mcpServers": {
    "atlassian": {
      "url": "http://localhost:3061/mcp",
      "type": "httpStream",
      "transportType": "httpStream"
    }
  }
}
```

```
// TDD §1.2 — STATED DESIGN
| Transport | stdio (process spawn) | Process isolation, BR-17 |
```

**Impact:**

If httpStream is the actual transport, credential delivery via IPC (`process.send()`) won't work — IPC requires parent-child process relationship. Credentials would need an alternative delivery mechanism, potentially less secure.

**Remediation:**

1. **Resolve the discrepancy** — decide on the actual transport:
   - If stdio → update `orchestration.json` to use `transportType: "stdio"` with `command` + `args`
   - If httpStream → redesign credential delivery (cannot use IPC), add authentication to the HTTP endpoint
2. If httpStream is chosen, add:
   - Bind to `127.0.0.1` explicitly (not `0.0.0.0`)
   - Add a shared secret/token header for MCP requests
   - Consider Unix domain socket instead of TCP for stronger isolation

---

### Finding #2: JQL Injection Risk

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟡 Medium |
| **OWASP Category** | A03:2021 — Injection |
| **CWE** | CWE-943: Improper Neutralization of Special Elements in Data Query Logic |
| **CVSS Score** | 5.3 |
| **Location** | TDD §7.2 — `JQL: Passed to Jira (their SQL injection protection)` |
| **Status** | Open |

**Description:**

The TDD explicitly notes JQL is "Passed to Jira (their SQL injection protection)" — relying entirely on Jira's server-side filtering. While Jira does validate JQL syntax, this design has risks:

1. **JQL-specific injection**: Malicious JQL can access data the calling user shouldn't see (e.g., `project = SECRET_PROJECT AND ...`)
2. **Denial of Service**: Complex JQL queries (deeply nested OR/AND, excessive functions) can cause Jira performance issues
3. **Information disclosure**: JQL error messages from Jira may reveal project names, field names, or schema details

**Evidence:**

```typescript
// TDD §7.2 — Input Validation table
// JQL | Passed to Jira (their SQL injection protection) | JiraSearchRequestSchema
```

**Impact:**

An MCP client (agent) could craft JQL to enumerate projects, access issues across project boundaries, or cause excessive Jira load.

**Remediation:**

```typescript
// jira-search-tools.ts — Add JQL safety validation BEFORE sending to Jira
const MAX_JQL_LENGTH = 2000;

function validateJql(jql: string): void {
  if (jql.length > MAX_JQL_LENGTH) {
    throw new ToolError('VALIDATION_ERROR', 'JQL query exceeds maximum length');
  }
}

// In JiraSearchRequestSchema (zod):
export const JiraSearchRequestSchema = z.object({
  jql: z.string().min(1).max(2000),
  maxResults: z.number().int().min(1).max(100).default(50),
  fields: z.array(z.string()).optional(),
});
```

Additionally, enforce `maxResults` cap (e.g., 100) in the Zod schema to prevent bulk data extraction.

---

### Finding #3: Path Traversal in `jira_attach_file`

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟡 Medium |
| **OWASP Category** | A01:2021 — Broken Access Control |
| **CWE** | CWE-22: Improper Limitation of a Pathname to a Restricted Directory |
| **CVSS Score** | 6.5 |
| **Location** | TDD §7.2 — `file_path: Must be within workspace root` |
| **Status** | Open |

**Description:**

The TDD states `file_path` must be "within workspace root" but doesn't specify the validation implementation. Common bypass techniques include:

- `../../etc/passwd` (directory traversal)
- `/absolute/path/outside/workspace`
- `file:///etc/shadow` (protocol prefixes)
- Symlink-following that escapes the workspace
- Null bytes: `valid/path%00../../secret`
- Windows UNC: `\\server\share\file`

The child server reads the file content and uploads it to Jira, meaning a traversal attack could exfiltrate arbitrary files from the host system.

**Impact:**

An attacker (or compromised agent) could read arbitrary files from the filesystem by passing a crafted `file_path` to `jira_attach_file`, then retrieve the uploaded attachment from Jira.

**Remediation:**

```typescript
// utils/path-validator.ts — Strict path containment check
import { resolve, relative, isAbsolute } from 'node:path';
import { realpath } from 'node:fs/promises';

/**
 * Validate file_path is strictly within workspace root.
 * Resolves symlinks to prevent escape via symlink chains.
 */
export async function validateFilePath(
  filePath: string,
  workspaceRoot: string
): Promise<string> {
  // Block absolute paths and protocol prefixes
  if (isAbsolute(filePath) || /^[a-z]+:\/\//i.test(filePath)) {
    throw new ToolError('VALIDATION_ERROR', 'Absolute paths not allowed');
  }
  // Block null bytes
  if (filePath.includes('\0')) {
    throw new ToolError('VALIDATION_ERROR', 'Invalid path characters');
  }
  // Block Windows UNC paths
  if (filePath.startsWith('\\\\')) {
    throw new ToolError('VALIDATION_ERROR', 'UNC paths not allowed');
  }
  // Resolve to real path (follows symlinks)
  const resolvedRoot = await realpath(workspaceRoot);
  const resolvedPath = await realpath(resolve(workspaceRoot, filePath));
  // Ensure resolved path starts with workspace root
  const rel = relative(resolvedRoot, resolvedPath);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new ToolError('VALIDATION_ERROR', 'Path must be within workspace');
  }
  return resolvedPath;
}
```

---

### Finding #4: IPC Credential Message Lacks Integrity Verification

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟡 Medium |
| **OWASP Category** | A02:2021 — Cryptographic Failures |
| **CWE** | CWE-345: Insufficient Verification of Data Authenticity |
| **CVSS Score** | 5.9 |
| **Location** | TDD §5.1, credentials/credential-manager.ts |
| **Status** | Open |

**Description:**

The IPC credential delivery via `process.send()` has no integrity verification. The design assumes only the legitimate parent (orchestrator) sends IPC messages to the child. While Node.js IPC channels between parent-child are relatively secure (Unix domain sockets / Windows named pipes), the credential-schemas.ts uses Zod for structure validation but there's no mention of:
- A challenge-response or nonce to ensure freshness
- A request ID correlation to prevent replay
- Validation that the message source is the expected parent

**Impact:**

In a compromised host scenario, if an attacker can inject messages into the IPC channel, they could supply malicious credentials directing API calls to an attacker-controlled endpoint (credential substitution).

**Remediation:**

```typescript
// credential-manager.ts — Add request correlation
interface CredentialRequest {
  type: 'getCredentials';
  requestId: string;  // crypto.randomUUID() — unique per request
  timestamp: number;
}

interface CredentialResponse {
  type: 'credentials';
  requestId: string;  // Must match the request
  timestamp: number;
  payload: { email: string; token: string; baseUrl: string };
}

function handleIpcMessage(msg: CredentialResponse): void {
  if (msg.requestId !== this.pendingRequestId) {
    logger.warn('Credential response with unexpected requestId — ignoring');
    return;
  }
  if (Date.now() - msg.timestamp > 5000) {
    logger.warn('Stale credential response — ignoring');
    return;
  }
  // Accept credentials
}
```

---

### Finding #5: Rate Limiter State Lost on Reconnection

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟡 Medium |
| **OWASP Category** | A05:2021 — Security Misconfiguration |
| **CWE** | CWE-770: Allocation of Resources Without Limits or Throttling |
| **CVSS Score** | 4.7 |
| **Location** | TDD §6.2, clients/rate-limiter.ts |
| **Status** | Open |

**Description:**

The token bucket rate limiter (100 req/min) is in-memory within the child process. When the child process dies and is respawned by `ReconnectManager`, the rate limiter resets to full capacity. This means:

1. A rapid reconnect cycle (crash → respawn → crash) could result in burst requests exceeding Jira's rate limit
2. Jira Cloud enforces rate limits per API token — getting rate-limited (HTTP 429) could affect ALL services using the same token
3. The 10-retry reconnect pattern (OI-02) combined with health checks could amplify this

**Impact:**

Rapid reconnections could cause Jira Cloud to rate-limit or temporarily block the API token, affecting all integrations using it.

**Remediation:**

```typescript
// Option A: Start with conservative budget after reconnect
class TokenBucketRateLimiter implements RateLimiter {
  constructor(private config: { maxTokens: number; isReconnect: boolean }) {
    // After reconnect, start at 25% capacity to avoid burst
    this.tokens = config.isReconnect
      ? Math.floor(config.maxTokens * 0.25)
      : config.maxTokens;
  }
}

// Option B: Persist token count via IPC to orchestrator
// On child spawn, send current rate limit state from orchestrator memory
```

---

### Finding #6: No PAT Token Expiry/Rotation Mechanism

| Attribute | Value |
|-----------|-------|
| **Severity** | 🔵 Low |
| **OWASP Category** | A07:2021 — Identification and Authentication Failures |
| **CWE** | CWE-613: Insufficient Session Expiration |
| **CVSS Score** | 3.7 |
| **Location** | TDD §7.1 |
| **Status** | Open |

**Description:**

The design uses Personal Access Tokens (PAT) for Jira Server/DC and API tokens for Cloud. Neither mechanism includes token expiration checking, proactive rotation prompting, or validation of token scope at startup.

**Remediation:**

- Validate credentials at startup via GET /myself (already partially designed in §5.1)
- Log a warning if token has been in use >90 days
- Document recommended PAT scope (read-only for read tools, project-scoped where possible)

---

### Finding #7: Error Responses May Leak Jira Internal Structure

| Attribute | Value |
|-----------|-------|
| **Severity** | 🔵 Low |
| **OWASP Category** | A05:2021 — Security Misconfiguration |
| **CWE** | CWE-209: Generation of Error Message Containing Sensitive Information |
| **CVSS Score** | 3.1 |
| **Location** | TDD §6.4, error-schemas.ts |
| **Status** | Open |

**Description:**

Jira error responses often include internal field IDs (`customfield_10001`), project configuration details, workflow states, and user email addresses. The `toToolError()` function must sanitize these before returning to MCP clients.

**Remediation:**

```typescript
function sanitizeJiraError(error: unknown): { code: string; message: string } {
  // Strip internal field IDs, email addresses, internal URLs
  // Return only user-actionable error message
  const raw = typeof error === 'string' ? error : JSON.stringify(error);
  const cleaned = raw
    .replace(/customfield_\d+/g, '[field]')
    .replace(/[\w.-]+@[\w.-]+\.\w+/g, '[email]');
  return { code: 'JIRA_ERROR', message: cleaned.slice(0, 500) };
}
```

---

### Finding #8: autoApprove Policy Not Formalized

| Attribute | Value |
|-----------|-------|
| **Severity** | 🔵 Low |
| **OWASP Category** | A01:2021 — Broken Access Control |
| **CWE** | CWE-862: Missing Authorization |
| **CVSS Score** | 2.4 |
| **Location** | orchestration.json |
| **Status** | Open |

**Description:**

The `autoApprove` list currently only contains read operations — this is correct. However, there's no documented policy preventing future additions of write tools to autoApprove.

**Remediation:**

- Document policy: "autoApprove MUST only contain read-only tools"
- Add CI validation that checks autoApprove entries against a write-tool denylist

---

### Finding #9: No Certificate Pinning (Informational)

| Attribute | Value |
|-----------|-------|
| **Severity** | ℹ️ Informational |
| **OWASP Category** | A02:2021 — Cryptographic Failures |
| **CWE** | CWE-295: Improper Certificate Validation |
| **Location** | TDD §1.2 |

**Description:**

Node.js `fetch` uses system certificate store. For Jira Server/DC (self-hosted), custom CA certificates may be needed. The design doesn't mention TLS minimum version enforcement.

**Remediation:**

- Document `NODE_EXTRA_CA_CERTS` support for custom CAs
- Require HTTPS for `base_url` (reject `http://` except localhost in dev)

---

### Finding #10: No Audit Trail for Tool Invocations (Informational)

| Attribute | Value |
|-----------|-------|
| **Severity** | ℹ️ Informational |
| **OWASP Category** | A09:2021 — Security Logging and Monitoring Failures |
| **CWE** | CWE-778: Insufficient Logging |
| **Location** | TDD §7 |

**Description:**

The TDD mentions Pino logger with redaction but doesn't specify structured audit logging for tool invocations. For a system that can create/modify/delete Jira issues, an audit trail is important.

**Remediation:**

```typescript
logger.info({
  event: 'tool_invocation',
  tool: toolName,
  params: redactSensitive(args),
  result: response.ok ? 'success' : `error_${response.status}`,
  duration: elapsedMs,
});
```

---

## Positive Security Practices ✅

| Practice | Location | Assessment |
|----------|----------|------------|
| Credentials never on disk | §7.1, BR-05 | ✅ Excellent — OS keychain + IPC |
| Token redaction in logs | §7.1 — Pino redact patterns | ✅ Good |
| Auth tokens excluded from error messages | §7.1 | ✅ Good |
| MCP responses sanitized | §7.1 | ✅ Good |
| Process isolation via stdio | §7.3 | ✅ Strong (if actually stdio) |
| Zod schema validation on all inputs | §7.2 | ✅ Good defense-in-depth |
| Issue key regex validation | §7.2 — `^[A-Z]+-\d+$` | ✅ Strict |
| URL validation (HTTPS required) | §7.2 | ✅ Good |
| 401 retry limited to once | §6.1 | ✅ Prevents infinite retry loop |
| Mature reconnect pattern | §5.3 (SA4E-37) | ✅ Battle-tested |

---

## Dependency Risk Assessment

| Dependency | Version | Risk | Notes |
|-----------|---------|------|-------|
| `@modelcontextprotocol/sdk` | ^1.29.0 | 🟡 Low-Medium | Newer SDK; monitor for CVEs |
| `zod` | ^3.23.0 | ✅ Low | Well-maintained, no known CVEs |
| Native `fetch` (Node.js built-in) | N/A | ✅ Low | Replaces axios — reduces supply chain risk |
| `pino` | ^9.14.0 | ✅ Low | Ensure redact config is correct |

**Positive:** Removing axios and using native fetch reduces supply-chain attack surface.

---

## Remediation Priority

| # | Finding | Effort | Impact | Priority |
|---|---------|--------|--------|----------|
| 1 | Transport mismatch (stdio vs httpStream) | Low | High | **P1** |
| 3 | Path traversal in jira_attach_file | Low | Medium | **P2** |
| 2 | JQL injection mitigation | Low | Medium | **P3** |
| 4 | IPC credential integrity | Medium | Medium | **P4** |
| 5 | Rate limiter reconnect reset | Low | Medium | **P5** |
| 7 | Error response sanitization | Low | Low | **P6** |
| 6 | PAT rotation guidance | Low | Low | **P7** |
| 8 | autoApprove policy documentation | Low | Low | **P8** |

---

## Recommendations Summary

### Immediate Actions (before implementation)

1. **Resolve transport discrepancy** — Confirm stdio is the intended transport and update `orchestration.json` to match TDD. If httpStream is needed, redesign credential delivery with authentication.
2. **Specify path traversal defense** — Add `validateFilePath()` implementation detail to TDD security section.

### During Implementation (DEV requirements)

3. Add JQL length limit and `maxResults` cap in Zod schemas
4. Add request correlation (requestId + timestamp) to IPC credential messages
5. Implement conservative rate limiter initialization after reconnect
6. Sanitize Jira error bodies before including in MCP tool results
7. Add structured audit logging for all tool invocations

### Long-term Hardening

8. Document PAT scope best practices and rotation schedule
9. Formalize autoApprove policy (read-only tools only)
10. Add CI secret scanning for credential patterns in source

---

## Appendix

### A. Scope and Methodology
- Static design review of TDD.md v1.0
- Cross-reference with existing codebase (AuthManager.ts, orchestration.json, package.json)
- OWASP Testing Guide v4.2 methodology applied to design artifacts

### B. Scope Limitations
- No dynamic/runtime testing (design review only)
- No penetration testing of existing orchestrator
- IPC security assumptions based on Node.js documentation
- Jira Cloud rate limit behavior based on public documentation

### C. References
- [OWASP Top 10 (2021)](https://owasp.org/Top10/)
- [CWE-22: Path Traversal](https://cwe.mitre.org/data/definitions/22.html)
- [CWE-943: Data Query Logic Injection](https://cwe.mitre.org/data/definitions/943.html)
- [Node.js IPC Security](https://nodejs.org/api/child_process.html)
- [Atlassian Rate Limiting](https://developer.atlassian.com/cloud/jira/platform/rate-limiting/)
