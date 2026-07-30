# Technical Design Document (TDD)

## SDLC-Agents-4-Enterprise — SA4E-77: Pega Knowledge Graph — Categorized node types, Pega-mode colors, entry_id-based Code/KB split

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-77 |
| Title | Pega Knowledge Graph — Categorized node types, Pega-mode colors, entry_id-based Code/KB split |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-07-30 |
| Status | Draft |

---

## 1. Introduction

### 1.1 Purpose

This TDD describes the technical implementation of Pega rule categorization in the knowledge graph visualization. The feature enables automatic classification of Pega rules by their pxObjClass type (PROCESS, DECISION, DATA_MODEL, UI, TECHNICAL, etc.), entry_id-based Code/KB splitting, and Pega-mode color switching in the graph UI legend.

### 1.2 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend Runtime | Node.js/TypeScript (tsx) | 20+ |
| Backend Framework | Hono | Latest |
| Database | SQLite (via better-sqlite3) | Latest |
| Graph Renderer | Three.js (LOD Points/InstancedMesh) | 0.128.0 |
| Frontend UI | React 18 (inline SPA) | 18 |
| Extension | VS Code Extension API | 1.90+ |

### 1.3 Design Principles

- **Auto-detection over configuration**: Code/KB split uses entry_id prefix matching, not hardcoded type allowlists
- **Config-driven categorization**: Pega rule → graph type mapping loaded from `pega-categories.json`
- **Self-healing backfill**: Existing entries automatically projected into graph on startup
- **Single source of truth**: graph_nodes table drives all graph count queries (not knowledge_entries or symbols)

### 1.4 References

| Document | Location |
|----------|----------|
| SA4E-77 Jira Ticket | Jira SA4E-77 |

---

## 2. System Architecture

### 2.1 Architecture Overview

The Pega Knowledge Graph system has three layers:

1. **Extension Layer** (VS Code extension) — Fetches Pega context from Pega server, writes project metadata
2. **Backend Layer** (Hono server) — Manages graph nodes, serves spatial positions API, handles Pega rule classification
3. **Visualization Layer** (Admin SPA) — Renders 3D graph with Three.js, provides filter/legend UI

![Architecture Diagram](diagrams/architecture.png)

### 2.2 Component Diagram

![Component Diagram](diagrams/component.png)

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| GraphRepository | graph_nodes CRUD, Code/KB counting, isPega detection | TypeScript/SQLite |
| PegaService | Pega rule → graph type mapping, reclassification backfill | TypeScript |
| PegaHttpClient | Fetch Pega context from Pega server | TypeScript/HTTP |
| MemoryEngineCrud | Auto-project entries into graph_nodes on insert | TypeScript/SQLite |
| KbGraphSpatialRoutes | Serve /api/admin/kb/graph/positions + /spatial | TypeScript/Hono |
| KBGraphRenderer | Three.js LOD graph rendering (Points/InstancedMesh/Mesh) | JavaScript/Three.js |
| KBGraphPage | React filter dropdown, search, node detail panel | JavaScript/React 18 |

### 2.3 Data Flow

![Data Flow](diagrams/data-flow.png)

**Flow 1 — Pega Rule Ingestion:**
1. Extension calls `fetchAndSavePegaContext()` → writes `pega-project.json` + `project.json`
2. Extension writes Pega rules as `knowledge_entries` with `type = 'PEGA_RULE'`, `entry_id = 'pega:{hash}'`
3. `MemoryEngineCrud.insert()` projects PEGA_RULE entries into `graph_nodes` with type from `pxObjClassToGraphType()`
4. `syncExistingEntriesToGraph()` backfills any entries that weren't projected during insert

**Flow 2 — Graph Visualization:**
1. Admin SPA calls `GET /api/admin/kb/graph/positions`
2. Backend queries `graph_nodes` for the project, counts Code/KB via entry_id prefix
3. Backend checks `isPegaProject()` — true if any node has `entry_id LIKE 'pega:%'`
4. Response includes `{ nodes: [...], total, codeCount, kbCount, isPega }`
5. Frontend switches to Pega color map if `isPega === true`

**Flow 3 — Code/KB Counting (Dashboard):**
1. `GET /api/admin/stats` calls `GraphRepository.getNodeCounts()`
2. Code count = `COUNT(*) WHERE entry_id LIKE 'code:%' OR entry_id LIKE 'pega:%'`
3. KB count = `total - code`
4. `codeSymbols = symbolCount + COUNT(DISTINCT knowledge_entries WHERE type IN ('PEGA_RULE','PEGA_DATA'))`

---

## 3. API Design

### 3.1 API Overview

| # | Endpoint | Method | Description |
|---|----------|--------|-------------|
| 1 | /api/admin/kb/graph/positions | GET | Returns all graph nodes with positions, counts, and isPega flag |

