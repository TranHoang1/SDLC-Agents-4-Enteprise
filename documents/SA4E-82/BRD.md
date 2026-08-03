# Business Requirements Document (BRD)

## SDLC Agents 4 Enterprise — SA4E-82: [Pega MCP] Register 8 Pega tools as hidden local tools (find_tools/execute_dynamic_tool)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-82 |
| Title | [Pega MCP] Register 8 Pega tools as hidden local tools (find_tools/execute_dynamic_tool) |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-07-31 |
| Status | Approved (backfill) |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | SA Agent – Solution Architect | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-31 | BA Agent | Initiate document — backfill from Jira ticket SA4E-82 (requirement already implemented and verified in extension) |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

SA4E-82 exposes the **8 Pega MCP tools** to LLM agents in the SDLC pipeline. The tool implementations already exist in the VS Code extension (`extension/src/mcp/PegaMcpTools.ts`, delivered by parent ticket SA4E-56) but were never wired into any MCP server — making them invisible to `tools/list`, `find_tools`, and `execute_dynamic_tool`.

The scope of this change (extension side — VS Code extension, TypeScript orchestration) is:

- **Register the 8 Pega tools as hidden local tools**: `pega_get_session_context`, `pega_get_rule`, `pega_query_rule`, `pega_list_rules`, `pega_save_rule`, `pega_checkout_rule`, `pega_run_tests`, `pega_create_branch`.
- **Hidden from `tools/list`**: the 8 Pega tools must NOT clutter the default LLM tool list. `tools/list` on the local MCP wrapper server (port 9181) must continue to show only the **12 visible tools**.
- **Discoverable via `find_tools`**: the hidden tools must be merged into `find_tools` responses so LLM agents can discover them on demand (verified live: **60 total tools** returned).
- **Executable via `execute_dynamic_tool`**: the hidden tools must be routable through the local tool registry and execute against the real Pega server.
- **Open/Closed Principle (OCP)**: new Pega tools are exposed by adding an entry to the `PEGA_TOOL_SPECS` mapping table and calling `registerPegaLocalTools()` — no switch/case modification in the routing layer.

### 1.2 Out of Scope

- **No new Pega tool implementations** — the 8 handlers in `PegaMcpTools.ts` are unchanged (delivered by SA4E-56).
- **No backend server changes** — Pega tools execute locally in the extension via `LOCAL_TOOL_REGISTRY`; the remote backend (port 48721) is not involved in local tool execution.
- **No change to the `tools/list` contract** — the visible tool list remains 12 tools; hidden tools are never promoted to visible.
- **No Pega Platform server-side changes** — the extension connects to an existing Pega Platform instance.

### 1.3 Preliminary Requirement

- **SA4E-56 (parent)** delivered: `PegaMcpTools.ts` with the 8 Pega tool handlers, plus `PegaHttpClient` and `PegaRuleSetResolverService` used for rule save/checkout/branch context resolution.
- **Local tool registry** (`extension/src/backend-local-tools.ts`) supporting the `hidden?: boolean` flag on `LocalToolDefinition`.
- **WrapperServer** (`extension/src/services/WrapperServer.ts`) listening on port 9181, capable of merging local tool definitions into `find_tools` responses and routing `execute_dynamic_tool` to local handlers.
- **A reachable Pega Platform instance** with operator credentials for live execution verification.

---

## 2. Business Requirements

### 2.1 High Level Process Map

The Pega integration is made available to the LLM through the extension's local MCP wrapper server:

