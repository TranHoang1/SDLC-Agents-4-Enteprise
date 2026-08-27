# Test Report (TEST-REPORT) — SA4E-215

**Ticket:** SA4E-215 · **Ngày chạy:** 2026-08-27
**Môi trường:** Node 22, Vitest 4.1.10, SQLite cô lập (temp workspace từ `vitest.setup.ts`).
**Lệnh chạy:** `cd backend && npx vitest run src/server/routes/sa4e-215`

## Kết quả
```
 Test Files  1 passed (1)
      Tests  21 passed (21)
```

## Phân bổ
| Module | TC | Pass |
|--------|----|------|
| AUTH | 6 | 6 |
| DECISIONS | 6 | 6 |
| MCP SERVERS | 9 | 9 |
| **Tổng** | **21** | **21** |

## Cách test thỏa mãn Acceptance Criteria
- **"CRUD trên in-memory SQLite, verify cùng input → cùng output"**: routes được gọi qua `Hono.app.request()` trên adapter SQLite cô lập (mỗi đợt chạy là DB mới, seed bởi `initSchema`/`seedDefaults`, sau đó `ensureSa4e215Tables()` tạo `mcp_servers`+`decisions`). TC DEC-03 và MCP-04 khẳng định cùng payload vào → cùng shaped output ra (status 200, các trường `result`/`ruleSetId`/`transportType` echo đúng).
- **Multi-tenant scoping**: MCP-06/MCP-07 xác nhận `(name, project_id)` unique per project, khác project thì cho phép.
- **Guard / auth**: DEC-01, MCP-01 xác nhận 401 khi thiếu token; MCP-03 xác nhận `ERR_006` khi `project_id` không có trong `project_registry`.
- **Error taxonomy**: `ERR_001` (validation/duplicate), `ERR_002` (unauth/wrong pwd), `ERR_006` (not found / unknown project) đều được cover.

## Ghi chú
- Không cần backend sống; test ở tầng route (Hono) → nhanh, deterministic, không phụ thuộc cổng 48721.
- Test file nằm cùng module: `backend/src/server/routes/sa4e-215/__tests__/sa4e-215.routes.test.ts` (dễ chạy lại qua `npm run test:unit`).
