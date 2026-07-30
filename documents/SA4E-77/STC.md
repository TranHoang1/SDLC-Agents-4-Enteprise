# Software Test Cases (STC)

## SDLC-Agents-4-Enterprise — SA4E-77: Pega Knowledge Graph — Categorized node types, Pega-mode colors, entry_id-based Code/KB split

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-77 |
| Title | Pega Knowledge Graph |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-07-30 |
| Status | Draft |

---

## Test Case Summary

| Category | ID Range | Count | Priority |
|----------|----------|-------|----------|
| Functional — Happy Path | TC-001 to TC-099 | 5 | High |
| Functional — Alternative Flows | TC-100 to TC-199 | 4 | High |
| Business Rule Validation | TC-300 to TC-399 | 3 | High |
| UI/UX Testing | TC-500 to TC-599 | 3 | Medium |
| Regression Testing | TC-800 to TC-899 | 2 | High |

---

## 1. Functional — Happy Path

### TC-001: isPega=true for project with Pega rules

| Field | Value |
|-------|-------|
| ID | TC-001 |
| Priority | High |
| Precondition | Project has graph_nodes with entry_id LIKE 'pega:%' |
| Steps | 1. Call GET /api/admin/kb/graph/positions 2. Inspect response |
| Expected Result | `isPega: true` in response |
| Covered BR | BR-01 |

### TC-002: isPega=false for non-Pega project

| Field | Value |
|-------|-------|
| ID | TC-002 |
| Priority | High |
| Precondition | Project has no graph_nodes with entry_id LIKE 'pega:%' |
| Steps | 1. Call GET /api/admin/kb/graph/positions 2. Inspect response |
| Expected Result | `isPega: false` in response |
| Covered BR | BR-02 |

### TC-003: Pega rule type from config

| Field | Value |
|-------|-------|
| ID | TC-003 |
| Priority | High |
| Precondition | pega-categories.json has rule: keywords=["Rule-Obj-Activity"] → "PROCESS" |
| Steps | 1. Insert PEGA_RULE with pxObjClass="Rule-Obj-Activity-Type" 2. Query graph_nodes |
| Expected Result | Node type = "PROCESS" |
| Covered BR | BR-03 |

### TC-004: Pega rule type from auto-fallback

| Field | Value |
|-------|-------|
| ID | TC-004 |
| Priority | High |
| Precondition | pega-categories.json missing or no matching rule |
| Steps | 1. Insert PEGA_RULE with pxObjClass="Rule-Obj-Flow-Action" 2. Query graph_nodes |
| Expected Result | Node type = auto-category (first segment after Rule-Obj-) |
| Covered BR | BR-04, BR-05 |

### TC-005: Code split by entry_id

| Field | Value |
|-------|-------|
| ID | TC-005 |
| Priority | High |
| Precondition | graph_nodes has entries with code:*, pega:*, kb-entry:* prefixes |
| Steps | 1. Call GET /api/admin/stats 2. Check graphCodeNodes and graphKbNodes |
| Expected Result | code + kb = total. code includes both code:* and pega:* |
| Covered BR | BR-10, BR-11, BR-12 |

---

## 2. Functional — Alternative/Exception Flows

### TC-101: isPega=false on DB error

| Field | Value |
|-------|-------|
| ID | TC-101 |
| Priority | High |
| Precondition | Database connection fails during isPegaProject query |
| Steps | 1. Simulate DB failure 2. Call /positions 3. Inspect response |
| Expected Result | isPega: false (fail-safe) |
| Covered BR | BR-02 |

### TC-102: Unknown pxObjClass → OTHER

| Field | Value |
|-------|-------|
| ID | TC-102 |
| Priority | High |
| Precondition | Empty pxObjClass or unrecognized format |
| Steps | 1. Insert PEGA_RULE with pxObjClass="" 2. Query graph_nodes |
| Expected Result | Node type = "OTHER" |
| Covered BR | BR-06 |

### TC-103: Empty pega-categories.json

| Field | Value |
|-------|-------|
| ID | TC-103 |
| Priority | Med |
| Precondition | pega-categories.json exists but has empty rules array |
| Steps | 1. Insert multiple PEGA_RULE entries 2. Query their graph node types |
| Expected Result | All types use auto-category fallback |
| Covered BR | BR-04 |

### TC-104: Config keyword priority

| Field | Value |
|-------|-------|
| ID | TC-104 |
| Priority | Med |
| Precondition | pega-categories.json has two rules both matching same pxObjClass |
| Steps | 1. Insert PEGA_RULE matching both rules 2. Query node type |
| Expected Result | Type = category from first matching rule |
| Covered BR | BR-16 |

---

## 3. UI/UX Testing

### TC-501: Graph legend switches to Pega mode

| Field | Value |
|-------|-------|
| ID | TC-501 |
| Priority | High |
| Precondition | Pega project (isPega=true) |
| Steps | 1. Open KB Graph page 2. Observe legend at bottom-left 3. Open filter dropdown |
| Expected Result | Legend shows Pega categories (PROCESS, DATA_MODEL, UI...). Filter dropdown shows same. |
| Covered BR | BR-07, BR-08, BR-09 |

### TC-502: Non-Pega project shows standard legend

| Field | Value |
|-------|-------|
| ID | TC-502 |
| Priority | High |
| Precondition | Non-Pega project (isPega=false) |
| Steps | 1. Open KB Graph page 2. Observe legend |
| Expected Result | Legend shows standard types (FUNCTION, CLASS, METHOD, etc.) |
| Covered BR | BR-09 |

### TC-503: Filter toggle hides nodes

| Field | Value |
|-------|-------|
| ID | TC-503 |
| Priority | Med |
| Precondition | Pega project with multiple rule types |
| Steps | 1. Open KB Graph 2. Uncheck "PROCESS" in filter 3. Observe graph |
| Expected Result | All PROCESS nodes disappear from graph. Other nodes remain. |

---

## 4. Regression Testing

### TC-801: Non-Pega project dashboard counts

| Field | Value |
|-------|-------|
| ID | TC-801 |
| Priority | High |
| Precondition | Project with code symbols only (no Pega rules) |
| Steps | 1. Open Dashboard 2. Check KB Entries, Code Symbols, Graph Nodes |
| Expected Result | Values match pre-SA4E-77 behavior. No regressions. |

### TC-802: Non-Pega project graph colors

| Field | Value |
|-------|-------|
| ID | TC-802 |
| Priority | High |
| Precondition | Non-Pega project |
| Steps | 1. Open KB Graph 2. Observe node colors |
| Expected Result | Colors match pre-SA4E-77: FUNCTION=indigo, CLASS=fuchsia, etc. |
