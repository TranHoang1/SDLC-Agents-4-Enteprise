# 🔒 Security Assessment Report — SA4E-84

## Document Information

| Field | Value |
|-------|-------|
| Project | SDLC-Agents-4-Enterprise (draw.io auto-layout tools) |
| Scope | `drawio-tool.ts`, `drawio-apply.ts`, `elk-layout.ts`, `drawio-writer.ts`, `drawio-layout-models.ts` |
| Date | 2025-07-27 |
| Assessor | Security Agent |
| Version | 1.0 |

## Executive Summary

The draw.io auto-layout tool module (SA4E-84) has a **moderate security posture**. The code demonstrates good practices in several areas: input type validation for algorithm/direction parameters, resource limits via `MAX_NODES` and `TIMEOUT_MS`, and proper temp file cleanup with `finally` blocks.

However, the primary concern is a **path traversal vulnerability** in `resolveFilePath()` which does not sanitize `../` sequences, potentially allowing file reads/writes outside the intended workspace. Additionally, the `spacing` parameter lacks an upper bound, creating a potential resource exhaustion vector in the ELK layout engine.

**Overall Risk Rating:** Medium

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 1 |
| 🟡 Medium | 2 |
| 🔵 Low | 3 |
| ℹ️ Informational | 2 |

---

## Findings Table

| ID | Severity | OWASP Category | File | Line | Description | Remediation |
|----|----------|----------------|------|------|-------------|-------------|
| SEC-01 | 🟠 High | A01:2021 Broken Access Control | `drawio-tool.ts` | 53-58 | Path traversal — `resolveFilePath()` does not sanitize `../` sequences. Attacker can read/overwrite files outside workspace via `file_path: "../../etc/passwd"` or `"../../../sensitive.drawio"` | Canonicalize path and verify it starts with workspace root |
| SEC-02 | 🟡 Medium | A05:2021 Security Misconfiguration | `drawio-apply.ts` | 11-12 | `MAX_NODES` and `TIMEOUT_MS` parsed from env without validation — `NaN`, negative, or extremely large values accepted | Validate parsed env values with bounds checking |
| SEC-03 | 🟡 Medium | A05:2021 Security Misconfiguration | `drawio-apply.ts` | 40 | `spacing` parameter has no upper bound — value like `999999999` passed directly to ELK layout options, potential memory/CPU exhaustion | Cap spacing to reasonable maximum (e.g., 500px) |
| SEC-04 | 🔵 Low | A09:2021 Security Logging Failures | `drawio-tool.ts` | 37 | Error messages include internal path in `File not found: ${filePath}` — leaks absolute filesystem path | Return generic "File not found" without full path |
| SEC-05 | 🔵 Low | A09:2021 Security Logging Failures | `drawio-apply.ts` | 50 | Error messages from ELK may expose internal state: `ELK layout failed: ${e.message}` | Sanitize error messages before returning to caller |
| SEC-06 | 🔵 Low | A06:2021 Vulnerable Components | `package.json` | 49 | `elkjs: ^0.9.3` uses caret range — may auto-upgrade to untested minor versions | Pin to exact version `0.9.3` |
| SEC-07 | ℹ️ Info | A05:2021 Security Misconfiguration | `drawio-apply.ts` | 69 | `validateReparse` temp file cleanup uses silent catch `catch { /* best-effort */ }` — cleanup failures not logged | Add logging for cleanup failures |
| SEC-08 | ℹ️ Info | Best Practice | `drawio-writer.ts` | 42-44 | Regex patterns in `readCurrentPositions` and `replaceCellGeometry` use `[\s\S]*?` — low ReDoS risk on well-formed XML but could stall on maliciously crafted large input | Consider limiting input XML size before regex processing |

---

## Detailed Findings

### Finding #1: Path Traversal in `resolveFilePath()` (SEC-01)

| Attribute | Value |
|-----------|-------|
| **Severity** | High |
| **OWASP Category** | A01:2021 — Broken Access Control |
| **CWE** | CWE-22: Improper Limitation of a Pathname to a Restricted Directory |
| **CVSS Score** | 7.5 |
| **Location** | `drawio-tool.ts:53-58` |
| **Status** | Open |

**Description:**
The `resolveFilePath()` function accepts relative paths and joins them to the workspace root without any canonicalization or directory traversal checks. An attacker who can invoke the `drawio_auto_layout` tool (e.g., via MCP protocol) can supply `file_path: "../../../../etc/passwd"` to read arbitrary files, or craft a path to overwrite files outside the workspace (since `handleApply` writes back to `filePath`).

