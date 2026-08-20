# System Test Cases (STC)

## SDLC-Agents-4-Enterprise — SA4E-186: Agent Runtime Routing — Frontmatter (tools, model), per-agent prompt switching

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-186 |
| Title | Agent Runtime Routing — Frontmatter (tools, model), per-agent prompt switching |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-01-27 |
| Status | Draft |
| Related STP | documents/SA4E-186/STP.md |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-27 | QA Agent | Initial STC — 56 test cases across 6 levels |

---

## 1. Property-Based Testing (PBT)

### PBT-01: isToolAllowed never throws on random inputs

| Field | Value |
|-------|-------|
| ID | PBT-01 |
| Priority | High |
| Traces To | BR-05, BR-06, BR-07, BR-08, BR-09 |
| Component | ToolFilter.isToolAllowed |
| Framework | Vitest + fast-check |

**Property:** For any string `toolName` and any `string[] | undefined` patterns, `isToolAllowed(toolName, patterns)` returns a boolean without throwing.

**Generator:**
```typescript
fc.tuple(
  fc.string({ minLength: 0, maxLength: 100 }),
  fc.oneof(
    fc.constant(undefined),
    fc.array(fc.string({ minLength: 0, maxLength: 50 }), { maxLength: 20 })
  )
)
```

**Assertion:** `typeof result === 'boolean'`

---

### PBT-02: filterTools output is always subset of input

| Field | Value |
|-------|-------|
| ID | PBT-02 |
| Priority | High |
| Traces To | BR-05, BR-06 |
| Component | ToolFilter.filterTools |
| Framework | Vitest + fast-check |

**Property:** For any tool list and any patterns, `filterTools(tools, patterns).length <= tools.length` and every item in result exists in original list.

**Generator:**
```typescript
fc.tuple(
  fc.array(fc.record({ name: fc.string({ minLength: 1, maxLength: 30 }) }), { maxLength: 50 }),
  fc.oneof(fc.constant(undefined), fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 }))
)
```

**Assertion:** `result.every(t => input.includes(t)) && result.length <= input.length`

---

## 2. Unit Testing (UT)

### UT-01: isToolAllowed — exact match returns true

| Field | Value |
|-------|-------|
| ID | UT-01 |
| Priority | High |
| Traces To | BR-05 |
| Component | ToolFilter.isToolAllowed |

**Preconditions:** None (pure function)

| Step | Action | Input | Expected Result |
|------|--------|-------|-----------------|
| 1 | Call isToolAllowed | `toolName: "mem_search"`, `patterns: ["mem_search", "code_search"]` | Returns `true` |

---

### UT-02: isToolAllowed — prefix wildcard match returns true

| Field | Value |
|-------|-------|
| ID | UT-02 |
| Priority | High |
| Traces To | BR-06 |
| Component | ToolFilter.isToolAllowed |

| Step | Action | Input | Expected Result |
|------|--------|-------|-----------------|
| 1 | Call isToolAllowed | `toolName: "code_search"`, `patterns: ["code_*"]` | Returns `true` |
| 2 | Call isToolAllowed | `toolName: "code_symbols"`, `patterns: ["code_*"]` | Returns `true` |
| 3 | Call isToolAllowed | `toolName: "code_"`, `patterns: ["code_*"]` | Returns `true` (empty suffix matches) |

---

### UT-03: isToolAllowed — non-matching name returns false

| Field | Value |
|-------|-------|
| ID | UT-03 |
| Priority | High |
| Traces To | BR-05, BR-06 |
| Component | ToolFilter.isToolAllowed |

| Step | Action | Input | Expected Result |
|------|--------|-------|-----------------|
| 1 | Call isToolAllowed | `toolName: "grep_search"`, `patterns: ["mem_search", "code_*"]` | Returns `false` |
| 2 | Call isToolAllowed | `toolName: "mem_searchx"`, `patterns: ["mem_search"]` | Returns `false` (not prefix, exact) |

---

### UT-04: isToolAllowed — empty patterns returns false (text-only)

| Field | Value |
|-------|-------|
| ID | UT-04 |
| Priority | High |
| Traces To | BR-09 |
| Component | ToolFilter.isToolAllowed |

| Step | Action | Input | Expected Result |
|------|--------|-------|-----------------|
| 1 | Call isToolAllowed | `toolName: "any_tool"`, `patterns: []` | Returns `false` |

---

### UT-05: isToolAllowed — undefined patterns returns true (no restriction)

| Field | Value |
|-------|-------|
| ID | UT-05 |
| Priority | High |
| Traces To | BR-08 |
| Component | ToolFilter.isToolAllowed |

