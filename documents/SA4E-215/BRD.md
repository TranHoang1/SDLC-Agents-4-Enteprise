# Business Requirements Document (BRD) — SA4E-215

**Ticket:** SA4E-215
**Title:** MCP Server Config (DB), Authentication & Decision Engine — *aligned to real `sa4e_db`*
**Status:** Done (L3 autonomy, redesigned 2026-08-26 after DB verification)
**Author:** SDLC Agent (SM)

> This BRD reflects the **verified real database** (`sa4e_db`, inspected 2026-08-26). Earlier drafts assumed a fictional schema (integer IDs, `role` column, argon2, `mcp_servers`/`projects` tables) and were discarded.

## 1. Background
The platform stored MCP server configuration in `orchestration.json` and lacked first-class Auth/Decision services. SA4E-215 delivers three modules that integrate with the **existing** platform data model (TEXT ids, group-based RBAC, `project_registry` scoping, `mcp_tools` for tool search).

## 2. Verified Platform Facts (constraints)
- PKs are **TEXT** (`user-admin-001`, `grp-admin`, `project_id` text).
- RBAC is **group-based** via `access_groups` + `group_permissions`.
- `mcp_tools` is the server's tool-ingest/search table — **not** for MCP server declaration.
- Passwords use **PBKDF2 `salt:hash`** (sha512).
- JSON as TEXT; booleans as INTEGER 0/1.

## 3. Feature Areas & Requirements

### A. Authentication (AUTH) — reuse `users`
| ID | Requirement |
|----|-------------|
| AUTH-001 | Register via `POST /api/sa4e-215/auth/register` (email, password, access_group_id) |
| AUTH-002 | Login via `POST /api/sa4e-215/auth/login` → token (claims `user_id`, `access_group_id`) |
| AUTH-003 | Logout `POST /api/sa4e-215/auth/logout` |
| AUTH-004 | Passwords hashed with platform **pbkdf2** (compatible with `users.password_hash`) |
| AUTH-005 | Email unique; invalid creds → generic error (no enumeration) |
| AUTH-006 | Authorization via `access_group_id` → `group_permissions` |

### B. Decision Engine (DEC) — new `decisions` + real `audit_log`
| ID | Requirement |
|----|-------------|
| DEC-001 | Evaluate `POST /api/sa4e-215/decisions/evaluate` (rule_set_id, params, user_id, project_id?) |
| DEC-002 | Threshold logic: score>50 approved, >20 pending, else rejected |
| DEC-003 | Persist result in new `decisions` table |
| DEC-004 | Write audit trail to **real** `audit_log` (action/resource/resource_id/changes/timestamp) |
| DEC-005 | History `GET /api/sa4e-215/decisions/history` (user_id/project_id filter + pagination) |

### C. MCP Server Config (MCP) — new `mcp_servers` + `project_registry`
| ID | Requirement |
|----|-------------|
| MCP-001 | Create `POST /api/sa4e-215/mcp-servers` (project_id, name, transport_type, …) |
| MCP-002 | Read list `GET .../mcp-servers` (project-scoped, paginated) + `GET .../mcp-servers/:server_id` |
| MCP-003 | Update `PUT .../mcp-servers/:server_id` |
| MCP-004 | Soft-delete `DELETE .../mcp-servers/:server_id` (disabled=1) |
| MCP-005 | Name unique **per project** (`UNIQUE(name, project_id)`) |
| MCP-006 | Scope strictly by `project_id` → `project_registry` (no cross-project leak) |
| MCP-007 | Migration `scripts/migrate-mcp.js`: `orchestration.json` → `mcp_servers`, tag `project_id` |

## 4. Non-Functional
- NFR-001: Response envelope `{ success, data, meta }` / `{ success:false, error:{ code, message } }`.
- NFR-002: Never return `password_hash`.
- NFR-003: Support SQLite (dev) / PostgreSQL (prod) via `DatabaseAdapter`.
- NFR-004: Error codes `ERR_001` (validation), `ERR_002` (auth), `ERR_004` (not found).

## 5. Diagram Index
| # | Diagram | PNG | Drawio |
|---|---------|-----|--------|
| 1 | ER Diagram (real sa4e_db + new) | [er-diagram.png](diagrams/er-diagram.png) | [er-diagram.drawio](diagrams/er-diagram.drawio) |
| 2 | Auth Flow | [auth-flow.png](diagrams/auth-flow.png) | [auth-flow.drawio](diagrams/auth-flow.drawio) |
| 3 | Decision Flow | [decision-flow.png](diagrams/decision-flow.png) | [decision-flow.drawio](diagrams/decision-flow.drawio) |
| 4 | Migration Flow | [migration-flow.png](diagrams/migration-flow.png) | [migration-flow.drawio](diagrams/migration-flow.drawio) |
| 5 | MCP CRUD Flow | [admin-crud-flow.png](diagrams/admin-crud-flow.drawio) | [admin-crud-flow.drawio](diagrams/admin-crud-flow.drawio) |
| 6 | API Usage | [api-usage.png](diagrams/api-usage.png) | [api-usage.drawio](diagrams/api-usage.png) |
| 7 | Test Strategy | [pending.png](diagrams/pending.png) | [pending.drawio](diagrams/pending.drawio) |