1. **Startup**: The extension starts `WrapperServer` on port 9181 and calls `registerPegaLocalTools()`, registering all 8 Pega tools into the `LOCAL_TOOL_REGISTRY` with `hidden: true`.
2. **Discovery**: The LLM agent queries `tools/list` → receives only the **12 visible tools** (hidden Pega tools filtered out via `getVisibleLocalToolDefinitions()`).
3. **On-demand discovery**: The LLM agent queries `find_tools` → `WrapperServer` merges ALL local tool definitions (including the 8 hidden Pega tools) into the response → **60 tools total** returned.
4. **Execution**: The LLM agent calls `execute_dynamic_tool({ tool_name: "pega_*", arguments: {...} })` → `WrapperServer` unwraps the call and routes it to `executeLocalTool()` in the registry.
5. **Pega operation**: The registry dispatches to the bound `PegaMcpTools` handler (e.g., `getSessionContext`, `listRules`, `saveRule`, `createBranch`), which calls the real Pega server via `PegaHttpClient`.
6. **Result**: The handler result is wrapped into the MCP text-result shape (`isError` + `content`) and returned to the LLM agent.

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case / Epic | Priority | Source Ticket |
|---|-------------------------|----------|---------------|
| 1 | As an LLM agent using the SDLC pipeline, I want to discover Pega integration tools via `find_tools` so that I can call Pega operations without them cluttering `tools/list` | MUST HAVE | SA4E-82 |
| 2 | As an LLM agent, I want to execute Pega operations (get/save/checkout/branch) via `execute_dynamic_tool` so that Pega rule management works from the chat pipeline | MUST HAVE | SA4E-82 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Extension starts the local MCP wrapper server on port 9181 and registers the 8 Pega tools into the local tool registry with `hidden: true` (via `registerPegaLocalTools()` in `pega-local-tools.ts`).

**Step 2:** LLM agent requests `tools/list` on port 9181. `WrapperServer` returns the visible local definitions (`getVisibleLocalToolDefinitions()` — hidden tools filtered out) plus backend tools → exactly **12 tools** shown; Pega tools are absent.

**Step 3:** LLM agent calls `find_tools(query)`. `WrapperServer` merges all local tool definitions — including the 8 hidden Pega tools — into the proxied backend response → **60 tools total** returned.

**Step 4:** LLM agent calls `execute_dynamic_tool({ tool_name: "pega_get_session_context" | "pega_list_rules" | ... , arguments: {...} })`. `WrapperServer`/`Base64ProxyService` unwraps the nested call and routes it to `executeLocalTool()`.

**Step 5:** The registry executes the bound `PegaMcpTools` handler. The handler performs the Pega operation against the real Pega server (`PegaHttpClient` / `PegaRuleSetResolverService`).

**Step 6:** The result is normalized to `{ isError, content: [{ type: "text", text: JSON.stringify(result) }] }` and returned to the LLM agent.

> **Note:** This is a backfill document — the requirement was already implemented and verified in the extension. All acceptance criteria below were verified live during implementation.

---

#### STORY 1: Discover Pega tools via find_tools (hidden from tools/list)

> As an LLM agent using the SDLC pipeline, I want to discover Pega integration tools via `find_tools` so that I can call Pega operations without them cluttering `tools/list`.

**Requirement Details:**

1. The 8 Pega tools (`pega_get_session_context`, `pega_get_rule`, `pega_query_rule`, `pega_list_rules`, `pega_save_rule`, `pega_checkout_rule`, `pega_run_tests`, `pega_create_branch`) must be registered in the extension's local tool registry as **hidden** local tools.
2. `tools/list` on the MCP wrapper server (port 9181) must NOT include the Pega tools — the visible list must remain **12 tools** (default, non-cluttered LLM tool surface).
3. `find_tools` must return all 8 Pega tools merged with existing backend tools so the LLM can discover them on demand (verified live: **60 total**).
4. Each Pega tool definition must carry a description and an input schema so the LLM can call it correctly.

**Data Fields (Pega tool definitions injected into `find_tools`):**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| name | string | Yes | Tool name (namespaced with `pega_` prefix) | `pega_list_rules` |
| description | string | Yes | Tool purpose (referencing its Pega service) | "List Pega rules of a class, paginated (Service 3)." |
| inputSchema | object | Yes | JSON Schema of the tool arguments | `{ "type": "object", "properties": { "pxObjClass": {...} } }` |
| hidden | boolean | Yes | Marks the tool hidden from `tools/list` | `true` |

**Acceptance Criteria:**

1. `tools/list` on port 9181 shows **12 tools** (Pega tools hidden).
2. `find_tools` returns all 8 Pega tools + existing tools (verified live: **60 total**).

**UI Specifications (if applicable):**

| No. | Name | Type | Required | Description | Note |
|-----|------|------|----------|-------------|------|
| 1 | `tools/list` response | MCP JSON-RPC response | Yes | Excludes the 8 hidden Pega tools | Must remain 12 tools |
| 2 | `find_tools` response | MCP JSON-RPC response | Yes | Merges the 8 hidden Pega tool definitions | 60 tools total, verified live |

