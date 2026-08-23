# User Guide (UG)

## SDLC Agents 4 Enterprise — SA4E-193: Config Commands (create-new-agent/hook/steering/skill)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-193 |
| Title | Config Commands — /create-new-agent, /create-new-hook, /create-new-steering, /create-new-skill |
| Author | DEV Agent |
| Reviewer | BA Agent |
| Version | 2.0 |
| Date | 2026-08-24 |
| Status | Draft |
| Related BRD | BRD-v2-SA4E-193.docx |
| Related FSD | FSD-v2-SA4E-193.docx |
| Related TDD | TDD-v2-SA4E-193.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-23 | DEV Agent | Initial document |
| 1.1 | 2026-08-23 | DEV Agent | Fix §6.2: Replace non-existent error codes with actual error handling behavior; Fix §7: Add authentication documentation for MCP endpoints; Document LLM fallback console-only logging |
| 2.0 | 2026-08-24 | DEV Agent | Refresh per refactored code a618e0b — ConfigCommands thin orchestrators, validation-gate, template-provider confirmedName, ERR-CMD-01..09 |

---

## 1. Introduction

### 1.1 Purpose

SA4E-193 introduces **Config Commands** — a set of 4 VS Code slash commands (`/create-new-agent`, `/create-new-hook`, `/create-new-steering`, `/create-new-skill`) that allow users to generate configuration files for the SDLC Agents system using natural language descriptions. Each command runs a shared pipeline:

**Input dialogs → LLM generation (Copilot, with template fallback) → ValidationGate (mandatory pre-write check) → File write → Editor open + success toast**

The **ValidationGate** validates every LLM generation *before* anything touches disk: invalid or empty content is rejected with an explanatory error toast, and **nothing is written on failure**. When the LLM is unavailable (or returns an empty stream), the system transparently falls back to a deterministic template scaffold that always honors the user-confirmed name.

Since the refactor (commit `a618e0b`), `ConfigCommands.ts` is a thin orchestrator (195 lines); the heavy lifting lives in dedicated modules under `extension/src/commands/`:

| Module | Responsibility |
|--------|----------------|
| `validation-gate.ts` | Mandatory pre-write content gate (normalize → per-type validation) |
| `hook-gate.ts` | Hook branch: strict JSON parse, schema + conditional consistency checks, canonical serialization |
| `frontmatter-utils.ts` | Pure YAML frontmatter utilities (split, strip echo, parse fields, canonical agent builder) |
| `template-provider.ts` | Single source of truth for LLM prompts and fallback scaffolds (uses `confirmedName`) |
| `llm-prompts.ts` | Data-only LLM system prompts per config type |
| `config-command-specs.ts` | Per-command spec table (prompts, placeholders, paths, success/error labels) |
| `name-extractor.ts` | Kebab-case name suggestion from the description |
| `file-writer.ts` | Workspace persistence (single atomic write + collision detection stub) |

This guide covers installation, configuration, usage of each command, administration, troubleshooting, and reference information.

### 1.2 Audience

| Audience | What They Need |
|----------|---------------|
| **AI Agent Developer** | How to create custom agents, hooks, steering rules, and skills for the SDLC pipeline |
| **System Administrator** | How to configure the VS Code extension settings for LLM providers and file generation |
| **Developer** | How to extend or customize the SDLC pipeline configuration files |

### 1.3 Prerequisites

| Prerequisite | Version | Required |
|-------------|---------|----------|
| Node.js | >= 18.14.1 | Yes |
| VS Code / Kiro IDE | >= 1.85.0 | Yes |
| SDLC Agents 4 Enterprise Extension | >= 1.33.0 | Yes |
| VS Code Copilot (optional) | Latest | Optional (for LLM generation) |
| Open workspace folder | >= 1 folder | Yes (commands are skipped without one) |

---

## 2. Getting Started

### 2.1 Quick Start

```bash
# Step 1: Ensure the extension is installed
# Open VS Code/Kiro → Command Palette → "SDLC Agents: Inject All Agents"

# Step 2: Open a workspace with .code-intel/ directory
# (The extension creates this on first inject)
# NOTE: Config Commands require an open workspace folder — without one they
# are not even registered.

# Step 3: Use a slash command in chat
# Type in the chat panel or terminal:
/create-new-agent A documentation agent that generates API docs

# Step 4: Follow the prompts
# 1. Enter description (or use the one provided inline after the command)
# 2. Confirm the suggested agent name (kebab-case, pre-filled automatically)
# 3. Content passes the validation gate, is written, and opens in the editor
```

### 2.2 System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Node.js | 18.14.1 | 20.x |
| VS Code | 1.85.0 | Latest |
| Memory | 512 MB free | 1 GB free |
| Disk | 100 MB free | 500 MB free |
| OS | Windows 10 / macOS 12 / Ubuntu 20.04 | Latest stable |

### 2.3 Distribution Formats

| Format | How to Get | Use Case |
|--------|-----------|----------|
| VS Code Extension (.vsix) | `npm run package:prod` in `extension/` directory | Install via `kiro --install-extension` or VS Code Extensions panel |
| NPM Package | `npm install -g sdlc-agent-4-enterprise-server` | Backend server (required for extension) |

### 2.4 Configuration Methods

The Config Commands are configured through VS Code settings (not environment variables):

| Method | Priority | Best For |
|--------|----------|----------|
| VS Code Settings (UI) | 1 (Highest) | Changing LLM provider, timeouts, proxy |
| `.vscode/settings.json` | 2 | Workspace-specific settings |
| Default values | 3 (Lowest) | Out-of-the-box experience |

