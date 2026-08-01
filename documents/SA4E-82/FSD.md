# Functional Specification Document (FSD)

## SDLC Agents 4 Enterprise — SA4E-82: [Pega MCP] Register 8 Pega tools as hidden local tools (find_tools/execute_dynamic_tool)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-82 |
| Title | [Pega MCP] Register 8 Pega tools as hidden local tools (find_tools/execute_dynamic_tool) |
| Author | TA Agent |
| Version | 1.0 |
| Date | 2026-07-31 |
| Status | Approved (backfill) |
| Related BRD | documents/SA4E-82/BRD.md |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-31 | TA Agent | Backfill FSD — specifies functionality already implemented and verified in the extension source (SA4E-82) |

> **TA Note:** This is a **backfill** document. The implementation was completed and verified before this FSD was written. All functional specifications below were verified against the actual implementation in `extension/src/` (references in §1.4). The BRD is being produced in parallel; requirement-ID alignment is tracked as Open Issue OI-1.

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of registering eight (8) Pega MCP tools as **hidden local tools** in the SDLC Agents 4 Enterprise VS Code extension. Hidden local tools are:

- **Executable locally** — the extension host handles the tool call itself via the local tool registry, without forwarding to the remote backend.
- **Discoverable via `find_tools`** — the LLM can discover the tools through the `find_tools` MCP method (local definitions are merged into the backend result).
- **Hidden from `tools/list`** — the tools are omitted from the standard MCP `tools/list` response so they do not clutter the LLM's default tool list; the LLM is expected to use `find_tools` + `execute_dynamic_tool` to locate and call them.

### 1.2 Scope

**In scope:**

- F1: Tool discovery — `find_tools` flow merges the 8 `pega_*` local tool definitions into the backend's tool list.
- F2: Tool execution — `execute_dynamic_tool` flow routes `pega_*` tool calls to local handlers.
- F3: Hidden visibility — `tools/list` flow excludes the 8 hidden tools (visible-only local definitions are merged).
- F4: Direct routing — `tools/call pega_*` still works: `routeToolCall` checks `isLocalTool()` before any other routing.
- Local tool registry refactor from a hardcoded handler to a dynamic OCP-compliant registry (`registerLocalTool`, `isLocalTool`, `getLocalToolDefinitions`, `getVisibleLocalToolDefinitions`, `LocalToolDefinition.hidden`).
- Secret injection: VS Code `SecretStorage` is passed from `extension.ts` through `McpServerManager` → `RemoteBackendClient` → `PegaMcpTools` for Pega credentials.

**Out of scope:**

- The Pega integration services themselves (`PegaHttpClient`, `PegaRuleSetResolverService`) — these pre-date this ticket and are consumed by `PegaMcpTools`.
- Backend-side `find_tools` / `execute_dynamic_tool` implementation (backend core tools, `backend/src/config/CoreTools.ts`).
- Any new user-facing UI.

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| MCP | Model Context Protocol — JSON-RPC protocol used to expose tools to LLM clients |
| WrapperServer | Local HTTP server in the extension (`extension/src/services/WrapperServer.ts`) that bridges MCP JSON-RPC to the remote backend REST API on port 9181 |
| Local tool | A tool whose handler executes inside the extension host (no backend round-trip) |
| Hidden tool | A local tool registered with `hidden: true` — executable and `find_tools`-discoverable but excluded from `tools/list` |
| `find_tools` | Backend MCP tool that returns discoverable tool definitions for dynamic/plugin tools |
| `execute_dynamic_tool` | Backend MCP tool that invokes a tool by name with arbitrary arguments |
| `tools/list` / `tools/call` | Standard MCP protocol methods for listing and invoking tools |
| insKey | Pega rule instance key, e.g. `RULE-OBJ-ACTIVITY MyClass!MyRule` |
| RuleSet | Pega logical grouping of rules; branch versions are derived from RuleSet + branch name |
| OCP | Open/Closed Principle — extend behavior (register new tools) without modifying existing routing logic |
| PegaMcpTools | Extension class (`extension/src/mcp/PegaMcpTools.ts`) exposing 8 Pega operations returning `{ success, data, context }` |
| SecretStorage | VS Code encrypted per-extension secret storage API used for Pega credentials |
| BRD | Business Requirements Document |
| FSD | Functional Specification Document |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | documents/SA4E-82/BRD.md (in parallel creation — see Open Issue OI-1) |
| FSD Template | documents/templates/FSD-TEMPLATE.md |
| Pega local tool registration | extension/src/mcp/pega-local-tools.ts |
| Local tool registry | extension/src/backend-local-tools.ts |
| MCP wrapper server | extension/src/services/WrapperServer.ts |
| Remote backend client | extension/src/remote-backend-client.ts |
| Extension bootstrap | extension/src/extension.ts (line ~145) |
| Pega operations | extension/src/mcp/PegaMcpTools.ts |
| Backend core tools | backend/src/config/CoreTools.ts |
| Unit tests | extension/src/__tests__/pega-local-tools.test.ts, backend-local-tools.test.ts, wrapper-server.test.ts |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

