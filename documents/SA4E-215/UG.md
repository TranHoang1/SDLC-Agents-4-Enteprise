# User Guide (UG) — SA4E-215

**Ticket:** SA4E-215
**Status:** Done (L3 autonomy)
**Last updated:** 2026-08-26

This guide covers the three SA4E-215 modules exposed under `/api/sa4e-215`.

## 1. Authentication

### 1.1 Register
```bash
curl -X POST http://localhost:3000/api/sa4e-215/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"secret","role":"admin"}'
```
Returns `{ token, user, expires_at }`. Role defaults to `user` if omitted.

### 1.2 Login
```bash
curl -X POST http://localhost:3000/api/sa4e-215/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"secret"}'
```
Store the returned `token`; send as `Authorization: Bearer <token>`.

### 1.3 Logout
```bash
curl -X POST http://localhost:3000/api/sa4e-215/auth/logout
```
Stateless; token remains valid until 24h expiry.

## 2. Decision Engine

### 2.1 Evaluate
```bash
curl -X POST http://localhost:3000/api/sa4e-215/decisions/evaluate \
  -H 'Content-Type: application/json' \
  -d '{"rule_set_id":"default","params":{"risk":30,"impact":40}}'
```
`score = 30+40 = 70 > 50` → `approved`. Writes an audit entry.

### 2.2 History
```bash
curl "http://localhost:3000/api/sa4e-215/decisions/history?user_id=1&limit=20&offset=0"
```

## 3. MCP Server Configuration

### 3.1 Create
```bash
curl -X POST http://localhost:3000/api/sa4e-215/mcp-servers \
  -H 'Content-Type: application/json' \
  -d '{"name":"github","project_id":1,"transport_type":"stdio","command":"npx","args":{},"env":{}}'
```

### 3.2 List / Read
```bash
curl "http://localhost:3000/api/sa4e-215/mcp-servers?project_id=1&page=1&page_size=20"
curl "http://localhost:3000/api/sa4e-215/mcp-servers/1"
```

### 3.3 Update / Delete
```bash
curl -X PUT http://localhost:3000/api/sa4e-215/mcp-servers/1 \
  -H 'Content-Type: application/json' -d '{"disabled":true}'
curl -X DELETE http://localhost:3000/api/sa4e-215/mcp-servers/1   # soft delete
```

### 3.4 Migrate from orchestration.json
```bash
node backend/scripts/migrate-mcp.js
```
Reads `./orchestration.json`, upserts into `mcp_servers` (tagged with `project_id`), prints a report and verifies row counts. Idempotent.

## 4. Common Errors

| Code | Meaning | Fix |
|------|---------|-----|
| ERR_001 | Validation / duplicate | Check required fields; name must be unique per project |
| ERR_002 | Invalid credentials | Verify email/password |
| ERR_004 | Not found | Check resource id |

## 5. Admin Ops & Troubleshooting

- **Project isolation:** same server name is allowed in different `project_id`.
- **Soft delete:** deleted servers remain with `disabled=true`; filter them out in lists if needed.
- **JWT secret:** set `AUTH_SECRET` env in production (insecure default otherwise).
- **Schema drift:** `mcp_servers`/`projects` are used at runtime but not yet in `schema-registry/sa4e-215.ts`; ensure Prisma schema includes them.

## 6. Diagram Index

| # | Diagram | PNG | Drawio |
|---|---------|-----|--------|
| 1 | Admin / API Workflow | [admin-workflow.png](diagrams/admin-workflow.png) | [admin-workflow.drawio](diagrams/admin-workflow.drawio) |
| 2 | Auth Flow | [auth-flow.png](diagrams/auth-flow.png) | [auth-flow.drawio](diagrams/auth-flow.drawio) |
| 3 | Decision Flow | [decision-flow.png](diagrams/decision-flow.png) | [decision-flow.drawio](diagrams/decision-flow.drawio) |
| 4 | Migration Flow | [migration-flow.png](diagrams/migration-flow.png) | [migration-flow.drawio](diagrams/migration-flow.drawio) |
| 5 | API Usage | [api-usage.png](diagrams/api-usage.png) | [api-usage.drawio](diagrams/api-usage.png) |
| 6 | ER Diagram | [er-diagram.png](diagrams/er-diagram.png) | [er-diagram.drawio](diagrams/er-diagram.drawio) |
