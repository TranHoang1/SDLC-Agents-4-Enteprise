# Release Notes (RLN) — SA4E-215

**Version:** backend (SA4E-215) · **Date:** 2026-08-27 · **Status:** Done (tests bổ sung)

## Tóm tắt
Chuyển việc lưu cấu hình MCP server từ file `orchestration.json` sang **Database**
(`mcp_servers`), đồng thời bổ sung module **Decisions** (`decisions` + `audit_log`) và
tái sử dụng auth nền tảng (`users` + session RBAC). Single source of truth, multi-tenant
theo `project_registry`, có audit trail.

## Tính năng mới
- **Auth** (reuse `users`): `POST /auth/register`, `/auth/login` (trả token + permissions),
  `/auth/logout`. Password pbkdf2 `salt:hash`, session-based.
- **Decision Engine** (mới): `POST /decisions`, `GET /decisions?projectId=&ruleSetId=&limit=`,
  `GET /decisions/:id`. Ghi `audit_log` (`action='DECISION_CREATE'`).
- **MCP Server Config** (mới, thay thế file JSON): `GET/POST /mcp/servers`, `GET/PUT/DELETE
  /mcp/servers/:id`. Scope theo `project_id`, unique `(name, project_id)`.

## Thay đổi kỹ thuật
- Bảng mới do SA4E-215 sở hữu: `mcp_servers`, `decisions` (tự tạo khi boot).
- `OrchestrationModule`/`McpClientManager` đọc config từ DB thay vì file.
- `backend/scripts/migrate-mcp.js`: one-time import `orchestration.json` → `mcp_servers`.

## Breaking changes
- Ghi config MCP không còn vào `orchestration.json`. Nếu có tool bên ngoài đọc file JSON,
  cần chuyển sang đọc DB hoặc chạy export.

## Quality
- 21 route integration tests PASS (Vitest, SQLite cô lập): `backend/src/server/routes/sa4e-215/__tests__/sa4e-215.routes.test.ts`.
- UAT thực tế trên backend sống (`:48721`): auth/decisions/mcp-servers xanh; guard chặn
  `project_id` lạ (`ERR_006`).
- Docs đồng bộ: UG/STP/STC/TEST-REPORT/DPG/RLN.