```xml
<mxfile host="app.diagrams.net">
  <diagram name="System Context — Pega Hidden Local Tools" id="sa4e82-ctx">
    <mxGraphModel dx="900" dy="600" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="640" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="llm" value="LLM Client (VS Code Chat / LangGraph)" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
          <mxGeometry x="40" y="250" width="150" height="70" as="geometry" />
        </mxCell>
        <mxCell id="wrapper" value="WrapperServer (extension/src/services/WrapperServer.ts, port 9181)" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;" vertex="1" parent="1">
          <mxGeometry x="320" y="240" width="180" height="90" as="geometry" />
        </mxCell>
        <mxCell id="registry" value="Local Tool Registry (backend-local-tools.ts)&#10;stream_write_file, embed_image, pega_* (hidden)" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;" vertex="1" parent="1">
          <mxGeometry x="590" y="90" width="200" height="80" as="geometry" />
        </mxCell>
        <mxCell id="pega" value="PegaMcpTools (mcp/PegaMcpTools.ts)&#10;8 Pega operations (Services 1-7 + session)" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="1">
          <mxGeometry x="590" y="250" width="200" height="80" as="geometry" />
        </mxCell>
        <mxCell id="backend" value="Remote Backend (REST :48721)&#10;/api/tools, /api/tools/execute, /health&#10;find_tools / execute_dynamic_tool" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;" vertex="1" parent="1">
          <mxGeometry x="320" y="460" width="180" height="90" as="geometry" />
        </mxCell>
        <mxCell id="e1" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;" edge="1" parent="1" source="llm" target="wrapper">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="e2" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;" edge="1" parent="1" source="wrapper" target="registry">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="e3" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;" edge="1" parent="1" source="registry" target="pega">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="e4" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;exitX=0.5;exitY=1;exitDx=0;exitDy=0;entryX=0.5;entryY=0;entryDx=0;entryDy=0;" edge="1" parent="1" source="wrapper" target="backend">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

### 2.2 System Architecture

The extension runs a local `WrapperServer` (HTTP, port 9181) that implements the MCP protocol for the LLM client (VS Code chat / LangGraph). MCP requests are routed as follows:

| Component | Role | Key Responsibilities for SA4E-82 |
|-----------|------|----------------------------------|
| `WrapperServer` (services/WrapperServer.ts) | MCP JSON-RPC front door | `routeToolCall` dispatch: local-first, then `find_tools`, then `execute_dynamic_tool`, then backend proxy; `tools/list` via `restGetTools`; `find_tools` response merge |
| `backend-local-tools.ts` | Local tool registry | Dynamic `Map`-backed registry; `registerLocalTool`, `isLocalTool`, `executeLocalTool`, `getLocalToolDefinitions`, `getVisibleLocalToolDefinitions`; `LocalToolDefinition.hidden` |
| `pega-local-tools.ts` (mcp/) | Pega tool registration | Maps the 8 `PegaMcpTools` operations to local tool definitions with `hidden: true`; `registerPegaLocalTools`, `getPegaLocalToolDefinitions` |
| `PegaMcpTools` (mcp/PegaMcpTools.ts) | Pega operation facade | Executes Pega operations via `PegaHttpClient` + `PegaRuleSetResolverService`; returns `{ success, data, context }` |
| `RemoteBackendClient` (remote-backend-client.ts) | Backend REST client | `restGetTools` merges visible local defs; `restCallTool` forwards to `/api/tools/execute`; constructor registers Pega tools when `SecretStorage` is provided |
| `extension.ts` | Bootstrap | Passes `context.secrets` into `McpServerManager` constructor (line ~145) |
| Remote Backend | Tool execution backend | Provides core tools `find_tools` / `execute_dynamic_tool` (backend/src/config/CoreTools.ts) |

---

## 3. Functional Requirements

### 3.1 Feature: Pega Local Tool Registration (Local Registry)

**Source:** SA4E-82 ticket context (backfill) [Implements: SA4E-82-Registration]

#### 3.1.1 Description

On extension startup, when `SecretStorage` is available, `RemoteBackendClient` constructs a `PegaMcpTools(secrets)` instance and calls `registerPegaLocalTools(...)`. This registers all eight `pega_*` tools into the local tool registry as **hidden** local tools. Registration is idempotent-safe (Map-backed — re-registering a name replaces the previous entry). The registry is OCP-compliant: adding a new local tool requires only a `registerLocalTool(name, handler, definition)` call — no changes to routing logic.

The eight tools and the `PegaMcpTools` methods they bind to:

| Tool Name | PegaMcpTools Method | Pega Service |
|-----------|---------------------|--------------|
| pega_get_session_context | getSessionContext() | Operator session context |
| pega_get_rule | getRuleByInsKey(args) | Service 1 — fetch rule by insKey |
| pega_query_rule | queryRule(args) | Service 2 — query rule by class/name triple |
| pega_list_rules | listRules(args) | Service 3 — paginated rule list |
| pega_save_rule | saveRule(args) | Service 4 — save rule with branch context |
| pega_checkout_rule | checkoutRule(args) | Service 5 — checkout/checkin/undo-checkout |
| pega_run_tests | runTests(args) | Service 6 — run scenario test suite |
| pega_create_branch | createBranch(args) | Service 7 — create ruleset branch version |

Each registered handler wraps the `PegaMcpTools` result into the MCP text-result shape:

```
{ isError: !success, content: [{ type: "text", text: JSON.stringify(result) }] }
```

where `result` is the value returned by the `PegaMcpTools` method (`{ success, data?, context?, error? }`).

#### 3.1.2 Use Case

**Use Case ID:** UC-001
**Actor:** Extension host (VS Code startup)
**Preconditions:** VS Code extension activated; `context.secrets` available; backend URL configured
**Postconditions:** 8 `pega_*` tools registered in the local registry with `hidden: true`; no backend round-trip involved

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | extension.ts | | Calls `new McpServerManager(workspaceRoot, outputChannel, authManager, backendUrl, context.secrets)` (line ~145) |
| 2 | | RemoteBackendClient | Constructor receives `secrets`; calls `registerPegaLocalTools(new PegaMcpTools(secrets))` inside try/catch |
| 3 | | pega-local-tools.ts | Iterates `PEGA_TOOL_SPECS` (8 entries); for each, `registerLocalTool(name, handler, toDefinition(spec))` |
| 4 | | backend-local-tools.ts | Stores `{ handler, definition }` in `LOCAL_TOOL_REGISTRY` Map keyed by tool name |
| 5 | | | Registration complete — `isLocalTool(name)` returns `true` for all 8 tools |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-001-1 | `secrets` not provided (constructor arg undefined) | Pega registration is skipped silently; `pega_*` tools are neither registered nor available; extension continues with the remaining local tools (stream_write_file, embed_image) |
| AF-001-2 | `registerPegaLocalTools` throws during construction | `RemoteBackendClient` catches, logs `console.warn("[RemoteBackendClient] Pega tools registration failed: <msg>")`, continues without Pega tools |
| AF-001-3 | Re-activation / hot reload registers again | Map `set` semantics make registration idempotent — no duplicate entries |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-001-1 | `PegaHttpClient` construction fails (invalid secrets) | Error caught by constructor catch; tools not registered; `console.warn` logged; server continues startup |

#### 3.1.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-001 | All 8 Pega tools are registered with `hidden: true` | SA4E-82; verified in `toDefinition()` |
| BR-002 | Hidden tools are executable via `tools/call` and `execute_dynamic_tool` but excluded from `tools/list` | SA4E-82; `getVisibleLocalToolDefinitions()` |
| BR-003 | Hidden tools are included in `find_tools` results | SA4E-82; `mergeLocalToolDefinitions()` uses `getLocalToolDefinitions()` (all) |
| BR-004 | Registration must not modify `routeToolCall` / `executeLocalTool` source (OCP) | Code standards; registry pattern |
| BR-005 | Pega credentials are read from VS Code `SecretStorage` only — never passed as tool arguments | Security; `PegaMcpTools(secrets)` |

#### 3.1.4 Data Specifications

**Input Data (registration arguments):**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| secrets | vscode.SecretStorage | N (opt-in) | — | VS Code secret storage backing `PegaHttpClient` credentials |

**Output Data (registration state):**

| Field | Type | Description |
|-------|------|-------------|
| LOCAL_TOOL_REGISTRY | Map<string, LocalToolEntry> | 10 entries after registration: stream_write_file, embed_image, 8 × pega_* |
| hidden flags | boolean | true for all 8 pega_* definitions; undefined/false for stream_write_file & embed_image |

#### 3.1.5 UI Specifications

Not applicable — no user-facing UI is added. The only consumer-visible surface is the MCP tool list exposed to the LLM client (§3.4).

#### 3.1.6 API Contract (Functional View)

Not an HTTP endpoint — this feature adds an internal registration API. The externally visible contracts are the MCP methods specified in §3.2–§3.5.

---

### 3.2 Feature: F1 — Tool Discovery via `find_tools`

**Source:** SA4E-82 ticket context (backfill) [Implements: SA4E-82-F1]

#### 3.2.1 Description

The LLM discovers dynamic/plugin tools by calling the backend's `find_tools` MCP tool. Because the 8 `pega_*` tools are local, they are not known to the backend. `WrapperServer` therefore merges **all** local tool definitions (including hidden ones) into the backend's `find_tools` response, so the LLM can discover and then call the Pega tools via `execute_dynamic_tool`.

#### 3.2.2 Use Case

**Use Case ID:** UC-002
**Actor:** LLM client
**Preconditions:** Extension running; backend reachable; Pega tools registered locally
**Postconditions:** LLM receives a tool list containing the backend tools plus all 10 local definitions (including the 8 hidden `pega_*` tools); base64 schemas rewritten for the LLM

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Sends `tools/call { name: "find_tools", arguments }` | | MCP JSON-RPC POST to WrapperServer `/mcp` |
| 2 | | WrapperServer | `routeToolCall` — `isLocalTool("find_tools")` is false → matches `name === "find_tools"` → `handleFindTools(args)` |
| 3 | | | `restCallTool("find_tools", args)` POSTs `{ tool_name: "find_tools", arguments }` to backend `/api/tools/execute` |
| 4 | | | `rewriteFindToolsResponse(result)`: parses `result.content[0].text` JSON, extracts `tools` array |
| 5 | | | `mergeLocalToolDefinitions(tools)`: appends local defs from `getLocalToolDefinitions()` (all 10) whose name is not already present |
| 6 | | | `base64Proxy.rewriteSchemasForLlm(merged)` rewrites file/base64 schemas for LLM consumption |
| 7 | | | Returns `{ isError: false, content: [{ type: "text", text: JSON.stringify({ tools: merged }) }] }` |
| 8 | Receives merged tool list | | LLM can now choose `pega_get_rule`, etc. |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-002-1 | Backend `find_tools` result already contains a local name (e.g. stream_write_file) | `mergeLocalToolDefinitions` skips duplicates by name — backend wins for same-name tools |
| AF-002-2 | Result text is not valid JSON or lacks a tools array | `rewriteFindToolsResponse` returns the original result unchanged; logs `console.warn`; no local defs merged |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-002-1 | Backend `find_tools` call fails | Error propagates from `restCallTool` → JSON-RPC error response (`-32603`); LLM sees the error |
| EF-002-2 | `find_tools` forwarded via `execute_dynamic_tool` | `handleDynamic` detects `toolName === "find_tools"`, forwards and rewrites identically (§3.3 AF-003-1) |

#### 3.2.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-006 | `find_tools` merges ALL local definitions (visible + hidden) | SA4E-82-F1; `getLocalToolDefinitions()` |
| BR-007 | Duplicate tool names are not merged — backend definition wins | `mergeLocalToolDefinitions` existing-name check |
| BR-008 | Merged list is schema-rewritten via Base64ProxyService before returning to LLM | `rewriteFindToolsResponse` |

#### 3.2.4 Data Specifications

**Input Data (find_tools arguments):**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| query | string | N | — | Optional search/filter text forwarded to backend |

**Output Data (merged tool list entry shape):**

| Field | Type | Description |
|-------|------|-------------|
| name | string | Tool name, e.g. `pega_get_rule` |
| description | string | Purpose text shown to LLM |
| inputSchema | object | JSON Schema (properties + required) |
| hidden | boolean | Present only on local defs; `true` for all pega_* |

#### 3.2.5 UI Specifications

Not applicable — MCP-level behavior only.

#### 3.2.6 API Contract (Functional View)

**Endpoint:** `MCP tools/call → find_tools` (WrapperServer `handleFindTools`)
**Purpose:** Let the LLM discover backend + local tools, including hidden Pega tools.

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| arguments.query | string | N | BR-006 | Search text forwarded to backend find_tools |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| isError | boolean | false on success |
| content[0].type | string | `"text"` |
| content[0].text | string | JSON string: `{ "tools": [ ...merged definitions... ] }` |

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| Backend unavailable | JSON-RPC error `-32603` with backend error text | restCallTool fails (§EF-002-1) |
| Unparseable backend result | Original (unmerged) result returned unchanged | Parse failure (§AF-002-2) |

---

### 3.3 Feature: F2 — Tool Execution via `execute_dynamic_tool`

**Source:** SA4E-82 ticket context (backfill) [Implements: SA4E-82-F2]

#### 3.3.1 Description

The LLM invokes a dynamically discovered tool by calling `execute_dynamic_tool` with `{ tool_name, arguments }`. When `tool_name` is one of the 8 `pega_*` tools, `WrapperServer` executes it **locally** via `executeLocalTool(toolName, innerArgs)` — no backend round-trip. The local handler wraps the `PegaMcpTools` result into the standard text-result shape.

#### 3.3.2 Use Case

**Use Case ID:** UC-003
**Actor:** LLM client
**Preconditions:** Pega tools registered locally; LLM has discovered the target tool via `find_tools`
**Postconditions:** The Pega operation executes in the extension host; result returned in MCP text-result shape

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Sends `tools/call { name: "execute_dynamic_tool", arguments: { tool_name: "pega_get_session_context", arguments: {} } }` | | MCP JSON-RPC POST to WrapperServer `/mcp` |
| 2 | | WrapperServer | `routeToolCall` — not local, not find_tools → `handleDynamic(args)` |
| 3 | | | `base64Proxy.unwrapDynamicTool(args)` extracts `{ toolName, innerArgs }` |
| 4 | | | `isLocalTool("pega_get_session_context")` → true → `executeLocalTool(toolName, innerArgs)` |
| 5 | | backend-local-tools.ts | Looks up registry entry → invokes the bound handler `(args) => toMcpResult(await tools.getSessionContext())` |
| 6 | | PegaMcpTools | `getSessionContext()` → `PegaHttpClient.getOperatorContext()` → returns `{ success: true, context }` |
| 7 | | | Handler wraps result → `{ isError: false, content: [{ type: "text", text: "{\"success\":true,\"context\":{...}}" }] }` |
| 8 | | WrapperServer | Returns result as the `tools/call` result |
| 9 | Receives text result | | LLM parses JSON text for `success` / `data` / `context` / `error` |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-003-1 | `tool_name` is `find_tools` | Forwarded to backend, response rewritten as in §3.2 |
| AF-003-2 | `tool_name` is a backend tool (not local) | `unwrapDynamicTool` → `proxyInput` → `wrapDynamicTool` → forward to backend → `proxyOutput` |
| AF-003-3 | `unwrapDynamicTool` returns null (malformed payload) | Forwarded verbatim to backend `execute_dynamic_tool` |
| AF-003-4 | Tool name not registered locally | `executeLocalTool` returns `{ isError: true, content: [{ type: "text", text: "Local tool '<name>' not implemented." }] }` |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-003-1 | Pega handler returns `success: false` (e.g. branch creation failed) | `toMcpResult` sets `isError: true`; `content[0].text` = JSON `{ success: false, error: "..." }` |
| EF-003-2 | Pega handler throws | Registration catch returns `{ isError: true, content: [{ type: "text", text: "pega_<tool>: <message>" }] }` — no exception propagates to the MCP layer |

#### 3.3.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-009 | All 8 `pega_*` tools execute locally via `executeLocalTool` — never forwarded to backend | SA4E-82-F2; `handleDynamic` isLocalTool check |
| BR-010 | `success: false` in the Pega result maps to `isError: true` in the MCP result | `toMcpResult` |
| BR-011 | Result JSON always contains `success`; may contain `data`, `context`, `error` | `PegaMcpTools` contract |

#### 3.3.4 Data Specifications

**Input Data (execute_dynamic_tool arguments):**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| tool_name | string | Y | Must match a registered tool name | Tool to invoke |
| arguments | object | Y | Tool-specific schema (§4.2) | Arguments passed to the handler |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| isError | boolean | `true` when success === false or handler threw |
| content[0].type | string | `"text"` |
| content[0].text | string | JSON string of `PegaMcpTools` result (`{ success, data?, context?, error? }`) |

#### 3.3.5 UI Specifications

Not applicable — MCP-level behavior only.

#### 3.3.6 API Contract (Functional View)

**Endpoint:** `MCP tools/call → execute_dynamic_tool` (WrapperServer `handleDynamic`, local branch)
**Purpose:** Execute any discovered tool by name; Pega tools run locally in the extension host.

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| arguments.tool_name | string | Y | BR-009 | Tool name, e.g. `pega_save_rule` |
| arguments.arguments | object | Y | Tool schema (§4.2) | Tool-specific input arguments |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| isError | boolean | Success flag per BR-010 |
| content | array | Single text block containing JSON result |

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| Pega operation failed | `{ success: false, error: "<message>" }` in text | Handler returned failure (§EF-003-1) |
| Handler threw | `pega_<tool>: <message>` in text, isError true | Exception in PegaMcpTools call (§EF-003-2) |
| Unknown tool | `Local tool '<name>' not implemented.` | Name not in registry (§AF-003-4) |

---

### 3.4 Feature: F3 — Hidden Visibility (`tools/list`)

**Source:** SA4E-82 ticket context (backfill) [Implements: SA4E-82-F3]

#### 3.4.1 Description

The standard MCP `tools/list` method must NOT expose the 8 hidden Pega tools, so the LLM's default tool list stays clean. `RemoteBackendClient.restGetTools()` merges only **visible** local definitions (`getVisibleLocalToolDefinitions()` — excludes `hidden: true`). Pega tools remain reachable only via `find_tools` + `execute_dynamic_tool` or direct `tools/call`.

#### 3.4.2 Use Case

**Use Case ID:** UC-004
**Actor:** LLM client (or MCP host)
**Preconditions:** Extension running; backend reachable
**Postconditions:** `tools/list` response contains backend tools + visible local tools (stream_write_file, embed_image); no `pega_*` entries

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Sends `tools/list` | | MCP JSON-RPC POST to WrapperServer `/mcp` |
| 2 | | WrapperServer | `handleMcp` → `getToolsRewritten()` |
| 3 | | | `restGetTools()`: GET backend `/api/tools` with auth headers (5 s timeout) |
| 4 | | RemoteBackendClient | Merges `getVisibleLocalToolDefinitions()` (only stream_write_file + embed_image; pega_* excluded) skipping duplicates |
| 5 | | WrapperServer | `base64Proxy.detectFromToolList(tools)` + `rewriteSchemasForLlm(tools)` |
| 6 | | | Returns `{ tools }` as `tools/list` result |
| 7 | Receives clean tool list | | No `pega_*` tools visible in default listing |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-004-1 | Backend `/api/tools` fails or times out | `restGetTools` catches, logs `console.debug`, returns `getVisibleLocalToolDefinitions()` only — server still serves a minimal tool list |
| AF-004-2 | Backend already returns a tool with a local visible name | Duplicate skipped — backend definition wins |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-004-1 | Backend unreachable during `tools/list` | Minimal local tool list returned (AF-004-1); MCP host can still call stream_write_file / embed_image locally |

#### 3.4.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-012 | `tools/list` includes only non-hidden local definitions | SA4E-82-F3; `getVisibleLocalToolDefinitions()` |
| BR-013 | Hidden Pega tools are still callable by name even though not listed | `routeToolCall` / `handleDynamic` local checks (BR-009) |
| BR-014 | Backend tool list is always merged first; local defs appended only when names are new | `restGetTools` duplicate check |

#### 3.4.4 Data Specifications

**Input Data (tools/list):**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| (none) | — | — | — | MCP tools/list has no parameters |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| tools | array | Backend tools + visible local defs (stream_write_file, embed_image) |
| tools[].name | string | Tool name |
| tools[].description | string | Tool purpose |
| tools[].inputSchema | object | JSON Schema |

#### 3.4.5 UI Specifications

Not applicable — MCP-level behavior only. Effect on the consumer: the LLM sees fewer tools by default; Pega tools are opt-in via find_tools.

#### 3.4.6 API Contract (Functional View)

**Endpoint:** `MCP tools/list` (WrapperServer `getToolsRewritten` → `restGetTools`)
**Purpose:** Provide the default, clean tool list excluding hidden Pega tools.

**Input Parameters:** none

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| tools | array | See §3.4.4 |

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| Backend down | Minimal local tool list returned | restGetTools fallback (EF-004-1) |
| Auth failure | Backend 401/403 — treated as backend failure → local-only list | httpGetJson throws; fallback path |

---

### 3.5 Feature: F4 — Direct `tools/call pega_*` Routing

**Source:** SA4E-82 ticket context (backfill) [Implements: SA4E-82-F4]

#### 3.5.1 Description

Direct invocation of a Pega tool by its real name — `tools/call { name: "pega_get_rule", arguments: {...} }` — continues to work even though the tool is hidden from `tools/list`. `WrapperServer.routeToolCall` checks `isLocalTool(name)` **before** any other dispatch, so `pega_*` names execute locally without consulting the backend. This provides backward compatibility for LLM flows that hardcode Pega tool names.

#### 3.5.2 Use Case

**Use Case ID:** UC-005
**Actor:** LLM client
**Preconditions:** Pega tools registered locally
**Postconditions:** Pega operation executes locally; MCP text-result returned

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Sends `tools/call { name: "pega_list_rules", arguments: { pxObjClass: "Rule-Obj-Activity" } }` | | MCP JSON-RPC POST to WrapperServer `/mcp` |
| 2 | | WrapperServer | `routeToolCall` — first check `isLocalTool("pega_list_rules")` → true |
| 3 | | | `executeLocalTool(name, args)` → registry handler → `PegaMcpTools.listRules(args)` |
| 4 | | | Result wrapped → `{ isError: false, content: [{ type: "text", text: "{\"success\":true,\"data\":{...}}" }] }` |
| 5 | Receives result | | — |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-005-1 | Tool name is a backend tool (not local) | Falls through: find_tools → execute_dynamic_tool → `callWithProxy` (backend forward + base64 proxy) |
| AF-005-2 | Tool name is `find_tools` or `execute_dynamic_tool` | Routed to their dedicated handlers (§3.2, §3.3) |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-005-1 | Pega handler fails/throws | Same as §3.3 EF-003-1 / EF-003-2 — result-shaped errors, no MCP-level exception |

#### 3.5.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-015 | `isLocalTool(name)` is evaluated first in `routeToolCall` — local execution wins over backend forwarding | SA4E-82-F4 |
| BR-016 | Hidden status does not affect executability | BR-013 |

#### 3.5.4 Data Specifications

**Input Data (tools/call arguments):**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| name | string | Y | Any registered tool name | Tool name (pega_* or visible local) |
| arguments | object | Y | Tool-specific schema (§4.2) | Handler arguments |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| isError | boolean | Success flag |
| content | array | Text block with JSON result |

#### 3.5.5 UI Specifications

Not applicable.

#### 3.5.6 API Contract (Functional View)

**Endpoint:** `MCP tools/call` (WrapperServer `routeToolCall`, local-first branch)
**Purpose:** Execute any local tool — including hidden Pega tools — by direct name.

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| name | string | Y | BR-015 | Tool name |
| arguments | object | Y | Tool schema (§4.2) | Tool-specific input arguments |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| isError | boolean | Success flag |
| content | array | Text block with JSON result |

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| Pega operation failed | JSON text `{ success: false, error }` | Handler failure |
| Handler threw | `pega_<tool>: <message>` | Exception (EF-005-1) |

---

## 4. Data Model

> **TA Note:** This section defines the logical data model of the feature: the local tool registry structure and the data dictionary of the 8 Pega tools. Physical implementation details (TypeScript interfaces, JSON Schemas) are in the source files referenced in §1.4.

### 4.1 Entity Relationship Diagram

![ER Diagram](diagrams/er-diagram.png)

```xml
<mxfile host="app.diagrams.net">
  <diagram name="Local Tool Registry — Entities" id="sa4e82-er">
    <mxGraphModel dx="900" dy="600" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="500" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="spec" value="PegaToolSpec (pega-local-tools.ts)&#10;name, description, handler, inputSchema" style="swimlane;whiteSpace=wrap;html=1;" vertex="1" parent="1">
          <mxGeometry x="40" y="40" width="240" height="90" as="geometry" />
        </mxCell>
        <mxCell id="def" value="LocalToolDefinition (backend-local-tools.ts)&#10;name, description, inputSchema, hidden?" style="swimlane;whiteSpace=wrap;html=1;" vertex="1" parent="1">
          <mxGeometry x="360" y="40" width="260" height="90" as="geometry" />
        </mxCell>
        <mxCell id="entry" value="LocalToolEntry&#10;handler, definition" style="swimlane;whiteSpace=wrap;html=1;" vertex="1" parent="1">
          <mxGeometry x="690" y="40" width="160" height="80" as="geometry" />
        </mxCell>
        <mxCell id="registry" value="LOCAL_TOOL_REGISTRY&#10;Map&lt;name, LocalToolEntry&gt;&#10;10 entries: stream_write_file, embed_image, 8 x pega_*" style="swimlane;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="1">
          <mxGeometry x="200" y="260" width="420" height="90" as="geometry" />
        </mxCell>
        <mxCell id="pmt" value="PegaMcpTools (1 instance)&#10;bound via registerPegaLocalTools(pegaTools)" style="swimlane;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
          <mxGeometry x="200" y="420" width="420" height="70" as="geometry" />
        </mxCell>
        <mxCell id="r1" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;" edge="1" parent="1" source="spec" target="def">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="r2" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;" edge="1" parent="1" source="def" target="entry">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="r3" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;" edge="1" parent="1" source="entry" target="registry">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="r4" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;" edge="1" parent="1" source="registry" target="pmt">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