### 2.5 Verify Configuration

After installing the extension and starting the backend server:

1. **Check extension is loaded**: Command Palette → "SDLC Agents: Show Status"
   - Expected: ✅ indicators for injected components

2. **Check slash commands are available**: Open chat panel → type `/`
   - Expected: See `/create-new-agent`, `/create-new-hook`, `/create-new-steering`, `/create-new-skill` in the menu

3. **Test a command**: Type `/create-new-agent Test agent for debugging`
   - Expected: Name input box appears, pre-filled with a suggestion derived from your description (e.g., `test-agent-for` — the first three qualifying words; see §4.0)

| Symptom | Cause | Fix |
|---------|-------|-----|
| Slash commands not showing | Extension not loaded | Reload VS Code window (Ctrl+Shift+P → "Reload Window") |
| "No workspace folder open" / commands never appear | No workspace selected | Open a folder in VS Code (registration requires a workspace root) |
| Generated content is generic/scaffold-like | LLM fallback used | Install/sign in to VS Code Copilot for richer generation — the flow still completes correctly |

---

## 3. Configuration

### 3.1 Configuration File

The Config Commands do not use a separate configuration file. All settings are managed through VS Code settings:

- **Global settings**: `~/.config/Code/User/settings.json` (or `%APPDATA%\Code\User\settings.json` on Windows)
- **Workspace settings**: `.vscode/settings.json`

Output locations are fixed by convention (BR-05) and built only from the workspace root plus the confirmed name — there is no setting to redirect them (see §4).

### 3.2 Configuration Reference

#### Extension Settings (kiroSdlc.*)

All properties below were verified against the extension's `package.json` contribution points:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `kiroSdlc.backend.url` | string | `http://127.0.0.1:48721` | Backend server URL |
| `kiroSdlc.mcpServerPort` | number | `9181` | Local MCP wrapper server port |
| `kiroSdlc.enableMcpServer` | boolean | `true` | Enable/disable local MCP server on startup |
| `kiroSdlc.llmProvider` | string (enum) | `anthropic` | Active LLM provider. Allowed: `anthropic`, `openai`, `ollama`, `lmstudio`, `openrouter`, `onnx`, `kiro` |
| `kiroSdlc.llmModel` | string | `""` | Override model for the selected provider |
| `kiroSdlc.configPath` | string | `.code-intel/orchestration.json` | Path to orchestration config file |

Additional backend-related settings referenced in examples:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `kiroSdlc.backend.toolCallTimeout` | number | `300000` | Timeout for MCP tool calls (ms) |
| `kiroSdlc.backend.chatTimeout` | number | `120000` | Timeout for chat responses (ms) |
| `kiroSdlc.backend.healthCheckInterval` | number | `30000` | Health check interval (ms) |

> **Note for LLM generation in Config Commands:** the generation step uses the **VS Code language model API** (`vscode.lm.selectChatModels({ vendor: "copilot" })`). The `kiroSdlc.llmProvider`/`llmModel` settings configure the backend-side LLM client, not this in-editor Copilot call. If no Copilot model is available, the command falls back to the template scaffold (see §4.0 and ERR-CMD-03).

#### Backend Server Configuration (Environment Variables)

| Variable | Default | Description |
|----------|---------|-------------|
| `CODE_INTEL_PORT` | `48721` | HTTP server port |
| `CODE_INTEL_HOST` | `0.0.0.0` | Bind address |
| `CODE_INTEL_DATA_DIR` | `.code-intel` | Data directory for DB and models |
| `CODE_INTEL_DB` | `index.db` | SQLite database filename |
| `CODE_INTEL_ONNX_MODEL` | `models/model.onnx` | ONNX embedding model path |
| `CODE_INTEL_ORCHESTRATION` | `orchestration.json` | Child MCP servers config |
| `CODE_INTEL_LOG_LEVEL` | `info` | Log level: debug, info, warn, error |

### 3.3 Environment Variables

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `CODE_INTEL_PORT` | Backend server port | No | `CODE_INTEL_PORT=9000` |
| `CODE_INTEL_HOST` | Bind address | No | `CODE_INTEL_HOST=127.0.0.1` |
| `CODE_INTEL_LOG_LEVEL` | Log verbosity | No | `CODE_INTEL_LOG_LEVEL=debug` |
| `CODE_INTEL_WORKSPACE` | Workspace path override | No | `CODE_INTEL_WORKSPACE=/path/to/project` |

### 3.4 Configuration Examples

#### Minimal Configuration (defaults)

```json
{
  "kiroSdlc.backend.url": "http://127.0.0.1:48721"
}
```

#### Full Configuration

```json
{
  "kiroSdlc.backend.url": "http://127.0.0.1:48721",
  "kiroSdlc.mcpServerPort": 9181,
  "kiroSdlc.enableMcpServer": true,
  "kiroSdlc.llmProvider": "anthropic",
  "kiroSdlc.llmModel": "claude-sonnet-4-20250514",
  "kiroSdlc.configPath": ".code-intel/orchestration.json",
  "kiroSdlc.backend.toolCallTimeout": 300000,
  "kiroSdlc.backend.chatTimeout": 120000,
  "kiroSdlc.backend.healthCheckInterval": 30000
}
```

---

## 4. Usage

### 4.0 Shared Pipeline (all four commands)

Every command executes the same pipeline (PL-1):

