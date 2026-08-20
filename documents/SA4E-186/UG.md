# User Guide — Agent Runtime Routing

## SA4E-186: Frontmatter (tools, model), per-agent prompt switching

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-186 |
| Version | 1.0 |
| Date | 2025-01-27 |
| Author | DEV Agent |

---

## 1. Quick Start

Agent Runtime Routing lets you control which tools an agent can use, which LLM model it calls, and ensures the system prompt contains only that agent's instructions — all configured via a simple YAML frontmatter block in your agent `.md` file.

### 1.1 Create an Agent File

1. In your workspace, create the directory `.kiro/agents/` if it doesn't exist.
2. Add a markdown file with a descriptive name, e.g. `.kiro/agents/code-reviewer.md`.
3. Add YAML frontmatter at the top, then write the agent's instructions in the body:

```markdown
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
mcpServers:
  - code-intelligence
autoApprove:
  - read_file
---

You are a code reviewer. Analyze code for:
- SOLID principle violations
- Security vulnerabilities
- Performance issues
- Readability and naming conventions

Always provide specific line references and improvement suggestions.
```

4. Save the file. The extension discovers it automatically — no reload needed.

### 1.2 Select the Agent

Open the Chat Panel and select your agent from the **Agent Selector dropdown** at the top of the panel. The system prompt, tool access, and model will switch immediately.

### 1.3 Verify It Works

Send a message. The LLM will respond using only the selected agent's instructions, with access restricted to the tools you listed in frontmatter. Check the output channel (Debug: Kiro) for confirmation logs:

```
[AgentConfigResolver] Agent 'code-reviewer' selected — tools: 4 patterns, model: claude-sonnet-4-20250514
```

---

## 2. Configuration Reference

### 2.1 Frontmatter Fields