**Evidence:**
```typescript
// drawio-tool.ts:53-58
function resolveFilePath(filePath: unknown, workspace: string): string | null {
  if (typeof filePath !== 'string' || filePath.trim() === '') return null;
  const trimmed = filePath.trim();
  // Already absolute — NO VALIDATION that it's within workspace
  if (trimmed.startsWith('/') || /^[A-Z]:\\/i.test(trimmed)) return trimmed;
  // Relative — NO sanitization of ../
  return `${workspace}/${trimmed}`;
}
```

**Impact:**
- **Read**: Parse arbitrary XML files on the system (content processed but not returned raw — however error messages may leak info)
- **Write**: If the file parses as valid draw.io XML with detectable issues, the "fixed" version is written back to `filePath` via `fs.writeFileSync(filePath, xml)` in `drawio-apply.ts:56` — potential arbitrary file overwrite

**Remediation:**
```typescript
import * as path from 'path';

function resolveFilePath(filePath: unknown, workspace: string): string | null {
  if (typeof filePath !== 'string' || filePath.trim() === '') return null;
  const trimmed = filePath.trim();

  // Resolve to absolute path
  const resolved = path.isAbsolute(trimmed) ? trimmed : path.resolve(workspace, trimmed);

  // Canonicalize to eliminate ../ sequences
  const canonical = path.resolve(resolved);

  // Verify the canonical path is within the workspace
  const normalizedWorkspace = path.resolve(workspace);
  if (!canonical.startsWith(normalizedWorkspace + path.sep) && canonical !== normalizedWorkspace) {
    return null; // Path escapes workspace — reject
  }

  return canonical;
}
```

