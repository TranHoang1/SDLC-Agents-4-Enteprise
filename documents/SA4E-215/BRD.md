# Business Requirements Document (BRD) — SA4E-215

**Ticket:** SA4E-215
**Title:** MCP Server Config Storage (DB), Authentication & Decision Engine
**Status:** Done (L3 autonomy)
**Author:** SDLC Agent (SM)
**Last updated:** 2026-08-26

> This BRD is aligned with the **actual implemented code** (not the original fabricated scope). SA4E-215 delivers three cohesive modules that share one database and one API surface under `/api/sa4e-215`.

---

## 1. Background & Problem Statement

The platform previously stored MCP server configuration in a flat `orchestration.json` file, had no real authentication layer, and had no decision/evaluation capability. SA4E-215 introduces:

1. **Auth module** — user registration, login, logout with JWT and RBAC role.
2. **Decision Engine module** — evaluate rule sets and persist decision history + audit trail.
3. **MCP Server Config module** — move MCP server configuration from `orchestration.json` into a database (`mcp_servers` + `projects`), project-scoped, with full CRUD API and a one-time migration script.

All three modules are backed by the same `PrismaClient` (SQLite in dev, PostgreSQL in prod via `DatabaseAdapter`).

## 2. Stakeholders

| Role | Interest |
|------|----------|
| Platform Admin | Manage users, MCP servers; ensure isolation |
| Developer | Consume JWT-protected APIs; register MCP servers per project |
| Auditor | Review decision evaluations via audit log |

## 3. Goals

- G1: Replace file-based MCP config with a queryable, project-scoped database store.
- G2: Provide secure authentication (argon2 + JWT) with role-based access.
- G3: Provide a decision evaluation endpoint that records an immutable audit trail.
- G4: Preserve existing MCP configuration via a non-destructive migration.

## 4. Non-Goals

- NG1: Not building a full OAuth/SSO provider (JWT only).
- NG2: Decision rules are simplistic (threshold-based) in this iteration, not a full rules engine.
- NG3: Logout is stateless (token not revoked server-side in this iteration).

---

## 5. Feature Area A — Authentication (AUTH)

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| AUTH-001 | System shall allow user **registration** via `POST /api/sa4e-215/auth/register` with email, password, optional role | High | Role defaults to `user` |
| AUTH-002 | System shall allow **login** via `POST /api/sa4e-215/auth/login` returning a JWT | High | Claims: `sub`, `email`, `role`; expires in 24h |
| AUTH-003 | System shall allow **logout** via `POST /api/sa4e-215/auth/logout` | Low | Stateless; returns success |
| AUTH-004 | Passwords shall be hashed with **argon2** (memoryCost 2^16, timeCost 2, parallelism 2) | High | Never store plaintext |
| AUTH-005 | Email shall be **unique** per user; duplicate registration rejected | High | ERR_001 |
| AUTH-006 | Invalid credentials shall be rejected with `ERR_002` (401) | High | Generic message, no leak |

## 6. Feature Area B — Decision Engine (DEC)

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| DEC-001 | System shall **evaluate** a decision via `POST /api/sa4e-215/decisions/evaluate` with `rule_set_id` + `params` | High | `rule_set_id` required (ERR_001) |
| DEC-002 | For `rule_set_id='default'`, decision = `approved` (score>50), `pending` (20<score≤50), `rejected` (≤20) where score = sum of numeric params | Medium | Confidence derived from score |
| DEC-003 | Every evaluation shall write an **audit log** entry (`decision_evaluate`) with metadata | High | Best-effort; failure does not abort response |
| DEC-004 | System shall return **decision history** via `GET /api/sa4e-215/decisions/history` with `user_id` filter + pagination | Medium | Joins `users` for email/role |

## 7. Feature Area C — MCP Server Config (MCP)

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| MCP-001 | System shall allow **create** MCP server via `POST /api/sa4e-215/mcp-servers` | High | Requires name, project_id, transport_type |
| MCP-002 | System shall allow **read** via `GET .../mcp-servers` (list, paginated) and `GET .../mcp-servers/:id` | High | Response includes all fields |
| MCP-003 | System shall allow **update** via `PUT .../mcp-servers/:id` | High | Partial update supported |
| MCP-004 | System shall **soft-delete** via `DELETE .../mcp-servers/:id` (sets `disabled=true`) | High | No physical deletion |
| MCP-005 | MCP server **name must be unique per project_id** | High | 409 on conflict (ERR_001) |
| MCP-006 | Configuration must be **project-scoped / isolated** (queries filter by `project_id`) | High | No cross-project leakage |
| MCP-007 | A **migration script** shall import `orchestration.json` → DB, tagging `project_id` | High | Idempotent upsert |
| MCP-008 | All mutating operations shall run inside a **DB transaction** | Medium | Atomicity |

## 8. Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-001 | API responses use envelope `{ success, data, meta }` or `{ success:false, error:{ code, message } }` |
| NFR-002 | Sensitive data (passwords) never returned in responses |
| NFR-003 | Database supports SQLite (dev) and PostgreSQL (prod) via `DatabaseAdapter` |
| NFR-004 | Errors use stable codes: `ERR_001` (validation), `ERR_002` (auth), `ERR_004` (not found) |

## 9. Constraints & Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| `schema-registry/sa4e-215.ts` defines only `users/decisions/audit_log`; `mcp_servers/projects` used at runtime but not registered | Schema drift | Add `mcp_servers`/`projects` to registry (see TDD §3) |
| Stateless logout (no token revocation) | Token reuse until expiry | Short JWT TTL (24h); future: blacklist |
| Migration overwrites data | Data loss | Upsert (not blind insert); verify counts post-migration |

---

## 10. Diagram Index

| # | Diagram | PNG | Drawio |
|---|---------|-----|--------|
| 1 | ER Diagram (users, decisions, audit_log, projects, mcp_servers) | [er-diagram.png](diagrams/er-diagram.png) | [er-diagram.drawio](diagrams/er-diagram.drawio) |
| 2 | Migration Flow (orchestration.json → DB) | [migration-flow.png](diagrams/migration-flow.png) | [migration-flow.drawio](diagrams/migration-flow.drawio) |
| 3 | Auth Flow (JWT + RBAC) | [auth-flow.png](diagrams/auth-flow.png) | [auth-flow.drawio](diagrams/auth-flow.drawio) |
| 4 | Decision Engine Flow | [decision-flow.png](diagrams/decision-flow.png) | [decision-flow.drawio](diagrams/decision-flow.drawio) |
| 5 | MCP Admin CRUD Flow | [admin-crud-flow.png](diagrams/admin-crud-flow.png) | [admin-crud-flow.drawio](diagrams/admin-crud-flow.drawio) |
| 6 | API Usage (all modules) | [api-usage.png](diagrams/api-usage.png) | [api-usage.drawio](diagrams/api-usage.drawio) |
| 7 | API Flow (request → DB) | [api-flow.png](diagrams/api-flow.png) | [api-flow.drawio](diagrams/api-flow.drawio) |
| 8 | Test Strategy Pyramid | [pending.png](diagrams/pending.png) | [pending.drawio](diagrams/pending.drawio) |