### 3.2 API: GET /api/admin/kb/graph/positions

**Implements:** Graph visualization data loading

| Attribute | Value |
|-----------|-------|
| Method | GET |
| Path | /api/admin/kb/graph/positions |
| Auth | Bearer Token |
| Project | X-Project-Id header |

**Response — 200 OK:**

```json
{
  "nodes": [
    {
      "id": "pega:a1b2c3d4",
      "label": "CaseCreate",
      "type": "PROCESS",
      "tier": "CODE",
      "x": 123.45,
      "y": 67.89,
      "z": -45.67
    }
  ],
  "total": 1419,
  "kbCount": 0,
  "codeCount": 1419,
  "isPega": true
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 401 | Unauthorized — missing/invalid token |
| 403 | Forbidden — insufficient permissions |

---

## 4. Database Design

### 4.1 Schema Overview

The `graph_nodes` table is the authoritative source for graph visualization. No schema changes were required — the implementation uses the existing table structure.

**graph_nodes:**
| Column | Type | Description |
|--------|------|-------------|
| entry_id | TEXT PRIMARY KEY | `code:{id}` / `pega:{hash}` / `kb-entry:{id}` |
| label | TEXT | Display name |
| type | TEXT | Graph node type (PROCESS, CLASS, FUNCTION, etc.) |
| tier | TEXT | CODE / USER / PROJECT / SHARED |
| project_id | TEXT | Project identifier |
| x,y,z | REAL | 3D position |

### 4.2 Key Query Patterns

**Code count:**
```sql
SELECT COUNT(*) FROM graph_nodes
WHERE project_id = ? AND (entry_id LIKE 'code:%' OR entry_id LIKE 'pega:%')
```

**KB count:**
```sql
SELECT COUNT(*) FROM graph_nodes
WHERE project_id = ? AND entry_id NOT LIKE 'code:%' AND entry_id NOT LIKE 'pega:%'
```

**Pega project detection:**
```sql
SELECT COUNT(*) FROM graph_nodes
WHERE project_id = ? AND entry_id LIKE 'pega:%'
LIMIT 1
```

---

## 5. Module Design

### 5.1 Package Structure

```
src/
├── database/
│   ├── repositories/
│   │   ├── GraphRepository.ts    # getNodeCounts, isPegaProject, upsertNode
│   │   └── interfaces.ts         # IGraphRepository (isPegaProject added)
│   └── constants.ts              # Removed CODE_TYPES (dead code)
├── server/routes/admin/
│   └── kb-graph-spatial.ts       # /positions (isPega flag), /spatial
├── modules/
│   ├── pega/
│   │   └── PegaService.ts        # pxObjClassToGraphType, reclassifyExistingGraphNodes
│   └── memory/engine/
│       └── crud.ts               # insert() auto-projection, syncExistingEntriesToGraph()
├── viewer/admin/
│   ├── kb-graph-renderer.js      # COLORS + NODE_SIZES (includes Pega categories)
│   └── index.html                # KBGraphPage (DEFAULT_COLORS/PEGA_COLORS switching)
```

### 5.2 Key Interfaces

```typescript
interface IGraphRepository {
  getNodeCounts(projectId: string): Promise<GraphNodeCounts>;
  isPegaProject(projectId: string): Promise<boolean>;
  // ...
}
```

```typescript
interface GraphNodeCounts {
  total: number;
  code: number;     // entry_id LIKE 'code:%' OR 'pega:%'
  kb: number;       // total - code
}
```

### 5.3 Design Patterns

| Pattern | Where Used | Rationale |
|---------|-----------|-----------|
| Repository | GraphRepository | Isolates SQL queries behind interface (ISP) |
| Config-driven strategy | PegaService#pxObjClassToGraphType | Rule mapping from `pega-categories.json` |
| Singleton | PegaService (via getPegaService) | One-time reclassification on first access |
| Auto-backfill | MemoryEngineCrud + MemoryModuleBuilder | Ensures consistency without manual migration |

### 5.4 Pega Category Mapping

**Config file:** `backend/.code-intel/pega-categories.json`

```json
{
  "rules": [
    { "keywords": ["Rule-Obj-Activity"], "category": "PROCESS" },
    { "keywords": ["Rule-Obj-Decision"], "category": "DECISION" },
    { "keywords": ["Rule-Obj-HTML"], "category": "UI" }
  ]
}
```

**Fallback:** If no config file or no keyword matches, auto-extract first segment after `Rule-Obj-`:
- `Rule-Obj-Activity` → `ACTIVITY` (normalized: first segment)
- If no segment → `OTHER`

**16 Pega Categories with Colors:**

| Category | Hex Color | Used For |
|----------|-----------|----------|
| PROCESS | `#3b82f6` (blue) | Activities, flows |
| DATA_MODEL | `#10b981` (emerald) | Data types, properties |
| UI | `#f59e0b` (amber) | HTML, sections, layouts |
| TECHNICAL | `#ec4899` (pink) | Services, integrations |
| INT_CONNECTOR | `#ef4444` (red) | Connectors |
| DECISION | `#06b6d4` (cyan) | Decision trees, tables |
| INT_MAPPING | `#f97316` (orange) | Data transforms |
| INT_SERVICE | `#dc2626` (dark red) | SOAP/REST services |
| INT_RESOURCE | `#a855f7` (purple) | Connector resources |
| SECURITY | `#818cf8` (indigo) | Access roles, privileges |
| REPORT | `#6366f1` (indigo-500) | Reports, dashboards |
| ORG | `#e879f9` (fuchsia) | Organization, units |
| APP_DEF | `#c084fc` (purple-400) | Application definitions |
| GEN_AI | `#fb7185` (rose) | AI/ML rules |
| SURVEY | `#f472b6` (pink-400) | Surveys |
| SYSADMIN | `#34d399` (emerald-400) | System administration |
| PEGA_SCHEMA | `#fbbf24` (amber-400) | KB entry projections |
| OTHER | `#94a3b8` (slate) | Unmatched types |

