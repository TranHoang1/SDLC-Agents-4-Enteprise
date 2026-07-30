# Deployment Guide (DPG)

## SDLC-Agents-4-Enterprise — SA4E-77: Pega Knowledge Graph — Categorized node types, Pega-mode colors, entry_id-based Code/KB split

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-77 |
| Title | Pega Knowledge Graph — Categorized node types, Pega-mode colors, entry_id-based Code/KB split |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2026-07-30 |
| Status | Draft |

---

## 1. Overview

### 1.1 Feature Summary

This feature enhances the Pega integration by:
- Categorizing Pega rule types (PROCESS, DECISION, DATA_MODEL, UI, TECHNICAL, etc.) in the knowledge graph
- Switching graph legend/colors to Pega mode automatically when a Pega project is detected
- Using entry_id prefix matching (`code:*` / `pega:*`) for Code/KB split instead of hardcoded type allowlist

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| GraphRepository.ts | Modified | Code/KB counting uses entry_id prefix, not CODE_TYPES |
| interfaces.ts | Modified | Added isPegaProject() to interface |
| constants.ts | Modified | Removed dead CODE_TYPES exports |
| kb-graph-spatial.ts | Modified | /positions API returns isPega flag |
| PegaService.ts | Modified | Config-driven category mapping, reclassification |
| crud.ts (memory engine) | Modified | Auto-projection + startup backfill |
| MemoryModuleBuilder.ts | Modified | Startup backfill call |
| analytics.ts | Modified | Pega rules counted in codeSymbols, Number() wrapping |
| kb-graph-renderer.js | Modified | Added 16 Pega categories to COLORS + NODE_SIZES |
| index.html (admin SPA) | Modified | Pega-mode color/filter switching |
| Extension (multiple files) | Modified | Project ID derivation, fetch context handler |

### 1.3 Target Environments

| Environment | Description | Deploy Order | Approval Required |
|-------------|-------------|-------------|-------------------|
| DEV | Local development | 1st | No |
| PROD | Production | 2nd | Yes |

---

## 2. Prerequisites

### 2.1 Software Dependencies

| Dependency | Version | Status |
|-----------|---------|--------|
| Node.js | 20+ | Required |
| npm/npx | Latest | Required |
| VS Code | 1.90+ | Required (extension host) |

### 2.2 Backup Requirements

- [ ] Database backup (graph_nodes, knowledge_entries tables)
- [ ] Previously built VSIX artifact saved
- [ ] `pega-categories.json` backed up if customized

---

## 3. Pre-Deployment Checklist

| # | Item | Responsible | Status |
|---|------|-------------|--------|
| 1 | All code merged to main branch | Developer | ☐ |
| 2 | Backend compiles: `npx tsc --noEmit` | Developer | ✅ |
| 3 | Extension compiles: `npm run compile` | Developer | ✅ |
| 4 | VSIX packaged: `npx @vscode/vsce package` | Developer | ✅ |
| 5 | pega-categories.json reviewed | Developer | ☐ |
| 6 | Rollback plan reviewed | Team | ☐ |

---

## 4. Database Migration

No database schema changes required. The implementation uses the existing `graph_nodes` table.

**Post-deployment cleanup** (optional, removes stale CODE_ENTITY types):
```sql
UPDATE graph_nodes SET type = 'PROCESS' WHERE type = 'CODE_ENTITY' AND entry_id LIKE 'pega:%' AND project_id = ?;
```
This is done automatically by `reclassifyExistingGraphNodes()` on first PegaService access.

---

## 5. Application Deployment

### 5.1 Backend Deployment

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Stop backend | `Ctrl+C` (tsx watch) | Process exits |
| 2 | Rebuild backend | `npm run build` (if applicable) | Exit code 0 |
| 3 | Start backend | `npx tsx watch backend/src/index.ts` | Server starts on port 9186 |
| 4 | Health check | `curl http://localhost:9186/api/admin/stats` | 200 OK, JSON response |

### 5.2 Extension (VSIX) Deployment

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Build extension | `cd extension && npm run compile` | No errors |
| 2 | Package VSIX | `cd extension && npx @vscode/vsce package --out sdlc-agents.vsix` | File created |
| 3 | Install in VS Code | Extensions → ... → Install from VSIX → select file | Extension appears in list |
| 4 | Reload window | Ctrl+Shift+P → "Developer: Reload Window" | Extension activates |
| 5 | Verify activation | Check Output panel → "SDLC-Agents" channel | "activated" message |

---

## 6. Configuration Changes

### 6.1 New Config File

`backend/.code-intel/pega-categories.json`