| Step | Action | Input | Expected Result |
|------|--------|-------|-----------------|
| 1 | Call isToolAllowed | `toolName: "any_tool"`, `patterns: undefined` | Returns `true` |

---

### UT-06: filterTools — filters correct subset

| Field | Value |
|-------|-------|
| ID | UT-06 |
| Priority | High |
| Traces To | BR-05, BR-06 |
| Component | ToolFilter.filterTools |

**Preconditions:** Tool list with 5 tools: `["mem_search", "code_search", "code_symbols", "grep_search", "read_file"]`

| Step | Action | Input | Expected Result |
|------|--------|-------|-----------------|
| 1 | Call filterTools | `patterns: ["mem_search", "code_*"]` | Returns 3 tools: `["mem_search", "code_search", "code_symbols"]` |

---

### UT-07: filterTools — empty patterns returns empty array

| Field | Value |
|-------|-------|
| ID | UT-07 |
| Priority | High |
| Traces To | BR-09 |
| Component | ToolFilter.filterTools |

| Step | Action | Input | Expected Result |
|------|--------|-------|-----------------|
| 1 | Call filterTools | `tools: [5 tools]`, `patterns: []` | Returns `[]` |

---

### UT-08: buildToolBlockedMessage — formats correct error string

| Field | Value |
|-------|-------|
| ID | UT-08 |
| Priority | Medium |
| Traces To | FSD §3.2.2 EF-01 |
| Component | ToolFilter.buildToolBlockedMessage |

| Step | Action | Input | Expected Result |
|------|--------|-------|-----------------|
| 1 | Call buildToolBlockedMessage | `toolName: "grep_search"`, `agentId: "code-reviewer"`, `patterns: ["mem_search", "code_*"]` | Returns string containing "grep_search", "code-reviewer", and "mem_search, code_*" |
| 2 | Call with >5 patterns | `patterns: ["a","b","c","d","e","f"]` | Returns string with "... (6 total)" truncation |

---

### UT-09: selectAgent — resolves config with model field

| Field | Value |
|-------|-------|
| ID | UT-09 |
| Priority | High |
| Traces To | BR-12, BR-15 |
| Component | AgentConfigResolver.selectAgent |

**Preconditions:** Mock `findAgentMeta` returns agent with `model: "claude-sonnet-4-20250514"`, `tools: ["code_*"]`

| Step | Action | Input | Expected Result |
|------|--------|-------|-----------------|
| 1 | Call selectAgent | `agentId: "code-reviewer"` | Returns `{ agentId: "code-reviewer", agentName: "Code Reviewer" }` |
| 2 | Call getActiveConfig | — | Returns config with `model: "claude-sonnet-4-20250514"`, `toolPatterns: ["code_*"]` |

---

### UT-10: selectAgent(null) — clears config (fallback)

| Field | Value |
|-------|-------|
| ID | UT-10 |
| Priority | High |
| Traces To | BR-25, BR-29 |
| Component | AgentConfigResolver.selectAgent |

**Preconditions:** Previous agent selected (activeConfig is not null)

| Step | Action | Input | Expected Result |
|------|--------|-------|-----------------|
| 1 | Call selectAgent | `agentId: null` | Returns `{ agentId: null, agentName: "All Agents (Default)" }` |
| 2 | Call getActiveConfig | — | Returns `null` |

---

### UT-11: selectAgent — missing agent returns fallback

| Field | Value |
|-------|-------|
| ID | UT-11 |
| Priority | High |
| Traces To | FSD §3.1.2 EF-01 |
| Component | AgentConfigResolver.selectAgent |

**Preconditions:** Mock `findAgentMeta` returns `undefined` for given ID

| Step | Action | Input | Expected Result |
|------|--------|-------|-----------------|
| 1 | Call selectAgent | `agentId: "nonexistent-agent"` | Returns `{ agentId: null, agentName: "All Agents (Default)" }` |
| 2 | Call getActiveConfig | — | Returns `null` |
| 3 | Verify console.warn called | — | Warning logged with agent ID |

---

### UT-12: readAgentBody — strips frontmatter correctly

| Field | Value |
|-------|-------|
| ID | UT-12 |
| Priority | High |
| Traces To | BR-16 |
| Component | AgentConfigResolver.readAgentBody |

**Preconditions:** Mock file content:
```
---
id: test
name: Test Agent
tools: []
---
This is the agent body.

With multiple paragraphs.
```

| Step | Action | Input | Expected Result |
|------|--------|-------|-----------------|
| 1 | Call readAgentBody | `filePath: "/path/to/agent.md"` | Returns `"This is the agent body.\n\nWith multiple paragraphs."` |