**Validation Rules (if applicable):**

- Every Pega tool definition MUST have `hidden: true` so it is excluded from `tools/list` but kept in `find_tools`.
- Pega tool names MUST use the `pega_` prefix to avoid collisions with backend or other local tools.

**Error Handling (if applicable):**

- `find_tools` merge failure (backend unreachable): `WrapperServer` still returns the local tool definitions so Pega tools remain discoverable; the backend portion is omitted or flagged as unavailable.

---

#### STORY 2: Execute Pega operations via execute_dynamic_tool

> As an LLM agent, I want to execute Pega operations (get/save/checkout/branch) via `execute_dynamic_tool` so that Pega rule management works from the chat pipeline.

**Requirement Details:**

1. `execute_dynamic_tool` must recognize all 8 Pega tool names and route them to the local registry (no backend forwarding).
2. Execution must dispatch to the correct `PegaMcpTools` handler and run against the **real Pega server**.
3. Supported operations: session context retrieval (`pega_get_session_context`), rule get/query/list, rule save with RuleSet/branch context resolution (`pega_save_rule`), rule checkout/checkin/undo-checkout with branch context (`pega_checkout_rule`), scenario test execution (`pega_run_tests`), and ruleset branch creation (`pega_create_branch`).
4. Every result must be normalized to the MCP text-result shape with a `success`/`error` indicator.

**Data Fields (common `execute_dynamic_tool` arguments):**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| tool_name | string | Yes | Name of the Pega tool to execute | `pega_get_rule` |
| arguments | object | Yes | Tool arguments per its input schema | `{ "insKey": "RULE-OBJ-ACTIVITY MyClass!MyRule" }` |
| ticketId / crId | string | No | Jira ticket key used to derive branch context (save/checkout/create_branch) | `SA4E-58` |
| developerShortName | string | No | Developer short name for branch naming | `jd` |

**Acceptance Criteria:**

1. `execute_dynamic_tool(pega_get_session_context)` executes successfully against the real Pega server.
2. `execute_dynamic_tool(pega_list_rules)` executes successfully against the real Pega server.
3. Extension test suite: **589 tests pass**; compile clean.

**UI Specifications (if applicable):**

| No. | Name | Type | Required | Description | Note |
|-----|------|------|----------|-------------|------|
| 1 | `execute_dynamic_tool` response | MCP JSON-RPC response | Yes | `{ isError, content: [{ type: "text", text }] }` with success flag | Pega JSON payload in `text` |

**Validation Rules (if applicable):**

- `pega_get_rule`: `insKey` (or alias `key`) required — missing value returns `{ success: false, error: "insKey parameter required" }`.
- `pega_query_rule`: `pxObjClass` and `pyRuleName` required.
- `pega_save_rule`: `ruleJson` (or `payload`) required; invalid JSON payload must be rejected.
- `pega_checkout_rule`: `insKey` required; `action` must be one of `CHECKOUT` | `CHECKIN` | `UNDOCHECKOUT`.
- `pega_create_branch`: `rulesetName` required; `branchName` auto-derived from `ticketId`/`crId` + `developerShortName` when omitted.
- `pega_run_tests`: at least one of `testSuiteID`/`suiteId` or `insKey` required.

**Error Handling (if applicable):**

