# Deployment Guide (DPG)

## SDLC-Agents-4-Enterprise — SA4E-186: Agent Runtime Routing — Frontmatter (tools, model), per-agent prompt switching

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-186 |
| Title | Agent Runtime Routing — Frontmatter (tools, model), per-agent prompt switching |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2025-07-14 |
| Status | Final |
| Related TDD | TDD-v1-SA4E-186.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-14 | DevOps Agent | Initial DPG — deployment procedure for v1.31.0 |

---

## Sign-Off

| Name | Role | Signature and date |
|------|------|--------------------|
| | Dev Lead | ☐ Approved for deployment |
| | QA Lead | ☐ Testing completed |
| | Ops Lead | ☐ Infrastructure ready |

---

## 1. Overview

### 1.1 Feature Summary

Agent Runtime Routing transforms agent frontmatter fields (`tools`, `model`) from passive UI metadata into active runtime controls. When a user selects an agent in the chat panel, the system rebuilds the LLM system prompt with only that agent's instructions, restricts tool access to the agent's allowed list, and routes LLM calls to the agent's specified model.

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| VS Code Extension (VSIX) | Modified | New modules: AgentConfigResolver, ToolFilter; modified: chat-graph, chat-graph-nodes, LangGraphEngine, message-protocol |
| Backend (npm package) | Unchanged | No backend changes required for this feature |
| Database | None | No database migrations — feature is stateless (in-memory config) |
| Configuration | None | No new environment variables — uses existing agent frontmatter files |

### 1.3 Target Environments

| Environment | Deployment Method | Deploy Order | Approval Required |
|-------------|-------------------|-------------|-------------------|
| Developer Local | `kiro --install-extension` | 1st | No |
| Team / CI | Extension marketplace or VSIX sideload | 2nd | Dev Lead sign-off |
| Production (all users) | Marketplace publish | 3rd | PM + QA Sign-off |

---

## 2. Prerequisites

### 2.1 Infrastructure

| Requirement | Status | Notes |
|-------------|--------|-------|
| VS Code 1.85+ or compatible IDE | Ready | Extension API dependency |
| Node.js 18+ | Ready | Required for extension host and backend |
| Git access to main branch | Ready | Merged via PR |

### 2.2 Software Dependencies

| Dependency | Version | Status |
|-----------|---------|--------|
| VS Code / Kiro IDE | 1.85+ | Required |
| Node.js | 18.x+ | Required for `npx` backend commands |
| LangGraph (bundled) | 0.0.x | Bundled in extension — no separate install |
| MCP SDK (bundled) | latest | Bundled in extension |

### 2.3 Access Requirements

| Access | Type | Who Needs It |
|--------|------|-------------|
| npm registry (publish) | Token-based auth | DevOps / CI pipeline |
| VS Code marketplace (if applicable) | Publisher credentials | DevOps |
| Git repository (main branch) | Write access | Dev Lead (merge approval) |

### 2.4 Backup Requirements

- [ ] Previous VSIX version archived (v1.30.x artifact saved)
- [ ] Previous npm package version available on registry (rollback target)
- [ ] Agent frontmatter files unchanged (feature reads existing files — no data migration)

---

## 3. Pre-Deployment Checklist

| # | Item | Responsible | Status |
|---|------|-------------|--------|
| 1 | Code merged to `main` branch | Developer | ☑ Done |
| 2 | All unit tests passed (Vitest) | Developer | ☑ Done |
| 3 | All integration tests passed | QA | ☑ Done |
| 4 | Security Code Review completed | Security Agent | ☑ Done |
| 5 | UAT sign-off obtained | User/PO | ☑ Done |
| 6 | Previous VSIX version archived | DevOps | ☐ |
| 7 | Version bumped to 1.31.0 in package.json | DevOps | ☑ Done |
| 8 | CHANGELOG updated | DevOps | ☐ |
| 9 | Rollback plan reviewed | Team | ☐ |
| 10 | No feature flags required (fallback mode = off-state) | Developer | ☑ N/A |

---

## 4. Database Migration

**Not applicable.** This feature is entirely in-memory and stateless. No database tables, columns, or migrations are involved.

---

## 5. Application Deployment

### 5.1 Deployment Flow

