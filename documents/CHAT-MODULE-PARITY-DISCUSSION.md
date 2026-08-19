# Chat Module Parity Discussion — OpenCode vs Our Extension

**Date:** 2026-08-19
**Participants:** User + Kiro Agent
**Context:** So sánh extension chatbox (LangGraph engine) với OpenCode, xác định gaps và chuẩn hóa format.

---

## 1. Feature Coverage vs OpenCode (~85%)

### ✅ Đã implement:

| Feature | Implementation |
|---------|---------------|
| Streaming AI responses | `StreamProtocolAdapter` + Svelte `ChatMessageList` |
| Tool execution | `OpenCodeToolHandler` + LangGraph pipeline |
| Diff/Patch application | `OpenCodeToolHandler.applyDiff()` + conflict detection (SHA-256) |
| Permission system | `ToolApprovalGate` (timeout, retry, metrics, 2-phase escalation) |
| Session management | `SessionManager` (KB-backed threads, multi-IDE hydration) |
| Context engineering | `IdeContextManager` (token tracking, pruning, relevance scoring) |
| Slash commands | `SlashMenuController` + agents + steering |
| MCP integration | Full MCP client via `mcp/` module |
| Agent routing | `KiroAgentRegistry` + dynamic hot-reload |
| IPC Bridge | `IpcBridge` + JSON-RPC |
| File context picker | `FilePicker`, `FolderPicker`, `FuzzyFilter` |
| Webview UI | Svelte 4 + stores + components |
| Sub-agent | LangGraph subgraphs |

### ❌ Gaps (confirmed):

| # | Feature | Mô tả | Priority |
|---|---------|-------|----------|
| 1 | **Compact session** | (a) `/compact` manual command: summarize để giảm context trong cùng session. (b) Auto-compact: tự trigger khi đạt ~95% context window | High |
| 2 | **File change tracking visualization** | Session-wide diff summary (tất cả files đã thay đổi trong session) | High |
| 3 | **Web/code search tool** | Agent không có tool tìm kiếm external (tương đương Sourcegraph) | Medium |
| 4 | **LSP diagnostics feed** | Feed lỗi realtime từ language server vào agent loop | Medium |

### ❌ Not Applicable (khác platform):

- Non-interactive/headless mode (`-p "prompt"`) — chúng ta là IDE extension, không phải CLI
- External editor (Ctrl+E → vim) — đã trong IDE
- Vim-like keybindings — IDE có sẵn

### 🏆 Features chúng ta có MÀ OpenCode KHÔNG có:

- Context pruning algorithm với relevance scoring
- Tool Approval 2-phase escalation + retry + metrics
- Dynamic Agent Registry (switch agents at runtime)
- Diagram rendering trong chat (`DiagramBlock.svelte`)
- KB-backed persistence (multi-IDE hydration)
- Enrichment Progress UI
- Context Badge pulse animation (>80% usage)

---

## 2. `.code-intel/` Folder Usage Status

| Folder | Loaded by engine? | How |
|--------|-------------------|-----|
| `.code-intel/agents/` | ✅ YES | `KiroAgentRegistry` watch + `chat-graph.ts` load instructions |
| `.code-intel/steering/` | ✅ YES | `steering-loader.ts` recursive scan |
| `.code-intel/skills/` | ✅ YES | Backend `find_skill` tool |
| `.code-intel/hooks/` | ✅ YES (after fix) | `hook-loader.ts` — **fixed** from `.kiro/hooks/` to `.code-intel/hooks/` |

---

## 3. Format Standardization Decisions

### Approach: Best of Claude Code + Kiro

| Type | Adopted From | Format | Rationale |
|------|-------------|--------|-----------|
| **Agents** | **Hybrid** (Kiro + Claude) | YAML frontmatter + markdown body | Cần `phase`, `outputDoc` (Kiro) + `tools`, `model` (Claude) |
| **Steering/Rules** | **Kiro** | Optional YAML frontmatter + markdown | `inclusion: manual/always/fileMatch` saves context. Superior to Claude load-all approach |
| **Hooks** | **Kiro** | Multi-file JSON (`.json`/`.kiro.hook`) | `askAgent` concept + file events. Not merged into 1 file |
| **Skills** | **Agent Skills Standard** (cả Kiro & Claude) | `skills/{name}/SKILL.md` + references/ | Portable, community-compatible (agentskills.io) |
| **MCP** | **Skip** | N/A | Chúng ta dùng backend MCP server, không cần local config |

### Key Decision: Giữ frontmatter cho steering files

```yaml
---
inclusion: manual          # manual | always | fileMatch
description: "..."         # Agent biết file làm gì mà không cần load
fileMatchPattern: "*.ts"   # Auto-load khi đọc matching file
---
```

