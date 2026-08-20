# Release Notes (RLN)

## SDLC-Agents-4-Enterprise — SA4E-186: Agent Runtime Routing — Frontmatter (tools, model), per-agent prompt switching

---

## Release Information

| Field | Value |
|-------|-------|
| Release Version | 1.31.0 |
| Release Date | 2025-07-14 |
| Jira Ticket | SA4E-186 |
| Environment | All (Local / CI / Production) |
| Author | DevOps Agent |
| Status | Final |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-14 | DevOps Agent | Initial release notes for v1.31.0 |

---

## 1. What's New

### 1.1 Feature Summary

**Agent Runtime Routing** makes agent selection meaningful. Previously, selecting an agent in the chat panel was purely cosmetic — the LLM still received all agents' instructions concatenated together and had access to every tool. With v1.31.0, selecting an agent now:

- **Isolates the system prompt** — only the selected agent's instructions are sent to the LLM
- **Restricts tool access** — agents can only call tools listed in their `tools` frontmatter field
- **Routes to a specific model** — agents can specify which LLM model to use via the `model` frontmatter field

This enables focused, purpose-built agents with controlled capabilities — code reviewers that only see code tools, documentation agents that use cheaper models, security agents with restricted access scopes.

### 1.2 User-Facing Changes

| # | Change | Description | Impact |
|---|--------|-------------|--------|
| 1 | Agent selection activates runtime behavior | Selecting an agent now changes LLM prompt, available tools, and model | High |
| 2 | Tool restriction enforcement | Agents with `tools: [...]` can only invoke listed tools | Medium |
| 3 | Model routing per agent | Agents with `model: <id>` route LLM calls to that specific model | Medium |
| 4 | Prompt isolation | System prompt reduces to single agent's instructions when selected | High |
| 5 | Fallback mode preserved | Deselecting any agent returns to all-agents-concatenated behavior | Low |
| 6 | Mid-session agent switching | Switch agents anytime — history preserved, prompt changes immediately | Medium |

### 1.3 Example: Agent Frontmatter Configuration

```yaml
---
id: code-reviewer
name: Code Reviewer
description: Reviews code for quality and best practices
tools:
  - code_search
  - code_symbols
  - grep_search
  - read_file
model: claude-sonnet-4-20250514
---
```

- `tools` — Array of allowed tool names. Supports wildcards: `code_*` matches all tools starting with `code_`.
- `model` — LLM model identifier passed to the provider.
- Both fields are optional — agents without them behave as before.

---

## 2. Technical Changes

### 2.1 New Components

| Component | File | Description |
|-----------|------|-------------|
| AgentConfigResolver | `agents/agent-config-resolver.ts` | Resolves runtime config (prompt body, tool patterns, model) from selected agent's frontmatter |
| ToolFilter | `agents/tool-filter.ts` | Pure functions for pattern-matching tool names against allowed list |

### 2.2 Message Protocol Changes

| Type | Message | Direction | Description |
|------|---------|-----------|-------------|
| New | `chat:selectAgent` | Webview → Extension Host | Dispatches agent selection with `agentId` |
| New | `chat:agentSwitched` | Extension Host → Webview | Confirmation with active `agentId` and `agentName` |

### 2.3 Modified Components

| Component | File | Change |
|-----------|------|--------|
| chat-graph.ts | `subgraphs/chat-graph.ts` | Dynamic prompt assembly via closure (per-agent vs fallback) |
| chat-graph-nodes.ts | `subgraphs/chat-graph-nodes.ts` | Tool filtering at agent_step, enforcement at execute_tools |
| LangGraphEngine | `engine/langgraph-engine.ts` | Exposes `selectAgent()`, holds AgentConfigResolver instance |
| message-protocol.ts | `chat-panel/message-protocol.ts` | New message types added to union |
| message-handler.ts | `chat-panel/message-handler.ts` | SELECT_AGENT case handler |
| ChatEngineAdapter | `chat/engine/ChatEngineAdapter.ts` | SELECT_AGENT routing to resolver |
| agentStore.ts | `webview/stores/agentStore.ts` | postMessage dispatch on selection |
| AgentMeta | `chat/types/messages.ts` | Added `model?: string` field |

### 2.4 Database Changes

**None.** Feature is entirely in-memory and stateless.

### 2.5 Configuration Changes

**None.** Feature reads from existing agent frontmatter files (`.kiro/agents/*.md`). No new environment variables or settings required.

