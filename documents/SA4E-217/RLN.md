# RLN — Release Notes (SA4E-217)

**Ticket:** SA4E-217
**Date:** 2026-08-27
**Type:** Feature + Bugfix
**Component:** backend (code-intel MCP server), extension (DiskBackedSet)

## Tính năng (Features)
1. **Fix enrichment 403** — Route guard chuyển từ `localhost-only` sang JWT auth.
   Request không token → `401` (thay vì `403`). Extension refresh token khi nhận 401.
   - Files: `backend/src/server/middleware/jwt-auth.ts`, xóa `localhost-only.ts`.
2. **Runtime rate-limit config** — Endpoint `POST /api/v1/rate-limit/config`
   (admin JWT) set `maxRPM`/`hardCap`, persist vào `config_entries`, reload runtime
   qua EventBus `RATE_LIMIT_CONFIG_CHANGED` (không restart).
   - File: `backend/src/server/routes/rate-limit-config-routes.ts`.
3. **Pega memory optimization** —
   - `DiskBackedSet` dedup RAM + disk (spill khi vượt `dedupMaxInMemory`, no OOM).
   - `pega_category_counters` table persist counts (idempotent, auto tại startup).
   - Files: `backend/src/modules/pega/DiskBackedSet.ts`,
     `backend/src/database/migration/ensure-pega-category-counters.ts`,
     `extension/src/services/DiskBackedSet.ts`.

## Bug Fixes
- `403 Forbidden` cho Extension trong Docker khi gọi enrichment status → fix thành 401 + refresh flow.
- Rate limiter cứng hóa tại startup → configurable runtime.

## Migration
- Tự động: `pega_category_counters` CREATE TABLE IF NOT EXISTS tại startup.

## Test
- Unit: rate-limiter 13/13, DiskBackedSet 5/5 PASS.
- `tsc --noEmit` backend PASS.
- UAT (TC-1..TC-12) pending human gate.

## Compatibility
- Backward compatible: route cũ giữ nguyên, thêm route mới. Không đổi Pega parser.

## Upgrade steps
Xem `DPG.md`.