---

### UT-13: readAgentBody — file not found returns empty string

| Field | Value |
|-------|-------|
| ID | UT-13 |
| Priority | Medium |
| Traces To | FSD §3.1.2 EF-01 |
| Component | AgentConfigResolver.readAgentBody |

**Preconditions:** File does not exist on disk

| Step | Action | Input | Expected Result |
|------|--------|-------|-----------------|
| 1 | Call readAgentBody | `filePath: "/nonexistent/path.md"` | Returns `""` |
| 2 | Verify console.warn called | — | Warning logged with file path |

---

### UT-14: getActiveConfig — returns null when no agent selected

| Field | Value |
|-------|-------|
| ID | UT-14 |
| Priority | High |
| Traces To | BR-25 |
| Component | AgentConfigResolver.getActiveConfig |

**Preconditions:** Fresh instance (no selectAgent called)

| Step | Action | Input | Expected Result |
|------|--------|-------|-----------------|
| 1 | Call getActiveConfig | — | Returns `null` |

---

### UT-15: getActiveConfig — returns config after selectAgent

| Field | Value |
|-------|-------|
| ID | UT-15 |
| Priority | High |
| Traces To | BR-22 |
| Component | AgentConfigResolver.getActiveConfig |

**Preconditions:** selectAgent("code-reviewer") called successfully

| Step | Action | Input | Expected Result |
|------|--------|-------|-----------------|
| 1 | Call getActiveConfig | — | Returns non-null ActiveAgentConfig with matching agentId |
| 2 | Verify resolvedAt | — | `resolvedAt` is a recent timestamp (within 1s of now) |

---

### UT-16: clear() — resets to null

| Field | Value |
|-------|-------|
| ID | UT-16 |
| Priority | Medium |
| Traces To | BR-25 |
| Component | AgentConfigResolver.clear |

**Preconditions:** Agent previously selected

| Step | Action | Input | Expected Result |
|------|--------|-------|-----------------|
| 1 | Call clear() | — | — |
| 2 | Call getActiveConfig | — | Returns `null` |

---

### UT-17: selectAgent — empty body after frontmatter strip

| Field | Value |
|-------|-------|
| ID | UT-17 |
| Priority | Medium |
| Traces To | FSD §3.1.2 EF-02 |
| Component | AgentConfigResolver.selectAgent |

**Preconditions:** Mock file content is only frontmatter (no body):
```
---
id: empty
name: Empty Agent
---
```

| Step | Action | Input | Expected Result |
|------|--------|-------|-----------------|
| 1 | Call selectAgent | `agentId: "empty"` | Returns `{ agentId: "empty", agentName: "Empty Agent" }` |
| 2 | Call getActiveConfig | — | Returns config with `systemPromptBody: ""` |
| 3 | Verify console.warn called | — | Warning logged about empty body |

---

## 3. Integration Testing (IT)

### IT-01: agent_step node filters tools via active config

| Field | Value |
|-------|-------|
| ID | IT-01 |
| Priority | High |
| Traces To | BR-05, BR-06, UC-02 |
| Components | createAgentStepNode + ToolFilter + AgentConfigResolver |

**Preconditions:**
- AgentConfigResolver with active agent `tools: ["mem_search", "code_*"]`
- Mock LlmProvider
- Tool list: `["mem_search", "code_search", "code_symbols", "grep_search", "read_file"]`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke agent_step node with state containing 5 tools | LlmProvider.chatWithTools called with 3 tools only: `["mem_search", "code_search", "code_symbols"]` |
| 2 | Verify `grep_search` and `read_file` NOT in LLM call | Tools not present in chatWithTools argument |

---

### IT-02: execute_tools blocks disallowed tool call

| Field | Value |
|-------|-------|
| ID | IT-02 |
| Priority | High |
| Traces To | BR-05, FSD §6.3 |
| Components | createExecuteToolsNode + ToolFilter + AgentConfigResolver |

**Preconditions:**
- Active agent with `tools: ["mem_search"]`
- State with `toolCalls: [{ id: "tc1", name: "grep_search", arguments: {} }]`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke execute_tools node | Result contains error content for `tc1` |
| 2 | Verify error message | Contains "grep_search", "not available", and agent ID |
| 3 | Verify MCP Bridge NOT called | `mcpBridge.executeTool` not invoked |

---

### IT-03: execute_tools allows permitted tool call

| Field | Value |
|-------|-------|
| ID | IT-03 |
| Priority | High |
| Traces To | BR-05, BR-06 |
| Components | createExecuteToolsNode + ToolFilter + AgentConfigResolver |