**Lý do:** Conditional loading tiết kiệm context đáng kể. Claude Code load ALL rules mọi session — không scalable khi có 35+ rule files.

---

## 4. Code Change Applied

### `hook-loader.ts` fix:
- **Before:** Reads from `.kiro/hooks/` (wrong path)
- **After:** Reads from `.code-intel/hooks/` (correct)
- **Tests:** 25/25 pass

---

## 5. All Identified Gaps

### 5.1 Feature Gaps (vs OpenCode)

| # | Feature | Mô tả | Priority | Effort |
|---|---------|-------|----------|--------|
| F1 | **Compact session** | (a) `/compact` manual: summarize để giảm context trong cùng session. (b) Auto-compact: tự trigger khi đạt ~95% context window | High | Medium |
| F2 | **File change tracking visualization** | Session-wide diff summary (tất cả files đã thay đổi trong session) | High | Medium |
| F3 | **Web/code search tool** | Agent không có tool tìm kiếm external (tương đương Sourcegraph) | Medium | Low |
| F4 | **LSP diagnostics feed** | Feed lỗi realtime từ language server vào agent loop | Medium | Low |

### 5.2 LangGraph Runtime Gaps (agent/hook/steering/skill integration)

| # | Component | Gap | Impact | Effort |
|---|-----------|-----|--------|--------|
| R1 | **Agents** | Frontmatter fields (phase, tools, model, outputDoc) không được sử dụng — chỉ body inject | Agents không thể có tool access khác nhau, model khác nhau | Medium |
| R2 | **Agents** | Không có agent routing — tất cả agents concat vào 1 system prompt | Không switch behavior khi user chọn agent khác | High |
| R3 | **Agents** | `KiroAgentRegistry` chỉ dùng cho UI (slash menu), không control runtime | Agent selection UI disconnected from actual LLM behavior | Medium |
| R4 | **Steering** | `inclusion: manual` chưa trigger từ LangGraph engine | Chỉ Kiro host inject được manual rules, engine tự không biết | Low |
| R5 | **Steering** | `inclusion: fileMatch` chưa trigger khi agent đọc file | File-gated rules không auto-load trong agent session | Medium |
| R6 | **Skills** | Không auto-activation — agent phải explicitly call `find_skill` | Agent không tự biết khi nào cần skill, user phải guide | High |
| R7 | **Skills** | Không có `/slash-command` → skill mapping | User không thể invoke skill trực tiếp từ chat input | Medium |
| R8 | **Skills** | `references/` sub-files không lazy-load | Agent reads toàn bộ SKILL.md, không biết về supporting files | Low |
| R9 | **Skills** | Skills không preload vào agent context | Không có cơ chế tương đương Claude `skills:` field trong agent frontmatter | Medium |
| R10 | **Hooks** | `userTriggered` event chưa có UI button | User không thể manually trigger hooks từ webview | Low |
| R11 | **Hooks** | `preTaskExecution`/`postTaskExecution` chưa integrated | Spec task workflow hooks không fire | Low |

### 5.3 Implementation Completeness Summary

| Component | Files Loaded? | Metadata Used? | Runtime Integration | Completeness |
|-----------|:---:|:---:|---|:---:|
| **Agents** | ✅ Body | ❌ Frontmatter ignored | System prompt concat (all agents) | 60% |
| **Steering** | ✅ Filtered | ✅ inclusion/targets/priority | System prompt inject (always only) | 80% |
| **Hooks** | ✅ All valid | ✅ Full schema | Full lifecycle (pre/post tool, prompt, stop) | 90% |
| **Skills** | ✅ On-demand | ⚠️ name+description | MCP tool (manual discovery) | 40% |

---

## 6. Platform Comparison Summary

| Category | Claude Code | Kiro | Our Choice |
|----------|-------------|------|------------|
| Agent frontmatter | Rich (tools, model, hooks, memory, isolation) | Rich (phase, outputDoc, tools) | Hybrid |
| Steering | Plain md, load all | Frontmatter, conditional loading | Kiro |
| Hooks | settings.json, command-only, exit codes | Multi-file, askAgent + runCommand | Kiro |
| Skills | `.claude/skills/{name}/SKILL.md` | `.kiro/skills/{name}/SKILL.md` | Same standard (agentskills.io) |
| Auto-delegation | Based on description matching | Manual via slash commands | Both approaches |
| Memory | Per-agent persistent memory | KB-backed (our custom) | Our KB system |

---

## 7. Official Templates Reference — Detailed Field Specs

### 7.1 Agent (`.code-intel/agents/*.md`)

**File format:** YAML frontmatter (`---` delimited) + Markdown body (system prompt)

#### Frontmatter Fields

