# Software Test Plan (STP) — SA4E-215

**Ticket:** SA4E-215
**Status:** Done (L3 autonomy)
**Last updated:** 2026-08-26

## 1. Test Strategy

Pyramid: **14 Unit** (fast, mocked DB) · **8 Integration** (real `DatabaseAdapter`) · **6 E2E** (real `orchestration.json` → DB via API). See [pending.png](diagrams/pending.png).

| Level | Count | Scope |
|-------|-------|-------|
| Unit | 14 | validation, hashing, decision logic, uniqueness, adapters |
| Integration | 8 | Auth + Decisions + MCP against real DB |
| E2E | 6 | migration script + full API flows |

## 2. Module Test Scope

### 2.1 Auth (AUTH)
- UT-AUTH-01 register creates user, hashes password (argon2)
- UT-AUTH-02 reject duplicate email (ERR_001)
- UT-AUTH-03 login returns JWT with claims sub/email/role
- UT-AUTH-04 login invalid password → ERR_002 (401)
- UT-AUTH-05 missing email/password → ERR_001 (400)
- UT-AUTH-06 logout returns success
- IT-AUTH-01 register→login→use token round-trip
- IT-AUTH-02 password hash verify matches stored hash

### 2.2 Decisions (DEC)
- UT-DEC-01 evaluate requires rule_set_id (ERR_001)
- UT-DEC-02 score>50 → approved, confidence≤0.95
- UT-DEC-03 20<score≤50 → pending
- UT-DEC-04 score≤20 → rejected
- IT-DEC-01 evaluate writes audit_log (best-effort)
- IT-DEC-02 history filters by user_id + pagination, joins user email/role
- E2E-DEC-01 full evaluate→history reflects new record
- E2E-DEC-02 audit_log entry created with correct metadata

### 2.3 MCP Server Config (MCP)
- UT-MCP-01 create requires name/project_id/transport_type (ERR_001)
- UT-MCP-02 name unique per project (409 ERR_001)
- UT-MCP-03 update partial + re-check uniqueness
- UT-MCP-04 soft-delete sets disabled=true
- UT-MCP-05 project scoping on list
- IT-MCP-01 CRUD lifecycle via API + DB
- IT-MCP-02 project isolation: same name different project_id allowed
- IT-MCP-03 transaction atomicity on create
- E2E-MCP-01 migration populates mcp_servers; count matches
- E2E-MCP-02 full CRUD via API after migration
- E2E-MCP-03 uniqueness enforced end-to-end

## 3. Integration Test Data
- 2 projects (`project_id` 1, 2) with distinct MCP configs.
- Sample `orchestration.json` with 5–10 MCP servers across 2–3 projects.
- Test users: `admin@example.com` (role admin), `user@example.com` (role user).

## 4. E2E Flows
1. Seed `orchestration.json` → run `node scripts/migrate-mcp.js` → assert DB rows + count match.
2. Call MCP CRUD API → assert DB state + uniqueness.
3. Register → login → evaluate → history reflects evaluation + audit entry.

## 5. Entry / Exit Criteria
- **Entry:** all 5 tables migrated/created; server boots.
- **Exit:** 14 unit + 8 integration + 6 e2e green; no `ERR_002` leakage of user existence.

## 6. Diagram Index

| # | Diagram | PNG | Drawio |
|---|---------|-----|--------|
| 1 | Test Strategy Pyramid | [pending.png](diagrams/pending.png) | [pending.drawio](diagrams/pending.drawio) |
| 2 | ER Diagram | [er-diagram.png](diagrams/er-diagram.png) | [er-diagram.drawio](diagrams/er-diagram.drawio) |
| 3 | Migration Flow | [migration-flow.png](diagrams/migration-flow.png) | [migration-flow.drawio](diagrams/migration-flow.drawio) |
| 4 | Auth Flow | [auth-flow.png](diagrams/auth-flow.png) | [auth-flow.drawio](diagrams/auth-flow.drawio) |
| 5 | Decision Flow | [decision-flow.png](diagrams/decision-flow.png) | [decision-flow.drawio](diagrams/decision-flow.drawio) |
| 6 | MCP CRUD Flow | [admin-crud-flow.png](diagrams/admin-crud-flow.png) | [admin-crud-flow.drawio](diagrams/admin-crud-flow.drawio) |
