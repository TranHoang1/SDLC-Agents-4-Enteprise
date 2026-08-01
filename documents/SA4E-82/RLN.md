# Release Notes (RLN)

## SDLC Agents 4 Enterprise — SA4E-82: [Pega MCP] Register 8 Pega tools as hidden local tools (find_tools/execute_dynamic_tool)

---

## Release Information

| Field | Value |
|-------|-------|
| Release Version | 1.19.1 |
| Release Date | 2026-07-31 |
| Jira Ticket | SA4E-82 |
| Environment | DEV / SIT / UAT / PROD |
| Author | DevOps Agent |
| Status | Approved (backfill) |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-31 | DevOps Agent | Backfill release notes — documents release 1.19.1 whose implementation was completed and verified before this document was written |

---

## 1. What's New

### 1.1 Feature Summary

Version 1.19.1 makes the SDLC Agents' **8 Pega tools** available to the AI agent as hidden tools. Instead of cluttering the default tool list, the Pega tools (get rule, query rule, list rules, save rule, checkout rule, run tests, create branch, and session context) are registered as **hidden local tools**:

- The AI can **discover** them on demand via `find_tools`.
- The AI can **invoke** them live against your Pega environment via `execute_dynamic_tool`.
- They stay **out of the default tool list** so the agent's standard view stays clean.

This means your AI assistant can now work directly with Pega rules in your environment (in this release the tools are registered in the extension; full end-to-end visibility through the agent wiring is completed in a follow-up ticket, SA4E-56).

### 1.2 User-Facing Changes

| # | Change | Description | Impact |
|---|--------|-------------|--------|
| 1 | 8 hidden Pega tools | `pega_get_rule`, `pega_query_rule`, `pega_list_rules`, `pega_save_rule`, `pega_checkout_rule`, `pega_run_tests`, `pega_create_branch`, `pega_get_session_context` registered as hidden local tools | Medium |
| 2 | `find_tools` discovery | AI can discover the 8 Pega tools on demand (merged into backend result) | Medium |
| 3 | `execute_dynamic_tool` execution | AI can execute the Pega tools live against Pega (verified: operator SSA@TGB, app HRAppsV2) | Medium |
| 4 | Slimmer `tools/list` | Default tool list stays at 12 (hidden tools excluded) — no clutter | Low |

---

## 2. Technical Changes

### 2.1 API Changes

| Type | Endpoint | Method | Description |
|------|----------|--------|-------------|
| New | MCP `find_tools` (WrapperServer merge) | `tools/call` | Local tool definitions (all 10, including hidden `pega_*`) merged into backend `find_tools` result |
| New | MCP `execute_dynamic_tool` (local branch) | `tools/call` | `pega_*` tool calls routed to local handlers — no backend round-trip |
| Modified | MCP `tools/list` | `tools/list` | Only visible local defs (stream_write_file, embed_image) merged; `pega_*` excluded |
| Modified | MCP `tools/call pega_*` (direct) | `tools/call` | `isLocalTool(name)` checked first — direct calls still execute locally |

### 2.2 Database Changes

| Type | Object | Description |
|------|--------|-------------|
| No change | — | No database migration required for this release |

### 2.3 Configuration Changes

| Property | Change Type | Description |
|----------|-----------|-------------|
| `kiroSdlc.pegaEndpoint` | Unchanged (consumed) | Pega Platform REST endpoint used by `PegaMcpTools` |
| `kiroSdlc.pegaUsername` | Unchanged (consumed) | Pega operator ID |
| `kiroSdlc.pegaDeveloperShortName` | Unchanged (consumed) | Branch naming short name |
| Pega credentials | New wiring | Now read from VS Code `SecretStorage` via `context.secrets` — never passed as tool arguments |

### 2.4 Infrastructure Changes

| Component | Change | Description |
|-----------|--------|-------------|
| VS Code extension | Repackaged | `sdlc-agents-4-enterprise-1.19.1.vsix` (5.03 MB, 979 files) |
| Local tool registry | Refactored | Dynamic OCP-compliant registry (`registerLocalTool`, `isLocalTool`, `getLocalToolDefinitions`, `getVisibleLocalToolDefinitions`, `LocalToolDefinition.hidden`) |

### 2.5 New Files Added

```
extension/src/mcp/pega-local-tools.ts          — 8 Pega tool registration (hidden)
extension/src/__tests__/pega-local-tools.test.ts
extension/src/__tests__/wrapper-server.test.ts
```

### 2.6 Modified Files

```
extension/src/backend-local-tools.ts           — dynamic registry
extension/src/services/WrapperServer.ts        — local-first routing, find_tools merge
extension/src/remote-backend-client.ts         — visible-merge in tools/list, SecretStorage wiring
extension/src/extension.ts                     — passes context.secrets (line ~145)
```

---