### 4.2 Logical Entities

#### Entity: LOCAL_TOOL_REGISTRY (Map<string, LocalToolEntry>)

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| key | string | Y | BR-001, BR-015 | Tool name (unique), e.g. `pega_get_rule` |
| handler | function | Y | BR-004 | Local execution function `(args) => result` |
| definition | LocalToolDefinition | Y | BR-001 | Public definition incl. `hidden` flag |
| definition.hidden | boolean | N | BR-001/BR-002 | `true` = excluded from tools/list, included in find_tools |

**Relationships:**

| From Entity | To Entity | Cardinality | Description |
|-------------|-----------|-------------|-------------|
| LOCAL_TOOL_REGISTRY | LocalToolDefinition | 1:1 | Each registry entry carries exactly one definition |
| LOCAL_TOOL_REGISTRY | PegaMcpTools | N:1 | 8 pega_* entries share one bound PegaMcpTools instance |
| PegaToolSpec | LocalToolDefinition | 1:1 | Each spec maps to a definition via `toDefinition()` |

#### Data Dictionary — the 8 Pega Tools

**Tool 1: pega_get_session_context**

| Attribute | Value |
|-----------|-------|
| Purpose | Get current Pega operator session context (operator, access group, application, ruleset stack) |
| Key input params | none (`{}`) |
| Output | `{ success, context }` — `context` = operator session info |
| Pega method | `getSessionContext()` |