### 5.5 Error Handling

| Exception | When Thrown | Handling |
|-----------|-------------|----------|
| isPegaProject DB error | Database query fails | Returns `false` (fail-safe) |
| getNodeCounts DB error | Database query fails | Returns zero counts |
| pxObjClassToGraphType empty | Empty pxObjClass | Returns `OTHER` |

---

## 6. Integration Design

### 6.1 Color Map Switching (Frontend)

When `KBGraphPage` loads graph positions:
1. If `d.isPega === true` → switch `typeFilters` to `PEGA_TYPE_FILTERS`, set `isPega` state
2. `typeColor(t)` helper picks from `PEGA_COLORS` or `DEFAULT_COLORS` based on `isPega`
3. Filter dropdown legend and node detail badge both use `typeColor()`
4. Node Types legend at bottom-left uses `isPega ? PEGA_COLORS : DEFAULT_COLORS`

### 6.2 Backfill Strategy

Two backfill mechanisms ensure consistency:
1. **Real-time:** `MemoryEngineCrud.insert()` projects every non-PEGA entry into `graph_nodes` at write time
2. **Startup:** `syncExistingEntriesToGraph()` iterates all knowledge_entries and inserts missing graph nodes
3. **Reclassification:** `reclassifyExistingGraphNodes()` updates old `CODE_ENTITY` types to correct Pega categories, called once on first `getPegaService()` call

---

## 7. Performance & Scalability

### 7.1 Query Performance

| Operation | Query | Expected Performance |
|-----------|-------|---------------------|
| getNodeCounts | 2x COUNT with LIKE | < 50ms for 10K nodes |
| isPegaProject | COUNT with LIKE 'pega:%' | < 20ms |
| loadPositions | Full table scan with project_id filter | < 100ms for 10K nodes |

### 7.2 LOD Rendering

The 3D graph renderer uses Level-of-Detail to handle large node counts:
- **FAR (>800 units):** `THREE.Points` — all nodes as colored dots (1 draw call)
- **MID (300-800):** `InstancedMesh` for nearby + Points for distant
- **CLOSE (<300):** Individual spheres for ~500 nearest + Points for rest

---

## 8. Security Design

### 8.1 Authentication

All graph API endpoints require Bearer token authentication via the existing admin auth system.

### 8.2 Authorization

| Role | Permissions |
|------|-------------|
| Admin | Full graph read access |
| User | Graph access limited by tier restrictions from KB_READ permission |

---

## 9. Deployment Considerations

### 9.1 Configuration

No new environment variables. The only config file is `backend/.code-intel/pega-categories.json` which is auto-created if missing.

### 9.2 Backward Compatibility

- Old `CODE_ENTITY` graph node types are reclassified on first PegaService access
- The `getNodeCounts()` method falls back to `project_id = ? OR project_id IS NULL` if no nodes found for specific project_id
- Dashboard stats handle both projects with and without Pega rules

---

## 10. Appendix

### Glossary

| Term | Definition |
|------|------------|
| pxObjClass | Pega class name like `Rule-Obj-Activity` |
| CODE_ENTITY | Old graph node type for all code-related nodes (legacy) |
| Pega mode | Graph UI mode where legend shows Pega categories instead of code symbol types |
| LOD | Level of Detail — rendering technique for large datasets |
| BACKFILL | Process of creating graph_nodes from existing knowledge_entries |

### Open Questions

| # | Question | Status | Answer |
|---|----------|--------|--------|
| 1 | Should pega-categories.json be shared across all Pega projects? | Open | Currently single file per backend instance |
| 2 | Auto-category fallback: should unknown Rule-Obj- types default to OTHER? | Open | Current behavior: first segment after Rule-Obj- |
