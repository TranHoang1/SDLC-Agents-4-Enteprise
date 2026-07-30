# Release Notes (RLN)

## SDLC-Agents-4-Enterprise — SA4E-77: Pega Knowledge Graph — Categorized node types, Pega-mode colors, entry_id-based Code/KB split

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-77 |
| Title | Pega Knowledge Graph Enhancement |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2026-07-30 |
| Status | Draft |

---

## 1. Release Summary

This release enhances the Pega integration by categorizing Pega rules in the knowledge graph by their pxObjClass type, switching the graph legend to show Pega-specific categories and colors, and using entry_id prefix matching for the Code/KB split.

---

## 2. New Features

### 2.1 Pega Rule Categorization in Graph

Pega rules in the knowledge graph are now categorized by their rule type:
- **PROCESS** (Activities, Flows) — Blue
- **DATA_MODEL** (Data Classes, Properties) — Emerald
- **UI** (HTML, Sections, Layouts) — Amber
- **DECISION** (Decision Trees, Tables) — Cyan
- **TECHNICAL** (Services, Integrations) — Pink
- **INT_CONNECTOR** — Red
- **INT_MAPPING** — Orange
- **INT_SERVICE** — Dark Red
- **INT_RESOURCE** — Purple
- **SECURITY** — Indigo
- **REPORT** — Indigo-500
- **ORG** — Fuchsia
- **APP_DEF** — Purple-400
- **GEN_AI** — Rose
- **SURVEY** — Pink-400
- **SYSADMIN** — Emerald-400
- **OTHER** — Slate (fallback)

### 2.2 Auto-Detection + Pega Mode

- Backend auto-detects Pega projects by checking for `pega:%` graph nodes
- Frontend automatically switches legend, filter dropdown, and node badge colors to Pega categories
- Non-Pega projects are unaffected — same colors and behavior as before

### 2.3 Config-Driven Category Mapping

- New config file: `backend/.code-intel/pega-categories.json`
- Customize keyword → category mapping without code changes
- Auto-fallback: if no config match, extracts category from first segment after `Rule-Obj-`

### 2.4 Entry-ID Based Code/KB Split

- Code count = nodes with `entry_id LIKE 'code:%' OR 'pega:%'`
- KB count = all other nodes
- No more CODE_TYPES allowlist — fully automatic

---

## 3. Bug Fixes

- Dashboard codeSymbols now includes Pega rules (was showing 0 for Pega-only projects)
- Fixed string concatenation bug in /api/admin/stats (Number() wrapping)
- Graph node detail badge references `colors` variable fixed (was broken after refactor)

---

## 4. Breaking Changes

None. All changes are backward-compatible:
- `/positions` API adds `isPega` field (does not remove any fields)
- Legacy nodes with `CODE_ENTITY` type are auto-reclassified on backend startup
- Non-Pega projects see identical behavior

---

## 5. Upgrade Notes

### 5.1 Backend
1. Pull latest code
2. Backend auto-restarts (tsx watch)
3. `reclassifyExistingGraphNodes()` runs automatically on first PegaService call
4. Optionally edit `backend/.code-intel/pega-categories.json`

### 5.2 Extension
1. Install new VSIX: `extension/sdlc-agents.vsix`
2. Reload VS Code window
3. Click "Fetch Pega Context" to ensure project.json is created

---

## 6. Files Changed

| Area | Files |
|------|-------|
| Backend (Core) | GraphRepository.ts, interfaces.ts, constants.ts, kb-graph-spatial.ts |
| Backend (Pega) | PegaService.ts, models.ts, pega-api.ts, crud.ts, MemoryModuleBuilder.ts |
| Backend (Analytics) | analytics.ts |
| Frontend (Graph) | kb-graph-renderer.js, index.html |
| Extension | extension.ts, PegaHttpClient.ts, CommandRegistrar.ts, IndexingService.ts |