**Tool 2: pega_get_rule**

| Attribute | Value |
|-----------|-------|
| Purpose | Fetch a Pega rule by its insKey (Service 1) |
| Key input params | `insKey` (string, **required**) — e.g. `RULE-OBJ-ACTIVITY MyClass!MyRule`; `key` (string, alias for insKey) |
| Output | `{ success, data, source }` — `data` = rule JSON; `source` = `"cache"` or `"pega_studio"` |
| Pega method | `getRuleByInsKey(args)` |

**Tool 3: pega_query_rule**

| Attribute | Value |
|-----------|-------|
| Purpose | Query a Pega rule by class/name triple (Service 2) |
| Key input params | `pxObjClass` (string, **required**), `pyRuleName` (string, **required**); aliases `className`, `appliesTo`/`pyClassName`, `ruleName` |
| Output | `{ success, data }` — matched rule data |
| Pega method | `queryRule(args)` |

**Tool 4: pega_list_rules**

| Attribute | Value |
|-----------|-------|
| Purpose | List Pega rules of a class, paginated (Service 3) |
| Key input params | `pxObjClass` (string, default `"Rule-Obj-Activity"`); `pageSize` (number, default 50); `pageIndex` (number, default 1); alias `className` |
| Output | `{ success, data }` — `data.total` + paginated rule items |
| Pega method | `listRules(args)` |

