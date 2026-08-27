# Deployment & Permissions Guide (DPG) — SA4E-215

**Ticket:** SA4E-215 · **Áp dụng cho:** backend (`/api/sa4e-215`)

## 1. Deploy
```bash
cd backend
npm install
npm run build      # tsc -> dist/
npm start          # node dist/index.js  (hoặc: npm run dev cho tsx watch)
```
- Server tự động tạo 2 bảng mới (`mcp_servers`, `decisions`) khi boot qua
  `ensureSa4e215Tables()` — idempotent, không cần chạy migrate thủ công mỗi lần.
- Port: theo biến môi trường `CODE_INTEL_PORT` (mặc định `48721` ở môi trường dev đã UAT).
- Mount: `app.route('/api/sa4e-215', createSa4e215Route())` (trong `admin/index.ts`).

## 2. Migration dữ liệu cũ (one-time)
```bash
node backend/scripts/migrate-mcp.js   # đọc orchestration.json -> bảng mcp_servers
```
- Sau migrate, **DB là single source of truth**; `orchestration.json` không còn là nơi lưu config MCP.

## 3. Phân quyền (Permissions / RBAC)
- `/auth/*` là **public**.
- `/decisions/*` và `/mcp/servers/*` yêu cầu session hợp lệ (`Authorization: Bearer <token>`),
  do `requireSa4eUser` guard. Thiếu/invalid token → `401 ERR_002`.
- Quyền chi tiết (vd `MCP_ACCESS`) được phân qua `access_groups` + `group_permissions`
  (RBAC nhóm). Login trả về `data.user.permissions` để client biết có quyền gì.
- Tạo user: `POST /auth/register` với `access_group_id` (mặc định `grp-dev`).

## 4. Multi-tenant scoping
- Mọi bản ghi `mcp_servers` / `decisions` gắn với `project_id`.
- `project_id` phải tồn tại trong `project_registry` (else `400 ERR_006`).
- `(name, project_id)` unique: trùng tên trong cùng project → `400 ERR_001`.

## 5. Error codes
| Code | Nghĩa |
|------|-------|
| ERR_001 | Validation / duplicate (thiếu trường, trùng tên) |
| ERR_002 | Unauthorized / sai credentials |
| ERR_006 | Not found / unknown `project_id` |
| ERR_009 | Lỗi DB |

## 6. Rollback
- Code revert commit `da87c28`/`d699559` (docs) + `c06704e`(impl). Bảng `mcp_servers`/`decisions`
  có thể giữ hoặc `DROP` nếu muốn quay về lưu file JSON.