**Preconditions:**
- Active agent with `tools: ["mem_*"]`
- State with `toolCalls: [{ id: "tc1", name: "mem_search", arguments: { query: "test" } }]`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke execute_tools node | MCP Bridge called with `mem_search` |
| 2 | Verify result contains tool output | Result has content from MCP execution |

---

### IT-04: agent_step passes model to LlmProvider options

| Field | Value |
|-------|-------|
| ID | IT-04 |
| Priority | High |
| Traces To | BR-12, BR-14 |
| Components | createAgentStepNode + AgentConfigResolver + LlmProvider |

**Preconditions:**
- Active agent with `model: "claude-sonnet-4-20250514"`
- Mock LlmProvider capturing `LlmOptions`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke agent_step node | LlmProvider called with `options.model === "claude-sonnet-4-20250514"` |

---

### IT-05: agent_step uses default model when config.model undefined

| Field | Value |
|-------|-------|
| ID | IT-05 |
| Priority | High |
| Traces To | BR-13, BR-27 |
| Components | createAgentStepNode + AgentConfigResolver + LlmProvider |

**Preconditions:**
- Active agent with `model: undefined`
- Mock LlmProvider capturing `LlmOptions`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke agent_step node | LlmProvider called with `options.model === undefined` (or not set) |

---

### IT-06: buildFinalSystemPrompt returns agent body when selected

| Field | Value |
|-------|-------|
| ID | IT-06 |
| Priority | High |
| Traces To | BR-16, BR-18 |
| Components | buildFinalSystemPrompt + AgentConfigResolver |

**Preconditions:**
- Active agent with body: `"You are a code reviewer. Review all code for quality."`
- Steering rules loaded

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call buildFinalSystemPrompt(state) | Result contains "You are a code reviewer" |
| 2 | Verify no other agent bodies present | Result does NOT contain other agents' instructions |
| 3 | Verify "# Agent Instructions" section header | Header present before agent body |

---

### IT-07: buildFinalSystemPrompt returns all-agents when no selection

| Field | Value |
|-------|-------|
| ID | IT-07 |
| Priority | High |
| Traces To | BR-25 |
| Components | buildFinalSystemPrompt + AgentConfigResolver |

**Preconditions:**
- No active agent (getActiveConfig() returns null)
- Multiple agent files exist in workspace

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call buildFinalSystemPrompt(state) | Result contains concatenated agents (multiple agent bodies) |
| 2 | Verify loadAgentInstructions() path used | Content matches current behavior |

---

### IT-08: buildFinalSystemPrompt includes steering regardless

| Field | Value |
|-------|-------|
| ID | IT-08 |
| Priority | High |
| Traces To | BR-17 |
| Components | buildFinalSystemPrompt + AgentConfigResolver |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select agent, call buildFinalSystemPrompt | Steering rules present in output |
| 2 | Deselect agent, call buildFinalSystemPrompt | Steering rules still present in output |

---

### IT-09: Graph invocation reads config per-turn (no rebuild)

| Field | Value |
|-------|-------|
| ID | IT-09 |
| Priority | High |
| Traces To | BR-21, BR-22 |
| Components | LangGraph + AgentConfigResolver |

**Preconditions:**
- Compiled graph instance
- AgentConfigResolver with agent A active

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke graph (message 1) | Uses agent A's config |
| 2 | Switch to agent B via resolver | — |
| 3 | Invoke graph (message 2) — same compiled graph | Uses agent B's config |
| 4 | Verify no graph rebuild occurred | Graph instance is the same object |

---

### IT-10: Rapid selectAgent calls — last-write-wins

| Field | Value |
|-------|-------|
| ID | IT-10 |
| Priority | Medium |
| Traces To | BR-02, BR-24 |
| Components | AgentConfigResolver |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call selectAgent("agent-a") | — |
| 2 | Call selectAgent("agent-b") immediately | — |
| 3 | Call selectAgent("agent-c") immediately | — |
| 4 | Call getActiveConfig() | Returns config for "agent-c" |

---

### IT-11: Mid-session switch preserves message history in state

| Field | Value |
|-------|-------|
| ID | IT-11 |
| Priority | High |
| Traces To | BR-03, BR-19 |
| Components | LangGraph state + AgentConfigResolver |

**Preconditions:**
- 3 messages exchanged with agent A

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Switch to agent B | — |
| 2 | Invoke graph with message 4 | State.messages contains all 4 messages (3 prior + 1 new) |
| 3 | Verify system prompt changed | New prompt uses agent B's body |
| 4 | Verify history messages unchanged | Messages 1-3 content identical |

