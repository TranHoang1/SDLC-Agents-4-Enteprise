# User Guide (UG)

## SDLC Agents 4 Enterprise — SA4E-193: Config Commands (create-new-agent/hook/steering/skill)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-193 |
| Title | SM Agent SA4E-193 L3 |
| Author | DEV Agent |
| Reviewer | BA Agent |
| Version | 1.1 |
| Date | 2026-08-23 |
| Status | Draft |
| Related BRD | BRD-v1.0-SA4E-193.docx |
| Related FSD | FSD-v1.0-SA4E-193.docx |
| Related TDD | TDD-v1.0-SA4E-193.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-23 | DEV Agent | Initial document |
| 1.1 | 2026-08-23 | DEV Agent | Fix §6.2: Replace non-existent error codes with actual error handling behavior; Fix §7: Add authentication documentation for MCP endpoints; Document LLM fallback console-only logging |

---

## 1. Introduction

### 1.1 Purpose

SA4E-193 introduces **Config Commands** — a set of 4 VS Code slash commands (`/create-new-agent`, `/create-new-hook`, `/create-new-steering`, `/create-new-skill`) that allow users to generate configuration files for the SDLC Agents system using natural language descriptions. The commands leverage the VS Code language model (Copilot LLM) to generate high-quality configuration files, with automatic fallback to template-based generation when the LLM is unavailable.

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

---

## 2. Getting Started

### 2.1 Quick Start

```bash
# Step 1: Ensure the extension is installed
# Open VS Code/Kiro → Command Palette → "SDLC Agents: Inject All Agents"

# Step 2: Open a workspace with .code-intel/ directory
# (The extension creates this on first inject)

# Step 3: Use a slash command in chat
# Type in the chat panel or terminal:
/create-new-agent A documentation agent that generates API docs

# Step 4: Follow the prompts
# 1. Enter description (or use the one provided)
# 2. Enter agent name (kebab-case)
# 3. File is created and opened automatically
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
   - Expected: Input box appears for agent name

| Symptom | Cause | Fix |
|---------|-------|-----|
| Slash commands not showing | Extension not loaded | Reload VS Code window (Ctrl+Shift+P → "Reload Window") |
| "No workspace folder open" error | No workspace selected | Open a folder in VS Code |
| LLM generation fails silently | Copilot not available | System falls back to template generation (check debug console for logs) |

---

## 3. Configuration

### 3.1 Configuration File

The Config Commands do not use a separate configuration file. All settings are managed through VS Code settings:

- **Global settings**: `~/.config/Code/User/settings.json` (or `%APPDATA%\Code\User\settings.json` on Windows)
- **Workspace settings**: `.vscode/settings.json`

### 3.2 Configuration Reference

#### Extension Settings (kiroSdlc.*)

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `kiroSdlc.backend.url` | string | `http://127.0.0.1:48721` | Backend server URL |
| `kiroSdlc.mcpServerPort` | number | `9181` | Local MCP wrapper server port |
| `kiroSdlc.enableMcpServer` | boolean | `true` | Enable/disable local MCP server on startup |
| `kiroSdlc.llmProvider` | string | `anthropic` | Active LLM provider (anthropic, openai, ollama, etc.) |
| `kiroSdlc.llmModel` | string | `""` | Override model for the selected provider |
| `kiroSdlc.configPath` | string | `.code-intel/orchestration.json` | Path to orchestration config file |

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

| Prompt | Validation | Description |
|--------|-----------|-------------|
| Agent name (kebab-case) | Must match `^[a-z][a-z0-9-]*$` | Unique identifier for the agent |

**Expected Output:**

```markdown
---
name: documentation-agent
label: Documentation Agent
description: >
  A documentation agent that generates API docs from code comments
phase: implementation
tools: ["read", "write", "shell", "@mcp"]
---

You are the documentation-agent agent.

**Description:** A documentation agent that generates API docs from code comments

**Role:**
- [Define the agent's primary role]
- [Define key responsibilities]

**Constraints:**
- [List constraints]
```

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

| Prompt | Validation | Description |
|--------|-----------|-------------|
| Hook name (kebab-case) | Must match `^[a-z][a-z0-9-]*$` | Unique identifier for the hook |

**Expected Output:**

```json
{
  "enabled": true,
  "name": "auto-validate-xml",
  "description": "Auto-validate XML when draw.io files are edited",
  "version": "1",
  "when": {
    "type": "promptSubmit"
  },
  "then": {
    "type": "askAgent",
    "prompt": "[Instructions for auto-validate-xml based on: Auto-validate XML when draw.io files are edited]"
  }
}
```

**Hook Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | boolean | Whether the hook is active |
| `name` | string | Human-readable name |
| `description` | string | What the hook does |
| `version` | string | Version string |
| `when.type` | enum | Trigger type: `promptSubmit`, `agentStop`, `fileEdited`, `fileCreated`, `fileDeleted` |
| `when.patterns` | string[] | Optional glob patterns for file events |
| `then.type` | enum | Action type: `askAgent`, `runCommand` |
| `then.prompt` | string | Instructions for the agent (when `askAgent`) |
| `then.command` | string | Command to run (when `runCommand`) |

