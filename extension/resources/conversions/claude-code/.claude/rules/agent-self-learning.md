# Agent Self-Learning & Tool Discovery

## ⛔ Rule #1: Search existing solutions BEFORE acting

Before solving any problem, MUST do 3 steps:

1. **Search Memory** — `mem_search("<problem description>")`
2. **Search Documents** — `grep_search("<keyword>", "documents/**/*.md")`
3. **Search Code** — `code_search("<class/pattern>")`

**Only if ALL 3 return nothing**, propose a new solution.

## ⛔ Rule #2: Tool Discovery — NO hardcoding

When needing external tools:
1. Use `find_tools(query="<description>")` to discover
2. Read `input_schema` from result
3. Call `execute_dynamic_tool(tool_name, arguments)` per schema
4. If not found → report user, suggest alternative

### Must search thoroughly — minimum 3 queries:
- Action description: `find_tools("search jira issues")`
- Predicted tool name: `find_tools("jira")`
- Domain keyword: `find_tools("JQL query filter")`

### MCP Tools First — NO custom scripts:
1. ALWAYS `find_tools` first to check MCP servers
2. If MCP has tool → use `execute_dynamic_tool`
3. ONLY use external script/CLI when MCP truly has no tool

## ⛔ Rule #3: Ingest new learnings

After completing task with new method, MUST ingest:
```
mem_ingest(content="<steps, tools, gotchas>", type="LESSON_LEARNED", source="<ticket>", tags="<agent>,<category>,proven-pattern")
```

## ⛔ Rule #4: Ingest document after creation (ZERO-CONTEXT)

After creating document, MUST ingest:
```
mem_ingest_file(file_path="documents/{TICKET}/{DOC}.md", type="REQUIREMENT|ARCHITECTURE|PROCEDURE")
```

## ⛔ Rule #5: Read context via Memory (save tokens)

When needing to read another ticket's document:
```
mem_search("<content>", detail=true)   → ~1,500 tokens
mem_get(id=<entry_id>)                 → Full content
```
**DO NOT** use `readFile(documents/.../BRD.md)` = ~6,000 tokens.

## ⛔ Rule #6: Tool prefix distinction

| Prefix | Server | When |
|---|---|---|
| `mem_*` | Code-Intelligence (local) | Local docs, decisions, error patterns |
| `code_*` | Code-Intelligence (local) | AST parsing, symbol search, code analysis |
| `kb_*` | Orchestrator (remote) | Jira data, cross-project team KB |

## ⛔ Rule #7: Load personalized rules at session start

First turn of each session: `mem_search("personalized rules preferences conventions", type="PROCEDURE", detail=true)`

## ⛔ Rule #8: No fragmented solutions

1. NO wrapper/helper if system already has mechanism — fix root cause
2. NO workaround when root cause can be fixed
3. Every new solution MUST be compatible with existing architecture