### 2.6 Infrastructure Changes

**None.** All changes are within the VS Code Extension Host process. No new services, containers, or external systems.

---

## 3. Bug Fixes

No bug fixes included in this release. This is a feature-only release.

---

## 4. Known Issues & Limitations

| # | Issue | Impact | Workaround | Target Fix |
|---|-------|--------|------------|------------|
| 1 | Agent file not hot-reloaded after edit | User must re-select agent to pick up frontmatter changes | Deselect and re-select the agent | Future enhancement |
| 2 | Model validation is provider-side only | Invalid model string surfaces as a stream error | Use correct model identifiers from provider docs | By design |
| 3 | Wildcard only supports suffix (`code_*`) | Cannot do prefix-wildcard (`*_search`) | Use explicit names for non-prefix patterns | Future if needed |
| 4 | Session-scoped only | Agent selection resets on window reload | Re-select after reload | Future persistence enhancement |

---

## 5. Dependencies

### 5.1 Pre-requisite Releases

| Release | Version | Status | Required Before |
|---------|---------|--------|-----------------|
| SA4E-85 (KiroAgentRegistry) | Included in 1.28.0+ | Deployed | This release |
| KSA-210 (LLM Provider Abstraction) | Included in 1.25.0+ | Deployed | This release |

### 5.2 External System Changes

**None.** No external systems require changes for this feature.

---

## 6. Migration Notes

### 6.1 Data Migration

**None.** No data migration required.

### 6.2 Breaking Changes

No breaking changes in this release. Fully backward compatible.

- Agents without `tools` field → all tools available (unchanged behavior)
- Agents without `model` field → default model used (unchanged behavior)
- No agent selected → all agents concatenated (unchanged behavior)

### 6.3 Backward Compatibility

**Fully compatible.** The feature is purely additive:
- Existing agent files work without modification
- Users who don't use agent selection see no change
- The compiled LangGraph graph topology is unchanged (dynamic config via closure)

---

## 7. Testing Summary

| Test Level | Total | Passed | Failed | Blocked | Pass Rate |
|-----------|-------|--------|--------|---------|-----------|
| Unit Tests (ToolFilter, AgentConfigResolver) | 18 | 18 | 0 | 0 | 100% |
| Integration Tests (agent routing E2E) | 8 | 8 | 0 | 0 | 100% |
| Security Code Review | 1 | 1 | 0 | 0 | PASS |
| UAT | 6 scenarios | 6 | 0 | 0 | 100% |

### Defect Summary

| Severity | Found | Fixed | Open | Deferred |
|----------|-------|-------|------|----------|
| Critical | 0 | 0 | 0 | 0 |
| Major | 0 | 0 | 0 | 0 |
| Minor | 0 | 0 | 0 | 0 |

---

## 8. Deployment Instructions

See: [Deployment Guide](DPG-v1-SA4E-186.docx)

### Quick Reference

| Step | Action | Estimated Time |
|------|--------|---------------|
| 1 | Build extension (`npm run build`) | 30s |
| 2 | Package VSIX (`npx vsce package`) | 15s |
| 3 | Install (`kiro --install-extension`) | 10s |
| 4 | Reload window | 5s |
| 5 | Verify (agent selection smoke test) | 60s |
| **Total** | | **~2 minutes** |

---

## 9. Rollback Plan

**Rollback Decision Criteria:**
- Extension fails to activate
- Agent selection crashes the extension host
- LLM calls fail when any agent is selected
- Tool filtering blocks tools on unrestricted agents

**Rollback Procedure:**
1. Uninstall: `kiro --uninstall-extension sdlc-agents-4-enterprise`
2. Install previous: `kiro --install-extension sdlc-agents-4-enterprise-1.30.x.vsix`
3. Reload window

**Estimated Rollback Time:** < 1 minute

**Rollback Safety:** Agent frontmatter `tools`/`model` fields become inert (ignored) after rollback. No cleanup needed.

---

## 10. Contacts

| Role | Name | Contact | Responsibility |
|------|------|---------|---------------|
| Dev Lead | Extension Team | Internal | Technical issues |
| QA Lead | QA Agent | Internal | Testing sign-off |
| DevOps | DevOps Agent | Internal | Deployment execution |
| SA | SA Agent | Internal | Architecture decisions |

---

## 11. Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Dev Lead | | | ☐ Approved |
| QA Lead | | | ☐ Approved |
| Release Manager | | | ☐ Approved |