## 3. Bug Fixes

No bug fixes included in this release.

---

## 4. Known Issues & Limitations

| # | Issue | Impact | Workaround | Target Fix |
|---|-------|--------|------------|------------|
| 1 | `eslint.config.js` imports `typescript-eslint` which is missing from `devDependencies` (pre-existing) | `npm run lint` fails to resolve the module until installed | `npm i -D typescript-eslint` before linting | Future release |
| 2 | Code-intel MCP server unreachable for KB ingest | KB ingest warning only — document ingestion skipped | Reconnect code-intel MCP server; ingestion is non-blocking | Monitoring / infra |
| 3 | Pega tools fully visible end-to-end only after SA4E-56 wiring | Tools registered and callable; agent wiring for full visibility pending | Use `find_tools` + `execute_dynamic_tool` directly | SA4E-56 |

---

## 5. Dependencies

### 5.1 Pre-requisite Releases

| Release | Version | Status | Required Before |
|---------|---------|--------|-----------------|
| Backend core tools (`find_tools` / `execute_dynamic_tool`) | pre-1.19.1 | Deployed | This release (runtime dependency) |
| SA4E-56 (agent wiring for Pega tools visibility) | — | Pending | Full end-to-end tool visibility |

### 5.2 External System Changes

| System | Change Required | Status | Contact |
|--------|----------------|--------|---------|
| Pega Platform (REST endpoint, operator SSA@TGB, app HRAppsV2) | Reachable from extension host | Verified live | Pega admin |

---

## 6. Migration Notes

### 6.1 Data Migration

| Migration | Description | Automated | Estimated Time |
|-----------|-------------|-----------|----------------|
| None | No data migration | N/A | N/A |

### 6.2 Breaking Changes

No breaking changes in this release. Fully backward compatible. `tools/list` remains at 12 tools; `find_tools`/`execute_dynamic_tool` behavior for `pega_*` reverts to invisible if rolled back.

### 6.3 Backward Compatibility

Fully backward compatible. Existing local tools (`stream_write_file`, `embed_image`) and backend tool flows are unchanged. Direct `tools/call pega_*` continues to work.

---

## 7. Testing Summary

| Test Level | Total | Passed | Failed | Blocked | Pass Rate |
|-----------|-------|--------|--------|---------|-----------|
| Unit Tests (extension) | 589 | 589 | 0 | 0 | 100% |
| Live Pega verification | 1 | 1 | 0 | 0 | 100% |

> Includes new tests: `pega-local-tools.test.ts`, `wrapper-server.test.ts`. Live verification: `execute_dynamic_tool` against Pega operator `SSA@TGB`, app `HRAppsV2` — `tools/list` = 12, `find_tools` = 8 `pega_*`.

### Defect Summary

| Severity | Found | Fixed | Open | Deferred |
|----------|-------|-------|------|----------|
| Critical | 0 | 0 | 0 | 0 |
| Major | 0 | 0 | 0 | 0 |
| Minor | 0 | 0 | 0 | 0 |

---

## 8. Deployment Instructions

See: [Deployment Guide](DPG-v1-SA4E-82.docx)

### Quick Reference

| Step | Action | Estimated Time |
|------|--------|---------------|
| 1 | Install VSIX (`code --install-extension sdlc-agents-4-enterprise-1.19.1.vsix`) | 1 minute |
| 2 | Reload VS Code window | 1 minute |
| 3 | Verify MCP server on port 9181 | 1 minute |
| 4 | Verification checklist (`tools/list`, `find_tools`, `execute_dynamic_tool`) | 5 minutes |
| **Total** | | **8 minutes** |

---

## 9. Rollback Plan

See: [Deployment Guide](DPG-v1-SA4E-82.docx) §8

**Rollback Decision Criteria:**
- Extension fails to activate after install → Immediate rollback
- MCP wrapper server does not start on port 9181 → Immediate rollback
- `tools/list` count regression (hidden flag broken) → Immediate rollback
- Live `execute_dynamic_tool` Pega call fails with unexpected errors → Investigate / rollback

**Estimated Rollback Time:** 8 minutes (reinstall previous VSIX + reload + verify)

---

## 10. Contacts

| Role | Name | Contact | Responsibility |
|------|------|---------|---------------|
| Release Manager | SM Agent | Project channel | Release coordination |
| Dev Lead | DEV Agent | Project channel | Technical issues |
| QA Lead | QA Agent | Project channel | Testing sign-off |
| DevOps | DevOps Agent | Project channel | Deployment execution |
| Business Owner | BA Agent | Project channel | Business sign-off |

---

## 11. Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Dev Lead | | | ☐ Approved |
| QA Lead | | | ☑ Approved (589 tests passed, live Pega verification OK) |
| Business Owner | | | ☐ Approved |
| Release Manager | | | ☐ Approved |