**Tool 5: pega_save_rule**

| Attribute | Value |
|-----------|-------|
| Purpose | Save a Pega rule with automatic RuleSet/branch context resolution (Service 4) |
| Key input params | `ruleJson` (object, **required**); `payload` (string, JSON alternative); `ticketId`/`crId` (string); `developerShortName` (string); `preferBranch` (boolean) |
| Output | `{ success, data, context }` — `context` may include resolved branch/RuleSet version info |
| Pega method | `saveRule(args)` |

**Tool 6: pega_checkout_rule**

| Attribute | Value |
|-----------|-------|
| Purpose | Checkout / checkin / undo-checkout a Pega rule with branch context (Service 5) |
| Key input params | `insKey` (string, **required**); `action` (enum `CHECKOUT` / `CHECKIN` / `UNDOCHECKOUT`, default `CHECKOUT`); `comment` (string); `ticketId`/`crId`; `developerShortName` |
| Output | `{ success, data, context }` |
| Pega method | `checkoutRule(args)` |

**Tool 7: pega_run_tests**

| Attribute | Value |
|-----------|-------|
| Purpose | Execute a scenario test suite in Pega (Service 6) |
| Key input params | `testSuiteID` (string); alias `suiteId`; `insKey` (string) |
| Output | `{ success, data }` — test run results |
| Pega method | `runTests(args)` |

**Tool 8: pega_create_branch**

| Attribute | Value |
|-----------|-------|
| Purpose | Create a Pega ruleset branch version when no open version exists (Service 7) |
| Key input params | `rulesetName` (string, **required**); `baseVersion` (string, default `"01-01-01"`); `branchName` (string, auto-derived from ticketId + developerShortName if omitted); `ticketId`/`crId`; `developerShortName` |
| Output | `{ success, data, context }` — `context.branchName` e.g. `SSA_SA4E-58` |
| Pega method | `createBranch(args)` |

#### Result Envelope (shared by all 8 tools)

| Field | Type | Description |
|-------|------|-------------|
| success | boolean | `false` on operation failure |
| data | object | Operation-specific payload (present on success) |
| context | object | Optional operational context (branch name, ruleset info, session) |
| error | string | Human-readable failure message (present when success = false) |

**Wrapper envelope (what the LLM receives):**

| Field | Type | Description |
|-------|------|-------------|
| isError | boolean | `true` iff `success === false` or handler threw |
| content | array | `[{ type: "text", text: JSON.stringify(<result envelope>) }]` |