Auto-created if missing. Contains category mapping rules:
```json
{
  "rules": [
    { "keywords": ["Rule-Obj-Activity", "Rule-Obj-Flow"], "category": "PROCESS" },
    { "keywords": ["Rule-Obj-Decision"], "category": "DECISION" },
    { "keywords": ["Rule-Obj-HTML", "Rule-Obj-Section"], "category": "UI" },
    { "keywords": ["Rule-Obj-DataClass", "Rule-Obj-Property"], "category": "DATA_MODEL" },
    { "keywords": ["Rule-Obj-Connect"], "category": "INT_CONNECTOR" },
    { "keywords": ["Rule-Obj-Mapping"], "category": "INT_MAPPING" },
    { "keywords": ["Rule-Obj-SOAP", "Rule-Obj-REST"], "category": "INT_SERVICE" },
    { "keywords": ["Rule-Obj-Connector"], "category": "INT_RESOURCE" },
    { "keywords": ["Rule-Obj-AccessRole", "Rule-Obj-Privilege"], "category": "SECURITY" },
    { "keywords": ["Rule-Obj-Report"], "category": "REPORT" },
    { "keywords": ["Rule-Obj-OrgUnit"], "category": "ORG" },
    { "keywords": ["Rule-Obj-App"], "category": "APP_DEF" },
    { "keywords": ["Rule-Obj-AIML"], "category": "GEN_AI" },
    { "keywords": ["Rule-Obj-Survey"], "category": "SURVEY" },
    { "keywords": ["Rule-Obj-SysAdmin"], "category": "SYSADMIN" }
  ]
}
```

---

## 7. Post-Deployment Verification

### 7.1 Health Checks

| Check | Endpoint/Command | Expected Result |
|-------|-----------------|-----------------|
| Backend health | `curl http://localhost:9186/api/admin/stats` | 200 OK, JSON |
| Graph API | `curl -H "Authorization: Bearer {token}" http://localhost:9186/api/admin/kb/graph/positions` | 200 OK, nodes array |
| Dashboard | Open Admin UI → Dashboard | KB/Code counts displayed correctly |

### 7.2 Smoke Tests

| # | Scenario | Steps | Expected Result |
|---|----------|-------|-----------------|
| 1 | Pega project graph | Open KB Graph for a Pega workspace | Legend shows Pega categories (PROCESS, DECISION, UI...) |
| 2 | Non-Pega project | Open KB Graph for non-Pega workspace | Legend shows standard types (FUNCTION, CLASS, etc.) |
| 3 | Filter toggle | Click filter button, toggle type checkboxes | Graph nodes filtered visually |
| 4 | Node detail | Click a graph node | Node detail panel opens with correct type badge color |

### 7.3 Log Verification

| Log Entry | Level | Expected | Location |
|-----------|-------|----------|----------|
| `reclassified X graph nodes` | INFO | After first PegaService access | Backend console |
| `Backfilled X entries to graph` | INFO | On startup | Backend console |
| isPega log | DEBUG | On each /positions request | Backend console |

---

## 8. Rollback Plan

### 8.1 Rollback Decision Criteria

| Condition | Action |
|-----------|--------|
| Graph fails to load | Rollback VSIX + backend |
| Colors/legend incorrect | Rollback VSIX |
| Dashboard numbers incorrect | Rollback backend |

### 8.2 Rollback Steps — Backend

| Step | Action | Command |
|------|--------|---------|
| 1 | Stop backend | `Ctrl+C` |
| 2 | Revert backend code | `git checkout <previous-commit> -- backend/` |
| 3 | Restart backend | `npx tsx watch backend/src/index.ts` |
| 4 | Verify | `curl http://localhost:9186/api/admin/stats` |

### 8.3 Rollback Steps — Extension

| Step | Action |
|------|--------|
| 1 | Uninstall current VSIX from VS Code |
| 2 | Install previous VSIX version |
| 3 | Reload VS Code window |

### 8.4 Rollback Time Estimate

| Action | Estimated Time |
|--------|---------------|
| Backend rollback | 5 minutes |
| Extension rollback | 3 minutes |
| Verification | 5 minutes |
| **Total** | **13 minutes** |

---

## 9. Environment-Specific Notes

### 9.1 DEV

Backend runs via `npx tsx watch`. Extension is installed from local VSIX file.

### 9.2 PROD

- **Deployment Window:** Anytime (local dev installation)
- **Communication Plan:** Notify team after update

---

## 10. Appendix

### Related Tickets

| Ticket | Summary | Relationship |
|--------|---------|-------------|
| SA4E-77 | Pega Knowledge Graph — Categorized node types, colors, Code/KB split | Main ticket |
