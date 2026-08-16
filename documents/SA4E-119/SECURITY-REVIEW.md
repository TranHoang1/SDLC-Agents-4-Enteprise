# 🔒 Security Design Review — SA4E-119

## Document Information

| Field | Value |
|-------|-------|
| Ticket | SA4E-119 |
| Scope | TDD Security Design Review — 12 ECC Feature Parity (Epic) |
| Date | 2026-08-16 |
| Reviewer | Security Agent |
| TDD Version | 1.0 |
| Status | Complete |

---

## Executive Summary

The TDD for SA4E-119 introduces 12 features across 5 domains. The security design is **partially addressed** in Section 7, covering AgentShield scanning rules, GateGuard denylist, and basic data protection. However, several **High** and **Medium** severity gaps exist in the design that should be addressed before implementation.

**Key concerns:**
1. GateGuard override mechanism lacks proper authentication — any user can approve a blocked command by knowing the hash
2. Skill Packs introduce supply chain risk without integrity verification (no signing)
3. AgentShield has a self-referential trust problem (who validates the scanner's own rules?)
4. MCP tools lack consistent authorization beyond project_id scoping
5. SQLite database at rest is unencrypted — GateGuard audit logs could be tampered with

**Overall Risk Rating:** 🟠 **High** (3 High findings require design changes before implementation)

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 3 |
| 🟡 Medium | 5 |
| 🔵 Low | 3 |
| ℹ️ Informational | 2 |

---

## Findings Table

| ID | Severity | Category | Finding | OWASP | Recommendation |
|----|----------|----------|---------|-------|----------------|
| SEC-01 | 🟠 High | Auth/Authz | GateGuard override lacks authentication | A01 | Require JWT identity + RBAC check for override approval |
| SEC-02 | 🟠 High | Supply Chain | Skill Packs have no integrity verification | A08 | Add manifest signing + checksum validation |
| SEC-03 | 🟠 High | Auth/Authz | New MCP tools lack granular authorization | A01 | Add RBAC middleware per tool, not just project_id scoping |
| SEC-04 | 🟡 Medium | Self-Referential | AgentShield cannot validate its own rule integrity | A08 | Hash-based rule integrity check + immutable default rules |
| SEC-05 | 🟡 Medium | Injection | GateGuard regex denylist vulnerable to ReDoS | A03 | Limit regex complexity, add timeout per match |
| SEC-06 | 🟡 Medium | Data Protection | GateGuard audit log in unencrypted SQLite (tamper-able) | A09 | Add HMAC-based tamper detection for audit entries |
| SEC-07 | 🟡 Medium | Injection | condition_json in instincts allows arbitrary JSON without schema constraints | A03 | Define strict JSON schema for condition_json, reject arbitrary shapes |
| SEC-08 | 🟡 Medium | Config | AgentShield scan paths could be used to read arbitrary files | A01 | Restrict scan paths to .kiro/, mcp.json patterns only |
| SEC-09 | 🔵 Low | Session | No rate limiting on MCP tool calls (10 new tools) | A05 | Add per-tool rate limiting for write operations |
| SEC-10 | 🔵 Low | Data Protection | KB entry content truncated at 200 chars in logs — may still contain PII | A02 | Apply PII masking rules before logging |
| SEC-11 | 🔵 Low | Config | Model Tiering routes to external LLM APIs without certificate pinning | A07 | Document TLS verification requirements for model endpoints |
| SEC-12 | ℹ️ Info | Design | Council Decision spawns 3-5 parallel LLM calls — cost amplification vector | — | Add budget cap per council invocation |
| SEC-13 | ℹ️ Info | Design | Pattern Extraction triggered by EventBus has no debounce — rapid ticket closures could cause resource exhaustion | — | Add debounce/throttle (max 1 extraction per 5s) |

---

## Detailed Findings

### SEC-01: GateGuard Override Lacks Authentication

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟠 High |
| **OWASP** | A01:2021 — Broken Access Control |
| **CWE** | CWE-862: Missing Authorization |
| **Location** | TDD Section 7.2 (Override Mechanism) |

**Description:**

The TDD states: "User says 'approve {hash}' → one-time allow". The SHA-256 hash of the command is deterministic — anyone who can see or guess the blocked command can compute the hash and override the block. There is no identity verification or role check on who issues the override.

**Current Design (TDD 7.2):**
```
1. GateGuard blocks command → generates SHA-256 hash of command
2. User says "approve {hash}" → one-time allow
3. Audit entry records: command, user, timestamp
```

**Impact:** A compromised or malicious agent could compute the hash of its own blocked command and auto-approve it, bypassing GateGuard entirely. The "user" field in audit is self-reported.

**Recommendation:**

```typescript
// Add identity verification to override
interface OverrideRequest {
  hash: string;
  // MUST come from authenticated JWT identity, not self-reported
  authenticatedUserId: string;  // from JWT claims
  // MUST have explicit RBAC role
  requiredRole: 'gateguard_admin' | 'project_owner';
}

// Verify override is from human (not agent) via session origin
function verifyOverrideSource(ctx: ProjectContext): boolean {
  return ctx.sessionOrigin === 'human-interactive' 
    && ctx.roles.includes('gateguard_admin');
}
```

Additionally, consider adding a TOTP or challenge-response step for critical overrides (rm -rf, DROP TABLE).

---

### SEC-02: Skill Packs Have No Integrity Verification

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟠 High |
| **OWASP** | A08:2021 — Software and Data Integrity Failures |
| **CWE** | CWE-494: Download of Code Without Integrity Check |
| **Location** | TDD Section 3.3 (skill_pack_install) + Section 5.1 (SkillPackLoader) |

**Description:**

The TDD defines skill pack installation with `source` parameter (local path or catalog URL) but specifies no mechanism for:
- Manifest signature verification
- Content hash validation
- Publisher identity verification
- Tamper detection after installation

A skill pack contains **steering files + tool configs + prompts** — these directly control agent behavior. A malicious pack could inject prompt instructions that exfiltrate data or bypass GateGuard.

**Current Design (TDD 3.3):**
```json
{
  "name": "string (required — pack identifier)",
  "source": "string (optional — local path or catalog URL)",
  "force": "boolean (optional — override existing)"
}
```

**Impact:** Supply chain attack — malicious actor publishes/modifies a skill pack that injects prompt instructions to bypass security controls, exfiltrate secrets, or execute arbitrary commands.

**Recommendation:**

```typescript
interface SkillPackManifest {
  name: string;
  version: string;
  // ADD: Cryptographic integrity
  checksums: {
    sha256: string;  // hash of entire pack content
    files: Record<string, string>;  // per-file hashes
  };
  signature?: string;  // Ed25519 signature from trusted publisher
  publisher: {
    name: string;
    publicKey?: string;  // For signature verification
  };
  // ADD: Capability declarations (principle of least privilege)
  permissions: {
    canModifySteering: boolean;
    canAccessTools: string[];  // Tool names the pack can reference
    canAccessPaths: string[];  // Glob patterns allowed
  };
}

// Validation at install time
async function validatePack(manifest: SkillPackManifest, content: Buffer): Promise<void> {
  // 1. Verify checksum
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  if (hash !== manifest.checksums.sha256) throw new PackIntegrityError();
  
  // 2. Verify signature (if publisher signed)
  if (manifest.signature) {
    const valid = crypto.verify('ed25519', content, manifest.publisher.publicKey!, 
      Buffer.from(manifest.signature, 'hex'));
    if (!valid) throw new PackSignatureError();
  }
  
  // 3. Scan pack content for suspicious patterns
  await agentShieldScanner.scan(packFiles, ['SHIELD-003']); // prompt injection check
}
```

---

### SEC-03: New MCP Tools Lack Granular Authorization

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟠 High |
| **OWASP** | A01:2021 — Broken Access Control |
| **CWE** | CWE-285: Improper Authorization |
| **Location** | TDD Section 3.1-3.5 (All new tools) |

**Description:**

The 10 new MCP tools use only `project_id` for scoping. There is no role-based authorization defining:
- Who can manage instincts (admin vs agent vs user)?
- Who can install/remove skill packs?
- Who can modify the GateGuard denylist?
- Who can clear audit logs?

The existing `apiKeyAuth` middleware is a single shared key — any client with the API key can invoke all tools equally.

**Current Design:** All tools accept `project_id` as the only authorization boundary. The existing `X-Project-Id` header is self-reported.

**Impact:** Any authenticated client can modify another project's instincts, install malicious packs, or modify the denylist to allow dangerous commands — effectively privilege escalation across projects.

**Recommendation:**

```typescript
// Add tool-level authorization matrix
const TOOL_PERMISSIONS: Record<string, { requiredRole: string; scope: 'project' | 'global' }> = {
  'instinct_manage': { requiredRole: 'project_admin', scope: 'project' },
  'skill_pack_install': { requiredRole: 'system_admin', scope: 'global' },
  'skill_pack_remove': { requiredRole: 'system_admin', scope: 'global' },
  'gateguard_denylist': { requiredRole: 'security_admin', scope: 'project' },
  'gateguard_evaluate': { requiredRole: 'agent', scope: 'project' },
  'gateguard_audit_log': { requiredRole: 'project_admin', scope: 'project' },
  'agentshield_scan': { requiredRole: 'agent', scope: 'project' },
  'onboarding_generate': { requiredRole: 'agent', scope: 'project' },
  'pattern_extract': { requiredRole: 'agent', scope: 'project' },
};

// Enforce in MCP tool handler
async function authorizeToolCall(toolName: string, ctx: ProjectContext): Promise<void> {
  const perm = TOOL_PERMISSIONS[toolName];
  if (!perm) return; // existing tools - backward compat
  if (!ctx.roles.includes(perm.requiredRole)) {
    throw new AuthorizationError(`Tool ${toolName} requires role: ${perm.requiredRole}`);
  }
}
```

---

### SEC-04: AgentShield Self-Referential Trust Problem

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟡 Medium |
| **OWASP** | A08:2021 — Software and Data Integrity Failures |
| **CWE** | CWE-693: Protection Mechanism Failure |
| **Location** | TDD Section 5.1 (SecurityModule) + Section 7.1 |

**Description:**

AgentShield scans config files for security issues. But:
1. Who verifies AgentShield's own scanning rules haven't been tampered with?
2. If a malicious skill pack modifies the rules directory, the scanner itself becomes compromised.
3. The TDD mentions rules are loaded via `IScanRule` interface with `registerRule()` — this allows dynamic rule registration without integrity checks.

**Impact:** An attacker who can modify the rules directory (via a malicious skill pack or compromised agent) can disable security scanning or add rules that whitelist malicious patterns.

**Recommendation:**

```typescript
// 1. Hash-based integrity for default rules (loaded at startup)
const DEFAULT_RULE_HASHES: Record<string, string> = {
  'SecretDetector': 'sha256:abc123...',
  'HttpEndpointRule': 'sha256:def456...',
  'InjectionDetector': 'sha256:ghi789...',
  'TlsValidator': 'sha256:jkl012...',
};

// 2. Verify rules at startup (fail-closed)
function verifyRuleIntegrity(rule: IScanRule, sourceHash: string): boolean {
  const expected = DEFAULT_RULE_HASHES[rule.id];
  if (!expected) return true; // custom rules are OK but logged
  return sourceHash === expected;
}

// 3. Separate immutable default rules from user-registered rules
interface IAgentShieldScanner {
  scan(paths: string[], rules?: string[]): Promise<ScanResult>;
  registerCustomRule(rule: IScanRule): void;  // logged, can be audited
  // Default rules CANNOT be unregistered or replaced
}
```

---

### SEC-05: GateGuard Regex Denylist Vulnerable to ReDoS

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟡 Medium |
| **OWASP** | A03:2021 — Injection |
| **CWE** | CWE-1333: Inefficient Regular Expression Complexity |
| **Location** | TDD Section 7.2 + Section 4.4 (Denylist lookup) |

**Description:**

The TDD specifies custom denylist patterns via `gateguard_denylist` tool. Users can add regex patterns. Catastrophic backtracking (ReDoS) could cause the GateGuard evaluation to exceed the 50ms performance target, effectively creating a denial-of-service on all agent commands.

Example evil pattern: `(a+)+b` with input `aaaaaaaaaaaaaaaaaac` causes exponential backtracking.

The TDD mentions "Pre-compiled regex Set cached in memory" but no complexity validation.

**Impact:** A malicious pattern added to the denylist could cause all `gateguard_evaluate` calls to timeout, blocking all agent operations.

**Recommendation:**

```typescript
// Add regex complexity validation before accepting patterns
function validateDenyPattern(pattern: string): ValidationResult {
  // 1. Length limit
  if (pattern.length > 200) return { valid: false, reason: 'Pattern too long (max 200 chars)' };
  
  // 2. Reject known ReDoS-prone constructs
  const redosPatterns = [
    /\(.+\+\).+\+/,  // (a+)+
    /\(.+\*\).+\*/,  // (a*)*
    /\(.+\)\{.+\}\{/,  // nested quantifiers
  ];
  for (const rp of redosPatterns) {
    if (rp.test(pattern)) {
      return { valid: false, reason: 'Pattern has catastrophic backtracking risk' };
    }
  }
  
  // 3. Benchmark against test input (max 10ms)
  try {
    const re = new RegExp(pattern);
    const testStr = 'a'.repeat(100);
    const start = performance.now();
    re.test(testStr);
    if (performance.now() - start > 10) {
      return { valid: false, reason: 'Pattern too slow on benchmark input' };
    }
  } catch {
    return { valid: false, reason: 'Invalid regex syntax' };
  }
  
  return { valid: true };
}
```

Consider using RE2 (linear-time regex engine via `re2` npm package) for all user-provided patterns.

---

### SEC-06: GateGuard Audit Log Tamper-able

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟡 Medium |
| **OWASP** | A09:2021 — Security Logging and Monitoring Failures |
| **CWE** | CWE-117: Improper Output Neutralization for Logs |
| **Location** | TDD Section 7.3 (Data Protection) + Section 4.2 (gateguard_audit table) |

**Description:**

The TDD states GateGuard audit is "append-only (BR-1204)" but the underlying SQLite database is a regular file. Nothing prevents a compromised process from modifying or deleting audit entries.

**Impact:** A sophisticated attacker who achieves code execution could modify audit logs to hide evidence of blocked command overrides or GateGuard bypasses.

**Recommendation:**

```typescript
// Add HMAC chain to audit entries (blockchain-like integrity)
interface AuditEntry {
  id: number;
  timestamp: string;
  command: string;
  action: 'blocked' | 'overridden' | 'allowed';
  // ADD: integrity chain
  prev_hash: string;  // HMAC of previous entry
  entry_hash: string; // HMAC(prev_hash + content, AUDIT_SECRET)
}

function computeAuditHash(entry: Omit<AuditEntry, 'entry_hash'>, secret: string): string {
  const content = `${entry.prev_hash}|${entry.timestamp}|${entry.command}|${entry.action}`;
  return crypto.createHmac('sha256', secret).update(content).digest('hex');
}
```

---

### SEC-07: Instinct condition_json Allows Arbitrary JSON

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟡 Medium |
| **OWASP** | A03:2021 — Injection |
| **CWE** | CWE-20: Improper Input Validation |
| **Location** | TDD Section 3.2 (instinct_manage) + Section 4.2 (instincts table) |

**Description:**

The `condition_json` field accepts "Valid JSON, max 2048 chars" per TDD Section 7.4. However, there is no schema definition for what valid condition structures look like. If this JSON is ever evaluated dynamically or used to construct queries, it becomes an injection vector. Deeply nested JSON could cause stack overflow during parsing.

**Recommendation:**

```typescript
// Define strict schema for condition_json
const ConditionSchema = z.object({
  field: z.enum(['source', 'type', 'tags', 'age_days', 'confidence']),
  operator: z.enum(['eq', 'neq', 'gt', 'lt', 'contains', 'matches']),
  value: z.union([z.string().max(200), z.number()]),
  and: z.array(z.lazy(() => ConditionSchema)).max(3).optional(),
  or: z.array(z.lazy(() => ConditionSchema)).max(3).optional(),
}).strict();

// Enforce max nesting depth = 3
function validateCondition(json: string): boolean {
  const parsed = JSON.parse(json);
  if (getJsonDepth(parsed) > 3) throw new Error('Condition too deeply nested');
  return ConditionSchema.safeParse(parsed).success;
}
```

---

### SEC-08: AgentShield Scan Paths Could Enable Arbitrary File Read

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟡 Medium |
| **OWASP** | A01:2021 — Broken Access Control |
| **CWE** | CWE-22: Path Traversal |
| **Location** | TDD Section 3.5 (agentshield_scan) + Section 7.4 |

**Description:**

The `agentshield_scan` tool accepts `paths: string[]` and reads file content to scan. Even with path traversal protection, the tool could read sensitive workspace files (`.env`, `.git/config`) under the guise of "scanning for security issues".

**Recommendation:**

```typescript
// Restrict scannable file patterns (allowlist approach)
const SCANNABLE_PATTERNS = [
  '.kiro/**/*.json',
  '.kiro/**/*.md',
  'mcp.json',
  '*.config.json',
  '.env.example',  // NOT .env
  'docker-compose*.yml',
  'Dockerfile*',
];

const SCAN_DENYLIST = ['.env', '.env.*', '*.pem', '*.key', '.git/**', 'node_modules/**'];

function validateScanPaths(paths: string[], workspace: string): string[] {
  return paths.filter(p => {
    const resolved = resolveWithinWorkspace(workspace, p);
    if (!resolved) return false;
    if (matchesAny(p, SCAN_DENYLIST)) return false;
    if (!matchesAny(p, SCANNABLE_PATTERNS)) return false;
    return true;
  });
}
```

---

### SEC-09 to SEC-13: Low/Informational Findings

**SEC-09 (Low):** No rate limiting on MCP tool calls. Add per-tool rate limits for write operations (instinct_manage: 30/min, skill_pack_install: 5/min).

**SEC-10 (Low):** KB entry content in logs may contain PII within 200-char truncation. Apply PII masking regex before logging.

**SEC-11 (Low):** Model Tiering external API connections lack documented TLS requirements. Specify TLS 1.2+, certificate verification mandatory, never `rejectUnauthorized: false`.

**SEC-12 (Info):** Council Decision cost amplification — add budget cap (max 1 council per 5 min per project).

**SEC-13 (Info):** Pattern Extraction no debounce on EventBus trigger — add max 1 extraction per 5 seconds.

---

## Positive Security Design Elements ✅

1. **Path traversal protection** — explicitly mentioned for AgentShield paths (Section 7.4)
2. **Input validation** — all tool inputs have constraints (max chars, type checks, range clamping)
3. **Performance-bounded blocking** — GateGuard < 50ms, regex-only (no LLM in hot path)
4. **Feature flags** — gradual rollout allows disabling problematic features
5. **Existing infrastructure** — backend has `apiKeyAuth`, `jwtAuth`, `securityHeaders`, `rateLimiter`, `path-safety.ts`, HTML sanitizer
6. **Append-only audit design intent** (BR-1204)
7. **Parameterized queries** — existing DB layer (confirmed in codebase)
8. **Safe error handling** — `safeError()` utility prevents log injection (CWE-117)
9. **Timing-safe comparison** — apiKeyAuth uses `crypto.timingSafeEqual`

---

## GateGuard — Race Condition Analysis

**Conclusion: Safe** given Node.js single-threaded execution model.

- TOCTOU: Command string passed by reference in same call stack — cannot be modified between check and use
- Concurrent override + evaluate: Override is single-use, consumed atomically
- Denylist update: In-memory Set read atomically in single thread
- Main weakness: Override hash is deterministic (addressed in SEC-01)

---

## AgentShield — "Who Scans the Scanner?" Analysis

**Recommendation:** 
1. Default rules compiled into binary (not filesystem-loaded)
2. Custom rules require explicit admin approval + audit logging
3. AgentShield self-checks rule directory at startup
4. Skill packs CANNOT write to `backend/src/modules/security/rules/`

---

## Skill Packs — Supply Chain Risk Summary

| Vector | Mitigation |
|--------|-----------|
| Prompt injection in steering files | AgentShield SHIELD-003 scan at install time |
| Override existing steering | Sandboxed to `.kiro/steering/packs/{name}/` only |
| Malicious tool configs (exfil) | URL validation + network allowlist |
| Name squatting | Registry verification (defer to v2) |
| GateGuard hook modification | Protected paths — packs cannot modify hooks/ |

---

## Recommendations Prioritized

### Immediate (High — Must Address in TDD)

| # | Finding | Effort |
|---|---------|--------|
| 1 | SEC-01: Add authenticated override to GateGuard | Low |
| 2 | SEC-02: Add checksum + signature to Skill Packs | Medium |
| 3 | SEC-03: Define tool-level RBAC matrix | Low |

### Short-term (Medium — Address During Implementation)

| # | Finding | Effort |
|---|---------|--------|
| 4 | SEC-04: Hash-based rule integrity | Low |
| 5 | SEC-05: RE2 or safe-regex for denylist | Low |
| 6 | SEC-06: HMAC chain for audit | Medium |
| 7 | SEC-07: Strict condition_json schema | Low |
| 8 | SEC-08: Scan path allowlist | Low |

### Long-term (Low/Info)

| # | Finding | Effort |
|---|---------|--------|
| 9 | SEC-09: Per-tool rate limits | Low |
| 10 | SEC-10: PII masking in logs | Medium |
| 11 | SEC-11: TLS requirements docs | Low |
| 12 | SEC-12: Council budget cap | Low |
| 13 | SEC-13: PatternExtractor debounce | Low |

---

## Appendix

### A. Methodology
- Static design review of TDD.md v1.0
- Cross-reference with existing backend security infrastructure
- OWASP Top 10 (2021) + CWE mapping
- Threat modeling for new features (GateGuard, AgentShield, Skill Packs)

### B. Scope Limitations
- Design review only — no implementation exists yet
- Runtime/dynamic testing not possible at this stage
- Extension security sandbox boundaries not analyzed
- Infrastructure (network, container) out of scope