**References:**
- [CWE-22](https://cwe.mitre.org/data/definitions/22.html)
- [OWASP Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)

---

### Finding #2: Unsafe Environment Variable Parsing (SEC-02)

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **OWASP Category** | A05:2021 — Security Misconfiguration |
| **CWE** | CWE-20: Improper Input Validation |
| **CVSS Score** | 4.3 |
| **Location** | `drawio-apply.ts:11-12` |
| **Status** | Open |

**Description:**
`MAX_NODES` and `TIMEOUT_MS` are parsed from environment variables without bounds validation. If set to non-numeric strings, they become `NaN`, effectively disabling the limit checks (since `nodeCount > NaN` is always `false`). Extremely large values bypass the protective intent.

**Evidence:**
```typescript
// drawio-apply.ts:11-12
const MAX_NODES = Number(process.env.SA4E_ELK_MAX_NODES ?? 500);
const TIMEOUT_MS = Number(process.env.SA4E_ELK_TIMEOUT_MS ?? 10_000);
```

**Impact:**
- If `SA4E_ELK_MAX_NODES="abc"`, then `MAX_NODES = NaN`, and `nodeCount > NaN` is always `false` — no limit enforced
- If set to `0` or negative, all diagrams are rejected
- If `TIMEOUT_MS = NaN`, the `setTimeout` behavior is undefined (fires immediately in most runtimes)

**Remediation:**
```typescript
function parseEnvInt(envVar: string, defaultVal: number, min: number, max: number): number {
  const raw = process.env[envVar];
  if (raw === undefined) return defaultVal;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return defaultVal;
  return Math.floor(parsed);
}

const MAX_NODES = parseEnvInt('SA4E_ELK_MAX_NODES', 500, 1, 5000);
const TIMEOUT_MS = parseEnvInt('SA4E_ELK_TIMEOUT_MS', 10_000, 1000, 60_000);
```

---

### Finding #3: Unbounded `spacing` Parameter (SEC-03)

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **OWASP Category** | A05:2021 — Security Misconfiguration |
| **CWE** | CWE-400: Uncontrolled Resource Consumption |
| **CVSS Score** | 4.0 |
| **Location** | `drawio-apply.ts:40-41` |
| **Status** | Open |

**Description:**
The `normalizeLayoutArgs()` function validates that `spacing` is a positive number but imposes no upper bound. A value like `Number.MAX_SAFE_INTEGER` is passed to ELK's layout options as `elk.spacing.nodeNode` and `elk.layered.spacing.nodeNodeBetweenLayers` (doubled), potentially causing ELK to allocate extreme coordinate space.

**Evidence:**
```typescript
// drawio-apply.ts:40-41
const spacing = typeof args.spacing === 'number' && args.spacing > 0 ? args.spacing : 80;
```

**Impact:**
- ELK may consume excessive CPU/memory calculating layouts with astronomical spacing values
- Output coordinates could overflow JavaScript's floating-point precision
- Mitigated partially by `TIMEOUT_MS` — but CPU pegs until timeout fires

**Remediation:**
```typescript
const MAX_SPACING = 500; // Reasonable upper bound in pixels
const spacing = typeof args.spacing === 'number' && args.spacing > 0
  ? Math.min(args.spacing, MAX_SPACING)
  : 80;
```

---

### Finding #4: Internal Path Leakage in Error Messages (SEC-04)

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **OWASP Category** | A09:2021 — Security Logging and Monitoring Failures |
| **CWE** | CWE-209: Information Exposure Through an Error Message |
| **CVSS Score** | 3.1 |
| **Location** | `drawio-tool.ts:37` |
| **Status** | Open |

**Evidence:**
```typescript
if (!fs.existsSync(filePath)) return error(`File not found: ${filePath}`);
```

**Remediation:**
```typescript
if (!fs.existsSync(filePath)) return error('File not found or not accessible');
```

---

### Finding #5: ELK Error Message Forwarding (SEC-05)

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **OWASP Category** | A09:2021 — Security Logging and Monitoring Failures |
| **CWE** | CWE-209: Information Exposure Through an Error Message |
| **CVSS Score** | 2.5 |
| **Location** | `drawio-apply.ts:50` |
| **Status** | Open |

**Evidence:**
```typescript
} catch (e: any) {
  return error(`ELK layout failed: ${e.message ?? e}`);
}
```

**Remediation:**
```typescript
} catch (e: any) {
  // Log full error internally, return generic message to caller
  console.error('[drawio-apply] ELK layout error:', e);
  return error('Layout engine failed. Please check input diagram and retry.');
}
```

---

## Positive Security Observations ✅

| Area | Good Practice Observed |
|------|----------------------|
| Input type validation | `algorithm` and `direction` validated against allowlists (`VALID_ALG`, `VALID_DIR`) |
| Resource limits | `MAX_NODES` cap prevents processing extremely large diagrams |
| Timeout protection | `withTimeout()` in `elk-layout.ts` prevents ELK from running indefinitely |
| Temp file cleanup | `validateReparse()` uses `try/finally` with `fs.rmSync(recursive: true, force: true)` |
| Layout output validation | `validateLayoutOutput()` checks `Number.isFinite()` on all coordinates |
| No eval/exec | No dynamic code execution, no shell commands |
| XML parsing safety | Uses regex-based parsing (not DOM/SAX) — **immune to XXE attacks** |
| No external network calls | ELK runs locally, no SSRF vectors |
| Type checking | `file_path` validated as string before use |

---

## Dependency Vulnerabilities

| Dependency | Current Version | Known CVEs | Severity | Notes |
|-----------|----------------|-----------|----------|-------|
| elkjs | ^0.9.3 | None known | N/A | No published CVEs as of 2025-07. Caret range is a minor supply-chain risk. |

---

## Remediation Priority

| Priority | Finding | Effort | Impact |
|----------|---------|--------|--------|
| 1 | SEC-01: Path Traversal in `resolveFilePath()` | Low | Prevents arbitrary file read/write outside workspace |
| 2 | SEC-02: Unsafe env var parsing | Low | Ensures resource limits always enforced |
| 3 | SEC-03: Unbounded `spacing` | Low | Prevents resource exhaustion via large spacing values |
| 4 | SEC-04: Path leakage in errors | Low | Reduces information disclosure |
| 5 | SEC-05: Internal error leakage | Low | Reduces information disclosure |
| 6 | SEC-06: Unpinned elkjs version | Low | Supply chain hardening |

---

## Recommendations Summary

### Immediate Actions (High)
1. **Fix `resolveFilePath()`** — Add `path.resolve()` canonicalization + workspace boundary check

### Short-term Improvements (Medium)
2. **Validate env vars** — Add bounds checking for `MAX_NODES` and `TIMEOUT_MS` with sane fallbacks
3. **Cap `spacing`** — Add `Math.min(args.spacing, 500)` upper bound

### Long-term Hardening (Low/Informational)
4. Sanitize all error messages before returning to callers
5. Pin `elkjs` to exact version in `package.json`
6. Add logging for temp file cleanup failures
7. Consider adding an XML size limit (e.g., 5MB) before regex processing in `drawio-parser.ts`

---

## Appendix

### A. Tools & Methodology
- Static code analysis (manual review)
- Dependency version checking against NVD/CVE databases
- OWASP Testing Guide v4.2 methodology
- CWE classification

### B. Scope Limitations
- **NOT tested**: Dynamic/runtime behavior, penetration testing, network-level security
- **NOT in scope**: `drawio-parser.ts` (referenced dependency, reviewed for context only)
- **Assumption**: The `workspace` parameter passed to `handleDrawioLayout` is trusted server-side input (set by tool registry in `register-tools.ts`). If `workspace` itself can be user-controlled, risk increases to Critical.

### C. Glossary
- **CVSS**: Common Vulnerability Scoring System
- **CWE**: Common Weakness Enumeration
- **OWASP**: Open Web Application Security Project
- **XXE**: XML External Entity injection
- **ReDoS**: Regular Expression Denial of Service
- **ELK**: Eclipse Layout Kernel (graph layout library)