---

### IT-12: In-flight tool call completes with old config

| Field | Value |
|-------|-------|
| ID | IT-12 |
| Priority | Medium |
| Traces To | BR-04 |
| Components | createExecuteToolsNode + AgentConfigResolver |

**Preconditions:**
- Agent A active with `tools: ["mem_*", "code_*"]`
- Tool call `mem_search` in progress (mocked as slow async)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start execute_tools with `mem_search` call | Execution begins |
| 2 | Switch to agent B with `tools: ["grep_*"]` during execution | — |
| 3 | Wait for execution to complete | `mem_search` completes successfully (not blocked) |

---

### IT-13: SELECT_AGENT message routes to resolver via adapter

| Field | Value |
|-------|-------|
| ID | IT-13 |
| Priority | High |
| Traces To | UC-01, FSD §3.1 |
| Components | ChatEngineAdapter + LangGraphEngine + AgentConfigResolver |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Dispatch `{ type: "chat:selectAgent", agentId: "code-reviewer" }` to adapter | — |
| 2 | Verify resolver.selectAgent called with "code-reviewer" | Called once |
| 3 | Verify AGENT_SWITCHED sent back | Response contains `{ type: "chat:agentSwitched", agentId: "code-reviewer", agentName: "Code Reviewer" }` |

---

### IT-14: Fallback mode — no tool restriction, default model

| Field | Value |
|-------|-------|
| ID | IT-14 |
| Priority | High |
| Traces To | BR-25, BR-26, BR-27 |
| Components | Full pipeline (no agent selected) |

**Preconditions:**
- getActiveConfig() returns null
- 5 tools available from MCP

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke agent_step | LlmProvider called with all 5 tools |
| 2 | Verify model option | `options.model` is undefined (default) |
| 3 | Verify system prompt | Contains concatenated agents (not single agent body) |

---

## 4. E2E API Testing (E2E-API)

### E2E-API-01: Select agent → send message → only allowed tools in LLM call

| Field | Value |
|-------|-------|
| ID | E2E-API-01 |
| Priority | High |
| Traces To | Story 1, UC-02, TC-01, TC-02 |

**Preconditions:**
- Engine initialized with mock LlmProvider
- Agent "code-reviewer" registered with `tools: ["code_*", "read_file"]`
- MCP tools available: `["code_search", "code_symbols", "mem_search", "grep_search", "read_file"]`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send SELECT_AGENT("code-reviewer") | AGENT_SWITCHED received |
| 2 | Send SEND_PROMPT("Review this code") | Graph invoked |
| 3 | Capture LlmProvider.chatWithTools args | Tools contain only: `["code_search", "code_symbols", "read_file"]` |
| 4 | Verify `mem_search` and `grep_search` excluded | Not in tools argument |

---

### E2E-API-02: Select agent with tools:[] → LLM receives no tools

| Field | Value |
|-------|-------|
| ID | E2E-API-02 |
| Priority | High |
| Traces To | Story 1, TC-04, BR-09 |

**Preconditions:**
- Agent "text-only" registered with `tools: []`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send SELECT_AGENT("text-only") | AGENT_SWITCHED received |
| 2 | Send SEND_PROMPT("Hello") | Graph invoked |
| 3 | Verify LlmProvider call | Called with `chat()` (no tools) OR `chatWithTools([], ...)` |

---

### E2E-API-03: Blocked tool call → error returned to LLM scratchpad

| Field | Value |
|-------|-------|
| ID | E2E-API-03 |
| Priority | High |
| Traces To | Story 1, TC-03, FSD §6.3 |

**Preconditions:**
- Agent "code-reviewer" active with `tools: ["code_*"]`
- Mock LlmProvider returns tool call to `grep_search`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Invoke graph (LLM returns tool_use: grep_search) | — |
| 2 | execute_tools processes the call | Error content returned |
| 3 | Verify error message | Contains "grep_search", "not available", "code-reviewer" |
| 4 | Verify MCP NOT called for grep_search | mcpBridge.executeTool not invoked |

---

### E2E-API-04: Select agent with model → LLM called with override

| Field | Value |
|-------|-------|
| ID | E2E-API-04 |
| Priority | High |
| Traces To | Story 2, TC-06, BR-12 |

**Preconditions:**
- Agent "deep-thinker" registered with `model: "claude-sonnet-4-20250514"`
- Mock LlmProvider capturing options

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send SELECT_AGENT("deep-thinker") | AGENT_SWITCHED received |
| 2 | Send SEND_PROMPT("Explain monads") | Graph invoked |
| 3 | Capture LlmProvider options | `options.model === "claude-sonnet-4-20250514"` |

