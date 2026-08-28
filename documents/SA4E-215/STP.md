# Software Test Plan (STP) — SA4E-215

**Ticket:** SA4E-215 · **Status:** Deployed & UAT live · **Realigned 2026-08-27 to actual routes** (was "Done (L3)" 2026-08-26)

## 1. Strategy
Pyramid: **14 Unit** · **8 Integration** · **6 E2E** (see [pending.png](diagrams/pending.png)). Integration/E2E run against the **real `sa4e_db`** (TEXT ids, pbkdf2, group RBAC).

> **2026-08-27 realign note:** older STP described `/decisions/evaluate` with server-side scoring, soft-delete, snake_case fields and `409` conflicts. The real API has **no `/evaluate` and no scoring** (client supplies `result`), **hard-delete** for MCP, **camelCase** fields (`projectId`,`ruleSetId`,`transportType`), and duplicate/unknown-project errors return **`400 ERR_001`/`ERR_006`** (not 409). This section is corrected to match `backend/src/server/routes/sa4e-215/*` + `mcp/servers.ts`.

## 2. Module Scope
### Auth (AUTH)
- UT-AUTH-01 register hashes with **pbkdf2** (`salt:hash`), inserts `users`.
- UT-AUTH-02 duplicate email → ERR_001.
- UT-AUTH-03 login returns `data.token` + `data.user.{userId,accessGroupId,permissions}`.
- UT-AUTH-04 wrong password → ERR_002.
- UT-AUTH-05 missing fields → ERR_001.
- IT-AUTH-01 register→login round-trip against real `users`.
- IT-AUTH-02 authorization resolves via `access_group_id`→`group_permissions` (e.g. `MCP_ACCESS`).

### Decisions (DEC)
> No `/evaluate`, no server scoring. Client sends `result`; server stores it + writes `audit_log`.
- UT-DEC-01 create requires `ruleSetId`+`result` (ERR_001).
- UT-DEC-02 result is stored verbatim (no score logic); `inputParams`/`confidence` optional.
- UT-DEC-03 inserts into `decisions` (TEXT `decision_id`, prefix `dec-`).
- IT-DEC-01 writes real `audit_log` row (`action='DECISION_CREATE'`, `resource='decision'`).
- IT-DEC-02 list filters by `projectId`/`ruleSetId` + `limit` (no `user_id` filter).
- E2E-DEC-01 create→list reflects new record + audit entry.

### MCP (MCP)
> Mounted at `/mcp/servers` (not `/mcp-servers`). `projectId` must exist in `project_registry` (else ERR_006). `name` unique per `projectId`.
- UT-MCP-01 create requires `projectId,name,transportType` (ERR_001 if missing).
- UT-MCP-02 `(name, projectId)` unique → `400 ERR_001` (not 409).
- UT-MCP-03 DELETE is **hard delete** (row removed); disable via `PUT` `disabled:true`.
- UT-MCP-04 JSON fields (`args`,`env`,`autoApprove`,`tools`) stored as TEXT.
- IT-MCP-01 CRUD lifecycle + project scoping.
- IT-MCP-02 same `name`, different `projectId` allowed.
- E2E-MCP-01 `migrate-mcp.js` populates `mcp_servers`; counts match `orchestration.json`.
- E2E-MCP-02 full CRUD via API post-migration.
- E2E-MCP-03 uniqueness enforced end-to-end (400 ERR_001).

## 3. Test Data
- Real `project_registry` project (e.g., `project_id` text) + 2–3 projects.
- Existing `users` (e.g., `user-admin-001`, `grp-admin`) for auth tests.
- Sample `orchestration.json` with 5–10 MCP servers.

## 4. Entry/Exit
- Entry: `mcp_servers`+`decisions` tables exist; `project_registry` has test project.
- Exit: 14 unit + 8 integration + 6 e2e green; no `ERR_002` user enumeration.

## 5. Diagram Index
| # | Diagram | PNG | Drawio |
|---|---------|-----|--------|
| 1 | Test Strategy | [pending.png](diagrams/pending.png) | [pending.drawio](diagrams/pending.drawio) |
| 2 | ER Diagram | [er-diagram.png](diagrams/er-diagram.png) | [er-diagram.drawio](diagrams/er-diagram.drawio) |
| 3 | Auth Flow | [auth-flow.png](diagrams/auth-flow.png) | [auth-flow.drawio](diagrams/auth-flow.drawio) |
| 4 | Decision Flow | [decision-flow.png](diagrams/decision-flow.png) | [decision-flow.drawio](diagrams/decision-flow.drawio) |
| 5 | Migration Flow | [migration-flow.png](diagrams/migration-flow.png) | [migration-flow.drawio](diagrams/migration-flow.drawio) |