```
1. Resolve description     — inline text after the slash command wins (rawArgs);
                             otherwise a mandatory InputBox appears
2. Confirm name            — InputBox PRE-FILLED with a kebab-case suggestion
                             extracted from the description; editable
3. Generate content        — Copilot LLM stream; on any failure OR empty
                             stream → deterministic fallback scaffold built
                             from the CONFIRMED name (never re-derived)
4. Validate                — ValidationGate normalizes and type-checks the
                             content BEFORE writing; failure ⇒ NOTHING written
5. Collision warning       — if target exists, a non-blocking warning is
                             shown (overwrite policy stub, pending OI-01)
6. Write                   — single atomic writeFile (parent dirs auto-created)
7. Post-write              — file opens in the editor; success toast shown
```

**Description input (step 1):**

| Aspect | Behavior |
|--------|----------|
| Inline form | `/create-new-agent <text>` — the text is used directly, no dialog |
| Dialog form | Prompt: *"Describe the … you want to create"* with a type-specific placeholder |
| Empty/whitespace description | Inline validation message `"Description is required"`; cancelling the dialog aborts silently (no file, no toast — ERR-CMD-01) |

**Name confirmation (step 2)** — suggestion algorithm (`extractNameFromDescription`):

1. Lowercase the description
2. Remove every character except `a-z`, `0-9`, whitespace
3. Split on whitespace; drop tokens of length ≤ 2
4. Take the first three tokens and join with `-`
5. If nothing remains, fall back to `<prefix>-new` where prefix is `agent`, `hook`, `rule`, or `skill`

Example: `"A documentation agent that generates API docs"` → `documentation-agent-that` (only the **first three** qualifying tokens are used).

> Note: punctuation and hyphens are stripped before tokenizing (step 2), so `"Auto-validate XML when draw.io files are edited"` yields `autovalidate-xml-when`. Suggestions may contain connector words like `that` — they are advisory only; you confirm or edit the name in step 2.

Validation while typing: the name must match `^[a-z][a-z0-9-]*$` (kebab-case), otherwise the inline message `Name must be kebab-case (e.g., my-agent)` appears (variants per command — see §6.2, ERR-CMD-02). Cancelling aborts silently.

**Validation gate & fallback behavior (steps 3–4):**

| Scenario | Result |
|----------|--------|
| LLM output valid | Normalized/canonicalized content written to disk |
| LLM output fails the gate | Error toast `Failed to create {type}: {reason}` — **nothing is written** (BR-07); retry with a refined description |
| LLM unavailable / request error / empty stream | Transparent fallback to the template scaffold; logged at debug level only (ERR-CMD-03); flow completes normally |
| Fallback produced | Scaffold content is built from the user-confirmed name, so the file/folder identity ALWAYS matches the frontmatter/JSON `name` (D-5) |

Per-type gate rules are detailed in §4.1–§4.4 and §6.2.

---

### 4.1 Create New Agent (`/create-new-agent`)

**Description:** Generate a complete agent definition file with YAML frontmatter for the SDLC pipeline. The agent is created at `.code-intel/agents/{name}.md`.

**How to use:**

```
/create-new-agent <description>
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| description | string | Yes | Natural language description of the agent's role and purpose |

**Example:**

```
/create-new-agent A documentation agent that generates API docs from code comments
```

**Follow-up prompts:**

| Prompt | Pre-filled value | Validation |
|--------|------------------|------------|
| "Agent name (kebab-case)" | Suggestion from description (e.g., `documentation-agent-that`) | Must match `^[a-z][a-z0-9-]*$`; inline message: `Name must be kebab-case (e.g., my-agent)` |

**Expected Output** (LLM path): the LLM body is validated, its own echoed frontmatter (if any) is stripped once, and a **canonical frontmatter block is prepended exactly once** by the gate. The sample below shows the fallback-scaffold body for illustration; with Copilot available the body comes from the LLM and is richer:

```markdown
---
name: documentation-agent-that
label: Documentation Agent That
description: >
  A documentation agent that generates API docs from code comments
phase: implementation
tools: ["read", "write", "shell", "@mcp"]
---

You are the documentation-agent-that agent.

**Description:** A documentation agent that generates API docs from code comments

