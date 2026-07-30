# Business Requirements Document (BRD)

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

---

## 1. Introduction

### 1.1 Scope

This BRD covers the enhancement of the Pega Knowledge Graph visualization to:
- Auto-detect Pega projects and switch graph legend colors to Pega rule categories
- Classify Pega rules by their pxObjClass type (PROCESS, DECISION, DATA_MODEL, UI, etc.)
- Use entry_id prefix matching for Code/KB split instead of hardcoded allowlists
- Provide a config-driven category mapping for Pega rule types via `pega-categories.json`

### 1.2 Out of Scope

- Changes to the Pega API fetch mechanism or authentication
- Performance optimization of the 3D graph renderer beyond color/type changes
- New graph interaction features (search, filter, etc.) beyond legend and color switching
- Multi-project Pega category sharing across backend instances

### 1.3 Preliminary Requirement

- Pega integration must already be configured (PegaHttpClient working)
- Knowledge base must have graph_nodes table with existing entries

---

## 2. Business Requirements

### 2.1 High Level Process Map

The feature enables Pega developers using the SDLC Agents extension to:
1. Fetch Pega context from the Pega server
2. View Pega rules categorized by type in the knowledge graph
3. See a Pega-specific legend with rule category colors
4. Toggle visibility of rule categories via filter dropdown
5. Automatically distinguish between code symbols, Pega rules, and KB entries in dashboard counts

### 2.2 List of User Stories

| # | Story | Priority | Source Ticket |
|---|-------|----------|---------------|
| 1 | As a Pega developer, I want Pega rules to be categorized by type in the knowledge graph so that I can visually distinguish between Activities, Data Types, UI rules, etc. | MUST HAVE | SA4E-77 |
| 2 | As a Pega developer, I want the graph legend to show Pega category colors (not code symbol types) when viewing a Pega project so that the visualization is relevant to my domain | MUST HAVE | SA4E-77 |
| 3 | As a Pega developer, I want the Code/KB split in the dashboard to automatically include Pega rules as "Code" so that I can see the total rule count | MUST HAVE | SA4E-77 |
| 4 | As an admin, I want to customize the Pega rule type categorization via a config file so that I can adapt grouping to my project's needs | COULD HAVE | SA4E-77 |
| 5 | As a developer on non-Pega projects, I want the graph to continue working as before with standard code symbol colors | MUST HAVE | SA4E-77 |

---

## 3. Dependencies

| Dependency | Type | Description |
|------------|------|-------------|
| Pega Integration (SA4E-50/53) | System | PegaHttpClient must be functional for fetching rules |
| Graph Nodes Table | Infrastructure | graph_nodes table must exist in SQLite database |
| Three.js v0.128.0 | External | LOD graph renderer library |

---

## 4. Stakeholders

| Role | Responsibility |
|------|----------------|
| Developer | Implement the feature |
| QA Engineer | Verify graph coloring and category mapping |
| Pega Developer (end user) | Validate that rule visualization is correct |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| pega-categories.json config mismatch | Medium | Low | Auto-fallback to first segment after Rule-Obj- |
| Performance regression for large rule sets | Medium | Low | LOD rendering handles up to 10K nodes |

### 5.2 Assumptions

- The existing graph rendering pipeline (kb-graph-renderer.js) supports adding new node types
- The /api/admin/kb/graph/positions response can include additional fields without breaking the frontend
- Pega pxObjClass naming conventions are consistent (Rule-Obj-{Category}-{Subtype})

---

## 6. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance | Graph load time for 10K nodes should not exceed 500ms |
| Backward Compatibility | Non-Pega projects must see the exact same colors and legend as before |
| Configurability | Pega category mapping must be editable without code changes |
| Auto-detection | Pega mode must be detected automatically, not require manual toggle |

---

## 7. Related Tickets

| Ticket Key | Summary | Relationship |
|------------|---------|--------------|
| SA4E-77 | Pega Knowledge Graph — Categorized node types, colors, Code/KB split | Main ticket |