```
┌─────────────┐    ┌──────────────┐    ┌───────────────┐    ┌──────────────┐
│ Build VSIX  │───>│ Run Tests    │───>│ Package v1.31 │───>│ Install/Push │
└─────────────┘    └──────────────┘    └───────────────┘    └──────────────┘
                                                                    │
                                              ┌─────────────────────┼──────────────┐
                                              │                     │              │
                                              v                     v              v
                                       ┌────────────┐    ┌───────────────┐  ┌──────────┐
                                       │ Local Dev  │    │ Team Sideload │  │Marketplace│
                                       │ (install)  │    │ (manual VSIX) │  │ (publish) │
                                       └────────────┘    └───────────────┘  └──────────┘
```

### 5.2 Build & Package Steps

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Install dependencies | `npm ci` (root + extension/) | Exit code 0, no audit critical |
| 2 | Build extension | `npm run build` in `extension/` | `dist/` directory populated |
| 3 | Run unit tests | `npm run test` in `extension/` | All tests pass (Vitest) |
| 4 | Package VSIX | `npx vsce package --no-dependencies` in `extension/` | `.vsix` file generated, size reasonable (~5-15MB) |
| 5 | Verify version | Check `extension/package.json` version = `1.31.0` | Version matches |

### 5.3 Extension Deployment — Local Install

```powershell
# Step 1: Install the new VSIX
kiro --install-extension path/to/sdlc-agents-4-enterprise-1.31.0.vsix

# Step 2: Reload window
# VS Code: Ctrl+Shift+P → "Developer: Reload Window"

# Step 3: Verify extension loaded
# Check Extensions panel → "SDLC Agents 4 Enterprise" → v1.31.0
```

### 5.4 Backend Deployment (npm package — if applicable)

```powershell
# Backend has no changes for SA4E-186, but if deploying alongside:
npx sdlc-agent-4-enterprise-server

# Verify backend running
# Check: http://127.0.0.1:48721/mcp responds to initialize
```

### 5.5 Verification After Install

```powershell
# 1. Extension activated
# Open Output panel → "SDLC Agents" channel → confirm "Extension activated"

# 2. Agent registry loaded
# Open Chat Panel → Agent selector shows available agents

# 3. Agent selection working
# Select an agent → observe system prompt change in debug logs
```

---

## 6. Configuration Changes

### 6.1 New Environment Variables

**None.** This feature requires no new environment variables.

### 6.2 Application Properties Changes

**None.** Agent configuration is read from existing `.kiro/agents/*.md` frontmatter files.

### 6.3 Feature Flags

| Flag | Value | Description |
|------|-------|-------------|
| N/A | — | No feature flag needed. Fallback mode (no agent selected) IS the off-state. Existing behavior preserved. |

### 6.4 Agent Frontmatter (Optional Configuration)

Users can optionally add `tools` and `model` fields to their agent `.md` files:

```yaml
---
id: code-reviewer
name: Code Reviewer
tools:
  - code_search
  - code_symbols
  - grep_search
  - read_file
model: claude-sonnet-4-20250514
---
```

- **If `tools` field absent** → all tools remain available (no restriction)
- **If `model` field absent** → default model from settings is used
- **No changes required** to existing agent files for backward compatibility

---

## 7. Post-Deployment Verification

### 7.1 Health Checks

| Check | Method | Expected Result | Timeout |
|-------|--------|-----------------|---------|
| Extension loaded | Extensions panel | v1.31.0 visible, enabled | 10s |
| Agent registry populated | Chat Panel agent selector | Shows discovered agents | 5s |
| Chat functional | Send test message | LLM responds normally | 30s |

### 7.2 Smoke Tests

| # | Scenario | Steps | Expected Result |
|---|----------|-------|-----------------|
| 1 | Agent selection | Open Chat → Select agent from dropdown | AGENT_SWITCHED confirmation, agent name shown |
| 2 | Tool restriction | Select agent with `tools: [mem_search]` → ask LLM to use `grep_search` | Tool blocked, error returned to LLM |
| 3 | Model routing | Select agent with `model: claude-sonnet-4-20250514` → send message | LLM call uses specified model (check debug logs) |
| 4 | Prompt isolation | Select agent → send message | System prompt contains ONLY selected agent body (verify in debug) |
| 5 | Fallback mode | Deselect agent (set to null) → send message | All agents concatenated, all tools available |
| 6 | Mid-session switch | Chat with agent A → switch to agent B → send message | Agent B prompt used, history preserved |

### 7.3 Log Verification

| Log Entry | Level | Expected | Location |
|-----------|-------|----------|----------|
| `[AgentConfigResolver] Agent selected` | DEBUG | On agent selection | Output → SDLC Agents |
| `[ToolFilter] Tool blocked` | DEBUG | When restricted tool called | Output → SDLC Agents |
| `Model override applied` | DEBUG | When model routing active | Output → SDLC Agents |