---

## 5. Integration Specifications

> **TA Note:** This section defines what external systems are involved and what data is exchanged. Technical details (timeout, retry, circuit breaker, connection strings) are specified in the TDD.

### 5.1 External System: Remote Backend (REST API)

| Attribute | Value |
|-----------|-------|
| Purpose | Source of backend tools, `find_tools`, `execute_dynamic_tool`, and `/api/tools` listing |
| Direction | Outbound (extension → backend) |
| Data Format | JSON over HTTP(S) |
| Frequency | On-demand (per MCP request) |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| `{ tool_name, arguments }` (POST body) | `/api/tools/execute` | Send | find_tools / execute_dynamic_tool forwarding (BR-006, BR-009) |
| Auth headers (`buildAuthHeaders`) | `/api/tools` + `/api/tools/execute` | Send | `buildBackendAuthHeaders(authManager)` |
| `tools` array | GET `/api/tools` response | Receive | Merged with visible local defs (BR-012) |

**Timeouts / Policy:** `restGetTools` 5000 ms; `restCallTool` 30000 ms; no retry at this layer (fail-fast; caller sees JSON-RPC error).

### 5.2 External System: Pega Server (via PegaHttpClient)

| Attribute | Value |
|-----------|-------|
| Purpose | Execute the 8 Pega operations (Services 1–7 + session context) |
| Direction | Outbound (extension → Pega) |
| Data Format | JSON over HTTP(S) |
| Frequency | On-demand (per Pega tool call) |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| Operator session request | Pega REST (operator context) | Send/Receive | pega_get_session_context |
| Rule insKey / class/name triple | Rule fetch / query / list | Send/Receive | pega_get_rule / pega_query_rule / pega_list_rules |
| Rule JSON + branch params | Rule save / checkout / tests / branch create | Send/Receive | pega_save_rule / pega_checkout_rule / pega_run_tests / pega_create_branch |

**Key points:** Credentials are read from VS Code `SecretStorage` (never from tool arguments — BR-005). Pega operations are invoked synchronously within the extension request handler; the Pega integration services themselves are out of scope for this FSD (see §1.2).

### 5.3 Integration: VS Code SecretStorage

| Attribute | Value |
|-----------|-------|
| Purpose | Securely supply Pega credentials to `PegaHttpClient` |
| Direction | Inbound (extension host → feature) |
| Data Format | VS Code SecretStorage API |
| Frequency | Once at construction |

**Data Exchange:** `extension.ts` passes `context.secrets` → `McpServerManager` constructor (line ~145) → `RemoteBackendClient` constructor (optional 5th parameter) → `new PegaMcpTools(secrets)`.

---

## 6. Processing Logic

### 6.1 Process: Pega Tool Registration

**Trigger:** `RemoteBackendClient` constructed with `secrets`
**Schedule:** On extension activation / server manager construction
**Input:** `vscode.SecretStorage`
**Output:** 8 entries in `LOCAL_TOOL_REGISTRY`

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Construct `PegaMcpTools(secrets)` (creates `PegaHttpClient` + `PegaRuleSetResolverService`) | Throw → caught in constructor, `console.warn`, registration skipped |
| 2 | For each of the 8 `PEGA_TOOL_SPECS`: build handler closure bound to `pegaTools` | Per-handler try/catch wraps thrown errors into result shape |
| 3 | `registerLocalTool(name, handler, { name, description, inputSchema, hidden: true })` | Map `set` — idempotent |
| 4 | Registry ready: `isLocalTool(name)` true for all 8 | — |

### 6.2 Process: F1 — find_tools Discovery

**Trigger:** `tools/call { name: "find_tools" }`
**Schedule:** On-demand
**Input:** optional `query` arguments
**Output:** merged tool list (backend + 10 local defs)

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | `routeToolCall` → `handleFindTools(args)` | — |
| 2 | `restCallTool("find_tools", args)` → backend | Throw → JSON-RPC -32603 error |
| 3 | Parse `result.content[0].text` → `tools` array | Parse failure → return original, `console.warn` |
| 4 | `mergeLocalToolDefinitions(tools)` — append local defs not already present | Duplicate names skipped |
| 5 | `base64Proxy.rewriteSchemasForLlm(merged)` | Non-fatal |
| 6 | Return `{ isError: false, content: [{ type: "text", text: JSON.stringify({ tools }) }] }` | — |

**Activity Diagram:**

![Process Flow - find_tools](diagrams/process-find-tools.png)

```xml
<mxfile host="app.diagrams.net">
  <diagram name="find_tools discovery flow" id="sa4e82-f1">
    <mxGraphModel dx="700" dy="500" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="600" pageHeight="520" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="s1" value="LLM calls tools/call find_tools" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
          <mxGeometry x="180" y="20" width="240" height="40" as="geometry" />
        </mxCell>
        <mxCell id="s2" value="routeToolCall: isLocalTool? no&#10;&#8594; handleFindTools" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;" vertex="1" parent="1">
          <mxGeometry x="180" y="90" width="240" height="50" as="geometry" />
        </mxCell>
        <mxCell id="s3" value="restCallTool(&quot;find_tools&quot;)&#10;&#8594; backend /api/tools/execute" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;" vertex="1" parent="1">
          <mxGeometry x="180" y="170" width="240" height="50" as="geometry" />
        </mxCell>
        <mxCell id="s4" value="Parse text, extract tools[]" style="shape=rhombus;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;" vertex="1" parent="1">
          <mxGeometry x="210" y="250" width="180" height="60" as="geometry" />
        </mxCell>
        <mxCell id="s5" value="Merge local defs (all 10, incl. hidden pega_*) + rewrite schemas" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="1">
          <mxGeometry x="180" y="350" width="240" height="50" as="geometry" />
        </mxCell>
        <mxCell id="s6" value="Return merged tool list to LLM" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="1">
          <mxGeometry x="180" y="430" width="240" height="40" as="geometry" />
        </mxCell>
        <mxCell id="sf" value="Parse failed:&#10;return original result" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;" vertex="1" parent="1">
          <mxGeometry x="450" y="255" width="140" height="50" as="geometry" />
        </mxCell>
        <mxCell id="x1" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;" edge="1" parent="1" source="s1" target="s2">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="x2" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;" edge="1" parent="1" source="s2" target="s3">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="x3" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;" edge="1" parent="1" source="s3" target="s4">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="x4" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;" edge="1" parent="1" source="s4" target="s5">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="x5" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;" edge="1" parent="1" source="s5" target="s6">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="x6" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;" edge="1" parent="1" source="s4" target="sf">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

### 6.3 Process: F2 — execute_dynamic_tool Local Execution

**Trigger:** `tools/call { name: "execute_dynamic_tool", arguments: { tool_name: "pega_*", arguments } }`
**Schedule:** On-demand
**Input:** `{ tool_name, arguments }`
**Output:** MCP text-result envelope

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | `routeToolCall` → `handleDynamic(args)` | — |
| 2 | `unwrapDynamicTool(args)` → `{ toolName, innerArgs }` | null → forward verbatim to backend |
| 3 | `isLocalTool(toolName)`? | No → proxy + forward to backend |
| 4 | `executeLocalTool(toolName, innerArgs)` → bound handler | Unknown name → `Local tool '<name>' not implemented.` |
| 5 | Handler calls `PegaMcpTools` method; result wrapped by `toMcpResult` | `success:false` → isError:true; throw → caught text error |
| 6 | Return envelope to LLM | — |

**Activity Diagram:**

![Process Flow - execute_dynamic_tool](diagrams/process-execute-dynamic.png)

```xml
<mxfile host="app.diagrams.net">
  <diagram name="execute_dynamic_tool local execution flow" id="sa4e82-f2">
    <mxGraphModel dx="700" dy="500" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="620" pageHeight="560" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="t1" value="LLM calls execute_dynamic_tool&#10;{tool_name: pega_*}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
          <mxGeometry x="180" y="20" width="260" height="50" as="geometry" />
        </mxCell>
        <mxCell id="t2" value="handleDynamic:&#10;unwrapDynamicTool" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;" vertex="1" parent="1">
          <mxGeometry x="180" y="100" width="260" height="50" as="geometry" />
        </mxCell>
        <mxCell id="t3" value="isLocalTool(toolName)?" style="shape=rhombus;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;" vertex="1" parent="1">
          <mxGeometry x="210" y="180" width="200" height="60" as="geometry" />
        </mxCell>
        <mxCell id="t4" value="executeLocalTool &#8594; PegaMcpTools handler" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="1">
          <mxGeometry x="180" y="280" width="260" height="50" as="geometry" />
        </mxCell>
        <mxCell id="t5" value="toMcpResult: isError = !success" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="1">
          <mxGeometry x="180" y="360" width="260" height="50" as="geometry" />
        </mxCell>
        <mxCell id="t6" value="Return { isError, content:[text] }" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="1">
          <mxGeometry x="180" y="440" width="260" height="40" as="geometry" />
        </mxCell>
        <mxCell id="tb" value="Proxy + forward to backend" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;" vertex="1" parent="1">
          <mxGeometry x="470" y="185" width="140" height="50" as="geometry" />
        </mxCell>
        <mxCell id="u1" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;" edge="1" parent="1" source="t1" target="t2">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="u2" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;" edge="1" parent="1" source="t2" target="t3">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="u3" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;exitX=0.5;exitY=1;exitDx=0;exitDy=0;entryX=0.5;entryY=0;entryDx=0;entryDy=0;" edge="1" parent="1" source="t3" target="t4">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="u4" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;" edge="1" parent="1" source="t4" target="t5">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="u5" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;" edge="1" parent="1" source="t5" target="t6">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="u6" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;" edge="1" parent="1" source="t3" target="tb">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

