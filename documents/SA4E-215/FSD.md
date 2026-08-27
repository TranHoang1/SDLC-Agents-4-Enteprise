# Functional Specification Document (FSD) — SA4E-215

**Ticket:** SA4E-215 · **Status:** Done (L3) · **Redesigned 2026-08-26 vs verified `sa4e_db`**

## 1. API Conventions
- Base: `/api/sa4e-215`. Auth header `Authorization: Bearer <token>` (platform `generateToken`).
- Success: `{ success:true, data, meta?:{total,page,page_size|limit,offset} }`.
- Error: `{ success:false, error:{ code, message } }`.
- Codes: `ERR_001` validation, `ERR_002` auth, `ERR_004` not found.

## 2. Auth (reuse `users`, pbkdf2, group RBAC)
### 2.1 POST /auth/register
`{ "email":"a@b.c","password":"secret","access_group_id":"grp-dev" }`
Hashes with **pbkdf2** (`hashPassword`), inserts `users` (`user_id` TEXT, `status='ACTIVE'`). Rejects duplicate email.
### 2.2 POST /auth/login
`{ "email","password" }` → `verifyPassword` (pbkdf2). On success `generateToken({ user_id, access_group_id })`.
Response: `{ success:true, data:{ token, user:{ user_id, email, access_group_id, status } } }`.
Invalid → `ERR_002`.
### 2.3 POST /auth/logout — stateless no-op.

## 3. Decision Engine (new `decisions` + real `audit_log`)
### 3.1 POST /decisions/evaluate
`{ "rule_set_id":"default","params":{...},"user_id":"user-xxx","project_id":"prj-xxx"? }`
`rule_set_id` required (ERR_001). Logic: `score=Σ numeric params`; >50 approved, >20 pending, else rejected.
- INSERT `decisions` (`decision_id` TEXT PK, `user_id`, `project_id`, `rule_set_id`, `input_params` TEXT-json, `result`, `confidence`, `evaluated_at`).
- INSERT `audit_log` (REAL shape): `audit_id` TEXT, `user_id`, `username` (lookup), `action='decision_evaluate'`, `resource='decision'`, `resource_id=decision_id`, `changes`=JSON, `timestamp`, `ip_address`.
Response: `{ decision, confidence, decision_id, evaluated_at }`.
### 3.2 GET /decisions/history
`?user_id=&project_id=&limit=50&offset=0` → list `decisions` ordered `evaluated_at` desc, joined `users` for display.

## 4. MCP Server Config (new `mcp_servers` + `project_registry`)
### 4.1 GET /mcp-servers `?project_id=&page=1&page_size=20` → paginated, project-scoped.
### 4.2 GET /mcp-servers/:server_id → `ERR_004` if not found.
### 4.3 POST /mcp-servers
`{ name, project_id, transport_type, url?, command?, args?, env?, disabled?, auto_approve?, tools? }`
Validate `name, project_id, transport_type` (ERR_001). Unique `(name, project_id)` → 409. JSON fields stored as TEXT.
### 4.4 PUT /mcp-servers/:server_id — partial update, re-check uniqueness on name change.
### 4.5 DELETE /mcp-servers/:server_id — soft delete `disabled=1`.

## 5. Data Model Summary
| Table | State | Notes |
|-------|-------|-------|
| users, access_groups, group_permissions, project_registry, audit_log, mcp_tools | EXISTING | reused; not recreated |
| mcp_servers | **NEW** | SA4E-215 owns; `server_id` TEXT PK, FK→project_registry |
| decisions | **NEW** | SA4E-215 owns; `decision_id` TEXT PK, FK→users |

See [er-diagram.png](diagrams/er-diagram.png).

## 6. Diagram Index
| # | Diagram | PNG | Drawio |
|---|---------|-----|--------|
| 1 | ER Diagram | [er-diagram.png](diagrams/er-diagram.png) | [er-diagram.drawio](diagrams/er-diagram.drawio) |
| 2 | Auth Flow | [auth-flow.png](diagrams/auth-flow.png) | [auth-flow.drawio](diagrams/auth-flow.drawio) |
| 3 | Decision Flow | [decision-flow.png](diagrams/decision-flow.png) | [decision-flow.drawio](diagrams/decision-flow.drawio) |
| 4 | Migration Flow | [migration-flow.png](diagrams/migration-flow.png) | [migration-flow.drawio](diagrams/migration-flow.drawio) |
| 5 | MCP CRUD Flow | [admin-crud-flow.png](diagrams/admin-crud-flow.png) | [admin-crud-flow.drawio](diagrams/admin-crud-flow.drawio) |
| 6 | API Usage | [api-usage.png](diagrams/api-usage.png) | [api-usage.drawio](diagrams/api-usage.png) |
| 7 | API Flow | [api-flow.png](diagrams/api-flow.png) | [api-flow.drawio](diagrams/api-flow.png) |
| 8 | Test Strategy | [pending.png](diagrams/pending.png) | [pending.drawio](diagrams/pending.drawio) |
