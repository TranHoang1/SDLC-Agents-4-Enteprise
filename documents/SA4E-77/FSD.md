# Functional Specification Document (FSD)

## SDLC-Agents-4-Enterprise — SA4E-77: Pega Knowledge Graph — Categorized node types, Pega-mode colors, entry_id-based Code/KB split

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-77 |
| Title | Pega Knowledge Graph — Categorized node types, Pega-mode colors, entry_id-based Code/KB split |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-07-30 |
| Status | Draft |
| Related BRD | documents/SA4E-77/BRD.md |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the Pega Knowledge Graph feature: how Pega rules are categorized, how the graph legend switches to Pega mode, and how code/KB counts are computed.

### 1.2 Scope

All functional behaviors described in this document apply to both the VS Code extension's admin SPA graph page and the backend API that serves graph data.

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| pxObjClass | Pega class name string like `Rule-Obj-Activity` |
| Pega mode | State where graph legend shows Pega categories instead of code symbol types |
| CODE_ENTITY | Legacy graph node type assigned to all code-like nodes before categorization |
| entry_id prefix | First segment of graph_nodes.entry_id (`code:`, `pega:`, `kb-entry:`) |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | documents/SA4E-77/BRD.md |
| TDD | documents/SA4E-77/TDD.md |

---

## 2. Functional Requirements — Use Cases

### UC-1: Auto-detect Pega Project

**Description:** When the knowledge graph loads, the backend detects whether the current project contains Pega rules and returns this information to the frontend.

**Trigger:** GET /api/admin/kb/graph/positions

**Main Flow:**
1. Backend queries `graph_nodes` for the given project_id
2. Backend checks: `SELECT COUNT(*) FROM graph_nodes WHERE project_id=? AND entry_id LIKE 'pega:%'`
3. If count > 0: `isPega = true`; else: `isPega = false`
4. Backend includes `isPega` field in API response
5. Frontend stores `isPega` in React state

**Business Rules:**
- BR-01: `isPega` is determined solely by presence of `pega:%` entries in graph_nodes
- BR-02: If database query fails, `isPega` defaults to `false`

### UC-2: Categorize Pega Rules by Type

**Description:** Each Pega rule inserted into the knowledge graph is assigned a category based on its pxObjClass.

**Trigger:** Insert of knowledge_entry with type = 'PEGA_RULE'

**Main Flow:**
1. `MemoryEngineCrud.insert()` receives a PEGA_RULE entry with pxObjClass
2. It calls `PegaService.pxObjClassToGraphType(pxObjClass)`
3. The function checks `pega-categories.json` for matching keywords
4. If match found: return configured category (e.g., "PROCESS")
5. If no match: auto-extract first segment after `Rule-Obj-` as category
6. If no segment: return "OTHER"
7. Node is inserted into graph_nodes with the determined type

**Alternative Flow — Reclassification:**
1. On first `getPegaService()` call, `reclassifyExistingGraphNodes()` runs
2. Iterates all graph_nodes where `entry_id LIKE 'pega:%' AND type = 'CODE_ENTITY'`
3. Updates each node's type via `pxObjClassToGraphType()`

**Business Rules:**
- BR-03: Category mapping is loaded from `backend/.code-intel/pega-categories.json`
- BR-04: If config file missing or empty, all categorization falls back to auto-category
- BR-05: Auto-category extracts first uppercase segment after `Rule-Obj-` prefix
- BR-06: Nodes with unknown type use `OTHER` as fallback

### UC-3: Switch Graph Legend to Pega Mode

**Description:** When the project is detected as a Pega project, the graph legend and filter dropdown switch to show Pega rule categories.

**Trigger:** Frontend receives `isPega: true` from /positions API

**Main Flow:**
1. `KBGraphPage` sets `isPega = true` state
2. `typeFilters` state is replaced with `PEGA_TYPE_FILTERS` (all Pega types enabled)
3. Filter dropdown renders Pega categories with Pega colors
4. Node detail badge uses `typeColor()` which picks from `PEGA_COLORS`
5. Node Types legend at bottom-left renders `PEGA_COLORS` entries

**Alternative Flow — Non-Pega project:**
1. `isPega` remains `false`
2. Legend shows standard `DEFAULT_COLORS` (FUNCTION, CLASS, etc.)
3. All filter/color behavior unchanged

**Business Rules:**
- BR-07: Color map switching is purely frontend-side — no backend involvement
- BR-08: `typeColor(t)` helper: if isPega → `PEGA_COLORS[t] || '#64748b'` else → `DEFAULT_COLORS[t] || '#64748b'`
- BR-09: The Node Types legend always shows the active color map's entries

### UC-4: Compute Code/KB Split via Entry ID Prefix

**Description:** Dashboard and graph use entry_id prefix to distinguish Code nodes from KB nodes.

**Trigger:** Any query that returns code and kb counts

**Main Flow:**
1. `GraphRepository.getNodeCounts()` queries total nodes: `COUNT(*)`
2. Code count: `COUNT(*) WHERE entry_id LIKE 'code:%' OR entry_id LIKE 'pega:%'`
3. KB count: `total - code`
4. Dashboard `codeSymbols` additionally includes Pega rules: `symbolCount + COUNT(DISTINCT pega rules in knowledge_entries)`