All fields are placed in the YAML block between `---` delimiters at the top of the `.md` file.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | No | filename (without `.md`) | Unique identifier for the agent |
| `name` | string | No | filename | Display name shown in UI dropdown |
| `description` | string | No | `""` | Short description shown in agent selector |
| `tools` | string[] | No | *(omit = unrestricted)* | Tool patterns whitelist (see §4) |
| `model` | string | No | *(user's default model)* | LLM model identifier override (see §5) |
| `mcpServers` | string[] | No | `[]` | Required MCP servers for this agent |
| `autoApprove` | string[] | No | `[]` | Tools that skip approval confirmation |

### 2.2 Agent Body (Instructions)

Everything below the closing `---` is the **agent body** — your system prompt instructions. When this agent is active, the LLM receives:

```
[Base system prompt]
[Steering rules (inclusion: always)]
[Your agent body here]
[KB context if available]
```

Only the selected agent's body is included. Other agents' instructions are excluded, reducing token usage and improving response focus.

### 2.3 File Location

| Path | Description |
|------|-------------|
| `.kiro/agents/*.md` | Agent definition files (Kiro IDE target) |

The extension watches this directory and discovers agents automatically on file creation/modification.

---

## 3. Usage

### 3.1 Selecting an Agent via Dropdown

1. Open the **Chat Panel** (sidebar or command palette: `Kiro: Open Chat`).
2. At the top of the chat panel, locate the **Agent Selector** dropdown.
3. Click to open the dropdown — all discovered agents appear with their `name` and `description`.
4. Select an agent. The system immediately:
   - Rebuilds the system prompt with only that agent's body
   - Filters available tools to match the agent's `tools` patterns
   - Routes LLM calls to the agent's `model` (if specified)
5. A confirmation message appears: the agent badge updates to show the active agent.

### 3.2 Deselecting an Agent (Fallback Mode)

To return to the default behavior (all agents concatenated, all tools available, default model):

- Select "All Agents (Default)" in the dropdown, or
- The system automatically falls back if the selected agent's file is deleted

In fallback mode, all agent instructions are concatenated (budget: 6000 chars) and all MCP tools remain available.

### 3.3 Switching Agents Mid-Session

You can switch agents at any time during a conversation:

- **Conversation history is preserved** — previous messages remain for context continuity.
- **System prompt changes immediately** — the next LLM call uses the new agent's instructions.
- **In-flight tool calls complete** — any running tool call finishes with the previous agent's config. The new config applies to the next turn.

### 3.4 Startup Behavior

On fresh session start, no agent is selected (fallback mode). If agents are synced from the extension host, the first agent in the list may be auto-selected based on your configuration.

---

## 4. Tool Filtering

### 4.1 How It Works

The `tools` field defines a **whitelist** of tool name patterns. Only tools matching these patterns are available to the LLM when the agent is active. Enforcement happens at two levels:

1. **Filter** — Before the LLM sees the tool list (agent_step node). The LLM schema only includes allowed tools.
2. **Enforcement** — At execution time (execute_tools node). Even if the LLM hallucinates a tool name, the call is blocked.

### 4.2 Pattern Syntax

| Pattern | Type | Matches | Example |
|---------|------|---------|---------|
| `mem_search` | Exact match | Only `mem_search` | `tools: [mem_search]` |
| `code_*` | Prefix wildcard | Any tool starting with `code_` | Matches `code_search`, `code_symbols`, `code_context` |
| `*` | Single wildcard | All tools (same as omitting field) | `tools: ['*']` |

**Rules:**
- Wildcard `*` is only supported as a **suffix** (prefix match). `*_search` is NOT valid.
- Pattern matching is **case-sensitive**. `Code_Search` ≠ `code_search`.
- Duplicate patterns are ignored (deduplicated at parse time).
- Invalid patterns (e.g. `*_search`) are treated as exact-match strings with a warning logged.

### 4.3 Special Cases

| `tools` value | Behavior |
|---------------|----------|
| Field omitted (no `tools` key) | **Unrestricted** — all discovered tools available |
| `tools: []` | **Text-only mode** — no tools available, LLM responds with text only |
| `tools: [pattern1, pattern2]` | **Filtered** — only matching tools available |

### 4.4 Blocked Tool Call Behavior

When the LLM requests a tool not in the allowed list, the system returns an error message to the LLM (not to the user):

```
Tool 'grep_search' is not available for agent 'code-reviewer'. Allowed tools: [code_search, code_symbols, read_file]
```

The LLM typically retries with an allowed tool or responds with text. No error is shown in the UI.

### 4.5 Examples

```yaml
# Only KB and code search tools
tools:
  - mem_search
  - mem_ingest
  - code_*
  - grep_search

# All Jira tools + memory tools
tools:
  - jira_*
  - mem_*

# Text-only agent (no tool access)
tools: []
```

---

## 5. Per-Agent Model Routing

### 5.1 How It Works

The `model` field specifies which LLM model to use for all calls made while this agent is active. The model string is passed directly to your configured LLM provider — no validation at the extension layer.

### 5.2 Configuration

```yaml
---
id: quick-answer
name: Quick Answer
description: Fast responses for simple questions
model: claude-haiku-4-20250514
tools:
  - read_file
  - grep_search
---
```

When this agent is selected, all LLM calls use `claude-haiku-4-20250514` instead of your global default.

### 5.3 Supported Model Strings

The `model` value is provider-specific. Use the model identifier your provider expects:

| Provider | Example Values |
|----------|---------------|
| Anthropic | `claude-sonnet-4-20250514`, `claude-haiku-4-20250514` |
| OpenAI | `gpt-4o`, `gpt-4o-mini`, `o1-preview` |
| Ollama | `llama3:70b`, `codellama:34b` |
| AWS Bedrock | `anthropic.claude-v2`, `amazon.titan-text-express-v1` |

### 5.4 Fallback Behavior

| Scenario | Behavior |
|----------|----------|
| `model` field omitted | Uses default model from VS Code settings (`kiroSdlc.llmModel`) |
| `model` field is empty string `""` | Treated as omitted — uses default model |
| Model not supported by provider | Provider returns standard error, surfaced in chat as stream error |
| API key missing for model's provider | Provider auth error displayed in chat |

### 5.5 Use Cases

| Use Case | Model Choice | Rationale |
|----------|-------------|-----------|
| Complex architecture review | `claude-sonnet-4-20250514` | Needs deep reasoning |
| Quick code lookups | `claude-haiku-4-20250514` | Fast, cheap, sufficient for simple tasks |
| Local/private code | `codellama:34b` (Ollama) | No data leaves machine |
| Cost optimization | Mix models per agent | Expensive model only for agents that need it |

---

## 6. Troubleshooting

### 6.1 Agent Not Appearing in Dropdown

| Possible Cause | Fix |
|----------------|-----|
| File not in `.kiro/agents/` directory | Move file to correct location |
| File extension not `.md` | Rename to `*.md` |
| Invalid YAML frontmatter | Check `---` delimiters are present and YAML is valid |
| Missing closing `---` | Ensure frontmatter block has both opening and closing `---` |

Check the debug output channel for parser warnings:
```
[AgentRegistry] Invalid YAML in .kiro/agents/my-agent.md: ...
```

### 6.2 Tools Not Being Filtered

| Symptom | Cause | Fix |
|---------|-------|-----|
| All tools still available | `tools` key missing from frontmatter | Add `tools:` field explicitly |
| Specific tool not blocked | Pattern matches via wildcard | Check if a wildcard pattern (e.g. `code_*`) inadvertently allows it |
| Agent appears unrestricted | Typo in field name (e.g. `tool:` instead of `tools:`) | Fix the YAML key name |

### 6.3 Model Routing Not Working

| Symptom | Cause | Fix |
|---------|-------|-----|
| Default model still used | `model` field empty or missing | Set `model: your-model-id` in frontmatter |
| "Model not found" error | Model string doesn't match provider | Verify exact model ID with your provider's docs |
| Auth error on model call | API key not configured for that provider | Configure provider credentials in VS Code settings |

### 6.4 Agent Switch Not Taking Effect

| Symptom | Cause | Fix |
|---------|-------|-----|
| Old agent's behavior persists | In-flight request completing | Wait for current response to finish, then send new message |
| Prompt still shows all agents | Agent selection message not received | Reopen chat panel, try selecting again |
| "Agent unavailable" toast | Agent file deleted from disk | Recreate the agent file |

### 6.5 Performance Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Slow agent switch (>100ms) | Agent file very large | Keep agent body concise (<10KB recommended) |
| High token usage | Agent body too verbose | Trim unnecessary instructions from agent body |

---

## 7. Examples

### 7.1 Code Reviewer — Focused on Quality

```markdown
---
id: code-reviewer
name: Code Reviewer
description: Reviews code for quality, security, and best practices
tools:
  - code_search
  - code_symbols
  - grep_search
  - read_file
model: claude-sonnet-4-20250514
mcpServers:
  - code-intelligence
autoApprove:
  - read_file
  - code_search
---

You are a senior code reviewer. When reviewing code:

1. Check SOLID principle violations
2. Identify security vulnerabilities (OWASP Top 10)
3. Flag performance bottlenecks
4. Verify error handling completeness
5. Assess naming clarity and documentation

Provide specific file:line references. Prioritize findings by severity (Critical > High > Medium > Low).
```

### 7.2 Quick Helper — Fast and Cheap

```markdown
---
id: quick-helper
name: Quick Helper
description: Fast answers for simple questions, uses lightweight model
tools:
  - read_file
  - grep_search
model: claude-haiku-4-20250514
---

You are a quick helper. Provide concise, direct answers.
Keep responses under 200 words unless the question requires more detail.
Prefer code examples over long explanations.
```

### 7.3 Research Agent — Full Tool Access

```markdown
---
id: researcher
name: Research Agent
description: Deep research with full tool access and powerful model
tools:
  - mem_*
  - code_*
  - grep_search
  - read_file
  - execute_dynamic_tool
model: claude-sonnet-4-20250514
mcpServers:
  - code-intelligence
---

You are a research agent with access to the knowledge base and code intelligence.

When researching a topic:
1. Search KB first (mem_search) for existing knowledge
2. Search codebase (code_search, grep_search) for implementations
3. Synthesize findings into a clear summary
4. Cite sources (file paths, KB entries)
```

### 7.4 Text-Only Agent — No Tools

```markdown
---
id: brainstorm
name: Brainstorm Partner
description: Pure text conversation for ideation (no tool access)
tools: []
model: claude-sonnet-4-20250514
---

You are a brainstorming partner. Help the user explore ideas, challenge assumptions, and think through problems.

Rules:
- Never suggest running tools or reading files
- Focus on creative thinking and structured reasoning
- Use analogies and frameworks to organize ideas
- Ask clarifying questions before diving deep
```

### 7.5 Jira Specialist — Domain-Specific Tools

```markdown
---
id: jira-bot
name: Jira Assistant
description: Manages Jira tickets — create, search, transition
tools:
  - jira_*
  - mem_search
model: claude-haiku-4-20250514
---

You are a Jira assistant. Help the user manage their project tickets.

Capabilities:
- Search issues by JQL
- Create new tickets with proper fields
- Transition ticket status
- Add comments and attachments
- Summarize sprint progress

Always confirm destructive actions (transitions, bulk updates) before executing.
```

### 7.6 Security Auditor — Restricted and Focused

```markdown
---
id: security-auditor
name: Security Auditor
description: Audits code for vulnerabilities with read-only access
tools:
  - code_search
  - code_symbols
  - grep_search
  - read_file
model: claude-sonnet-4-20250514
autoApprove:
  - read_file
  - grep_search
---

You are a security auditor. Perform static analysis on the codebase.

Check for:
- SQL injection vectors
- XSS vulnerabilities
- Hardcoded secrets/credentials
- Insecure deserialization
- Broken access control
- CSRF vulnerabilities
- Dependency vulnerabilities

For each finding, provide:
- Severity (Critical/High/Medium/Low)
- File and line number
- Proof of concept
- Recommended remediation
```

---

## 8. FAQ

**Q: Can I have multiple agents active at once?**
A: No. Only one agent is active at a time. The selected agent determines prompt, tools, and model. For multi-agent workflows, use the SDLC pipeline (separate feature).

**Q: Does switching agents lose my conversation?**
A: No. Conversation history is fully preserved. Only the system prompt, tool access, and model change.

**Q: What happens if I don't specify any frontmatter?**
A: The file is still recognized as an agent. The ID defaults to the filename, all tools remain available, and the default model is used. The file body becomes the agent's instructions.

**Q: Are tool names case-sensitive?**
A: Yes. `Code_Search` and `code_search` are different patterns. Use the exact tool name as reported by your MCP server.

**Q: Can I use regex in tool patterns?**
A: No. Only exact match and suffix wildcard (`*`) are supported. `code_*` matches any tool starting with `code_`, but `*_search` is invalid.

**Q: What's the maximum agent file size?**
A: No hard limit, but keep files under 10KB for best performance. The agent body is loaded synchronously on selection.

**Q: Do steering files still apply when an agent is selected?**
A: Yes. Steering files with `inclusion: always` are always included in the system prompt, regardless of agent selection.
