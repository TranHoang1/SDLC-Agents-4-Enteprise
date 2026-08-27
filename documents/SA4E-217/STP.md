# STP — Test Plan (SA4E-217)

**Ticket:** SA4E-217
**Phase:** 4 — Test Planning
**Author:** qa-agent (via SDLC pipeline)
**Date:** 2026-08-27
**FSD version:** 1.1

## 1. Mục tiêu (Objective)
Xác minh 3 tính năng của SA4E-217 được implement đúng spec, không hồi quy:
1. Fix enrichment 403 (JWT auth + scope-guarded routes, không localhostOnly).
2. Runtime rate-limit config (`POST /api/v1/rate-limit/config`, không restart).
3. Pega memory optimization (DiskBackedSet dedup + `pega_category_counters` persistence).

## 2. Scope
**In scope:**
- `backend/src/server/middleware/rate-limiter.ts` (sửa đổi)
- `backend/src/server/routes/rate-limit-config-routes.ts` (mới)
- `backend/src/modules/pega/DiskBackedSet.ts` (mới — backend)
- `extension/src/services/DiskBackedSet.ts` (mới — extension)
- `backend/src/database/migration/ensure-pega-category-counters.ts` (mới)
- `backend/src/server/middleware/jwt-auth.ts` (route guard, trả 401 thay 403)
- `backend/src/index.ts` (gọi migration lúc startup)

**Out of scope:** UI web admin form (chỉ test API contract), Pega OOTB rule parsing logic không đổi.

## 3. Loại kiểm thử
| Loại | Công cụ | Trạng thái |
|------|---------|-----------|
| Unit test (rate limiter) | vitest | ✅ 13/13 pass |
| Unit test (DiskBackedSet) | vitest | ✅ 5/5 pass |
| API contract (TC-1..TC-12) | manual/thunder client | ⏳ chờ UAT |
| Integration (10k rules, no OOM) | script | ⏳ chờ UAT |
| Migration idempotency | server startup log | ✅ verify log |

## 4. Môi trường (Test Environment)
- Backend: `npm run dev` (port 48721), SQLite (default) hoặc Postgres.
- Env: `CODE_INTEL_JWT_SECRET`, `RATE_LIMIT_DEFAULT_RPM`, `RATE_LIMIT_HARD_CAP`.
- DB: `pega_category_counters` auto-create tại startup (idempotent).

## 5. Entry / Exit criteria
**Entry:** `tsc --noEmit` pass (✅), unit tests pass (✅).
**Exit:** TC-1..TC-12 pass hoặc có justification; UAT sign-off (human gate).

## 6. Traceability
Xem `STC.md` — mỗi TC map 1:1 tới BRD acceptance criteria và FSD §10.1.

## 7. Rủi ro
- `npm test` full suite timeout do infra (git/DB) — chỉ chạy targeted suites.
- Rate-limit config cần JWT hợp lệ → test qua token thực tế.
