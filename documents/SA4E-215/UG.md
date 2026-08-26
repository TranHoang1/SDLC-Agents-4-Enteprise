# User Guide (UG) — SA4E-215

**Ticket:** SA4E-215 · **Status:** Done (L3) · **Redesigned 2026-08-26 vs verified `sa4e_db`**

All endpoints under `/api/sa4e-215`. Built on the **real platform model**: TEXT ids, pbkdf2 passwords, group RBAC, `project_registry` scoping.

## 1. Authentication (reuse `users`)
### Register
```bash
curl -X POST localhost:3000/api/sa4e-215/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"secret","access_group_id":"grp-admin"}'
```
### Login
```bash
curl -X POST localhost:3000/api/sa4e-215/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"secret"}'
# => { token, user:{ user_id, email, access_group_id, status } }
```
Send token as `Authorization: Bearer <token>`. Passwords are **pbkdf2 `salt:hash`** (compatible with the platform).
### Logout
```bash
curl -X POST localhost:3000/api/sa4e-215/auth/logout
```

## 2. Decision Engine (new `decisions` + real `audit_log`)
### Evaluate
```bash
curl -X POST localhost:3000/api/sa4e-215/decisions/evaluate -H 'Content-Type: application/json' \
  -d '{"rule_set_id":"default","params":{"risk":30,"impact":40},"user_id":"user-admin-001","project_id":"prj-demo"}'
# score=70 -> approved; writes audit_log row
```
### History
```bash
curl "localhost:3000/api/sa4e-215/decisions/history?user_id=user-admin-001&limit=20&offset=0"
```

## 3. MCP Server Config (new `mcp_servers`, scoped by `project_registry`)
### Create
```bash
curl -X POST localhost:3000/api/sa4e-215/mcp-servers -H 'Content-Type: application/json' \
  -d '{"name":"github","project_id":"prj-demo","transport_type":"stdio","command":"npx","args":{},"env":{}}'
```
### List / Read
```bash
curl "localhost:3000/api/sa4e-215/mcp-servers?project_id=prj-demo&page=1&page_size=20"
curl "localhost:3000/api/sa4e-215/mcp-servers/<server_id>"
```
### Update / Delete (soft)
```bash
curl -X PUT localhost:3000/api/sa4e-215/mcp-servers/<server_id> -H 'Content-Type: application/json' -d '{"disabled":1}'
curl -X DELETE localhost:3000/api/sa4e-215/mcp-servers/<server_id>
```
### Migrate
```bash
node backend/scripts/migrate-mcp.js   # orchestration.json -> mcp_servers (tagged project_id)
```
> `mcp_tools` is **not** used here — it is the server's tool-ingest/search table.

## 4. Common Errors
| Code | Meaning | Fix |
|------|---------|-----|
| ERR_001 | Validation / duplicate | Check required fields; name unique per project |
| ERR_002 | Invalid credentials | Verify email/password |
| ERR_004 | Not found | Check id |

## 5. Diagram Index
| # | Diagram | PNG | Drawio |
|---|---------|-----|--------|
| 1 | Admin/API Workflow | [admin-workflow.png](diagrams/admin-workflow.png) | [admin-workflow.drawio](diagrams/admin-workflow.drawio) |
| 2 | Auth Flow | [auth-flow.png](diagrams/auth-flow.png) | [auth-flow.drawio](diagrams/auth-flow.drawio) |
| 3 | Decision Flow | [decision-flow.png](diagrams/decision-flow.png) | [decision-flow.drawio](diagrams/decision-flow.drawio) |
| 4 | Migration Flow | [migration-flow.png](diagrams/migration-flow.png) | [migration-flow.drawio](diagrams/migration-flow.png) |
| 5 | API Usage | [api-usage.png](diagrams/api-usage.png) | [api-usage.drawio](diagrams/api-usage.png) |
| 6 | ER Diagram | [er-diagram.png](diagrams/er-diagram.png) | [er-diagram.drawio](diagrams/er-diagram.drawio) |
