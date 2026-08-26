# Software Test Plan (STP) — SA4E-215

**Ticket:** SA4E-215 · **Status:** Done (L3) · **Redesigned 2026-08-26 vs verified `sa4e_db`**

## 1. Strategy
Pyramid: **14 Unit** · **8 Integration** · **6 E2E** (see [pending.png](diagrams/pending.png)). Integration/E2E run against the **real `sa4e_db`** (TEXT ids, pbkdf2, group RBAC).

## 2. Module Scope
### Auth (AUTH)
- UT-AUTH-01 register hashes with **pbkdf2** (`salt:hash`), inserts `users`.
- UT-AUTH-02 duplicate email → ERR_001.
- UT-AUTH-03 login returns token with `user_id`+`access_group_id`.
- UT-AUTH-04 wrong password → ERR_002.
- UT-AUTH-05 missing fields → ERR_001.
- IT-AUTH-01 register→login round-trip against real `users`.
- IT-AUTH-02 authorization resolves via `access_group_id`→`group_permissions`.

### Decisions (DEC)
- UT-DEC-01 evaluate requires `rule_set_id` (ERR_001).
- UT-DEC-02 score>50→approved, >20→pending, else rejected.
- UT-DEC-03 inserts into `decisions` (TEXT `decision_id`).
- IT-DEC-01 writes real `audit_log` row (`action='decision_evaluate'`, `resource='decision'`).
- IT-DEC-02 history filters by `user_id`/`project_id` + pagination.
- E2E-DEC-01 full evaluate→history reflects new record + audit entry.

### MCP (MCP)
- UT-MCP-01 create requires `project_id,name,transport_type`.
- UT-MCP-02 `(name, project_id)` unique → 409.
- UT-MCP-03 soft-delete sets `disabled=1`.
- UT-MCP-04 JSON fields stored as TEXT.
- IT-MCP-01 CRUD lifecycle + project scoping.
- IT-MCP-02 same name, different `project_id` allowed.
- E2E-MCP-01 `migrate-mcp.js` populates `mcp_servers`; counts match `orchestration.json`.
- E2E-MCP-02 full CRUD via API post-migration.
- E2E-MCP-03 uniqueness enforced end-to-end.

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