### 6.4 Process: F3 — tools/list Visible Merge

**Trigger:** MCP `tools/list`
**Schedule:** On-demand
**Input:** none
**Output:** clean tool list (visible local defs only)

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | `getToolsRewritten()` → `restGetTools()` | Backend failure → local-only list |
| 2 | GET backend `/api/tools` | Throw → fallback (AF-004-1) |
| 3 | Merge `getVisibleLocalToolDefinitions()` (excludes hidden pega_*) | Duplicate names skipped |
| 4 | `detectFromToolList` + `rewriteSchemasForLlm` | Non-fatal |
| 5 | Return `{ tools }` | — |

---

## 7. Security Requirements

> **TA Note:** This section defines business-level security requirements. Technical implementation (encryption algorithms, input validation rules) is specified in the TDD §7.

### 7.1 Authentication & Authorization

| Role | Permissions | Features |
|------|-------------|----------|
| LLM client (chat) | Can call `find_tools`, `execute_dynamic_tool`, `tools/call` for `pega_*` | F1, F2, F4 — tool discovery & execution |
| LLM client (chat) | Cannot see hidden Pega tools in `tools/list` | F3 — hidden visibility |
| VS Code extension host | Owns Pega credentials via `SecretStorage`; registers tools | Registration |
| Pega user | Credentials stored in SecretStorage; no credentials accepted as tool args | BR-005 |

### 7.2 Data Sensitivity Classification

| Data Type | Classification | Business Requirement |
|-----------|---------------|----------------------|
| Pega credentials (operator ID, password/token) | Restricted | Stored in VS Code SecretStorage only; never serialized into tool arguments or MCP payloads (BR-005) |
| Pega rule JSON (data/context results) | Internal | Transmitted extension-local (MCP text result) and to Pega via HTTPS; may contain application rule source |
| Tool definitions / schemas | Internal | Exposed to LLM only via find_tools / tools/list |

### 7.3 Audit Trail

| Event | Logged Fields | Retention | Business Reason |
|-------|--------------|-----------|-----------------|
| Pega tool registration failure | timestamp, error message, component | Extension session / output channel | Operational diagnostics |
| Backend `/api/tools` fallback | timestamp, debug message | Extension session | Diagnose backend connectivity |
| find_tools parse failure | timestamp, warn message | Extension session | Detect protocol drift |
| Pega operation errors | In result text (`{ success: false, error }`) returned to LLM | MCP session | Traceability of failed Pega operations |

> **TA Note:** No new persistence or audit storage is introduced by this feature. Logging is limited to the VS Code output channel (`Kiro MCP Server`) and console; Pega credentials are never logged.

---

## 8. Non-Functional Requirements

> **TA Note:** This section defines quantified NFR targets. Technical implementation (caching strategy, connection pooling, monitoring setup) is specified in the TDD §8–§9.

| Category | Business Requirement | Acceptance Criteria |
|----------|---------------------|---------------------|
| Performance | find_tools returns merged tool list quickly | Local merge adds < 50 ms over backend round-trip; p95 total < 5 s (dominated by backend find_tools) |
| Performance | Local Pega tool execution is responsive | Registry lookup + handler dispatch < 10 ms; Pega operation latency bounded by PegaHttpClient (≤ 30 s restCallTool timeout) |
| Performance | tools/list does not regress | Merge of visible local defs < 10 ms; backend GET /api/tools ≤ 5 s timeout |
| Availability | Pega tools remain available when backend is down for tools/list | tools/list falls back to local-only visible defs (no crash) |
| Availability | Extension continues working if Pega registration fails | Registration failure is non-fatal (warn + continue) |
| Scalability | Adding more local tools must not change routing code | New tool = single `registerLocalTool` call (OCP, BR-004) |
| Scalability | Registry grows without performance impact | Map-based O(1) lookup; concurrent JSON-RPC requests isolated per handler |
| Compatibility | MCP protocol negotiation unaffected | Supports protocol versions 2025-06-18, 2025-03-26, 2024-11-05 (WrapperServer.PROTOCOL_VERSIONS) |
| Data Retention | No new data persisted by this feature | All state is in-memory registry + MCP session |
| Reliability | Failed Pega operations do not crash the MCP server | Errors returned as result-shaped envelopes (isError), never propagated as exceptions |

---

## 9. Error Handling (User-Facing)

> **TA Note:** This section defines user-facing error scenarios and expected behavior. Technical logging specifications (log levels, destinations, formats) are specified in the TDD §9.

### 9.1 Error Scenarios

| Scenario | Severity | User Message | Expected Behavior |
|----------|----------|-------------|-------------------|
| Pega operation returns `success: false` | Warning | `{ success: false, error: "<message>" }` in tool result text | isError=true; LLM sees the failure reason; can retry with corrected args |
| Pega handler throws | Warning | `pega_<tool>: <error message>` in tool result text | isError=true; server stays up; no JSON-RPC error |
| Unknown local tool name in execute_dynamic_tool | Warning | `Local tool '<name>' not implemented.` | isError=true result |
| Backend find_tools fails | Critical | JSON-RPC error `-32603` with backend error text | LLM notified; local tools unaffected |
| Backend /api/tools fails (tools/list) | Warning | (none — fallback) | Minimal local tool list returned; `console.debug` logged |
| Pega registration fails at startup | Warning | (none) | `console.warn`; extension continues without Pega tools |
| find_tools response parse failure | Info | Original backend result returned unchanged | `console.warn`; no merge |