---

### E2E-API-05: Select agent without model → default model used

| Field | Value |
|-------|-------|
| ID | E2E-API-05 |
| Priority | High |
| Traces To | Story 2, TC-07, BR-13 |

**Preconditions:**
- Agent "basic-helper" registered with no `model` field

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send SELECT_AGENT("basic-helper") | AGENT_SWITCHED received |
| 2 | Send SEND_PROMPT("Hello") | Graph invoked |
| 3 | Capture LlmProvider options | `options.model === undefined` |

---

### E2E-API-06: Select agent → system prompt contains only agent body

| Field | Value |
|-------|-------|
| ID | E2E-API-06 |
| Priority | High |
| Traces To | Story 3, TC-09, BR-16, BR-18 |

**Preconditions:**
- Agent "code-reviewer" with body: "You review code for quality and security."
- Other agents exist: "ba-agent", "dev-agent"

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send SELECT_AGENT("code-reviewer") | AGENT_SWITCHED received |
| 2 | Send SEND_PROMPT("Review") | Graph invoked |
| 3 | Capture system prompt passed to LLM | Contains "You review code for quality and security" |
| 4 | Verify exclusion | Does NOT contain ba-agent or dev-agent instructions |

---

### E2E-API-07: Deselect agent → system prompt contains all agents

| Field | Value |
|-------|-------|
| ID | E2E-API-07 |
| Priority | High |
| Traces To | Story 6, TC-10, BR-25 |

**Preconditions:**
- Agent previously selected, now deselected

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send SELECT_AGENT(null) | AGENT_SWITCHED with null |
| 2 | Send SEND_PROMPT("Hello") | Graph invoked |
| 3 | Capture system prompt | Contains concatenated agents (multiple agent bodies) |

---

### E2E-API-08: Steering rules present regardless of agent selection

| Field | Value |
|-------|-------|
| ID | E2E-API-08 |
| Priority | High |
| Traces To | Story 3, TC-11, BR-17 |

**Preconditions:**
- Steering file with `inclusion: always` containing "ALWAYS_PRESENT_MARKER"

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select agent, send message, capture prompt | Prompt contains "ALWAYS_PRESENT_MARKER" |
| 2 | Deselect agent, send message, capture prompt | Prompt still contains "ALWAYS_PRESENT_MARKER" |

---

### E2E-API-09: SELECT_AGENT message → AGENT_SWITCHED response

| Field | Value |
|-------|-------|
| ID | E2E-API-09 |
| Priority | High |
| Traces To | Story 4, UC-01, FSD §3.1.4 |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send `{ type: "chat:selectAgent", agentId: "code-reviewer" }` | — |
| 2 | Capture response message | `{ type: "chat:agentSwitched", agentId: "code-reviewer", agentName: "Code Reviewer" }` |

---

### E2E-API-10: SELECT_AGENT(null) → AGENT_SWITCHED with null

| Field | Value |
|-------|-------|
| ID | E2E-API-10 |
| Priority | High |
| Traces To | Story 6, FSD §3.1.2 AF-01 |

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send `{ type: "chat:selectAgent", agentId: null }` | — |
| 2 | Capture response message | `{ type: "chat:agentSwitched", agentId: null, agentName: "All Agents (Default)" }` |

---

### E2E-API-11: Switch A→B mid-session → next message uses B's config

| Field | Value |
|-------|-------|
| ID | E2E-API-11 |
| Priority | High |
| Traces To | Story 5, TC-12, BR-03 |

**Preconditions:**
- Agent A active with `model: "model-a"`, `tools: ["tool_a"]`
- Agent B with `model: "model-b"`, `tools: ["tool_b"]`
- 3 messages exchanged

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send SELECT_AGENT("agent-b") | AGENT_SWITCHED |
| 2 | Send SEND_PROMPT("Message 4") | Graph invoked |
| 3 | Verify LlmProvider options | `model === "model-b"` |
| 4 | Verify tools | Only "tool_b" pattern applied |
| 5 | Verify prompt | Contains agent B's body |

---

### E2E-API-12: Switch preserves conversation history (messages array)

| Field | Value |
|-------|-------|
| ID | E2E-API-12 |
| Priority | High |
| Traces To | Story 5, TC-12, BR-03, BR-19 |

**Preconditions:**
- 3 messages exchanged with agent A

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send SELECT_AGENT("agent-b") | — |
| 2 | Send SEND_PROMPT("Message 4") | — |
| 3 | Capture messages sent to LLM | Array contains messages 1-3 (prior) + message 4 |
| 4 | Verify prior message content unchanged | Content and roles match original |