| Field | Required | Type | Valid Values | Description |
|-------|----------|------|-------------|-------------|
| `name` | ✅ | string | Lowercase + hyphens, max 64 chars. E.g. `ba-agent`, `dev-agent` | Unique identifier. Must match across registry. Used in routing + logs. |
| `label` | No | string | Any display text. E.g. `"Business Analyst"`, `"Developer"` | Human-readable name shown in UI (agent selector). Falls back to `name` if omitted. |
| `description` | Recommended | string | Max 1024 chars. Clear, actionable. | When this agent should be invoked. Used for auto-delegation matching. |
| `phase` | No | string | `requirements`, `specification`, `design`, `test_planning`, `implementation`, `testing`, `deployment` | SDLC phase this agent is primary for. Used by SM pipeline routing. |
| `tools` | No | string[] | `["read", "write", "shell", "@mcp"]` | Tools agent can access. `@mcp` = all MCP tools. If omitted → inherits all. |
| `outputDoc` | No | string | Filename. E.g. `BRD.md`, `TDD.md`, `source_code.md` | Expected output document name for this agent's primary phase. |
| `model` | No | string | `sonnet`, `opus`, `haiku`, full model ID, or `inherit` | LLM model to use. Default: `inherit` (use session model). |
| `maxTurns` | No | number | Positive integer. E.g. `20`, `50` | Max agentic turns before agent stops. |

#### Body (after closing `---`)

Plain markdown = system prompt. No length limit but recommend < 500 lines for context efficiency.

#### Example

```markdown
---
name: ba-agent
label: Business Analyst
description: Drives requirements and specification phases. Creates BRD and FSD documents.
phase: requirements
tools: ["read", "write", "shell", "@mcp"]
outputDoc: BRD.md
model: inherit
---

You are the Business Analyst who drives the early phases of the SDLC.

**Pipeline Role:**
- **Requirements phase (primary):** You write the BRD.md
- **Specification phase:** You write the FSD.md

**Outputs:**
- BRD.md (Requirements phase)
- FSD.md (Specification phase)
```

---

### 7.2 Hook (`.code-intel/hooks/*.json` or `*.kiro.hook`)

**File format:** JSON object (one hook per file)

#### Fields

| Field | Required | Type | Valid Values | Description |
|-------|----------|------|-------------|-------------|
| `name` | ✅ | string | Any descriptive name. E.g. `"KB Search First"` | Display name for the hook. |
| `version` | ✅ | string | Semver. E.g. `"1.0.0"`, `"2"` | Version for tracking changes. |
| `description` | No | string | Free text, max 500 chars | Human-readable purpose of this hook. |
| `enabled` | No | boolean | `true` (default) or `false` | Set `false` to disable without deleting file. |
| `when` | ✅ | object | See `when` schema below | Trigger condition. |
| `when.type` | ✅ | string | `"promptSubmit"` — user sends message<br>`"agentStop"` — agent finishes<br>`"preToolUse"` — before tool executes<br>`"postToolUse"` — after tool executes<br>`"fileEdited"` — user saves file<br>`"fileCreated"` — new file created<br>`"fileDeleted"` — file deleted<br>`"userTriggered"` — manual button<br>`"preTaskExecution"` — before spec task<br>`"postTaskExecution"` — after spec task | Event type that triggers this hook. |
| `when.patterns` | Conditional | string[] | Glob patterns. E.g. `["*.ts", "*.tsx"]` | **Required** for file events (`fileEdited`/`fileCreated`/`fileDeleted`). |
| `when.toolTypes` | Conditional | string[] | Categories: `"read"`, `"write"`, `"shell"`, `"web"`, `"spec"`, `"*"`<br>Or regex: `".*sql.*"` | **Required** for `preToolUse`/`postToolUse`. Match tool names. |
| `then` | ✅ | object | See `then` schema below | Action to perform when triggered. |
| `then.type` | ✅ | string | `"askAgent"` — inject prompt into agent context<br>`"runCommand"` — execute shell command | Action type. |
| `then.prompt` | Conditional | string | Any text (supports `{{toolName}}`, `{{toolArgs}}`, `{{nodeName}}` placeholders) | **Required** when `then.type = "askAgent"`. Prompt injected to agent. |
| `then.command` | Conditional | string | Shell command. E.g. `"npm run lint"` | **Required** when `then.type = "runCommand"`. |

#### Example

```json
{
  "name": "KB Search First",
  "version": "1.0.0",
  "description": "Remind agent to search KB before responding",
  "enabled": true,
  "when": {
    "type": "promptSubmit"
  },
  "then": {
    "type": "askAgent",
    "prompt": "BEFORE responding, call mem_search with a relevant query."
  }
}
```

#### Example (preToolUse with toolTypes)