**File Location:** `.code-intel/hooks/{name}.json`

---

### 4.3 Create New Steering Rule (`/create-new-steering`)

**Description:** Generate a steering rule file (Markdown with optional YAML frontmatter) that guides agent behavior. The rule is created at `.code-intel/steering/{name}.md`.

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

| Prompt | Validation | Description |
|--------|-----------|-------------|
| Rule name (kebab-case) | Must match `^[a-z][a-z0-9-]*$` | Unique identifier for the rule |

**Expected Output:**

```markdown
---
inclusion: auto
description: Always use semantic versioning for git tags
---

# semantic-versioning-rule

Always use semantic versioning for git tags

## Rules

1. [Define rule 1]
2. [Define rule 2]
```

**Steering Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `inclusion` | enum | How the rule is included: `auto` (always loaded), `manual` (opt-in), `always` (forced) |
| `description` | string | Brief description of the rule |

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

| Prompt | Validation | Description |
|--------|-----------|-------------|
| Skill name (kebab-case) | Must match `^[a-z][a-z0-9-]*$` | Unique identifier for the skill |

**Expected Output:**

```markdown
---
name: code-security-review
description: A skill for reviewing code security vulnerabilities
---

## When to Use

A skill for reviewing code security vulnerabilities

## Workflow

1. [Step 1]
2. [Step 2]
```

**File Location:** `.code-intel/skills/{name}/SKILL.md`

---

## 5. Administration

### 5.1 Adding a New Agent to the Pipeline

**Steps:**

1. Use `/create-new-agent` with a description of the agent's role
2. Review the generated file at `.code-intel/agents/{name}.md`
3. Customize the system prompt with specific constraints and responsibilities
4. Add the agent to the orchestration configuration (`.code-intel/orchestration.json`)
5. Restart the MCP server: Command Palette → "SDLC Agents: Reconnect to Backend"

### 5.2 Creating Custom Hooks

**Steps:**

1. Use `/create-new-hook` with a description of the trigger and action
2. Review the generated JSON file at `.code-intel/hooks/{name}.json`
3. Modify the `when` and `then` sections as needed
4. The hook is automatically loaded by the extension on next chat session

### 5.3 Managing Steering Rules

**Steps:**

1. Use `/create-new-steering` to create a new rule
2. Review the generated Markdown file at `.code-intel/steering/{name}.md`
3. Set `inclusion` to `auto` for always-loaded rules, or `manual` for opt-in rules
4. The rule is automatically applied to agent sessions based on the inclusion setting

### 5.4 Creating Reusable Skills

**Steps:**

1. Use `/create-new-skill` to create a new skill
2. Review the generated `SKILL.md` file at `.code-intel/skills/{name}/SKILL.md`
3. Add detailed workflow steps, examples, and checklist items
4. The skill is available for agents to load via the `skill` tool

### 5.5 Hot-Reload Configuration

The extension supports hot-reload for most configuration changes:

- **Hooks**: Reloaded automatically when the JSON file is modified
- **Steering rules**: Reloaded on the next chat session
- **Agent definitions**: Requires MCP server restart
- **Skills**: Available immediately after creation

---

## 6. Troubleshooting

### 6.1 Common Issues

| # | Symptom | Cause | Solution |
|---|---------|-------|----------|
| 1 | Slash commands not appearing in chat | Extension not activated | Reload VS Code window (Ctrl+Shift+P → "Reload Window") |
| 2 | "Description is required" error | Empty input provided | Enter a non-empty description when prompted |
| 3 | "Name must be kebab-case" error | Invalid name format | Use only lowercase letters, numbers, and hyphens (e.g., `my-agent`) |
| 4 | LLM generation fails | Copilot not available | System falls back to template-based generation (check debug console) |
| 5 | File not created | No workspace folder open | Open a folder in VS Code before using the command |
| 6 | "Failed to create agent" error | Permission denied or disk full | Check file system permissions and available disk space |
| 7 | Generated content is generic | LLM fallback used | Install VS Code Copilot for better LLM-powered generation |

### 6.2 Error Handling

The Config Commands use VS Code input validation callbacks and error messages (not error code constants). Errors are displayed inline in the input box or as VS Code error notifications.

#### Input Validation Errors

| Validation | Message Displayed | Trigger | Action |
|------------|-------------------|---------|--------|
| Empty description | `"Description is required"` | User submits empty or whitespace-only description in input box | Enter a meaningful description of what you want to create |
| Invalid name format | `"Name must be kebab-case (e.g., my-agent)"` | Name does not match `^[a-z][a-z0-9-]*$` | Use only lowercase letters, numbers, and hyphens (e.g., `my-agent`) |

#### File Creation Errors