---

### E2E-API-13: No agent selected → all tools available

| Field | Value |
|-------|-------|
| ID | E2E-API-13 |
| Priority | High |
| Traces To | Story 6, BR-26 |

**Preconditions:**
- No agent selected (fresh start)
- 5 MCP tools available

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send SEND_PROMPT("Hello") | Graph invoked |
| 2 | Capture tools in LLM call | All 5 tools present |

---

### E2E-API-14: No agent selected → concatenated prompt (6000 char budget)

| Field | Value |
|-------|-------|
| ID | E2E-API-14 |
| Priority | Medium |
| Traces To | Story 6, BR-25 |

**Preconditions:**
- No agent selected
- Multiple agent files in workspace

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send SEND_PROMPT("Hello") | Graph invoked |
| 2 | Capture system prompt | Contains multiple agent bodies concatenated |
| 3 | Verify total agent section ≤ 6000 chars | Length check passes |

---

## 5. E2E UI Testing (E2E-UI) — Gherkin Scenarios

### E2E-UI-01: User selects agent from dropdown

```gherkin
Feature: Agent Selection UI
  Scenario: Select agent updates badge and dispatches message
    Given the chat panel is open
    And agents "code-reviewer", "ba-agent", "dev-agent" are loaded
    When I click the agent selector dropdown
    And I select "Code Reviewer"
    Then the agent badge shows "Code Reviewer"
    And a "chat:selectAgent" message with agentId "code-reviewer" is dispatched
    And I receive "chat:agentSwitched" confirmation within 100ms
```

---

### E2E-UI-02: User switches agent mid-session

```gherkin
Feature: Mid-Session Agent Switch
  Scenario: Switch agent preserves messages and updates prompt
    Given the chat panel is open with agent "ba-agent" selected
    And I have exchanged 3 messages
    When I select "dev-agent" from the dropdown
    Then the agent badge changes to "Dev Agent"
    And the previous 3 messages remain visible in the chat
    And the next message I send uses "dev-agent" configuration
```

---

### E2E-UI-03: User deselects agent

```gherkin
Feature: Agent Deselection
  Scenario: Deselect returns to default mode
    Given the chat panel is open with agent "code-reviewer" selected
    When I click "Deselect" (or select "All Agents")
    Then the agent badge shows default state
    And a "chat:selectAgent" message with agentId null is dispatched
    And subsequent messages use all-agents concatenated mode
```

---

## 6. System Integration Testing (SIT) — Manual

### SIT-01: Agent switch latency < 100ms

| Field | Value |
|-------|-------|
| ID | SIT-01 |
| Priority | Medium |
| Traces To | BR-01, BR-23, TC-15 |
| Type | Manual / Performance |

**Environment:** VS Code 1.85+ with extension loaded, 5+ agents registered

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open chat panel | Panel loads with agent dropdown |
| 2 | Open DevTools (Developer: Toggle Developer Tools) | Performance tab available |
| 3 | Start performance recording | — |
| 4 | Select agent from dropdown | — |
| 5 | Stop recording, measure time from click to AGENT_SWITCHED | < 100ms |
| 6 | Repeat 5 times | All measurements < 100ms |

---

### SIT-02: Extension startup with no agent selected = current behavior

| Field | Value |
|-------|-------|
| ID | SIT-02 |
| Priority | High |
| Traces To | BR-28, Story 6 |
| Type | Manual / Regression |

**Environment:** Fresh VS Code window with extension

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Launch VS Code with extension | Extension activates |
| 2 | Open chat panel | No agent badge shown (default state) |
| 3 | Send a message | Response received normally |
| 4 | Verify tools available | LLM can use any tool (no restriction) |
| 5 | Compare with pre-feature behavior | Identical response quality |

---

### SIT-03: Agent file deleted while selected → graceful fallback toast

| Field | Value |
|-------|-------|
| ID | SIT-03 |
| Priority | Medium |
| Traces To | TC-14, FSD §9.1 |
| Type | Manual / Error Recovery |

**Environment:** VS Code with extension, agent files in workspace

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select agent "test-agent" | Badge shows "Test Agent" |
| 2 | Delete `test-agent.md` from agents directory | — |
| 3 | Send a message | System does NOT crash |
| 4 | Observe UI | Warning toast: "Agent 'Test Agent' no longer available" |
| 5 | Verify fallback | System operates in all-agents mode |

---

## 7. Test Data Files

### 7.1 test-data/agents/code-reviewer.md