```json
{
  "name": "Validate Drawio XML",
  "version": "1.0.0",
  "when": {
    "type": "preToolUse",
    "toolTypes": ["write"]
  },
  "then": {
    "type": "askAgent",
    "prompt": "If writing a .drawio file, verify no self-closing edge cells."
  }
}
```

---

### 7.3 Steering (`.code-intel/steering/*.md`)

**File format:** Optional YAML frontmatter + Markdown body (instructions)

#### Frontmatter Fields (all optional — file works without frontmatter)

| Field | Required | Type | Valid Values | Description |
|-------|----------|------|-------------|-------------|
| `inclusion` | No | string | `"always"` (default) — load every session<br>`"manual"` — load only when user activates via `#` context key<br>`"fileMatch"` — auto-load when agent reads a matching file<br>`"auto"` — system decides based on relevance | When this steering file is loaded into context. |
| `description` | No | string | Max 500 chars. E.g. `"Code standards for all agents"` | What this file is about. Agent sees this without loading full content. |
| `fileMatchPattern` | Conditional | string | Glob pattern. E.g. `"*.ts"`, `".analysis/code-intelligence/**"` | **Required** when `inclusion: fileMatch`. Files that trigger auto-load. |
| `title` | No | string | Any text | Display title (overrides filename-derived title). |
| `priority` | No | number | Integer 1-100. Higher = loaded earlier | Loading order when multiple steering files active. |
| `targets` | No | string | `"langgraph"` (default) — our engine only<br>`"kiro"` — Kiro host only<br>`"all"` — both | Which runtime should load this file. |

#### Body (after optional frontmatter)

Plain markdown. Contains the actual instructions/rules. No length limit.

#### Examples

**Always loaded (no frontmatter needed):**
```markdown
# Code Standards

- Max 200 lines per file
- Max 20 lines per function
- SOLID principles mandatory
```

**Manual activation:**
```markdown
---
inclusion: manual
description: Code Intelligence system reference. Activate when working with indexer scripts.
---

# Code Intelligence System
...
```

**File-match triggered:**
```markdown
---
inclusion: fileMatch
description: Draw.io diagram rules — auto-loads when editing .drawio files
fileMatchPattern: "*.drawio"
---

# Draw.io Rules
- No <mxfile> wrapper
- Every edge must have <mxGeometry> child
...
```

---

### 7.4 Skill (`.code-intel/skills/{name}/SKILL.md`)

