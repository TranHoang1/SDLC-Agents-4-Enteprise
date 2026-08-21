# Security Design Review — SA4E-186

## Document Information

| Field | Value |
|-------|-------|
| Ticket | SA4E-186 |
| Feature | Agent Runtime Routing — Frontmatter (tools, model), per-agent prompt switching |
| Reviewer | Security Agent |
| Date | 2025-01-27 |
| TDD Version | 1.0 |
| Overall Risk | **Low** |

---

## Executive Summary

SA4E-186 introduces per-agent runtime routing within the VS Code Extension Host — a local, single-process environment with no network-facing API surface. The design is architecturally sound from a security perspective. Tool filtering uses a dual-layer enforcement (filter at `agent_step` + validate at `execute_tools`), agent config is resolved from trusted local disk files, and the `postMessage` protocol operates within VS Code's sandboxed webview boundary.

No Critical or High severity findings. The design follows defense-in-depth principles with code-level enforcement that cannot be bypassed by LLM prompt manipulation. Minor improvements identified relate to input validation hardening and information disclosure in error messages.

---

## Findings Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 0 |
| 🟡 Medium | 2 |
| 🔵 Low | 3 |
| ℹ️ Informational | 2 |

---

## Detailed Findings

### Finding #1: Synchronous File Read Without Path Validation

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟡 Medium |
| **Category** | Input Validation |
| **CWE** | CWE-22: Path Traversal |
| **Location** | `extension/src/langgraph/agents/agent-config-resolver.ts:readAgentBody()` |
| **Status** | Open |

**Description:**
`AgentConfigResolver.readAgentBody(filePath)` reads the file path directly from `AgentMeta.filePath` without canonicalization or validation that the path resides within the workspace. While `AgentMeta` is populated by the trusted `KiroAgentRegistry` (which only discovers files from `.kiro/agents/`), a programming error in the registry or a future refactor could allow arbitrary file reads.

**Evidence:**
```typescript
private readAgentBody(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return content.replace(/^---[\s\S]*?---\r?\n?/, "").trim();
  } catch (err) {
    console.warn(`[AgentConfigResolver] Cannot read agent file: ${(err as Error).message}`);
    return "";
  }
}
```

**Impact:**
Low in current context — the Extension Host already runs with user's full file system permissions. However, if agent body content is ever leaked to external services (LLM API), reading an arbitrary file could expose secrets.

**Remediation:**
```typescript
private readAgentBody(filePath: string): string {
  try {
    // Validate path is within workspace agents directory
    const resolved = path.resolve(filePath);
    const agentsDir = path.resolve(this.workspaceRoot, ".kiro", "agents");
    if (!resolved.startsWith(agentsDir)) {
      console.warn(`[AgentConfigResolver] Path outside agents dir: ${resolved}`);
      return "";
    }
    const content = fs.readFileSync(resolved, "utf-8");
    return content.replace(/^---[\s\S]*?---\r?\n?/, "").trim();
  } catch (err) {
    console.warn(`[AgentConfigResolver] Cannot read agent file: ${(err as Error).message}`);
    return "";
  }
}
```

---

### Finding #2: Tool Blocked Message Leaks Pattern Information

| Attribute | Value |
|-----------|-------|
| **Severity** | 🟡 Medium |
| **Category** | Information Disclosure |
| **CWE** | CWE-200: Exposure of Sensitive Information |
| **Location** | `extension/src/langgraph/agents/tool-filter.ts:buildToolBlockedMessage()` |
| **Status** | Open |

**Description:**
When a tool call is blocked, the error message returned to the LLM scratchpad includes the full list of allowed tool patterns. This information is fed back to the LLM, which could use it to craft subsequent calls targeting only allowed tools. While this is intentional for helping the LLM recover, it also means the agent's tool restriction policy is fully disclosed to the model.

**Evidence:**
```typescript
export function buildToolBlockedMessage(
  toolName: string, agentId: string, patterns: string[]
): string {
  const display = patterns.length > 5
    ? patterns.slice(0, 5).join(", ") + ` ... (${patterns.length} total)`
    : patterns.join(", ");
  return `Tool '${toolName}' is not available for agent '${agentId}'. Allowed tools: [${display}]`;
}
```

**Impact:**
Low practical impact — the LLM already receives the filtered tool list in the tools parameter. However, in edge cases where the tool filter logic changes mid-execution (race condition on agent switch), this message could reveal stale policy information.

