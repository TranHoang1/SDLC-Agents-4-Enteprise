# DPG — Deployment Guide (SA4E-217)

**Ticket:** SA4E-217
**Phase:** 7 — Deployment
**Author:** devops-agent (SDLC pipeline)
**Date:** 2026-08-27
**Depends on:** QA sign-off (UAT human gate)

## 1. Prerequisites
- Node ≥ 18, backend deps cài (`npm ci` trong `backend/`).
- Env vars (`.env`):
  - `CODE_INTEL_JWT_SECRET` — secret cho JWT auth (bắt buộc để tránh 403).
  - `RATE_LIMIT_DEFAULT_RPM` (default 100).
  - `RATE_LIMIT_HARD_CAP` (default 100).
  - `CODE_INTEL_PORT` (default 48721).
- DB: SQLite (default) hoặc Postgres (`pg`) — migration tự chạy.

## 2. Build & Deploy
```bash
# Backend
cd backend
npm ci
npm run build            # compile TS
npm run dev              # hoặc pm2/nodemon production

# Extension (nếu deploy VSIX)
cd extension
npm ci
npm run package          # vsce package
```

## 3. Migration (tự động)
`pega_category_counters` table được tạo idempotent tại server startup qua
`ensurePegaCategoryCountersTable()` (gọi trong `backend/src/index.ts`).
- Không cần chạy script thủ công.
- Log xác nhận: `Ensured pega_category_counters table exists`.
- Nếu DB chưa connect → log warn non-fatal, skip (không crash).

## 4. Runtime Rate-Limit Config
Sau deploy, admin set limit qua API (không restart):
```bash
curl -X POST http://localhost:48721/api/v1/rate-limit/config \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"maxRPM":200,"hardCap":100}'
```
→ `200`, config lưu `config_entries`, EventBus `RATE_LIMIT_CONFIG_CHANGED` reload runtime.

## 5. Verification sau deploy (smoke)
1. `GET /api/v1/enrichment/status` với JWT hợp lệ → `200` (không 403).
2. Không token → `401` (không 403).
3. Invalid payload config → `400`.
4. Check log migration `pega_category_counters` ok.
5. (Tùy chọn) index 10k Pega rules → query `pega_category_counters` có counts.

## 6. Rollback
- Code thuần additive (migration idempotent, route mới). Rollback = revert commit + restart.
- Bảng `pega_category_counters` không xóa khi revert (vô hại) — có thể `DROP TABLE` thủ công nếu cần.

## 7. Risks
- Thiếu `CODE_INTEL_JWT_SECRET` → auth fail. Đặt env trước deploy.
- `localhost-only.ts` đã xóa → mọi request cần JWT (intended).