**File format:** YAML frontmatter + Markdown body (instructions)
**Standard:** [Agent Skills (agentskills.io)](https://agentskills.io/specification)

#### Directory Structure

```
.code-intel/skills/
  {skill-name}/
    SKILL.md           ← Required entry point
    references/        ← Optional: detailed docs loaded on-demand
    scripts/           ← Optional: executable automation
    assets/            ← Optional: templates, configs
```

#### SKILL.md Frontmatter Fields

| Field | Required | Type | Valid Values | Description |
|-------|----------|------|-------------|-------------|
| `name` | ✅ | string | Lowercase + hyphens, must match folder name. Max 64 chars. E.g. `drawio-diagrams` | Skill identifier. Used as `/slash-command` name. |
| `description` | ✅ | string | Max 1024 chars. Specific keywords + actions. | When to activate this skill. Agent matches requests against this. |
| `license` | No | string | License name or file ref. E.g. `"MIT"`, `"LICENSE"` | License for sharing/redistribution. |
| `compatibility` | No | string | Environment requirements. E.g. `"requires: node >= 18"` | Pre-conditions for skill to work. |
| `metadata` | No | object | Key-value pairs | Additional info: `author`, `version`, `tags`. |
| `metadata.author` | No | string | E.g. `"team"`, `"john@company.com"` | Skill author. |
| `metadata.version` | No | string | Semver. E.g. `"1.2.0"` | Skill version. |
| `metadata.tags` | No | string[] | E.g. `["diagrams", "documentation"]` | Discovery keywords. |

#### Body (after frontmatter)

Markdown instructions. Keep actionable — this loads into context when skill activates.
Put detailed reference material in `references/` folder (loaded on-demand).

#### Example

```markdown
---
name: drawio-diagrams
description: Create draw.io XML diagrams and export to PNG for SDLC documents. Use when creating architecture, flow, or sequence diagrams.
metadata:
  author: SA4E Team
  version: 1.0.0
  tags: ["diagrams", "documentation", "draw.io"]
---

## Draw.io Diagram Requirements

- **NEVER use Mermaid** — use draw.io for ALL diagrams
- All diagrams stored at `documents/{TICKET}/diagrams/`
- Each diagram: `.drawio` (source) + `.png` (rendered)

## XML Format Rules

- Use bare `<mxGraphModel>` — NO `<mxfile>` wrapper
- Every edge MUST have `<mxGeometry relative="1" as="geometry"/>` child

## Export

Use `drawio_export_png` tool with the `.drawio` file path.

For detailed color palette and layout rules, see `references/color-palette.md`.
```

---

## 8. LangGraph Runtime — How Engine Uses Each File Type

### 8.1 Agents (`.code-intel/agents/*.md`)

**Loader:** `chat-graph.ts` → `loadAgentInstructions(wsRoot)`

**Process:**
1. Reads ALL `.md` files from `.code-intel/agents/`
2. Strips YAML frontmatter (regex: `^---[\s\S]*?---`)
3. Takes body text only
4. Concatenates all agents (max 6000 chars budget)
5. Appends to system prompt as `# Agent Instructions` section

**What WORKS:** Body text of all agents injected into system prompt.

**What DOESN'T work:**
- Frontmatter fields (`phase`, `tools`, `model`, `outputDoc`) completely IGNORED
- No per-agent routing — all agents dumped into 1 prompt
- `KiroAgentRegistry` watches files for UI (slash menu) but doesn't control LLM behavior
- Selecting agent in UI doesn't change which instructions the LLM sees

**Key files:** `extension/src/langgraph/subgraphs/chat-graph.ts`, `extension/src/chat/registry/KiroAgentRegistry.ts`

---

### 8.2 Steering (`.code-intel/steering/*.md`)

**Loader:** `steering-loader.ts` → `loadSteeringRules(wsRoot, "langgraph")`

**Process:**
1. Scans `.code-intel/steering/` recursively
2. Parses YAML frontmatter (inclusion, targets, priority, description)
3. Filters: only `targets = "langgraph"` or `"all"`
4. Filters: only `inclusion = "always"` (default)
5. Sorts by priority (descending)
6. `injectSteering()` appends matched rules to system prompt BEFORE agent instructions

**What WORKS:**
- `targets` filtering ✅
- `inclusion: always` ✅
- Priority ordering ✅
- Frontmatter fully parsed ✅

**What DOESN'T work:**
- `inclusion: manual` — only Kiro host can inject these (via `#` context key)
- `inclusion: fileMatch` — no trigger mechanism when agent reads a file
- `inclusion: auto` — no relevance scoring implemented

**Key files:** `extension/src/langgraph/steering/steering-loader.ts`

---

### 8.3 Hooks (`.code-intel/hooks/*.json` / `*.kiro.hook`)

**Loader:** `hook-loader.ts` → `loadHooks(wsRoot)`
**Runtime:** `hook-engine.ts` → `HookEngine` class

**Process:**
1. Reads ALL `.json` / `.kiro.hook` files from `.code-intel/hooks/`
2. Validates schema (name, version, when, then)
3. Skips disabled (`enabled: false`) or invalid hooks
4. HookEngine fires hooks at lifecycle points:
   - `firePromptSubmit()` — before agent processes user message
   - `firePreToolUse()` — before each tool execution (can DENY)
   - `firePostToolUse()` — after each tool execution
   - `fireAgentStop()` — when agent finishes

**What WORKS (fully):**
- `promptSubmit` → inject KB search reminders, logging ✅
- `preToolUse` → validate drawio XML, access control ✅
- `postToolUse` → post-processing ✅
- `agentStop` → run-log reminders ✅
- `fileEdited`/`fileCreated` → triggered when write tools used ✅
- `askAgent` → prompt injected into next LLM turn ✅
- `runCommand` → shell execution with timeout ✅
- Denial detection (FORBIDDEN, ACCESS_DENIED) ✅
- Circular dependency guard (executionStack) ✅

**What DOESN'T work:**
- `userTriggered` — no UI button in webview
- `preTaskExecution`/`postTaskExecution` — no spec task integration

**Key files:** `extension/src/langgraph/hooks/hook-engine.ts`, `hook-loader.ts`, `hook-executor.ts`, `hook-tool-matcher.ts`

---

### 8.4 Skills (`.code-intel/skills/{name}/SKILL.md`)

**Loader:** Backend MCP tool `find_skill`
**Runtime:** Agent calls tool → reads SKILL.md content

**Process:**
1. Agent (or user) calls `find_skill(query="drawio")`
2. Backend `scanSkills()` reads `.code-intel/skills/*/SKILL.md`
3. Parses frontmatter (name, description)
4. Scores keyword match against query
5. Returns matching skill names + file paths
6. Agent then reads SKILL.md via `read_file` tool if needed

**What WORKS:**
- `find_skill` MCP tool — keyword discovery ✅
- Frontmatter parsing (name, description) ✅
- Agent can read skill content on-demand ✅

**What DOESN'T work:**
- No auto-activation (agent must know to call `find_skill`)
- No `/slash-command` → skill mapping in chat input
- `references/` sub-files not lazy-loaded (agent doesn't know they exist)
- Skills not preloaded into agent context (no equivalent of Claude's `skills:` field)
- No Skill tool in LangGraph toolset (unlike Claude Code's built-in Skill tool)

**Key files:** `backend/src/modules/memory/dispatchers/skills.ts`, `backend/src/modules/memory/definitions/skills.ts`

---

### 8.5 System Prompt Assembly Order

```
┌─────────────────────────────────────────┐
│ 1. AGENT_SYSTEM_PROMPT (base hardcoded) │
├─────────────────────────────────────────┤
│ 2. Steering rules (always, langgraph)   │ ← steering-loader.ts
├─────────────────────────────────────────┤
│ 3. # Agent Instructions                │ ← all agents body concat
├─────────────────────────────────────────┤
│ 4. KB Context (if available)            │ ← from state.kbContext
├─────────────────────────────────────────┤
│ 5. Hook prompts (injected per-turn)     │ ← askAgent hooks fire
└─────────────────────────────────────────┘
```

Skills are NOT in system prompt — loaded on-demand via tool call only.

---

## 9. File Change Reactivity — Hot-Reload Behavior

### Current State

| Component | Hot-reload? | Mechanism | When changes visible? |
|-----------|:-----------:|-----------|------------------------|
| **Agents** | ⚠️ UI only | `KiroAgentRegistry` FileSystemWatcher (300ms debounce) | Slash menu updates. System prompt does NOT reload — graph compiled once. |
| **Steering** | ❌ No | No watcher. `loadSteeringRules` runs once at `buildChatSubgraph`. | Only after restart (new session or reload extension). |
| **Hooks** | ⚠️ Manual | `HookEngine.reload()` exists but not auto-triggered. No watcher. | Cache persists until `clearHookCache()`. Effectively = restart. |
| **Skills** | ✅ Instant | No cache — `scanSkills()` reads disk every `find_skill` call. | Immediate on next tool call. |

### Root Cause

`buildChatSubgraph()` compiles the LangGraph StateGraph **once** per session:
- Steering rules baked into `enrichedSystemPrompt` at compile time
- Agent instructions baked into `enrichedSystemPrompt` at compile time
- Graph nodes reference the frozen prompt via closure
- No mechanism to invalidate/rebuild mid-session

### Gaps (reactivity)

| # | Gap | Fix Approach |
|---|-----|--------------|
| HR1 | Agent file changes not reflected in LLM prompt | `KiroAgentRegistry.onAgentsChanged` → re-run `loadAgentInstructions` → update `enrichedSystemPrompt` reference |
| HR2 | Steering file changes not reflected | Add FileSystemWatcher for `.code-intel/steering/` → re-run `loadSteeringRules` → update prompt |
| HR3 | Hook file changes not reflected | Add FileSystemWatcher for `.code-intel/hooks/` → auto-call `hookEngine.reload()` |
| HR4 | System prompt is frozen closure | Refactor: make `enrichedSystemPrompt` a reactive getter or event-driven rebuild (not full graph recompile) |

### Design Consideration

Claude Code approach: watches `.claude/agents/` and auto-detects changes within seconds. New session uses updated definition. Kiro approach: similar watch + debounce.

Our `KiroAgentRegistry` already has the watcher — the gap is connecting it to the LLM prompt, not the UI.

---

## 10. Custom Editors — UI for Managing Agent/Hook/Steering/Skill Files

### Requirement

User cần custom editor UI (form-based) để tạo/sửa các file configuration thay vì edit raw YAML/JSON.

### Proposed Editors

| File Type | Editor Approach | Key UI Elements |
|-----------|----------------|-----------------|
| **Agent** `.md` | Webview Custom Editor | Form: name, label, phase (dropdown), tools (tag input), model (dropdown), outputDoc. Below: Monaco markdown editor cho body (system prompt) |
| **Hook** `.json` | Webview Custom Editor | Form: name, version, enabled (toggle). Event type dropdown → conditional fields (patterns, toolTypes). Action type radio → prompt textarea or command input |
| **Steering** `.md` | Webview Custom Editor | Form: inclusion (dropdown), description, fileMatchPattern (conditional). Below: Monaco markdown editor cho body |
| **Skill** `SKILL.md` | Webview Custom Editor + File Tree | Form: name, description, metadata fields. File tree showing references/, scripts/, assets/ subfolders |

### Implementation Options

**Option A: VS Code Custom Editor API**
- Register `CustomEditorProvider` for each file pattern
- When user opens `.code-intel/agents/*.md` → show form UI instead of raw text
- Pros: Seamless UX, integrated into editor tabs
- Cons: Complex implementation, must handle file save/sync

**Option B: Sidebar Panel (like Kiro)**
- TreeView in explorer sidebar listing all agents/hooks/steering/skills
- Click item → open form in webview panel
- Pros: Centralized management, simpler than Custom Editor
- Cons: Separate from file explorer, user might still open raw files

**Option C: Hybrid (Recommended)**
- Sidebar TreeView for discovery + CRUD operations
- Custom Editor for detailed editing (form + preview)
- Raw text editor still accessible (right-click → "Open as Text")

### Reference Implementations

- **Kiro:** "Agent Steering & Skills" section in Kiro panel (sidebar TreeView + import/create)
- **Claude Code:** File-based only (no GUI editor), relies on asking Claude to write files
- **VS Code Settings:** Form-based editor for `settings.json` — same concept

### Gap IDs

| # | Gap | Priority |
|---|-----|----------|
| UI1 | Agent editor (form + markdown) | Medium |
| UI2 | Hook editor (form with conditional fields) | Medium |
| UI3 | Steering editor (form + markdown) | Low |
| UI4 | Skill editor (form + file tree) | Low |
| UI5 | Sidebar TreeView for all config types | High |

### Existing Code to Leverage

- `extension/src/webview/` — Svelte webview infrastructure already exists
- `extension/src/chat/registry/KiroAgentRegistry.ts` — already watches agent files
- `extension/src/sidebar/` — sidebar panel infrastructure exists
- Svelte 4 + Vite build pipeline ready

### ⛔ DECISION: Dual-Tab Custom Editor (Form + Text)

**Quyết định:** Mỗi editor LUÔN có 2 tabs:
- **Tab 1: Form** — visual editor với form fields (dropdowns, toggles, text areas)
- **Tab 2: Text** — raw source view (markdown hoặc JSON)

Hai tab **sync 2 chiều**: edit Form → Text cập nhật; edit Text → Form cập nhật.

```
┌─────────────────────────────────────────────────┐
│ [📋 Form]  [📝 Text]                            │
├─────────────────────────────────────────────────┤
│                                                 │
│  Name: [ba-agent          ]                     │
│  Label: [Business Analyst  ]                    │
│  Phase: [requirements ▾]                        │
│  Tools: [read] [write] [shell] [@mcp] [+]      │
│  Model: [inherit ▾]                             │
│  Output: [BRD.md           ]                    │
│                                                 │
│  ─── System Prompt ───────────────────────      │
│  │ You are the Business Analyst who...  │       │
│  │                                      │       │
│  └──────────────────────────────────────┘       │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Implementation:** VS Code `CustomEditorProvider` API — register for `.code-intel/agents/*.md`, `.code-intel/hooks/*.json`, `.code-intel/hooks/*.kiro.hook`, `.code-intel/steering/*.md`, `.code-intel/skills/*/SKILL.md`.

**Sync mechanism:** Form ↔ Text via bidirectional serializer:
- Form → serialize to YAML frontmatter + markdown body (or JSON for hooks)
- Text → parse frontmatter/JSON → populate form fields
- Dirty state tracked, save triggers both sync + file write

---

## 11. Slash Commands for Creating Config Files

### Requirement

Thêm 4 slash commands vào chat input. User nhập mô tả → LLM generate file theo đúng template → lưu vào `.code-intel/`.

### Commands

| Command | Input | Output | Location |
|---------|-------|--------|----------|
| `/create-new-agent` | Mô tả agent (role, responsibilities, tools cần) | `.md` file với YAML frontmatter + system prompt | `.code-intel/agents/{name}.md` |
| `/create-new-hook` | Mô tả hook (khi nào trigger, làm gì) | `.json` file theo hook schema | `.code-intel/hooks/{name}.json` |
| `/create-new-steering` | Mô tả rule (áp dụng khi nào, nội dung) | `.md` file với optional frontmatter + body | `.code-intel/steering/{name}.md` |
| `/create-new-skill` | Mô tả skill (mục đích, khi nào dùng) | Folder `{name}/` + `SKILL.md` | `.code-intel/skills/{name}/SKILL.md` |

### Flow

```
User types: /create-new-agent
  → Chat input shows prompt: "Mô tả agent bạn muốn tạo:"
  → User enters: "QA agent kiểm tra code quality, chạy tests, report bugs"
  → LLM receives: description + template spec (from section 7)
  → LLM generates: complete file content following exact template
  → System writes file to correct location
  → Opens file in dual-tab editor (Form + Text)
  → User reviews/edits → Save
```

### LLM Prompt Template (internal)

Mỗi command inject prompt hướng dẫn LLM generate đúng format:

```
You are generating a {type} configuration file.

TEMPLATE SPEC:
{inject section 7.x field specs}

USER DESCRIPTION:
{user input}

Generate the complete file content following the template exactly.
- All required fields MUST be present
- Use appropriate values derived from the description
- Body/instructions should be specific and actionable
```

### Integration Points

- Register trong `SlashMenuItems.ts` (existing slash menu system)
- LLM call via `LangGraphEngine.invokeChat()` with structured prompt
- File write via `vscode.workspace.fs.writeFile()`
- After write → open in custom editor
- Hot-reload picks up new file automatically (after HR1-HR3 fixes)

### Gap IDs

| # | Gap | Priority |
|---|-----|----------|
| CMD1 | `/create-new-agent` command | Medium |
| CMD2 | `/create-new-hook` command | Medium |
| CMD3 | `/create-new-steering` command | Low |
| CMD4 | `/create-new-skill` command | Low |

---

## 12. OpenCode Commands Analysis — Which to Adopt

### Full Assessment

| Command | OpenCode Function | Adopt? | Reason | Priority |
|---------|------------------|:------:|--------|----------|
| `/agents` | Switch agent | ✅ | Already have AgentSelector UI, need runtime connection | High |
| `/compact` | Compact session | ✅ | Gap F1 — reduce context within session | High |
| `/connect` | Connect provider | ❌ | IDE extension uses config, no runtime connect needed | - |
| `/copy` | Copy transcript | ✅ | Useful — copy chat to clipboard for sharing | Medium |
| `/debug` | View debug info | ✅ | Token usage, tool calls, hook fires visibility | Medium |
| `/diff` | Open diff viewer | ✅ | Gap F2 — session-wide file changes summary | High |
| `/editor` | Open editor | ❌ | Already in IDE | - |
| `/exit` | Exit app | ❌ | IDE extension doesn't "exit" | - |
| `/export` | Export transcript | ⚠️ | Nice-to-have, export to md/json | Low |
| `/fork` | Fork session | ⚠️ | Branch conversation — advanced | Low |
| `/help` | Help | ✅ | Show available commands + shortcuts | Medium |
| `/init` | AGENTS.md setup | ✅ | First-time project config wizard | Medium |
| `/mcps` | Toggle MCPs | ⚠️ | We use backend, but could toggle tools | Low |
| `/models` | Switch model | ✅ | Switch LLM model mid-session | High |
| `/move` | Move project dir | ❌ | IDE handles workspace | - |
| `/new` | New session | ✅ | Reset chat, start fresh | High |
| `/rename` | Rename session | ⚠️ | Useful with session history | Low |
| `/review` | Review changes | ✅ | Code review (commit/branch/PR) — core dev workflow | High |
| `/sessions` | Switch session | ✅ | Multiple conversations, switch between them | Medium |
| `/share` | Share session | ⚠️ | Export shareable link — complex | Low |
| `/skills` | Skills list/invoke | ✅ | List and invoke skills directly | Medium |
| `/status` | View status | ✅ | Connection status, loaded tools/hooks/agents | Medium |
| `/themes` | Switch theme | ❌ | IDE handles themes | - |
| `/thinking` | Expand thinking | ✅ | Show/hide LLM extended thinking | Medium |
| `/timeline` | Jump to message | ⚠️ | Scroll to specific message in long chats | Low |
| `/timestamps` | Show timestamps | ⚠️ | Toggle timestamp per message | Low |
| `/undo` | Undo previous msg | ✅ | Remove last exchange, re-prompt | High |
| `/variants` | Model variant | ❌ | Covered by `/models` | - |

### Priority Tiers

**Tier 1 — Must Have (7 commands):**
`/agents`, `/compact`, `/diff`, `/models`, `/new`, `/review`, `/undo`

**Tier 2 — Should Have (8 commands):**
`/copy`, `/debug`, `/help`, `/init`, `/sessions`, `/skills`, `/status`, `/thinking`

**Tier 3 — Nice to Have (5 commands):**
`/export`, `/fork`, `/rename`, `/timeline`, `/timestamps`

**Not Applicable (6 commands):**
`/connect`, `/editor`, `/exit`, `/move`, `/themes`, `/variants`

### Combined with Section 11 Commands

Total new slash commands needed:
- Section 11: `/create-new-agent`, `/create-new-hook`, `/create-new-steering`, `/create-new-skill`
- Section 12 Tier 1: `/agents`, `/compact`, `/diff`, `/models`, `/new`, `/review`, `/undo`
- Section 12 Tier 2: `/copy`, `/debug`, `/help`, `/init`, `/sessions`, `/skills`, `/status`, `/thinking`

**Grand Total Tier 1+2: 19 slash commands**

### Correction: `/mcps` → Not Applicable

`/mcps` chuyển từ "Maybe" sang **Not Applicable** — chúng ta dùng backend MCP server, không cần toggle tools từ chatbox.

Updated Not Applicable list: `/connect`, `/editor`, `/exit`, `/move`, `/themes`, `/variants`, `/mcps` (7 commands).
