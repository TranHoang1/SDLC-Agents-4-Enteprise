# AGENTS.md — Instructions & Patterns

> Scoped instructions loaded conditionally by Codex when working in relevant contexts.

## Instructions (Conditional Rules)

| File | Purpose | When loaded |
|------|---------|-------------|
| `agent-self-learning.md` | Extended KB search + tool discovery details | Agent sessions |
| `code-intelligence.md` | Code/document indexing system | Code analysis tasks |
| `file-writing-standards.md` | Large file chunking, DOCX export | Document creation |
| `no-workaround-rule.md` | Fix root cause, no hacks | Code fixes |
| `tool-usage-dynamic.md` | Extended dynamic tool execution details | MCP tool issues |

## Patterns (Architecture Detection)

See `patterns/` subdirectory for architecture pattern detection:

- `catalog.md` — detection algorithm + scoring
- `ai-agent.md` — AI agent systems (this project's primary pattern)
- `microservice.md`, `monolith.md`, `library.md`, `cli-tool.md`, `data-pipeline.md`, `plugin.md`

## How Codex Loads These

Codex CLI discovers `AGENTS.md` files hierarchically:
- Root `AGENTS.md` — always-on project rules (5 core rules embedded)
- `instructions/AGENTS.md` — conditional rules index (this file)
- `instructions/patterns/` — loaded when architecture detection runs
- `agents/` — individual agent prompts