- Unknown tool name: registry returns `{ isError: true, content: [...] "Local tool '<name>' not implemented." }`.
- Pega server unreachable / operation fails: handler catches the error and returns `{ success: false, error: <message> }` — no unhandled exception propagates to the LLM.
- Unresolvable branch context (save/checkout/create_branch): handler returns a descriptive error and suggests providing `ticketId`/`crId` to auto-derive the branch.

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| SA4E-56 — PegaMcpTools implementation | System | SA4E-56 | Parent ticket delivering `PegaMcpTools.ts` (8 Pega tool handlers) + `PegaHttpClient` + `PegaRuleSetResolverService`. SA4E-82 wires these into the local tool registry. |
| Local tool registry (`backend-local-tools.ts`) | System | SA4E-82 | `LOCAL_TOOL_REGISTRY` with `hidden` flag support; OCP-based `registerLocalTool()` extension point. |
| WrapperServer (port 9181) | System | SA4E-82 | Local MCP wrapper server that merges hidden definitions into `find_tools` and routes `execute_dynamic_tool` to local handlers. |
| Pega Platform instance | External | N/A | Target system for the 8 Pega operations; requires operator credentials (stored via `vscode.SecretStorage`). |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| LLM Agents | SDLC pipeline agents (BA, SA, QA, DEV, DevOps) | Consume the 8 Pega tools via `find_tools` + `execute_dynamic_tool` during pipeline execution | SA4E-82 (user stories) |
| BA Agent | BA – Business Analyst | Define business requirement and acceptance criteria | SA4E-82 |
| SA Agent | SA – Solution Architect | Review solution design and document | SA4E-82 (peer reviewer) |
| DEV Team | Extension development team | Implement hidden local tool registration and wiring | SA4E-82 |
| QA Team | QA – Test Engineer | Verify acceptance criteria (589 tests, live Pega execution) | SA4E-82 (acceptance criteria) |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Hidden tools not discoverable by LLM (find_tools merge regression) | Medium | Low | Dedicated unit tests for `find_tools` merging (TC-37) and hidden flag filtering (pega-local-tools.test.ts) |
| Name collision with backend tools | Medium | Low | `pega_` prefix namespacing enforced by convention in `PEGA_TOOL_SPECS` |
| Pega server unreachable during live execution | Medium | Medium | All handlers catch errors and return `{ success: false, error }`; session context test verifies connectivity |
| `tools/list` accidentally exposing hidden tools | Medium | Low | `getVisibleLocalToolDefinitions()` filters by `!d.hidden`; TC-38 + pega-local-tools tests guard the contract |

### 5.2 Assumptions

- The 8 Pega tool handlers in `PegaMcpTools.ts` (SA4E-56) are correct and require no changes for this ticket.
- The default `tools/list` surface must remain **12 visible tools** — Pega tools stay hidden and are never promoted to visible.
- `find_tools` remains the discovery mechanism for hidden tools; the LLM agent is expected to call it before invoking Pega operations.
- Backfill: implementation already verified — 589 extension tests pass and compile is clean.

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | `tools/list` response must remain small and unchanged | Hidden Pega tools excluded — response stays at 12 tools, no payload bloat |
| Performance | `find_tools` merge must not add significant latency | Local definitions merged in-memory in `WrapperServer`; verified live with 60 tools |
| Security | Pega credentials must not be exposed in tool definitions or logs | Credentials stored via `vscode.SecretStorage` and used inside `PegaHttpClient` |
| Security | Tool schemas must not leak Pega server internals | Descriptions reference service IDs only (e.g., "Service 3") |
| Scalability | Adding new Pega tools must not modify routing logic | OCP: append to `PEGA_TOOL_SPECS` + call `registerPegaLocalTools()` |
| Maintainability | Single source of truth for tool registration | `pega-local-tools.ts` maps tool name → description → handler → inputSchema |
| Availability | Local execution independent of backend availability | Pega tools route to `LOCAL_TOOL_REGISTRY`; backend (48721) is not required for local execution |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| SA4E-82 | [Pega MCP] Register 8 Pega tools as hidden local tools (find_tools/execute_dynamic_tool) | Done | Task | Main ticket |
| SA4E-56 | Unified Code & Pega Rule Indexing Pipeline (PegaMcpTools implementation) | Done | Task | Parent — implements the 8 Pega tool handlers wired by SA4E-82 (relates to) |

---

## 8. Appendix

### 8.1 The 8 Pega Tools (hidden local tool registry)

All 8 tools are defined in `extension/src/mcp/pega-local-tools.ts` (`PEGA_TOOL_SPECS`), bound to handlers in `extension/src/mcp/PegaMcpTools.ts`, and registered with `hidden: true`.

