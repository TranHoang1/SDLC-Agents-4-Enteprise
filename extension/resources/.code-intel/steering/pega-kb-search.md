# Pega Knowledge Base Search Cascade

## Purpose

Pega rules (1,349+ nodes) are stored across TWO data layers:
1. **Memory KB** — text entries with BM25 search (tags: `pega,rule`, `pega,data`, `pega,schema`, `pega,ast`)
2. **Graph DB** — nodes with label/type/tier + edges (relationships between rules)

Using only `mem_search` misses graph-structured data. This cascade ensures ALL agents find Pega knowledge.

## When to Use

- Searching for Pega rule definitions (Activity, Flow, Data Transform, Decision Table)
- Exploring class hierarchy (`Work-`, `Data-`, `Rule-Obj-`)
- Finding relationships between rules (who calls whom, inheritance)
- Investigating Flow steps, connectors, or schema/field definitions

Do NOT use for: general project KB, code intelligence, or non-Pega searches.

---

## 4-Step Cascade

### Step 1: Text Search — `mem_search` (Direct)

```
mem_search(query: "ProcessClaim", type: "PEGA_RULE", limit: 10)
```

If 0 results or insufficient → Step 2.

### Step 2: Graph Label Search — `kb_graph_query` (via execute_dynamic_tool)

```
execute_dynamic_tool(
  tool_name: "kb_graph_query",
  arguments: { "query": "ProcessClaim", "type": "FUNCTION", "limit": 20 }
)
```

**Node type mapping:**

| Pega Artifact | Graph Type |
|---------------|------------|
| Activity / Flow / DT / Data Transform | `FUNCTION` |
| Class (Work-/Data-) | `CLASS` |
| Property | `PROPERTY` |
| Schema/Field docs | `DOCUMENT` |

If nodes found → use node ID for Step 3. If 0 nodes → Step 4.

### Step 3: Expand Neighbors — `mem_graph` (Direct)

```
mem_graph(action: "neighbors", node_id: 42)
```

Additional graph tools (via `execute_dynamic_tool`):
- `kb_graph_community` — detect clusters: `{ "min_cluster_size": 3 }`
- `kb_graph_pagerank` — rank importance: `{ "top_n": 10 }`

### Step 4: Fallback — File Search

```
grep_search(query: "ProcessClaim", includePattern: "rules/**/*.pega.json")
```

Or: `code_search(query: "ProcessClaim", file_pattern: "*.pega.json")`

---

## Common Query Examples

### Find Flow Steps

```
mem_search(query: "MyClaimFlow Rule-Obj-Flow", limit: 5)
// If 0 → graph:
execute_dynamic_tool(tool_name: "kb_graph_query", arguments: { "query": "MyClaimFlow", "type": "FUNCTION" })
// Expand connected shapes:
mem_graph(action: "neighbors", node_id: <flow_node_id>)
```

### Find Activity Relationships

```
mem_search(query: "ValidateAddress Rule-Obj-Activity", limit: 5)
// Graph fallback:
execute_dynamic_tool(tool_name: "kb_graph_query", arguments: { "query": "ValidateAddress" })
// Get CALLS/CALLED_BY edges:
mem_graph(action: "neighbors", node_id: <activity_node_id>)
```

### Find Class Hierarchy

```
execute_dynamic_tool(tool_name: "kb_graph_query", arguments: { "query": "Work-Claim", "type": "CLASS" })
// Expand INHERITS edges:
mem_graph(action: "neighbors", node_id: <class_node_id>)
```

### Find Decision Table Conditions

```
mem_search(query: "EligibilityCheck Decision", type: "PEGA_RULE", limit: 5)
execute_dynamic_tool(tool_name: "kb_graph_query", arguments: { "query": "EligibilityCheck", "type": "FUNCTION" })
```

### Find All Rules in a RuleSet

```
mem_search(query: "MyApp:01-01", type: "PEGA_RULE", limit: 50)
```

---

## Tool Reference

| Tool | Callable | Purpose |
|------|----------|---------|
| `mem_search` | Direct | Text/BM25 search across KB entries |
| `mem_graph` | Direct | Navigate graph edges (neighbors, path) |
| `kb_graph_query` | `execute_dynamic_tool` | Fuzzy label search on graph nodes |
| `kb_graph_community` | `execute_dynamic_tool` | Detect clusters of related nodes |
| `kb_graph_pagerank` | `execute_dynamic_tool` | Rank nodes by connectivity importance |
| `kb_graph_add_node` | `execute_dynamic_tool` | Add missing node to graph |
| `kb_graph_add_edge` | `execute_dynamic_tool` | Add relationship between nodes |
| `code_search` | Direct | Search source code files |
| `grep_search` | Direct | Regex search on raw rule JSON files |

---

## Rules for All Agents

1. **ALWAYS start with `mem_search`** — fastest, covers most cases
2. **NEVER stop at Step 1 if 0 results** — graph has 1,349+ nodes text search may miss
3. **Use `execute_dynamic_tool` for `kb_graph_*` tools** — they are nested tools
4. **Use `mem_graph` directly** for neighbor traversal (it is a core tool)
5. **Cache node IDs** — note relevant IDs for follow-up queries
6. **Ingest new knowledge** when discovered:
   ```
   mem_ingest(content: "...", type: "CONTEXT", tags: "pega,rule,{class}")
   ```
