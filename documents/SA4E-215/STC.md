# Software Test Cases (STC) — SA4E-215

**Ticket:** SA4E-215 · **Status:** Reopened-for-AC-gap → tests added 2026-08-27
**Scope:** Route-level integration tests for auth / decisions / mcp-servers.
**Runner:** Vitest, Hono `app.request` (no live server). DB: isolated SQLite (temp test workspace).

## AUTH (auth.ts)
| TC | Mô tả | Input | Kỳ vọng | Result |
|----|-------|-------|---------|--------|
| AUTH-01 | Register tạo user | email+password | 200, `userId` khớp `user-` | PASS |
| AUTH-02 | Email trùng | email đã tồn tại | 400 `ERR_001` | PASS |
| AUTH-03 | Thiếu trường | thiếu email/password | 400 `ERR_001` | PASS |
| AUTH-04 | Login trả token+permissions | email+password đúng | 200, `data.token`, `data.user.permissions[]` | PASS |
| AUTH-05 | Sai password | password sai | 401 `ERR_002` | PASS |
| AUTH-06 | Logout (token riêng) | Bearer valid | 200 `success` | PASS |

## DECISIONS (decisions.ts)
| TC | Mô tả | Input | Kỳ vọng | Result |
|----|-------|-------|---------|--------|
| DEC-01 | Từ chối không token | POST | 401 `ERR_002` | PASS |
| DEC-02 | Thiếu ruleSetId/result | POST thiếu | 400 `ERR_001` | PASS |
| DEC-03 | Create echo input (same input → same output) | payload chuẩn | 200, `decisionId`~`dec-`, `result`/`ruleSetId`/`confidence` khớp | PASS |
| DEC-04 | List lọc theo projectId | GET ?projectId= | 200, mọi row `projectId` khớp | PASS |
| DEC-05 | Read one | GET /:id | 200, `decisionId` khớp | PASS |
| DEC-06 | Read unknown | GET /dec-xxx | 404 `ERR_006` | PASS |

## MCP SERVERS (mcp/servers.ts)
| TC | Mô tả | Input | Kỳ vọng | Result |
|----|-------|-------|---------|--------|
| MCP-01 | Từ chối không token | POST | 401 `ERR_002` | PASS |
| MCP-02 | Thiếu trường | thiếu projectId/name/transportType | 400 `ERR_001` | PASS |
| MCP-03 | project_id không tồn tại | `prj-does-not-exist` | 400 `ERR_006` | PASS |
| MCP-04 | Create thành công | payload chuẩn | 200, `serverId`~`mcp-`, `transportType` khớp | PASS |
| MCP-05 | List theo projectId | GET ?projectId= | 200, mọi row `projectId` khớp | PASS |
| MCP-06 | Trùng tên trong 1 project | 2 POST cùng name | 400 `ERR_001` | PASS |
| MCP-07 | Cùng tên khác project | 2 project khác nhau | 200 (cả 2) | PASS |
| MCP-08 | Update disabled | PUT `disabled:true` | 200, `disabled=true` | PASS |
| MCP-09 | Hard-delete + read sau xoá | DELETE rồi GET | 200, rồi 404 `ERR_006` | PASS |

**Tổng:** 21/21 PASS (file `backend/src/server/routes/sa4e-215/__tests__/sa4e-215.routes.test.ts`).
