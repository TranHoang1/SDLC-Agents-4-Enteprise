# User Guide (UG) — SA4E-215

**Ticket:** SA4E-215 · **Status:** Deployed & UAT live (verified 2026-08-27)
**IMPORTANT — docs realigned to actual code:** older UG described `:3000`, `/mcp-servers`, `/decisions/evaluate` and snake_case fields. Those are WRONG. This version matches the real routes (verified against `backend/src/server/routes/sa4e-215/*` and `mcp/servers.ts`).

## 0. Base URL & Auth model
- Base: `http://127.0.0.1:48721/api/sa4e-215`
  > Port follows the backend `PORT` env (was `48721` at live UAT). Replace `B=...` below with your actual base.
- `B=http://127.0.0.1:48721/api/sa4e-215`
- `/auth/*` are **public**.
- `/decisions/*` and `/mcp/servers/*` require `Authorization: Bearer <token>` (guard `requireSa4eUser`).

## 1. Authentication (reuse `users`)
### Register
```bash
curl -X POST $B/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"secret","access_group_id":"grp-admin"}'
# => { success:true, data:{ userId, email, accessGroupId } }
```
### Login
```bash
curl -X POST $B/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"secret"}'
# => { success:true, data:{ token, user:{ userId, email, accessGroupId, permissions:[...] }, expiresAt } }
```
- `permissions` is an array of `permissionId` (e.g. `MCP_ACCESS`). Capture the token:
  `TOKEN=$(curl -s -X POST $B/auth/login ... | python -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")`
- Passwords are **pbkdf2 `salt:hash`** (platform standard).
### Logout
```bash
curl -X POST $B/auth/logout -H "Authorization: Bearer $TOKEN"
```

## 2. Decision Engine (new `decisions` + real `audit_log`)
> There is **NO** `/evaluate` and **NO** server-side scoring. The client supplies `result`; the server stores it and writes an `audit_log` row (`action='DECISION_CREATE'`).

### Create
```bash
curl -X POST $B/decisions -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"ruleSetId":"default","result":"approved","inputParams":{"risk":30,"impact":40},"confidence":0.7,"projectId":"<PROJECT_THẬT>"}'
# => { success:true, data:{ decisionId:"dec-xxxxxxxx", userId, projectId, ruleSetId, result, confidence, evaluatedAt } }
```
- Required: `ruleSetId` + `result` (else `ERR_001`). `projectId` optional (defaults null). `inputParams`/`confidence` optional.
### List (filter by project / rule set, paginated)
```bash
curl "$B/decisions?projectId=<PROJECT_THẬT>&ruleSetId=default&limit=20" -H "Authorization: Bearer $TOKEN"
# => { success:true, data:[ { decisionId, userId, projectId, ruleSetId, inputParams, result, confidence, evaluatedAt } ] }
```
### Read one
```bash
curl "$B/decisions/<decisionId>" -H "Authorization: Bearer $TOKEN"
```

## 3. MCP Server Config (new `mcp_servers`, scoped by `project_registry`)
> Mounted at `/mcp/servers` (NOT `/mcp-servers`). `projectId` MUST exist in `project_registry` or you get `ERR_006`. `name` is unique per `projectId`.

### List
```bash
curl "$B/mcp/servers?projectId=<PROJECT_THẬT>&disabled=false" -H "Authorization: Bearer $TOKEN"
```
### Create
```bash
curl -X POST $B/mcp/servers -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"projectId":"<PROJECT_THẬT>","name":"github","transportType":"stdio","command":"npx","args":{},"env":{}}'
# => { success:true, data:{ serverId:"mcp-xxxxxxxx", projectId, name, transportType, ... } }
```
- Required: `projectId`, `name`, `transportType` (else `ERR_001`). Unknown `projectId` → `ERR_006`.
- Optional: `url`, `command`, `args`, `env`, `disabled`, `autoApprove`, `tools`.
### Read / Update / Delete
```bash
curl "$B/mcp/servers/<serverId>" -H "Authorization: Bearer $TOKEN"
curl -X PUT $B/mcp/servers/<serverId> -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"disabled":true}'
curl -X DELETE $B/mcp/servers/<serverId> -H "Authorization: Bearer $TOKEN"
# => { success:true, message:"MCP server deleted" }
```
> **Delete is HARD delete** (row removed). There is no soft-delete `disabled` flag set by DELETE — use `PUT` with `disabled:true` to disable instead.
### Migrate (one-time, import orchestration.json → mcp_servers)
```bash
node backend/scripts/migrate-mcp.js
```
> `mcp_tools` is NOT used here — it is the server's tool-ingest/search table.

## 4. Common Errors
| Code | Meaning | Fix |
|------|---------|-----|
| ERR_001 | Validation / duplicate / missing required | Check required fields; `name` unique per `projectId` |
| ERR_002 | Invalid credentials / account disabled | Verify email/password; check `users.status` |
| ERR_006 | Unknown `project_id` or resource not found | Ensure `projectId` exists in `project_registry`; check id |
| ERR_009 | Database error | Check backend logs / DB connectivity |

## 5. Diagram Index
| # | Diagram | PNG | Drawio |
|---|---------|-----|--------|
| 1 | Admin/API Workflow | [admin-workflow.png](diagrams/admin-workflow.png) | [admin-workflow.drawio](diagrams/admin-workflow.drawio) |
| 2 | Auth Flow | [auth-flow.png](diagrams/auth-flow.png) | [auth-flow.drawio](diagrams/auth-flow.drawio) |
| 3 | Decision Flow | [decision-flow.png](diagrams/decision-flow.png) | [decision-flow.drawio](diagrams/decision-flow.drawio) |
| 4 | Migration Flow | [migration-flow.png](diagrams/migration-flow.png) | [migration-flow.drawio](diagrams/migration-flow.png) |
| 5 | API Usage | [api-usage.png](diagrams/api-usage.png) | [api-usage.drawio](diagrams/api-usage.png) |
| 6 | ER Diagram | [er-diagram.png](diagrams/er-diagram.png) | [er-diagram.drawio](diagrams/er-diagram.drawio) |
