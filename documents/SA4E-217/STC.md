# STC — Test Cases (SA4E-217)

**Ticket:** SA4E-217
**Phase:** 4 — Test Planning (Test Cases)
**Source:** FSD.md §10.1 (TC-1..TC-12) + BRD acceptance criteria
**Date:** 2026-08-27

Format: Given / When / Then.

| ID | Scenario | Priority | TC Link BRD |
|----|----------|----------|-------------|
| TC-1 | JWT valid → enrichment status 200 | High | AC1.1 |
| TC-2 | JWT expired → refresh retry → 200 | High | AC1.2 |
| TC-3 | JWT invalid → 401 | High | AC1.3 |
| TC-4 | Set maxRPM via admin → persist | High | AC2.1 |
| TC-5 | Config change no restart | High | AC2.2 |
| TC-6 | Client RPM > hardCap → 429/limit | High | AC2.3 |
| TC-7 | 10k rules DiskBackedSet no OOM | High | AC3.1 |
| TC-8 | Category counters from DB | Medium | — |
| TC-9 | 3 refresh fails → disable | Medium | — |
| TC-10 | Scope-guarded route → 401 not 403 | Medium | AC1.3 |
| TC-11 | Zod validation bad payload → 400 | Medium | AC2.1 |
| TC-12 | DiskBackedSet spill edge (max=0) | Low | AC3.2 |

---

### TC-1 — JWT token valid, call enrichment status
- **Given** valid JWT trong header `Authorization: Bearer <token>`
- **When** `GET /api/v1/enrichment/status`
- **Then** response `200` với status data (không 403)

### TC-2 — JWT expired, retry with refresh
- **Given** expired token, extension có refresh flow
- **When** server trả `401`, extension refresh token và retry
- **Then** retry trả `200`

### TC-3 — JWT invalid, no retry
- **Given** token invalid (sai signature)
- **When** `GET /api/v1/enrichment/status`
- **Then** `401 Unauthorized`, không retry

### TC-4 — Set maxRPM via web admin, persist
- **Given** admin gửi `POST /api/v1/rate-limit/config` `{"maxRPM":200}`
- **When** server xử lý
- **Then** `200`, config ghi vào `config_entries` (section=rateLimit), event `RATE_LIMIT_CONFIG_CHANGED` broadcast

### TC-5 — Rate limit config change without restart
- **Given** maxRPM changed từ 100 → 200 (TC-4)
- **When** request mới tới
- **Then** rate limiter dùng 200 RPM (không cần restart) — verify qua EventBus runtime reload

### TC-6 — Client RPM exceeds hard cap
- **Given** client gửi `X-Rate-Limit-RPM: 150`, server hardCap=100
- **When** request vượt 100 RPM
- **Then** `429` hoặc limit xuống 100 RPM

### TC-7 — Index 10,000 rules with DiskBackedSet
- **Given** `dedupMaxInMemory=500`, 10,000 rules
- **When** index chạy
- **Then** 100% dedup correctness, memory ổn định (no OOM)

### TC-8 — Category counters from DB after index
- **Given** index xong
- **When** query `SELECT rule_type, count FROM pega_category_counters`
- **Then** counts khớp, memory footprint < 1 MB

### TC-9 — Token refresh after 3 failed attempts
- **Given** 3 lần refresh liên tiếp fail
- **When** call tiếp theo
- **Then** error logged, further calls disabled (circuit break)

### TC-10 — Scope-guarded routes (no localhostOnly)
- **Given** request không token tới `/api/v1/enrichment/status`
- **When** route guard chạy
- **Then** `401` (không `403`) — xóa `localhost-only.ts`

### TC-11 — Zod schema validation on API inputs
- **Given** payload sai (`{"maxRPM":0}` hoặc thiếu field)
- **When** `POST /api/v1/rate-limit/config`
- **Then** `400 Bad Request` với validation error

### TC-12 — DiskBackedSet spill edge case
- **Given** `dedupMaxInMemory=0`
- **When** add entries
- **Then** log error, continue RAM-only mode (không crash)

---

## Execution status
| Suite | Result |
|-------|--------|
| Unit: rate-limiter | ✅ 13/13 |
| Unit: DiskBackedSet (extension) | ✅ 5/5 |
| API/Integration (TC-1..TC-12) | ⏳ chờ UAT (human gate) |
