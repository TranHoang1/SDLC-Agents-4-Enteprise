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

## Pega Application Context — Access Group Discovery

### Purpose

Sau khi xác định application context (AppName, AppVersion), agent PHẢI lấy danh sách Access Groups để hiểu permission model và RuleSet stack của app đó.

### Workflow: Application → Access Groups

```
Step 0: Fetch DPage Rule Definition (MANDATORY before calling ANY Data Page)
  execute_dynamic_tool(
    toolName: "pega_get_rule",
    arguments: { "insKey": "RULE-DECLARE-PAGES D_PZACCESSGROUPSBYAPPLICATION" }
  )
  → Returns: rule JSON with pyParameterPage (param names, types, defaults)
  → Extract: exact parameter names from the rule (e.g., AppName, AppVersion)

Step 1: Get Application Info
  execute_dynamic_tool(
    toolName: "pega_get_session_context",
    arguments: {}
  )
  → Returns: { pyAccessGroup, pyUserIdentifier, pyUserName, ... }

Step 2: Fetch Access Groups using CORRECT param names from Step 0
  execute_dynamic_tool(
    toolName: "pega_datapage_list",
    arguments: {
      "dataPageName": "D_pzAccessGroupsByApplication",
      "parameters": { "AppName": "{appName}", "AppVersion": "{appVersion}" }
    }
  )
  → Returns: { pxResults: [{ pyAccessGroup: "...", ... }, ...], totalCount: N }
```

### ⛔ CRITICAL RULE: Always Fetch DPage Rule Before Calling

**Trước khi gọi BẤT KỲ Data Page nào qua `/datapage/list` hoặc `/datapage/single`:**

1. Fetch rule definition: `GET /rules/RULE-DECLARE-PAGES D_{PAGE_NAME_UPPERCASE}`
2. Parse `pyParameterPage` → extract param names + types
3. Dùng CHÍNH XÁC param names từ rule definition (case-sensitive)
4. KHÔNG ĐƯỢC đoán param names — Pega Data Pages rất nhạy cảm với tên tham số

**Ví dụ:**
- ❌ WRONG: `{ "ApplicationName": "HRAppsV2" }` (đoán tên)
- ✅ RIGHT: Fetch rule → thấy param `AppName` → `{ "AppName": "HRAppsV2" }`

### Khi nào dùng:

| Trigger | Action |
|---------|--------|
| Bắt đầu phiên làm việc Pega mới | Lấy session context → access groups |
| Trước khi save/checkout rule | Xác định RuleSet version từ access group stack |
| Trước khi tạo branch | Biết RuleSet name từ access group |
| Khi agent cần biết permission model | List access groups → xem operator permissions |

### API Details

**Endpoint:** `POST /api/CodeIntelligence/v1/datapage/list`

**Parameters:**

| Param | Location | Value |
|-------|----------|-------|
| `dataPageName` | Query string | `D_pzAccessGroupsByApplication` |
| Body | JSON | `{ "AppName": "HRAppsV2", "AppVersion": "01.01" }` |

**Response format:**
```json
{
  "pxResults": [
    { "pyAccessGroup": "HRAppsV2:Administrators", "pyRuleSetList": [...] },
    { "pyAccessGroup": "HRAppsV2:Users", "pyRuleSetList": [...] }
  ],
  "totalCount": 2
}
```

### Useful Data Pages (all via `/datapage/list`)

| Data Page Name | Purpose | Parameters |
|----------------|---------|------------|
| `D_pzAccessGroupsByApplication` | All access groups for an app | `ApplicationName`, `ApplicationVersion` |
| `D_pyCaseTypeList` | All case types in scope | _(none — uses session context)_ |
| `D_pzRuleSetsInApplication` | All RuleSets in app stack | `ApplicationName`, `ApplicationVersion` |

### MCP Tool Mapping

Nếu tool `pega_datapage_list` chưa available, dùng `find_tools("pega datapage")` để discover tên chính xác. Fallback HTTP:

```
POST {pegaEndpoint}/api/CodeIntelligence/v1/datapage/list?dataPageName=D_pzAccessGroupsByApplication
Authorization: Basic {base64(user:pass)}
Content-Type: application/json

{ "AppName": "HRAppsV2", "AppVersion": "01.01" }
```

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
