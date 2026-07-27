## Đánh giá Memory Module của Backend Hono theo 7 Level

```
[L1: Context] ──► [L2: pgvector RAG] ──► [L3: Events/Session] ──► [L4: Tier/Scope/Evolution] ──► [L5: Procedure/Skill] ──► [L6: Graph/Multi-Agent]
```

### Chi tiết phân cấp

| Level | Tên | Trạng thái | Cơ chế thực tế |
|---|---|---|---|
| **L0** | Stateless | ✅ Vượt xa | Module `memory` chuyên biệt, không chạy pure prompt |
| **L1** | Short-term Context | ✅ 100% | Middleware Hono, context window, session management |
| **L2** | Vector RAG | ✅ 100% | PostgreSQL + pgvector, FTS5 + tsvector, hybrid search |
| **L3** | Episodic & Persona | ✅ 100% | `memory_sessions` + `conversation_turns`, audit log |
| **L4** | Self-Reflective | ✅ **100%** | `knowledge_entries` với tier (WORKING→EPISODIC→SEMANTIC) + scope (USER→SHARED). **TierConsolidationService**: auto-promote WORKING→EPISODIC→SEMANTIC theo quality/access/age thresholds, stale demotion, expired archiving, dry-run, configurable. **Auto-scheduled consolidation** (30min interval via `MemoryModuleBuilder.withConsolidation()`). Evolution scoring (temporal decay, confidence, outcome, predictive, superseded). Epoch auto-tracking. ScopePromotionService. `mem_consolidate` thật (3 actions: consolidate, config, stats). |
| **L5** | Skill Memory | ✅ **100%** | `mem_procedure` CRUD + `mem_skill_capture` (auto-capture từ conversation turns) + `mem_skill_execute` wired vào tool registry qua `DispatchContext.dispatch`. **Skill sharing**: `share`/`list_shared` actions + `mem_skill_share`/`mem_skill_list_shared` convenience tools. Variable substitution (`{{var}}`). Procedures lưu trong knowledge_entries dạng `type='PROCEDURE'`, scope promotion to SHARED cho cross-project visibility. |
| **L6** | Collective Graph | ✅ **100%** | `kb-graph` module với GraphService 20+ methods. 9 tools: `kb_graph_query`/`kb_graph_add_node`/`kb_graph_add_edge`/`kb_graph_community` (label propagation)/`kb_graph_pagerank`/`kb_graph_stats` + **`kb_graph_merge`** (multi-project merge với conflict detection)/**`kb_graph_cross_sync`** (cross-tenant edge creation)/**`kb_graph_remove_cross`** (cross-edge cleanup). Spatial query 3D. SHARED scope promotion. |

### Kiến trúc thực tế

- **Backend:** Hono (Port 48721)
- **Database:** SQLite / PostgreSQL + pgvector (Strategy Pattern qua DatabaseAdapter)
- **Modules:** `memory`, `code-intel`, `kb-graph`, `orchestration`, `analytics`, `web`, `utility`

### Lưu ý

- Tiers: `WORKING → EPISODIC → SEMANTIC` (không phải PROCEDURAL)
- `mem_consolidate` thay thế stub với 3 sub-actions (consolidate, config, stats)
- `mem_skill_execute` nhận `(engine, scopeCtx, args, dispatch)` — gọi tool thật qua DispatchContext
- `DispatchContext` có `dispatch?: (toolName, args) => Promise<string | null>` để handler gọi tool khác
- 9 graph tools đều real implementation, không còn stub
- Consolidation background job chạy 30 phút/lần
- Skill sharing: `mem_procedure share` → scope='SHARED', `mem_skill_list_shared` → list cross-project
- Multi-agent graph: `kb_graph_merge` (read-only union), `kb_graph_cross_sync` (CROSS_TENANT edges), `kb_graph_remove_cross` (cleanup)
- 44+ tests (Procedure + KBGraphModule), tất cả pass

### Còn lại

Không — tất cả gaps đã đóng. 3 levels 100%.