**Remediation:**
Consider simplifying to avoid exposing the full pattern list:
```typescript
export function buildToolBlockedMessage(
  toolName: string, agentId: string, patterns: string[]
): string {
  return `Tool '${toolName}' is not permitted for the active agent '${agentId}'. Use only the tools provided in the available tools list.`;
}
```

---

### Finding #3: No `agentId` Input Sanitization at Message Protocol Boundary

| Attribute | Value |
|-----------|-------|
| **Severity** | 🔵 Low |
| **Category** | Input Validation |
| **CWE** | CWE-20: Improper Input Validation |
| **Location** | `extension/src/chat-panel/message-protocol.ts` — `chat:selectAgent` |
| **Status** | Open |

**Description:**
The `chat:selectAgent` message accepts `agentId: string | null` without length/format validation. While the resolver safely handles unknown IDs (returns fallback), extremely long strings or strings with special characters pass through to `console.warn()` logging and the registry lookup.

**Evidence:**
```typescript
| { type: "chat:selectAgent"; agentId: string | null }
```

**Impact:**
Minimal — the webview is a trusted context within VS Code, and the resolver's registry lookup will simply return `undefined` for invalid IDs. No injection vector exists since the ID is used only as a map key lookup.

**Remediation:**
Add a basic length guard at the handler level:
```typescript
case "chat:selectAgent":
  const id = msg.agentId;
  if (id !== null && (typeof id !== "string" || id.length > 128)) break;
  this.getEngine().selectAgent(id);
  break;
```

---

### Finding #4: Model String Passed Verbatim to LLM Provider

| Attribute | Value |
|-----------|-------|
| **Severity** | 🔵 Low |
| **Category** | Input Validation |
| **CWE** | CWE-20: Improper Input Validation |
| **Location** | `chat-graph-nodes.ts:createAgentStepNode()` — model routing |
| **Status** | Open |

**Description:**
The `model` field from agent frontmatter is passed verbatim to the LLM provider without validation against a known-good list. A typo or malicious value in an agent file could cause unexpected API calls.

**Evidence:**
```typescript
const llmOptions = agentConfig?.model ? { model: agentConfig.model } : undefined;
// ... later:
const chatOptions = { maxTokens: 8192, ...(llmOptions?.model ? { model: llmOptions.model } : {}) };
```

**Impact:**
Low — agent files are authored by the workspace owner (trusted source). The LLM provider will reject unknown models with a standard API error. No financial impact beyond a failed request (most providers validate model names server-side).

**Remediation (defense-in-depth):**
Log a warning for model values not in a known set:
```typescript
const KNOWN_MODELS = new Set(["claude-sonnet", "claude-haiku", "gpt-4o", ...]);
if (activeConfig?.model && !KNOWN_MODELS.has(activeConfig.model)) {
  debugLog(`[agent_step] Unrecognized model '${activeConfig.model}', passing to provider`);
}
```

---

### Finding #5: No Rate Limiting on Agent Switch Operations

| Attribute | Value |
|-----------|-------|
| **Severity** | 🔵 Low |
| **Category** | Denial of Service |
| **CWE** | CWE-400: Uncontrolled Resource Consumption |
| **Location** | `langgraph-engine.ts:selectAgent()` |
| **Status** | Open |

**Description:**
The TDD mentions a 50ms debounce at the webview level, but the engine's `selectAgent()` has no server-side rate limit. Rapid programmatic calls (e.g., from a rogue extension) could trigger repeated synchronous file reads.

**Impact:**
Negligible — `fs.readFileSync` on a <10KB local file is <1ms. Even thousands of rapid calls would not cause meaningful performance degradation. The single-threaded Extension Host naturally serializes these calls.

**Remediation:**
No code change needed. Document in TDD that webview-level debounce is the mitigation. If a future API exposes this externally, add throttling.

---

### Finding #6: Agent Prompt Injection via Frontmatter Body (Informational)

| Attribute | Value |
|-----------|-------|
| **Severity** | ℹ️ Informational |
| **Category** | Prompt Injection |
| **CWE** | CWE-77: Command Injection |
| **Location** | `agent-config-resolver.ts:readAgentBody()` → `chat-graph.ts:buildFinalSystemPrompt()` |
| **Status** | Accepted Risk |

**Description:**
The agent markdown body (after frontmatter strip) is injected directly into the system prompt. A malicious agent file could contain instructions that override safety guardrails. However, since agent files are authored by the workspace owner and stored in `.kiro/agents/`, this is equivalent to the owner writing their own system prompt — expected and correct behavior.