```markdown
---
id: code-reviewer
name: Code Reviewer
description: Reviews code for quality
tools:
  - code_search
  - code_symbols
  - read_file
model: claude-sonnet-4-20250514
---
You are a code reviewer. Review all code for quality, security, and best practices.
Focus on SOLID principles and clean code.
```

### 7.2 test-data/agents/text-only-agent.md

```markdown
---
id: text-only
name: Text Only Agent
description: Agent with no tools
tools: []
---
You are a text-only assistant. You cannot use any tools.
Respond with text only.
```

### 7.3 test-data/agents/no-tools-agent.md

```markdown
---
id: no-tools
name: No Tools Agent
description: Agent without tools field (all tools available)
model: gpt-4o
---
You are a general assistant with access to all tools.
```

### 7.4 test-data/agents/no-model-agent.md

```markdown
---
id: no-model
name: No Model Agent
description: Agent without model field (uses default)
tools:
  - mem_*
  - grep_search
---
You are a research assistant using memory and search tools.
```

### 7.5 test-data/agents/empty-body-agent.md

```markdown
---
id: empty-body
name: Empty Body Agent
description: Agent with empty body
tools:
  - code_*
---
```

### 7.6 test-data/tools.json

```json
[
  { "name": "mem_search", "description": "Search memory" },
  { "name": "mem_ingest", "description": "Ingest to memory" },
  { "name": "code_search", "description": "Search code" },
  { "name": "code_symbols", "description": "Find symbols" },
  { "name": "grep_search", "description": "Grep search" },
  { "name": "read_file", "description": "Read a file" },
  { "name": "fs_write", "description": "Write a file" },
  { "name": "execute_pwsh", "description": "Run shell command" },
  { "name": "find_tools", "description": "Find tools" },
  { "name": "agent_log", "description": "Log agent action" }
]
```

### 7.7 test-data/agent-switch-scenarios.csv

```csv
scenario_id,initial_agent,switch_to,messages_before,expected_model,expected_tools_count
SC-01,code-reviewer,text-only,3,undefined,0
SC-02,text-only,code-reviewer,2,claude-sonnet-4-20250514,3
SC-03,code-reviewer,null,5,undefined,all
SC-04,null,no-tools,0,gpt-4o,all
SC-05,no-model,code-reviewer,1,claude-sonnet-4-20250514,3
```

---

## 8. Appendix

### RTM Coverage Verification

| Business Rule | Test Cases Covering |
|---------------|-------------------|
| BR-01 (100ms) | SIT-01 |
| BR-02 (last-write-wins) | IT-10 |
| BR-03 (history preserved) | IT-11, E2E-API-11, E2E-API-12 |
| BR-04 (in-flight completes) | IT-12 |
| BR-05 (exact match) | UT-01, UT-03, IT-01, E2E-API-01 |
| BR-06 (prefix wildcard) | UT-02, IT-01, E2E-API-01 |
| BR-07 (suffix wildcard only) | PBT-01 |
| BR-08 (undefined = all) | UT-05, IT-14, E2E-API-13 |
| BR-09 ([] = no tools) | UT-04, UT-07, E2E-API-02 |
| BR-10 (deduplicated) | PBT-01 |
| BR-11 (case-sensitive) | UT-01, UT-03 |
| BR-12 (model verbatim) | UT-09, IT-04, E2E-API-04 |
| BR-13 (empty = absent) | IT-05, E2E-API-05 |
| BR-14 (both chat methods) | IT-04 |
| BR-15 (immediate switch) | E2E-API-04 |
| BR-16 (body after ---) | UT-12, IT-06, E2E-API-06 |
| BR-17 (steering preserved) | IT-08, E2E-API-08 |
| BR-18 (prompt structure) | IT-06, E2E-API-06 |
| BR-19 (history preserved) | IT-11, E2E-API-12 |
| BR-20 (synchronous rebuild) | IT-09 |
| BR-21 (no graph rebuild) | IT-09 |
| BR-22 (per-turn resolution) | UT-15, IT-09 |
| BR-23 (100ms processing) | SIT-01 |
| BR-24 (last-write-wins) | IT-10 |
| BR-25 (fallback concat) | UT-10, IT-07, E2E-API-07, E2E-API-14 |
| BR-26 (fallback no restrict) | IT-14, E2E-API-13 |
| BR-27 (fallback default model) | IT-05, IT-14 |
| BR-28 (startup = no agent) | UT-14, SIT-02 |
| BR-29 (deselect = fallback) | UT-10, E2E-API-10, E2E-UI-03 |

**Coverage: 29/29 business rules covered (100%)**