| Error | Message Displayed | Trigger | Action |
|-------|-------------------|---------|--------|
| File system error | `"Failed to create {type}: {message}"` | Permission denied, disk full, or invalid path | Check file system permissions and available disk space |

*Note: `{type}` is replaced with the actual component type (e.g., `agent`, `hook`, `steering rule`, `skill`).*

#### LLM Fallback Behavior

When VS Code Copilot is unavailable or the LLM request fails:
- The error is logged to the VS Code Developer Console at `debug` level: `[ConfigCommands] LLM generation failed, falling back to template: {error message}`
- **No error is shown to the user** — the system silently falls back to template-based generation
- The generated file uses a generic template instead of LLM-customized content

### 6.3 Logs

| Log Location | Content | Useful For |
|-------------|---------|------------|
| VS Code Developer Console | LLM generation attempts and fallbacks | Debugging LLM issues |
| Debug Output Channel | File creation success/failure messages | Verifying file generation |
| Backend Server Logs | MCP tool execution details | Backend-side debugging |

### 6.4 FAQ

**Q: Do I need VS Code Copilot installed to use these commands?**
A: No. The commands work without Copilot, using template-based generation. However, Copilot produces higher-quality, more customized output.

**Q: Where are the generated files stored?**
A: All files are created under the `.code-intel/` directory in your workspace root:
- Agents: `.code-intel/agents/{name}.md`
- Hooks: `.code-intel/hooks/{name}.json`
- Steering: `.code-intel/steering/{name}.md`
- Skills: `.code-intel/skills/{name}/SKILL.md`

**Q: Can I modify the generated files?**
A: Yes. The generated files are standard Markdown/JSON files that you can edit freely. The commands generate a starting template that you can customize.

**Q: What happens if I create a file with the same name?**
A: The file is overwritten without warning. Make sure to back up important customizations before re-running a command with the same name.

**Q: Can I use these commands from the VS Code terminal?**
A: These commands are designed for the chat panel slash menu. To use them, open the chat panel (Ctrl+Shift+I) and type the slash command there, not in the terminal.

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
| Command ID | `create-new-agent` |
| Slash Menu | `/create-new-agent` |
| Input | Natural language description (string) |
| Output | `.code-intel/agents/{name}.md` (Markdown with YAML frontmatter) |

**Frontmatter Schema:**

```yaml
name: string          # kebab-case identifier
label: string         # Human-readable name
description: string   # Brief description
phase: enum           # requirements | specification | design | test_planning | implementation | testing | deployment
tools: string[]       # Array of tool names (default: ["read", "write", "shell", "@mcp"])
```

### 7.2 create-new-hook

| Attribute | Value |
|-----------|-------|
| Command ID | `create-new-hook` |
| Slash Menu | `/create-new-hook` |
| Input | Natural language description (string) |
| Output | `.code-intel/hooks/{name}.json` (JSON configuration) |

**JSON Schema:**

```json
{
  "enabled": boolean,
  "name": "string",
  "description": "string",
  "version": "string",
  "when": {
    "type": "promptSubmit | agentStop | fileEdited | fileCreated | fileDeleted",
    "patterns": ["string"]  // optional, for file events
  },
  "then": {
    "type": "askAgent | runCommand",
    "prompt": "string",  // for askAgent
    "command": "string"  // for runCommand
  }
}
```

### 7.3 create-new-steering

| Attribute | Value |
|-----------|-------|
| Command ID | `create-new-steering` |
| Slash Menu | `/create-new-steering` |
| Input | Natural language description (string) |
| Output | `.code-intel/steering/{name}.md` (Markdown with optional YAML frontmatter) |

**Frontmatter Schema:**

```yaml
inclusion: auto | manual | always  # How the rule is loaded
description: string                # Brief description
```

### 7.4 create-new-skill

| Attribute | Value |
|-----------|-------|
| Command ID | `create-new-skill` |
| Slash Menu | `/create-new-skill` |
| Input | Natural language description (string) |
| Output | `.code-intel/skills/{name}/SKILL.md` (Markdown with YAML frontmatter) |

**Frontmatter Schema:**

```yaml
name: string         # kebab-case identifier
description: string  # Brief description
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
| **Kebab-case** | Lowercase words separated by hyphens (e.g., `my-agent-name`) |
| **Frontmatter** | YAML metadata block at the top of a Markdown file |
| **Orchestration** | The system that coordinates multiple AI agents in the SDLC pipeline |

### 8.2 Related Documents

| Document | Location |
|----------|----------|
| BRD | BRD-v1.0-SA4E-193.docx |
| FSD | FSD-v1.0-SA4E-193.docx |
| TDD | TDD-v1.0-SA4E-193.docx |
| DPG | DPG-v1.0-SA4E-193.docx |

### 8.3 Version Compatibility

| System Version | Config Version | Breaking Changes |
|---------------|---------------|-----------------|
| 1.33.0 | v1 | Initial release of Config Commands |
| 1.32.0 | v1 | Agent runtime routing (compatible) |
| 1.31.0 | v1 | GraphSyncService fix (compatible) |