### 7.4 Regression Check

- [ ] Chat without agent selected works identically to v1.30.x
- [ ] All existing agents continue to load and display correctly
- [ ] Steering files still included in system prompt
- [ ] MCP tool discovery still functions normally
- [ ] No increase in extension activation time (< 100ms delta)

---

## 8. Rollback Plan

### 8.1 Rollback Decision Criteria

| Condition | Action |
|-----------|--------|
| Extension fails to activate after install | Immediate rollback |
| Agent selection crashes extension host | Immediate rollback |
| LLM calls fail when agent is selected | Immediate rollback |
| Tool filtering blocks ALL tools (even unrestricted agents) | Immediate rollback |
| Minor UI glitch in agent selector | Hotfix — no rollback |
| Performance degradation on agent switch > 500ms | Investigate, rollback if persists |

### 8.2 Rollback Steps

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Uninstall current extension | `kiro --uninstall-extension sdlc-agents-4-enterprise` | Extension removed from list |
| 2 | Install previous version | `kiro --install-extension sdlc-agents-4-enterprise-1.30.x.vsix` | v1.30.x shows in Extensions panel |
| 3 | Reload window | `Ctrl+Shift+P` → "Developer: Reload Window" | Extension reactivated |
| 4 | Verify rollback | Open Chat → send message → confirm normal behavior | LLM responds, all tools available |
| 5 | (If npm published) Deprecate 1.31.0 | `npm deprecate sdlc-agents-4-enterprise@1.31.0 "rollback"` | Package marked deprecated |

### 8.3 Rollback Safety

- **Agent frontmatter fields (`tools`, `model`) are inert without runtime routing code.** Rolling back the extension leaves frontmatter unchanged but non-functional — no cleanup needed.
- **No database state to revert.** Feature is fully stateless.
- **Conversation history unaffected.** Messages stored in VS Code's chat state are format-compatible.

### 8.4 Rollback Time Estimate

| Action | Estimated Time |
|--------|---------------|
| Uninstall extension | 10 seconds |
| Install previous VSIX | 15 seconds |
| Reload and verify | 30 seconds |
| **Total** | **< 1 minute** |

---

## 9. Environment-Specific Notes

### 9.1 Developer Local

- Install via `kiro --install-extension` with the `.vsix` file
- Agent frontmatter files should already exist in `.kiro/agents/` directory
- Enable debug logging for detailed trace: VS Code settings → `kiroSdlc.logLevel: debug`

### 9.2 CI/CD Pipeline

- VSIX build automated in CI (GitHub Actions / Jenkins)
- Test step runs `npm test` in `extension/` before packaging
- Artifact: `.vsix` file uploaded to release assets

### 9.3 Production (All Users)

- **Deployment Window:** No maintenance window needed — extension update is non-disruptive
- **Communication Plan:** Release notes published alongside VSIX
- **Backward Compatibility:** 100% — agents without `tools`/`model` fields work exactly as before

---

## 10. Appendix

### Contacts

| Role | Name | Contact |
|------|------|---------|
| Dev Lead | Extension Team | Internal |
| QA Lead | QA Agent | Internal |
| DevOps | DevOps Agent | Internal |

### Related Tickets

| Ticket | Summary | Relationship |
|--------|---------|-------------|
| SA4E-186 | Agent Runtime Routing — Frontmatter (tools, model), per-agent prompt switching | Main ticket |
| SA4E-85 | KiroAgentRegistry — Agent discovery and hot-reload | Dependency (completed) |
| KSA-210 | LLM Provider Abstraction | Dependency (completed) |

### Files Changed (Key)

| File | Change Type |
|------|-------------|
| `extension/src/langgraph/agents/agent-config-resolver.ts` | NEW |
| `extension/src/langgraph/agents/tool-filter.ts` | NEW |
| `extension/src/langgraph/subgraphs/chat-graph.ts` | MODIFIED |
| `extension/src/langgraph/subgraphs/chat-graph-nodes.ts` | MODIFIED |
| `extension/src/langgraph/engine/langgraph-engine.ts` | MODIFIED |
| `extension/src/chat-panel/message-protocol.ts` | MODIFIED |
| `extension/src/chat-panel/message-handler.ts` | MODIFIED |
| `extension/src/chat/engine/ChatEngineAdapter.ts` | MODIFIED |
| `extension/src/webview/stores/agentStore.ts` | MODIFIED |
| `extension/src/chat/types/messages.ts` | MODIFIED |