| # | Tool Name | Handler (PegaMcpTools) | Description | Key Inputs |
|---|-----------|------------------------|-------------|------------|
| 1 | `pega_get_session_context` | `getSessionContext()` | Get current Pega operator session context (operator, access group, application, ruleset stack) | — |
| 2 | `pega_get_rule` | `getRuleByInsKey()` | Fetch a Pega rule by its insKey (Service 1) | `insKey` / `key` |
| 3 | `pega_query_rule` | `queryRule()` | Query a Pega rule by class/name triple (Service 2) | `pxObjClass`, `pyRuleName` |
| 4 | `pega_list_rules` | `listRules()` | List Pega rules of a class, paginated (Service 3) | `pxObjClass`, `pageSize`, `pageIndex` |
| 5 | `pega_save_rule` | `saveRule()` | Save a Pega rule with automatic RuleSet/branch context resolution (Service 4) | `ruleJson`, `ticketId`, `developerShortName`, `preferBranch` |
| 6 | `pega_checkout_rule` | `checkoutRule()` | Checkout/checkin/undo-checkout a Pega rule with branch context (Service 5) | `insKey`, `action`, `comment` |
| 7 | `pega_run_tests` | `runTests()` | Execute a scenario test suite in Pega (Service 6) | `testSuiteID` / `suiteId`, `insKey` |
| 8 | `pega_create_branch` | `createBranch()` | Create a Pega ruleset branch version when no open version exists (Service 7) | `rulesetName`, `baseVersion`, `branchName`, `ticketId` |

### 8.2 Mechanism — Hidden Local Tool Registry (OCP)

- **Registry**: `extension/src/backend-local-tools.ts` holds `LOCAL_TOOL_REGISTRY: Map<string, LocalToolEntry>` where each entry couples a handler with its definition. `LocalToolDefinition` supports the `hidden?: boolean` flag: *"Hidden tools are executable + discoverable via find_tools but omitted from tools/list."*
- **Visible filtering**: `getVisibleLocalToolDefinitions()` returns only `!hidden` definitions for `tools/list`; `getLocalToolDefinitions()` returns ALL definitions (including hidden) for `find_tools` merging.
- **Registration (OCP)**: `registerLocalTool(name, handler, definition)` — adding a new local tool does NOT require editing `executeLocalTool()` (no switch/case). `registerPegaLocalTools()` iterates `PEGA_TOOL_SPECS` and registers each Pega tool (idempotent-safe).
- **Routing**: `WrapperServer` (port 9181) intercepts `find_tools` (merges local definitions) and `execute_dynamic_tool` (routes to `executeLocalTool()` when `isLocalTool(name)` is true; otherwise proxies to backend).
- **Result normalization**: `toMcpResult()` wraps Pega handler results into the MCP text-result shape `{ isError, content: [{ type: "text", text: JSON.stringify(result) }] }`.
- **Same OCP pattern as `stream_write_file`**: `stream_write_file` and `embed_image` are registered in `LOCAL_TOOL_REGISTRY` the same way — Pega tools reuse this exact extension mechanism rather than a bespoke path.

### Glossary

| Term | Definition |
|------|------------|
| MCP | Model Context Protocol — JSON-RPC protocol between the LLM and tools (served by WrapperServer on port 9181) |
| `tools/list` | MCP method returning the default tool surface — must stay at 12 visible tools (Pega hidden) |
| `find_tools` | Tool discovery method — returns merged local + backend definitions (60 total, including hidden Pega tools) |
| `execute_dynamic_tool` | Dynamic tool execution method — routes to local registry or backend |
| Hidden local tool | A registered tool with `hidden: true` — omitted from `tools/list`, kept in `find_tools`, executable via `execute_dynamic_tool` |
| LOCAL_TOOL_REGISTRY | Extension-side registry of local tool handlers/definitions (`backend-local-tools.ts`) |
| PEGA_TOOL_SPECS | Mapping table of the 8 Pega tool definitions (`pega-local-tools.ts`) |
| OCP | Open/Closed Principle — extend behavior via registration, not modification of routing logic |
| Pega Platform | External Pega instance executing rule operations (accessed via `PegaHttpClient`) |
| RuleSet / branch | Pega versioning mechanism used by save/checkout/create_branch context resolution |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| Pega MCP tool handlers (8 tools) | `extension/src/mcp/PegaMcpTools.ts` |
| Pega tool specs & registration | `extension/src/mcp/pega-local-tools.ts` |
| Local tool registry & hidden flag | `extension/src/backend-local-tools.ts` |
| WrapperServer (find_tools / execute_dynamic_tool routing) | `extension/src/services/WrapperServer.ts` |
| Nested argument unwrapping | `extension/src/services/Base64ProxyService.ts` |
| Parent ticket BRD | `documents/SA4E-56/BRD.md` |