**Role:**
- [Define the agent's primary role]
- [Define key responsibilities]

**Constraints:**
- [List constraints]
```

**Expected Output** (fallback path): identical shape — the scaffold provides the body above and the gate prepends the same canonical frontmatter. `label` is derived from the confirmed name in Title Case (e.g., `my-report-agent` → `My Report Agent`).

**Validation applied (agent branch):**

| Check | Failure reason surfaced in toast |
|-------|----------------------------------|
| Empty/whitespace-only generation | `empty generation` |
| Residual second frontmatter block after stripping the LLM echo (double-frontmatter guard, ERR-CMD-09/D-1) | `duplicated frontmatter blocks in generated agent content (ERR-CMD-09)` |
| Body has zero non-empty lines | `agent body must contain at least one non-empty line (BR-11)` |
| Canonical frontmatter self-check (label/phase/description) | `canonical agent frontmatter incomplete` |
| Confirmed name fails kebab-case (defense-in-depth) | `confirmed name "{name}" violates kebab-case rule (BR-03)` |

**File Location:** `.code-intel/agents/{name}.md`

---

### 4.2 Create New Hook (`/create-new-hook`)

**Description:** Generate a hook configuration file (JSON) that triggers automated actions on specific events. The hook is created at `.code-intel/hooks/{name}.json`.

**How to use:**

```
/create-new-hook <description>
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| description | string | Yes | Natural language description of the hook's behavior |

**Example:**

```
/create-new-hook Auto-validate XML when draw.io files are edited
```

**Follow-up prompts:**

| Prompt | Pre-filled value | Validation |
|--------|------------------|------------|
| "Hook name (kebab-case)" | Suggestion from description (e.g., `autovalidate-xml-when` — hyphens in the description are stripped) | Must match `^[a-z][a-z0-9-]*$`; inline message: `Name must be kebab-case (e.g., my-hook)` |

**Expected Output:** canonical JSON — strict 2-space indentation; surrounding markdown fences stripped before parsing; empty-string action fields omitted (D-7):

```json
{
  "enabled": true,
  "name": "autovalidate-xml-when",
  "description": "Auto-validate XML when draw.io files are edited",
  "version": "1",
  "when": {
    "type": "promptSubmit"
  },
  "then": {
    "type": "askAgent",
    "prompt": "[Instructions for autovalidate-xml-when based on: Auto-validate XML when draw.io files are edited]"
  }
}
```

**Defaults applied by the gate (BR-20):** `enabled` defaults to `true`, `version` defaults to `"1"` when the LLM omits them.

**Hook Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | boolean | Whether the hook is active (default `true`) |
| `name` | string | Human-readable name (**required**) |
| `description` | string | What the hook does (**required**) |
| `version` | string | Version string (default `"1"`) |
| `when.type` | enum | Trigger type: `promptSubmit`, `agentStop`, `fileEdited`, `fileCreated`, `fileDeleted` |
| `when.patterns` | string[] | Optional glob patterns — allowed ONLY for `fileEdited`/`fileCreated`/`fileDeleted` (BR-08) |
| `then.type` | enum | Action type: `askAgent`, `runCommand` |
| `then.prompt` | string | Instructions for the agent (**required iff `type=askAgent`**, BR-08) |
| `then.command` | string | Command to run (**required iff `type=runCommand`**, BR-08) |

Only these top-level keys are accepted: `enabled`, `name`, `description`, `version`, `when`, `then` — unknown keys reject the generation (BR-09).

**Validation applied (hook branch):**

| Check | Failure reason surfaced in toast |
|-------|----------------------------------|
| Malformed JSON after fence stripping (D-2) | `invalid hook JSON: {parser message}` |
| Parsed value is not a JSON object | `hook must be a JSON object` |
| Unknown top-level key | `unknown hook top-level key "{key}" (allowed: "enabled", "name", "description", "version", "when", "then")` |
| Missing/empty `name` or `description` | `hook "name" is required and must be a non-empty string` / `hook "description" is required and must be a non-empty string` |
| Wrong primitive types | `hook "enabled" must be a boolean` / `hook "version" must be a string` |
| Invalid trigger/action enums | `hook when.type "{type}" must be one of: promptSubmit, agentStop, fileEdited, fileCreated, fileDeleted (BR-08)` / `hook then.type "{type}" must be one of: askAgent, runCommand` |
| Conditional action consistency (XOR, BR-08) | `hook then.prompt is required when then.type is "askAgent" (BR-08)` / `hook then.command is required when then.type is "runCommand" (BR-08)` |
| Patterns on non-file events | `hook when.patterns is allowed only for fileEdited/fileCreated/fileDeleted events (BR-08)` |

**File Location:** `.code-intel/hooks/{name}.json`

---

### 4.3 Create New Steering Rule (`/create-new-steering`)

**Description:** Generate a steering rule file (Markdown with **optional** YAML frontmatter) that guides agent behavior. The rule is created at `.code-intel/steering/{name}.md`.

**How to use:**

```
/create-new-steering <description>
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| description | string | Yes | Natural language description of the rule |

**Example:**

```
/create-new-steering Always use semantic versioning for git tags
```

**Follow-up prompts:**

| Prompt | Pre-filled value | Validation |
|--------|------------------|------------|
| "Rule name (kebab-case)" | Suggestion from description (e.g., `always-use-semantic`) | Must match `^[a-z][a-z0-9-]*$`; inline message: `Name must be kebab-case (e.g., my-rule)` |

**Expected Output** (fallback path):

```markdown
---
inclusion: auto
description: Always use semantic versioning for git tags
---

# always-use-semantic

Always use semantic versioning for git tags

## Rules

1. [Define rule 1]
2. [Define rule 2]
```

Frontmatter is OPTIONAL (AF-23): content without a frontmatter block is accepted as-is (body only). If frontmatter IS present, it is re-emitted canonically (`---\n{fields}\n---\n\n{body}`).

**Validation applied (steering branch):**

| Check | Failure reason surfaced in toast |
|-------|----------------------------------|
| Body has zero non-empty lines | `steering body must contain at least one non-empty instruction line (BR-11)` |
| Frontmatter present with invalid `inclusion` | `steering inclusion "{value}" must be one of: auto, manual, always (BR-10)` |

**File Location:** `.code-intel/steering/{name}.md`

---

### 4.4 Create New Skill (`/create-new-skill`)

**Description:** Generate a skill folder with a `SKILL.md` file that defines a reusable workflow. The skill is created at `.code-intel/skills/{name}/SKILL.md`.

**How to use:**

```
/create-new-skill <description>
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| description | string | Yes | Natural language description of the skill |

**Example:**

```
/create-new-skill A skill for reviewing code security vulnerabilities
```

**Follow-up prompts:**

| Prompt | Pre-filled value | Validation |
|--------|------------------|------------|
| "Skill name (kebab-case)" | Suggestion from description (e.g., `skill-for-reviewing`) | Must match `^[a-z][a-z0-9-]*$`; inline message: `Name must be kebab-case (e.g., my-skill)` |

**Expected Output** (fallback path):

```markdown
---
name: skill-for-reviewing
description: A skill for reviewing code security vulnerabilities
---

## When to Use

A skill for reviewing code security vulnerabilities

## Workflow

1. [Step 1]
2. [Step 2]
```

**Name enforcement (AF-33/D-5):** the frontmatter `name` field is **forced to equal the user-confirmed name** regardless of what the LLM wrote, guaranteeing the SKILL.md frontmatter always matches the folder name.

**Validation applied (skill branch):**

| Check | Failure reason surfaced in toast |
|-------|----------------------------------|
| Missing frontmatter block | `SKILL.md requires YAML frontmatter with name and description` |
| Missing `name` field | `skill frontmatter requires a kebab-case name field (§3.7.4)` |
| Missing/empty `description` field | `skill frontmatter requires a non-empty description` |
| Body has zero non-empty lines | `skill body must contain at least one non-empty line (BR-11)` |

**File Location:** `.code-intel/skills/{name}/SKILL.md`

---

## 5. Administration

### 5.1 Adding a New Agent to the Pipeline

**Steps:**

1. Use `/create-new-agent` with a description of the agent's role
2. Review the generated file at `.code-intel/agents/{name}.md` — verify the canonical frontmatter (name, label, phase, tools) matches your intent
3. Customize the system prompt with specific constraints and responsibilities
4. Add the agent to the orchestration configuration (`.code-intel/orchestration.json`)
5. Restart the MCP server: Command Palette → "SDLC Agents: Reconnect to Backend"

### 5.2 Creating Custom Hooks

**Steps:**

1. Use `/create-new-hook` with a description of the trigger and action
2. Review the generated JSON file at `.code-intel/hooks/{name}.json` — the gate has already enforced the schema (enums, XOR action consistency, defaults)
3. Modify the `when` and `then` sections as needed
4. The hook is automatically loaded by the extension on next chat session

### 5.3 Managing Steering Rules

**Steps:**

1. Use `/create-new-steering` to create a new rule
2. Review the generated Markdown file at `.code-intel/steering/{name}.md`
3. Set `inclusion` to `auto` for always-loaded rules, or `manual` for opt-in rules (values `auto` | `manual` | `always`)
4. The rule is automatically applied to agent sessions based on the inclusion setting

### 5.4 Creating Reusable Skills

**Steps:**

1. Use `/create-new-skill` to create a new skill
2. Review the generated `SKILL.md` file at `.code-intel/skills/{name}/SKILL.md` — the frontmatter `name` is guaranteed to match the folder name
3. Add detailed workflow steps, examples, and checklist items
4. The skill is available for agents to load via the `skill` tool

### 5.5 Hot-Reload Configuration

The extension supports hot-reload for most configuration changes:

- **Hooks**: Reloaded automatically when the JSON file is modified — writes are performed in a SINGLE atomic `writeFile` call so the SA4E-189 hot-reload debounce (300 ms) never observes partial content
- **Steering rules**: Reloaded on the next chat session
- **Agent definitions**: Requires MCP server restart
- **Skills**: Available immediately after creation

### 5.6 Command Registration Notes

- The four commands are registered programmatically (IDs `create-new-agent`, `create-new-hook`, `create-new-steering`, `create-new-skill`) by the `CommandRegistrar` during extension activation — they are dispatched from the chat slash menu by the same identifiers
- Registration is **skipped entirely when no workspace folder is open**
- Inline arguments (`args.rawArgs`) are supported: text typed directly after the slash command bypasses the description dialog

---

## 6. Troubleshooting

### 6.1 Common Issues

| # | Symptom | Cause | Solution |
|---|---------|-------|----------|
| 1 | Slash commands not appearing in chat | Extension not activated | Reload VS Code window (Ctrl+Shift+P → "Reload Window") |
| 2 | "Description is required" error | Empty input provided | Enter a non-empty description when prompted |
| 3 | "Name must be kebab-case (…)" error | Invalid name format | Use only lowercase letters, numbers, and hyphens (e.g., `my-agent`) |
| 4 | `Failed to create …: empty generation` | LLM returned an empty/whitespace-only stream (D-4) | Retry — the empty stream should promote the template fallback; if persistent, check Copilot sign-in status |
| 5 | `Failed to create …: duplicated frontmatter blocks …` | LLM emitted its own frontmatter AND a second residual block survived stripping (ERR-CMD-09) | Retry; nothing was written — the assembled file would have had two frontmatter blocks |
| 6 | `Failed to create hook: invalid hook JSON: …` | LLM returned malformed JSON (fences are stripped once automatically) | Retry; consider simplifying the description |
| 7 | `Failed to create skill: SKILL.md requires YAML frontmatter …` | LLM omitted the mandatory frontmatter block | Retry — fallback scaffolds always include valid frontmatter |
| 8 | File not created | No workspace folder open | Open a folder in VS Code before using the command |
| 9 | Generated content is generic/scaffold-shaped | LLM fallback used (Copilot missing, request failed, or empty stream) | Install/sign in to VS Code Copilot; the name in the content still matches the filename |
| 10 | Warning `"<file>" already exists and will be overwritten.` | Target collision detected (ERR-CMD-06 stub) | Non-blocking — rename first if you want to keep the old file (policy decision pending OI-01) |

### 6.2 Error Handling

Errors follow the FSD error catalogue **ERR-CMD-01..09** (FSD §9.1); the behavior rows below reflect the post-refactor code (commit `a618e0b`). Every code was verified against the current source (`extension/src/commands/*`).

#### Error Catalogue (ERR-CMD-01..09)

| Code | Trigger | Severity | User-visible behavior |
|------|---------|----------|----------------------|
| ERR-CMD-01 | Description empty or dialog cancelled | Info | **Silent abort** — no file, no toast |
| ERR-CMD-02 | Name violates kebab-case regex `^[a-z][a-z0-9-]*$` | Warning | Inline InputBox validation: `Name must be kebab-case (e.g., my-agent)` (variants: `my-hook`, `my-rule`, `my-skill`); cancel → silent abort |
| ERR-CMD-03 | LLM unavailable / no copilot model / request error / empty stream | Info | **Transparent fallback** to template scaffold; debug-only log; flow completes |
| ERR-CMD-04 | Generation fails the validation gate | Error | Toast `Failed to create {type}: {reason}` — **nothing written to disk** |
| ERR-CMD-05 | File write failure (EACCES/ENOSPC/path issues) | Error | Toast `Failed to create {type}: {os message}` |
| ERR-CMD-06 | Target name collision (file exists) | Warning | Non-blocking warning `"{filename}" already exists and will be overwritten.`; overwrite currently proceeds — policy pending OI-01/GAP-05 |
| ERR-CMD-07 | Skill folder creation failure mid-flow | Error | Same write-error path as ERR-CMD-05: `Failed to create skill: {message}` (parent dirs created recursively in one call) |
| ERR-CMD-08 | Editor open failure after successful write | Warning | Non-blocking notice `Created "{name}", but the editor could not be opened.`; **success toast still shown**, file exists on disk, hot-reload still fires (D-3 fix) |
| ERR-CMD-09 | LLM echoes its own `---` frontmatter block (agent path) | Warning → gate rejection | One leading echoed block is stripped before assembly; a residual SECOND block rejects the generation with reason `duplicated frontmatter blocks in generated agent content (ERR-CMD-09)` surfaced via ERR-CMD-04 |

#### Exact User-Visible Messages

| Message (exact string) | Where shown | Code |
|------------------------|-------------|------|
| `Description is required` | Inline, description InputBox | `resolveDescription` |
| `Name must be kebab-case (e.g., my-agent)` *(variants: `my-hook`, `my-rule`, `my-skill`)* | Inline, name InputBox | `confirmName` |
| `` Failed to create {agent\|hook\|steering rule\|skill}: {reason} `` | Error toast | `reportGateFailure` (ERR-CMD-04) and write catch (ERR-CMD-05) |
| `"{filename}" already exists and will be overwritten.` | Warning toast | `warnOnCollision` (ERR-CMD-06) |
| `Created "{name}", but the editor could not be opened.` | Warning toast | `persistGeneratedFile` (ERR-CMD-08) |
| `✅ Agent "{name}" created at .code-intel/agents/{name}.md` | Info toast | `AGENT_SPEC.successMessage` |
| `✅ Hook "{name}" created at .code-intel/hooks/{name}.json` | Info toast | `HOOK_SPEC.successMessage` |
| `✅ Steering rule "{name}" created at .code-intel/steering/{name}.md` | Info toast | `STEERING_SPEC.successMessage` |
| `✅ Skill "{name}" created at .code-intel/skills/{name}/SKILL.md` | Info toast | `SKILL_SPEC.successMessage` |

#### Validation Gate Failure Reasons (shown verbatim in the ERR-CMD-04 toast)

**Shared (all types):**

| Reason string | Meaning |
|---------------|---------|
| `empty generation` | Normalized content was empty/whitespace (empty LLM stream never reaches disk — D-4) |
| `confirmed name "{name}" violates kebab-case rule (BR-03)` | Defense-in-depth re-check of the confirmed name |

**Agent:**

| Reason string | Meaning |
|---------------|---------|
| `duplicated frontmatter blocks in generated agent content (ERR-CMD-09)` | Second frontmatter block remained after stripping the LLM echo (double-frontmatter guard) |
| `agent body must contain at least one non-empty line (BR-11)` | Body was blank after frontmatter removal |
| `canonical agent frontmatter incomplete` | Internal self-check of the prepended frontmatter failed |
| `agent tools field is not a parseable list: {message}` | Canonical tools JSON failed self-parse |

**Hook:**

| Reason string | Meaning |
|---------------|---------|
| `invalid hook JSON: {message}` | Strict JSON.parse failed after fence stripping (D-2) |
| `hook must be a JSON object` | Parsed payload was an array/primitive/null |
| `unknown hook top-level key "{key}" (allowed: "enabled", "name", "description", "version", "when", "then")` | Key outside the allowed subset (BR-09) |
| `hook "name" is required and must be a non-empty string` | Missing/invalid name |
| `hook "description" is required and must be a non-empty string` | Missing/invalid description |
| `hook "enabled" must be a boolean` | Wrong primitive type |
| `hook "version" must be a string` | Wrong primitive type |
| `hook "when" must be an object` / `hook "then" must be an object` | Non-object sections |
| `hook when.type "{type}" must be one of: promptSubmit, agentStop, fileEdited, fileCreated, fileDeleted (BR-08)` | Invalid trigger enum |
| `hook when.patterns is allowed only for fileEdited/fileCreated/fileDeleted events (BR-08)` | Patterns on promptSubmit/agentStop |
| `hook when.patterns must be an array of strings (BR-08)` | Bad patterns shape |
| `hook then.type "{type}" must be one of: askAgent, runCommand` | Invalid action enum |
| `hook then.prompt is required when then.type is "askAgent" (BR-08)` | XOR consistency: askAgent without prompt |
| `hook then.command is required when then.type is "runCommand" (BR-08)` | XOR consistency: runCommand without command (empty/whitespace counts as absent — D-7) |

**Steering:**

| Reason string | Meaning |
|---------------|---------|
| `steering body must contain at least one non-empty instruction line (BR-11)` | Blank body |
| `steering inclusion "{value}" must be one of: auto, manual, always (BR-10)` | Invalid inclusion enum (frontmatter itself is optional) |

**Skill:**

| Reason string | Meaning |
|---------------|---------|
| `SKILL.md requires YAML frontmatter with name and description` | No frontmatter block |
| `skill frontmatter requires a kebab-case name field (§3.7.4)` | Missing `name` field |
| `skill frontmatter requires a non-empty description` | Missing/blank `description` field |
| `skill body must contain at least one non-empty line (BR-11)` | Blank body |

#### LLM Fallback Behavior (ERR-CMD-03)

When VS Code Copilot is unavailable, the request throws, no copilot model is returned, **or the streamed result is empty** (D-4):
- The condition is logged to the VS Code Developer Console at `debug` level with prefix: `[ConfigCommands] LLM generation failed, falling back to template: {error message}`
- **No error toast is shown** — the system transparently substitutes the deterministic template scaffold
- The scaffold is built from the **user-confirmed name**, so frontmatter/JSON `name` values always match the filename/folder (D-5) — divergence between LLM-chosen names and the confirmed file identity cannot occur

### 6.3 Logs

| Log Location | Content | Useful For |
|--------------|---------|------------|
| VS Code Developer Console (`console.debug`) | Prefixes: `[ConfigCommands] LLM generation failed, falling back to template:`, `[ConfigCommands] target collision:`, `[ConfigCommands] failed to open generated file:`, `[TemplateProvider] template spec unavailable:`, `[FileWriter] no collision at:` | Debugging LLM fallbacks, collisions, editor-open warnings |
| Success/Error toasts | Gate rejection reasons, write failures, success confirmations | Verifying command outcomes |
| Backend Server Logs | MCP tool execution details | Backend-side debugging |

### 6.4 FAQ

**Q: Do I need VS Code Copilot installed to use these commands?**
A: No. Without a Copilot model (or on request failure/empty stream) the command falls back to a deterministic template scaffold. Because the scaffold is built from your confirmed name, the output is guaranteed consistent — just less rich than LLM-generated content.

**Q: Where are the generated files stored?**
A: All files are created under the `.code-intel/` directory in your workspace root:
- Agents: `.code-intel/agents/{name}.md`
- Hooks: `.code-intel/hooks/{name}.json`
- Steering: `.code-intel/steering/{name}.md`
- Skills: `.code-intel/skills/{name}/SKILL.md`

**Q: Can I modify the generated files?**
A: Yes. The generated files are standard Markdown/JSON files that you can edit freely. The commands generate a starting point that you can customize.

**Q: What happens if I create a file with the same name?**
A: You will see a warning — `"{filename}" already exists and will be overwritten.` — and the file WILL be overwritten (non-blocking collision stub; the confirm-overwrite vs auto-rename policy is pending product decision OI-01/GAP-05). Back up important customizations before re-running a command with the same name.

**Q: Why did nothing happen when I ran the command?**
A: Two silent-abort cases produce no file and no toast (ERR-CMD-01): submitting an empty description is blocked inline, and pressing Escape/cancelling either dialog aborts the flow deliberately. Run the command again and complete both prompts.

**Q: My LLM output was rejected with "Failed to create …" — was anything written?**
A: No. The validation gate runs BEFORE the write step (BR-07). On any gate rejection nothing reaches disk; the toast carries the exact reason (see §6.2 reason tables). Refine your description or retry — repeated failures automatically mean you are getting the fallback scaffold path instead.

**Q: Why does the SKILL.md frontmatter `name` differ from what the LLM wrote?**
A: By design. The gate forces `name := your confirmed name` so the frontmatter always matches the folder name (AF-33/D-5). Edit the folder and frontmatter together if you rename manually.

**Q: Can I use these commands from the VS Code terminal?**
A: These commands are designed for the chat panel slash menu. To use them, open the chat panel and type the slash command there, not in the terminal.

---

## 7. API Reference

### 7.0 Authentication

The backend MCP endpoints require authentication. The Config Commands extension handles authentication automatically via the VS Code extension settings.

| Endpoint | Auth Required | Auth Method | Notes |
|----------|---------------|-------------|-------|
| `GET /mcp/tools/list` | Yes | API key or session token | Returns 401 without auth |
| `POST /mcp/tools/call` | Yes | API key or session token | Returns 401 without auth |
| `GET /health` | No | None | Public health check |

**Authentication Methods:**

1. **API Key** (recommended for extension use):
   - Set `CODE_INTEL_API_KEY` environment variable on the backend server
   - Send via `Authorization: Bearer {api-key}` header or `X-API-Key: {api-key}` header
   - API key callers receive the full unfiltered tool list

2. **Session Token** (for admin UI):
   - Obtain via admin login endpoint
   - Send via `Authorization: Bearer {session-token}` header
   - Session users are subject to RBAC filtering (require `MCP_ACCESS` permission)

3. **JWT Token** (for multi-tenant deployments):
   - Send via `Authorization: Bearer {jwt-token}` header
   - JWT users are subject to RBAC filtering and project binding verification

**RBAC Behavior for `GET /mcp/tools/list`:**

| Caller Type | MCP_ACCESS Permission | Result |
|-------------|----------------------|--------|
| API key | N/A (bypasses RBAC) | Full tool list |
| Session user | Has `MCP_ACCESS` | Filtered tool list (based on `toolAccess` in roleData) |
| Session user | No `MCP_ACCESS` | Empty list `{ tools: [] }` |
| Unauthenticated | N/A | HTTP 401 `{ error: { code: "UNAUTHORIZED", message: "Authentication required" } }` |

### 7.1 create-new-agent

| Attribute | Value |
|-----------|-------|
| Command ID | `create-new-agent` (registered programmatically; slash menu `/create-new-agent`) |
| Input | Natural language description (string); optional inline `rawArgs` |
| Output | `.code-intel/agents/{name}.md` (Markdown, canonical YAML frontmatter + body) |
| Pre-write gate | Normalize (strip fences, reject empty) → strip one echoed FM block → reject residual FM → require ≥1 non-empty body line → prepend canonical FM |

**Frontmatter Schema (assembled by the gate):**

```yaml
name: string          # confirmed kebab-case identifier
label: string         # Title Case of name (auto-derived)
description: string   # folded block scalar (">")
phase: implementation # canonical default; LLM prompt enumerates:
                      # requirements | specification | design | test_planning |
                      # implementation | testing | deployment
tools: string[]       # canonical default: ["read", "write", "shell", "@mcp"]
```

### 7.2 create-new-hook

| Attribute | Value |
|-----------|-------|
| Command ID | `create-new-hook` (registered programmatically; slash menu `/create-new-hook`) |
| Input | Natural language description (string); optional inline `rawArgs` |
| Output | `.code-intel/hooks/{name}.json` (canonical JSON, 2-space indent, empty action fields omitted) |
| Pre-write gate | Normalize → strict JSON parse (fences pre-stripped) → object check → top-level keys ⊆ {enabled, name, description, version, when, then} → schema + BR-08 conditional checks → apply defaults → canonical serialization |

**JSON Schema:**

```json
{
  "enabled": true,                     // boolean, default true (BR-20)
  "name": "string",                    // required non-empty
  "description": "string",             // required non-empty
  "version": "1",                      // string, default "1" (BR-20)
  "when": {
    "type": "promptSubmit | agentStop | fileEdited | fileCreated | fileDeleted",
    "patterns": ["string"]             // optional; ONLY for fileEdited/fileCreated/fileDeleted
  },
  "then": {
    "type": "askAgent | runCommand",
    "prompt": "string",                // required non-empty iff askAgent
    "command": "string"                // required non-empty iff runCommand;
                                       // empty-string fields are OMITTED in output (D-7)
  }
}
```

### 7.3 create-new-steering

| Attribute | Value |
|-----------|-------|
| Command ID | `create-new-steering` (registered programmatically; slash menu `/create-new-steering`) |
| Input | Natural language description (string); optional inline `rawArgs` |
| Output | `.code-intel/steering/{name}.md` (Markdown, OPTIONAL YAML frontmatter) |
| Pre-write gate | Normalize → require ≥1 non-empty body line → if FM present: `inclusion` ∈ {auto, manual, always} → canonical re-emission |

**Frontmatter Schema (optional):**

```yaml
inclusion: auto | manual | always  # How the rule is loaded (validated when present)
description: string                # Brief description
```

### 7.4 create-new-skill

| Attribute | Value |
|-----------|-------|
| Command ID | `create-new-skill` (registered programmatically; slash menu `/create-new-skill`) |
| Input | Natural language description (string); optional inline `rawArgs` |
| Output | `.code-intel/skills/{name}/SKILL.md` (Markdown, REQUIRED YAML frontmatter) |
| Pre-write gate | Normalize → require FM block with `name` + non-empty `description` → force `name := confirmedName` → require ≥1 non-empty body line → canonical re-emission |

**Frontmatter Schema (required):**

```yaml
name: string         # FORCED to the confirmed kebab-case folder name (AF-33/D-5)
description: string  # required non-empty
```

---

## 8. Appendix

### 8.1 Glossary

| Term | Definition |
|------|------------|
| **Agent** | An AI role with a defined system prompt, tools, and SDLC phase responsibility |
| **Hook** | An automated trigger-action pair that runs on specific events |
| **Steering Rule** | A guideline that shapes agent behavior and decision-making |
| **Skill** | A reusable workflow or procedure that agents can load and execute |
| **MCP** | Model Context Protocol — standard interface for AI tool communication |
| **Kebab-case** | Lowercase words separated by hyphens (e.g., `my-agent-name`); regex `^[a-z][a-z0-9-]*$` |
| **Frontmatter** | YAML metadata block at the top of a Markdown file |
| **Orchestration** | The system that coordinates multiple AI agents in the SDLC pipeline |
| **ValidationGate** | Mandatory pre-write check (BR-07) — normalizes and type-validates generated content; failures prevent any disk write |
| **Fallback scaffold** | Deterministic offline template used when the LLM is unavailable or returns empty output; built from the user-confirmed name |
| **Confirmed name** | The kebab-case name the user accepts in the name InputBox; single source of truth for filenames, folders, and embedded identifiers |

### 8.2 Related Documents

| Document | Location |
|----------|----------|
| BRD | BRD-v2-SA4E-193.docx |
| FSD | FSD-v2-SA4E-193.docx |
| TDD | TDD-v2-SA4E-193.docx |

### 8.3 Version Compatibility

| System Version | Config Version | Breaking Changes |
|---------------|---------------|-----------------|
| 1.33.0 (incl. refactor a618e0b) | v1 | None — internal module split into thin orchestrators (ConfigCommands + validation-gate/hook-gate/frontmatter-utils/template-provider/name-extractor/file-writer/config-command-specs/llm-prompts); generated-file formats unchanged |
| 1.33.0 | v1 | Initial release of Config Commands |
| 1.32.0 | v1 | Agent runtime routing (compatible) |
| 1.31.0 | v1 | GraphSyncService fix (compatible) |