**Business Rules:**
- BR-10: `code:*` nodes = traditional code symbols (from graph-sync-service)
- BR-11: `pega:*` nodes = Pega rules (from PegaService)
- BR-12: All other entry_id prefixes = KB entries
- BR-13: No CODE_TYPES allowlist is maintained — detection is fully automatic

### UC-5: Config-Driven Pega Category Mapping

**Description:** Administrators can customize Pega rule → graph type mapping by editing `pega-categories.json`.

**Main Flow:**
1. Admin edits `backend/.code-intel/pega-categories.json`
2. File contains: `{ "rules": [{ "keywords": [...], "category": "..." }] }`
3. On next PegaService call, the config is reloaded
4. New rules apply to newly inserted nodes
5. Existing nodes can be reclassified by restarting the backend

**Business Rules:**
- BR-14: Config file is optional — if missing, auto-category fallback is used
- BR-15: Keyword matching is case-sensitive substring match against pxObjClass
- BR-16: First matching keyword in first matching rule wins (top-down priority)

---

## 3. Non-Functional Requirements

### 3.1 Performance

- getNodeCounts must complete within 50ms for up to 10K nodes
- isPegaProject query uses indexed project_id and partial entry_id scan

### 3.2 Compatibility

- Non-Pega projects must see identical behavior to pre-SA4E-77 release
- The /positions API response shape is backward-compatible (adds isPega field, does not remove any)

### 3.3 Configuration

- `pega-categories.json` is a plain JSON file, editable with any text editor
- No server restart required for config changes to apply to new nodes
- Existing nodes require reclassification call (automatic on next backend restart)

---

## 4. Data Requirements

### 4.1 Graph Node Types

| Type | Source | Prefix | Description |
|------|--------|--------|-------------|
| FUNCTION, METHOD, CLASS... | graph-sync-service | `code:*` | Traditional code symbols |
| PROCESS, DECISION, UI... | PegaService | `pega:*` | Pega rules by category |
| PEGA_SCHEMA | MemoryEngineCrud | `kb-entry:*` | KB entry projections |
| KNOWLEDGE_ENTRY | MemoryEngineCrud | `kb-entry:*` | KB entry projections |
| REQUIREMENT, ARCHITECTURE... | Manual KB entries | various | User-created KB entries |

### 4.2 Color Assignments (Pega Mode)

| Category | Color | CSS |
|----------|-------|-----|
| PROCESS | Blue | `#3b82f6` |
| DATA_MODEL | Emerald | `#10b981` |
| UI | Amber | `#f59e0b` |
| TECHNICAL | Pink | `#ec4899` |
| INT_CONNECTOR | Red | `#ef4444` |
| DECISION | Cyan | `#06b6d4` |
| INT_MAPPING | Orange | `#f97316` |
| INT_SERVICE | Dark Red | `#dc2626` |
| INT_RESOURCE | Purple | `#a855f7` |
| SECURITY | Indigo-400 | `#818cf8` |
| REPORT | Indigo-500 | `#6366f1` |
| ORG | Fuchsia | `#e879f9` |
| APP_DEF | Purple-400 | `#c084fc` |
| GEN_AI | Rose | `#fb7185` |
| SURVEY | Pink-400 | `#f472b6` |
| SYSADMIN | Emerald-400 | `#34d399` |
| PEGA_SCHEMA | Amber-400 | `#fbbf24` |
| OTHER | Slate | `#94a3b8` |

---

## 5. UI Specifications

### 5.1 Filter Dropdown

- Location: Top-left of graph, below search bar
- Toggle button: "Filter ▾"
- Each type: checkbox + colored dot + type name
- Click checkbox: toggle node visibility in graph
- All types enabled by default

### 5.2 Legend Panel

- Location: Bottom-left of graph
- Title: "Node Types"
- Lists all type→color pairs in the active color map
- Switches between DEFAULT_COLORS and PEGA_COLORS based on isPega

### 5.3 Node Detail Badge

- Shows selected node's type as a colored badge
- Background + border + text color derived from `typeColor(node.type)`

---

## 6. Business Rules Summary

| ID | Rule | Source |
|----|------|--------|
| BR-01 | isPega = presence of `pega:%` entries in graph_nodes | UC-1 |
| BR-02 | isPega defaults to false on DB error | UC-1 |
| BR-03 | Category mapping from pega-categories.json | UC-2 |
| BR-04 | Missing/empty config → auto-category fallback | UC-2 |
| BR-05 | Auto-category = first segment after Rule-Obj- | UC-2 |
| BR-06 | Unknown type → OTHER | UC-2 |
| BR-07 | Color switching is frontend-only | UC-3 |
| BR-08 | typeColor(): isPega ? PEGA_COLORS : DEFAULT_COLORS | UC-3 |
| BR-09 | Legend shows active color map | UC-3 |
| BR-10 | code:* = traditional symbols | UC-4 |
| BR-11 | pega:* = Pega rules | UC-4 |
| BR-12 | Other prefixes = KB entries | UC-4 |
| BR-13 | No CODE_TYPES allowlist | UC-4 |
| BR-14 | pega-categories.json is optional | UC-5 |
| BR-15 | Keyword match = case-sensitive substring | UC-5 |
| BR-16 | First matching rule wins | UC-5 |
