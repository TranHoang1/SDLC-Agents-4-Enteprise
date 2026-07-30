---
name: 'Agent Self-Learning'
description: 'KB search + tool discovery rules for all agents'
applyTo: '**'
---

# Agent Self-Learning & Tool Discovery

## Search existing solutions BEFORE acting

1. `mem_search("<problem>")` — check KB
2. `grep_search("<keyword>", "documents/**/*.md")` — check docs
3. `code_search("<pattern>")` — check code

Only if ALL 3 return nothing, propose new solution.

## Tool Discovery — NO hardcoding

1. `find_tools(query="<description>")` to discover
2. Read `input_schema` from result
3. `execute_dynamic_tool(tool_name, arguments)` per schema

Minimum 3 query variations before concluding "no tool". MCP tools first — no custom scripts when MCP has a tool.

## Ingest new learnings

`mem_ingest(content="...", type="LESSON_LEARNED", source="<ticket>", tags="<agent>,proven-pattern")`

## Ingest documents after creation

`mem_ingest_file(file_path="documents/{TICKET}/{DOC}.md", type="REQUIREMENT|ARCHITECTURE|PROCEDURE")`

## Read context via Memory (save tokens)

`mem_search(query, detail=true)` ~1,500 tokens vs `readFile` ~6,000 tokens.

## Tool prefix distinction

| Prefix | When |
|---|---|
| `mem_*` | Local documents, decisions, error patterns |
| `code_*` | AST parsing, symbol search, code analysis |
| `kb_*` | Jira data, cross-project team KB |

## No fragmented solutions

- No wrapper/helper if system already has mechanism — fix root cause
- No workaround when root cause can be fixed
- Every new solution must be compatible with existing architecture