**Assessment:**
This is NOT a vulnerability — it is the intended feature (per-agent prompt switching). The trust boundary is appropriate: workspace owner = prompt author = user.

**Mitigating factors:**
- Agent files are local, version-controlled, and human-readable
- No external/untrusted source can inject agent files
- The tool filter is code-level enforcement, independent of prompt content
- LLM cannot modify agent files (no write access to `.kiro/agents/`)

---

### Finding #7: TOCTOU Window During Agent Switch (Informational)

| Attribute | Value |
|-----------|-------|
| **Severity** | ℹ️ Informational |
| **Category** | Race Condition |
| **CWE** | CWE-367: Time-of-Check Time-of-Use |
| **Location** | `agent-config-resolver.ts` — config resolved at select time, used at invoke time |
| **Status** | Accepted Risk |

**Description:**
Agent config is resolved once at `selectAgent()` and used for all subsequent graph invocations until the next `selectAgent()` call. If the agent file on disk changes between selection and invocation, the in-memory config will be stale.

**Assessment:**
The TDD explicitly acknowledges this (Section 4.4: "In-flight calls complete with config read at invocation start; no mid-call revocation"). This is a deliberate design decision — not a vulnerability. Hot-reload is documented as a future enhancement.

**Mitigating factors:**
- Stale config means slightly outdated tool patterns — no security escalation
- Tool filter uses the config that was valid at the time of selection
- Re-selecting the same agent refreshes the config

---

## Security Design Assessment

### 1. Authentication/Authorization Design ✅

| Aspect | Assessment |
|--------|------------|
| Per-agent config access control | **Adequate** — Config resolved from trusted local files only |
| SELECT_AGENT authorization | **Adequate** — VS Code webview boundary is the auth perimeter |
| Tool restriction enforcement | **Strong** — Dual-layer (filter + enforce), code-level, cannot be prompt-bypassed |
| Privilege escalation prevention | **Strong** — Agent cannot add tools; patterns read from disk, not from LLM |

### 2. Data Protection ✅

| Data Type | Protection | Assessment |
|-----------|------------|------------|
| Agent frontmatter | Local disk (git-versioned) | **Adequate** |
| System prompt content | In-memory, transmitted TLS to LLM API | **Adequate** |
| Tool call arguments | In-memory, TLS to MCP server | **Adequate** |
| LLM API keys | VS Code SecretStorage (encrypted) | **Strong** |

### 3. API Security / Tool Filtering ✅

| Mechanism | Assessment |
|-----------|------------|
| Filter at `agent_step` (LLM never sees blocked tools) | **Strong** — primary defense |
| Enforce at `execute_tools` (safety net) | **Strong** — defense-in-depth |
| Pattern matching (exact + prefix wildcard) | **Adequate** — simple, auditable |
| Text-only mode (`tools: []`) | **Correctly implemented** |

### 4. Dependency Risks ✅

No new dependencies introduced by SA4E-186. Existing dependencies used:
- `fs` (Node.js built-in) — file read
- No new npm packages added

### 5. Injection Risks ✅

| Vector | Mitigation | Assessment |
|--------|------------|------------|
| LLM prompt injection to bypass tool filter | Code-level enforcement (TypeScript), not prompt-level | **Immune** |
| Malicious agent file content | Trusted source (workspace owner) | **Accepted risk** |
| agentId injection via postMessage | Registry lookup rejects unknown IDs | **Adequate** |

---

## Recommendations Summary

### Short-term (Medium findings)

1. **Add path validation** in `readAgentBody()` — ensure file is within `.kiro/agents/` directory
2. **Simplify tool blocked message** — avoid disclosing full pattern list to LLM scratchpad

### Long-term (Hardening)

3. Add basic `agentId` length validation at message handler boundary
4. Consider logging unknown model identifiers for debugging
5. Document webview debounce as the rate-limiting mechanism

---

## Verdict

**✅ PASS — No Critical or High findings. Design is secure for intended use case.**

The per-agent routing architecture correctly identifies and maintains trust boundaries:
- Workspace owner ↔ Agent files (trusted authorship)
- Extension Host ↔ Webview (VS Code sandbox boundary)
- Code-level enforcement ↔ LLM behavior (tool filter cannot be prompt-manipulated)

The feature can proceed to Phase 4 (Test Planning) without blocking security issues.
