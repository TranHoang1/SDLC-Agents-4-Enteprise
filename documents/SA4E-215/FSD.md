# Functional Specification Document (FSD) — SA4E-215

**Ticket:** SA4E-215
**Status:** Done (L3 autonomy)
**Last updated:** 2026-08-26

> Aligned with implemented code: `backend/src/server/routes/sa4e-215/auth.ts`, `.../decisions.ts`, `backend/src/server/routes/mcp/servers.ts`, `backend/src/database/schema-registry/sa4e-215.ts`, `backend/scripts/migrate-mcp.js`.

## 1. API Conventions

- Base path: `/api/sa4e-215`
- Auth header: `Authorization: Bearer <JWT>` (consumed by protected routes; current routes do not yet enforce it — see Open Issues).
- Envelope success: `{ success: true, data: <object|array>, meta?: { total, page, page_size | limit, offset } }`
- Envelope error: `{ success: false, error: { code: "ERR_xxx", message: "..." } }`
- Content-Type: `application/json`.

### Error Codes

| Code | Meaning | HTTP |
|------|---------|------|
| ERR_001 | Validation failure (missing/invalid field, duplicate) | 400 / 409 |
| ERR_002 | Authentication failure (invalid email/password) | 401 |
| ERR_004 | Resource not found | 404 |

---

## 2. Auth Module

### 2.1 POST /api/sa4e-215/auth/register
**Request**
```json
{ "email": "admin@example.com", "password": "secret", "role": "admin" }
```
**Behavior:** hash password (argon2), create `users` row (role defaults `user`). Rejects duplicate email (ERR_001).
**Response 200**
```json
{ "success": true, "data": { "token": "<jwt>", "user": { "id": 1, "email": "admin@example.com", "role": "admin" }, "expires_at": "2026-08-27T..." } }
```

### 2.2 POST /api/sa4e-215/auth/login
**Request** `{ "email": "...", "password": "..." }`
**Behavior:** verify argon2 hash; on success sign JWT (claims `sub, email, role`, 24h). Invalid → ERR_002 (401).
**Response 200:** same envelope as register.

### 2.3 POST /api/sa4e-215/auth/logout
**Behavior:** stateless no-op. **Response 200** `{ success: true, message: "Successfully logged out" }`.

---

## 3. Decision Engine Module

### 3.1 POST /api/sa4e-215/decisions/evaluate
**Request** `{ "rule_set_id": "default", "params": { "x": 30, "y": 40 } }`
**Behavior:** `rule_set_id` required (ERR_001). For `default`, `score = sum(numeric params)`.
- score > 50 → `approved`, confidence up to 0.95
- 20 < score ≤ 50 → `pending`
- else → `rejected`

Writes `audit_log` (`action='decision_evaluate'`) best-effort.
**Response 200**
```json
{ "success": true, "data": { "decision": "approved", "confidence": 0.7, "audit_id": 0, "evaluated_at": "2026-08-26T..." } }
```

### 3.2 GET /api/sa4e-215/decisions/history
**Query:** `?user_id=&limit=50&offset=0`
**Behavior:** list `decisions` ordered by `evaluated_at` desc, joined with `users.email/role`.
**Response 200** `{ success: true, data: [ { id, user_id, rule_set_id, result, confidence, input_params, evaluated_at, user:{email,role} } ], meta:{ total, limit, offset } }`

---

## 4. MCP Server Config Module

### 4.1 GET /api/sa4e-215/mcp-servers
**Query:** `?project_id=&page=1&page_size=20`
**Response 200** `{ success:true, data:[...], meta:{ total, page, page_size } }`

### 4.2 GET /api/sa4e-215/mcp-servers/:id
**Response 200** `{ success:true, data:{ id, project_id, name, transport_type, url, command, args, env, disabled, auto_approve, tools, created_at, updated_at } }`
Not found → ERR_004 (404).

### 4.3 POST /api/sa4e-215/mcp-servers
**Request** `{ "name":"srv","project_id":1,"transport_type":"stdio","url":null,"command":"npx", args:{}, env:{}, disabled:false, auto_approve:{}, tools:{} }`
**Validation:** `name`, `project_id`, `transport_type` required (ERR_001). Unique `(name, project_id)` (ERR_001, 409). Created inside a transaction.

### 4.4 PUT /api/sa4e-215/mcp-servers/:id
Partial update; re-checks uniqueness if `name` changes; not found → ERR_004. Runs in transaction.

### 4.5 DELETE /api/sa4e-215/mcp-servers/:id
**Soft delete:** sets `disabled=true`, `updated_at=now()`. Returns `{ success:true, message:"MCP server soft-deleted (disabled)" }`.

---

## 5. Data Model (summary)

| Table | Key columns | Defined in registry? |
|-------|-------------|----------------------|
| users | id, email (unique), password_hash, role | ✅ |
| decisions | id, user_id (FK), rule_set_id, input_params (jsonb), result, confidence, evaluated_at | ✅ |
| audit_log | id, user_id (FK nullable), action, resource_type, resource_id, metadata (jsonb) | ✅ |
| projects | id, name (unique) | ❌ (runtime only) |
| mcp_servers | id, project_id (FK), name, transport_type, url, command, args/env/auto_approve/tools (jsonb), disabled | ❌ (runtime only) |

See [er-diagram.png](diagrams/er-diagram.png) for relationships.

---

## 6. Open Issues

1. **Auth not enforced** on protected routes (no middleware verifying JWT yet).
2. **Schema registry gap** — `mcp_servers`/`projects` missing from `schema-registry/sa4e-215.ts`.
3. **Logout** does not revoke token.

## 7. Diagram Index

| # | Diagram | PNG | Drawio |
|---|---------|-----|--------|
| 1 | ER Diagram | [er-diagram.png](diagrams/er-diagram.png) | [er-diagram.drawio](diagrams/er-diagram.drawio) |
| 2 | Auth Flow | [auth-flow.png](diagrams/auth-flow.png) | [auth-flow.drawio](diagrams/auth-flow.drawio) |
| 3 | Decision Flow | [decision-flow.png](diagrams/decision-flow.png) | [decision-flow.drawio](diagrams/decision-flow.drawio) |
| 4 | Migration Flow | [migration-flow.png](diagrams/migration-flow.png) | [migration-flow.drawio](diagrams/migration-flow.drawio) |
| 5 | MCP CRUD Flow | [admin-crud-flow.png](diagrams/admin-crud-flow.png) | [admin-crud-flow.drawio](diagrams/admin-crud-flow.drawio) |
| 6 | API Usage | [api-usage.png](diagrams/api-usage.png) | [api-usage.drawio](diagrams/api-usage.drawio) |
| 7 | API Flow | [api-flow.png](diagrams/api-flow.png) | [api-flow.drawio](diagrams/api-flow.png) |
| 8 | Test Strategy | [pending.png](diagrams/pending.png) | [pending.drawio](diagrams/pending.drawio) |