### 9.2 Notification Requirements

| Event | Who is Notified | Channel | Timing |
|-------|----------------|---------|--------|
| Backend connection/health failure | Developer | Output channel "Kiro MCP Server" + status bar (crashed state) | Immediate |
| Pega registration failure | Developer | Output channel warn | Immediate |
| Pega operation failure | LLM client | Tool result envelope | Immediate |

---

## 10. Testing Considerations

### 10.1 Test Scenarios

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-01 | All 8 Pega tool definitions exposed | `getPegaLocalToolDefinitions()` | Returns definitions for exactly pega_get_session_context, pega_get_rule, pega_query_rule, pega_list_rules, pega_save_rule, pega_checkout_rule, pega_run_tests, pega_create_branch; all `hidden: true` | High |
| TC-02 | Required params present in schemas | `pega_save_rule` / `pega_create_branch` schemas | `pega_save_rule.inputSchema.required` contains `ruleJson`; `pega_create_branch` contains `rulesetName` | High |
| TC-03 | Registration makes tools local | `registerPegaLocalTools(mock)` then `isLocalTool(name)` | `true` for all 8; present in `getLocalToolDefinitions()` | High |
| TC-04 | Local execution wraps success result | `executeLocalTool("pega_get_session_context", {})` | `isError=false`, `content[0].text` JSON contains `context.operatorId` | High |
| TC-05 | `success: false` maps to isError | Handler returns `{ success: false, error: "branchName required" }` | Result `isError=true`, text JSON contains the error | High |
| TC-06 | Thrown handler errors are captured | Handler throws `new Error("boom")` | `isError=true`, text contains "boom"; no propagation | High |
| TC-07 | Hidden tools excluded from visible list | After registration, `getVisibleLocalToolDefinitions()` | Contains only stream_write_file + embed_image; no pega_* | High |
| TC-08 | find_tools merge includes hidden defs | WrapperServer `rewriteFindToolsResponse` with backend list | Merged list contains all 10 local defs (incl. hidden); no duplicates | High |
| TC-09 | tools/list excludes hidden | `restGetTools()` with backend list | No pega_* entries; visible local defs appended | High |
| TC-10 | Direct tools/call of pega_* routes locally | `routeToolCall({ name: "pega_list_rules", arguments })` | Executes via `executeLocalTool`, no backend call (isLocalTool checked first) | High |
| TC-11 | Backend failure on tools/list | GET /api/tools throws | Falls back to `getVisibleLocalToolDefinitions()` | Medium |
| TC-12 | MCP protocol handshake unaffected | `initialize` request | `tools.listChanged: false`, negotiated protocol version; serverInfo name "sdlc-agents-4-enterprise" | Medium |

### 10.2 Implementation Notes for QA

- Existing automated coverage: `extension/src/__tests__/pega-local-tools.test.ts` (TC-01..TC-06), `backend-local-tools.test.ts` (registry/visibility), `wrapper-server.test.ts` (routing/merge). Regression suites: `mcp-handshake.regression.test.ts`, backend `tool-forwarding.e2e.test.ts`, `mcp-api.e2e.test.ts`.
- Performance check: run find_tools + tools/list with 1000 backend tools to confirm merge stays < 50 ms.
- Security check: assert no Pega credential values appear in any MCP payload or log output.
- Compatibility check: verify VS Code MCP client negotiation on the three supported protocol versions.

---

## 11. Appendix

### Diagrams

| Diagram | File |
|---------|------|
| System Context — Pega Hidden Local Tools | [diagrams/system-context.png](diagrams/system-context.png) |
| ER — Local Tool Registry Entities | [diagrams/er-diagram.png](diagrams/er-diagram.png) |
| Process Flow — find_tools | [diagrams/process-find-tools.png](diagrams/process-find-tools.png) |
| Process Flow — execute_dynamic_tool | [diagrams/process-execute-dynamic.png](diagrams/process-execute-dynamic.png) |

> **TA Note:** draw.io XML for each diagram is embedded inline in §2.1, §4.1, §6.2, and §6.3 respectively (project standard: Draw.io only — no Mermaid).

### Sample Payloads

**Sample 1 — find_tools response (after merge, simplified):**

```json
{
  "isError": false,
  "content": [
    {
      "type": "text",
      "text": "{\"tools\":[{\"name\":\"code_search\",\"description\":\"...\",\"inputSchema\":{}},{\"name\":\"pega_get_rule\",\"description\":\"Fetch a Pega rule by its insKey (Service 1).\",\"inputSchema\":{\"type\":\"object\",\"properties\":{\"insKey\":{\"type\":\"string\"},\"key\":{\"type\":\"string\"}},\"required\":[\"insKey\"]},\"hidden\":true},{\"name\":\"pega_get_session_context\",\"description\":\"Get current Pega operator session context (operator, access group, application, ruleset stack).\",\"inputSchema\":{\"type\":\"object\",\"properties\":{},\"required\":[]},\"hidden\":true}]}"
    }
  ]
}
```

**Sample 2 — execute_dynamic_tool call for a hidden Pega tool:**

```json
{
  "name": "execute_dynamic_tool",
  "arguments": {
    "tool_name": "pega_get_session_context",
    "arguments": {}
  }
}
```

**Sample 3 — local execution result envelope:**

```json
{
  "isError": false,
  "content": [
    {
      "type": "text",
      "text": "{\"success\":true,\"context\":{\"operatorId\":\"SSA@TGB\"}}"
    }
  ]
}
```

**Sample 4 — tools/list (hidden tools absent):**

```json
{
  "tools": [
    { "name": "code_search", "description": "...", "inputSchema": {} },
    { "name": "stream_write_file", "description": "Write or append content to a local workspace file (creates parent dirs).", "inputSchema": {} },
    { "name": "embed_image", "description": "Replace local image refs in markdown with base64 data URIs.", "inputSchema": {} }
  ]
}
```

### Change Log from BRD

| BRD Item | FSD Handling | Status |
|----------|--------------|--------|
| (BRD in parallel creation) | FSD written from ticket context + verified implementation (backfill); requirement IDs (PREQ-xxx) to be aligned in v1.1 | Pending OI-1 |

### Open Issues

| ID | Issue | Owner | Target |
|----|-------|-------|--------|
| OI-1 | BRD being created in parallel — align `[Implements:]` references once published | BA Agent | FSD v1.1 |
| OI-2 | Cosmetic: handler-catch error text prefixes the tool name with `pega_` even though spec names already start with `pega_` (e.g. `pega_pega_get_rule: ...`) — normalize or accept | DEV | Next maintenance sprint |
| OI-3 | Confirm e2e coverage for tools/list exclusion across all 3 MCP protocol versions | QA | Before v2.0 release |
| OI-4 | Decide whether the `find_tools` merge should expose the `hidden` flag to the LLM or strip it | SA / TA | FSD v1.1 |

---

*End of FSD — SA4E-82 (backfill). Functional specifications verified against the implementation in `extension/src/`; BRD alignment tracked in OI-1.*
