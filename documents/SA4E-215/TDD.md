# Technical Design Document (TDD) — SA4E-215

**Ticket:** SA4E-215
**Status:** Done (L3 autonomy) — *redesigned against verified real DB `sa4e_db` (2026-08-26)*
**Last updated:** 2026-08-26

> All design below is aligned with the **actual PostgreSQL `sa4e_db`** (inspected via `information_schema`), not assumptions. The earlier draft (JWT/argon2/`mcp_servers` with integer IDs) was invalid and has been discarded.

## 1. Real Platform Conventions (verified)

| Convention | Value |
|------------|-------|
| Primary keys | **TEXT ids** (`user-admin-001`, `grp-admin`, `project_id` text) |
| JSON storage | as **TEXT** (`schema_json TEXT`) |
| Booleans | **INTEGER 0/1** (`force_password_change INTEGER`) |
| Password hash | **PBKDF2** `salt:hash` (sha512, 10000 iters, 64B) — `backend/src/admin/db/password.ts` |
| RBAC | **group-based**: `users.access_group_id` → `access_groups` → `group_permissions` |
| Project scoping | `project_registry(project_id TEXT)` |

## 2. Existing Tables Reused (do NOT recreate)

`users`, `access_groups`, `group_permissions`, `project_registry`, `audit_log`, `mcp_tools`.

> `mcp_tools` is used by the **server to ingest tools for search** — NOT for declaring MCP servers. SA4E-215 must NOT write MCP server config there.

## 3. New Tables Owned by SA4E-215

### 3.1 `mcp_servers` (dedicated MCP server config)
```sql
CREATE TABLE IF NOT EXISTS mcp_servers (
  server_id      TEXT PRIMARY KEY,
  project_id     TEXT NOT NULL REFERENCES project_registry(project_id),
  name           TEXT NOT NULL,
  transport_type TEXT NOT NULL,
  url            TEXT,
  command        TEXT,
  args           TEXT,            -- JSON as text
  env            TEXT,            -- JSON as text
  disabled       INTEGER NOT NULL DEFAULT 0,  -- 0/1
  auto_approve   TEXT,            -- JSON as text
  tools          TEXT,            -- JSON as text
  created_at     TIMESTAMP NOT NULL,
  updated_at     TIMESTAMP NOT NULL,
  UNIQUE (name, project_id)
);
CREATE INDEX idx_mcp_servers_project_id ON mcp_servers(project_id);
CREATE INDEX idx_mcp_servers_disabled ON mcp_servers(disabled);
```

### 3.2 `decisions` (decision evaluation results)
```sql
CREATE TABLE IF NOT EXISTS decisions (
  decision_id   TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(user_id),
  project_id    TEXT REFERENCES project_registry(project_id),
  rule_set_id   TEXT NOT NULL,
  input_params  TEXT,             -- JSON as text
  result        TEXT NOT NULL,
  confidence    REAL NOT NULL DEFAULT 0,
  evaluated_at  TIMESTAMP NOT NULL
);
CREATE INDEX idx_decisions_user_id ON decisions(user_id);
CREATE INDEX idx_decisions_evaluated_at ON decisions(evaluated_at);
CREATE INDEX idx_decisions_rule_set_id ON decisions(rule_set_id);
```

Audit entries are written to the **existing** `audit_log` table (real shape: `audit_id, user_id, username, action, resource, resource_id, changes, timestamp, ip_address`).

## 4. Module Design

### 4.1 Auth (reuse `users`, pbkdf2, group RBAC)
- Query `users` by **`user_id`/`email`** (not `id`).
- Verify with platform `verifyPassword` (pbkdf2 `salt:hash`), **not argon2**.
- Token via platform `generateToken`; claims include `user_id` + `access_group_id`.
- Authorization derived from `access_group_id` → `group_permissions.permission_id`.
- No `role` column exists — drop that assumption.

### 4.2 Decisions
- `POST /evaluate`: compute `decision`/`confidence` (threshold logic), insert into `decisions`, then insert audit row into **real** `audit_log` (`action='decision_evaluate'`, `resource='decision'`, `resource_id=decision_id`, `changes=JSON`, `username` looked up).
- `GET /history`: list `decisions` joined with `users` for display.

### 4.3 MCP Server Config
- CRUD on `mcp_servers`, **scoped by `project_id`** (FK → `project_registry`).
- Name unique **per project**: `UNIQUE(name, project_id)`.
- Soft-delete: set `disabled=1`.
- JSON fields stored as TEXT.

### 4.4 Migration (`scripts/migrate-mcp.js`)
- Read `orchestration.json` (`mcpServers[]`).
- Resolve `project_id` from `project_registry` (default project, else create one).
- Upsert into `mcp_servers` (tag `project_id`); verify row counts.

## 5. Decision Logic (unchanged algorithm)
`score = Σ numeric params`; score>50 → approved (conf ≤0.95), 20<score≤50 → pending, else rejected.

## 6. Open Items Resolved
- ❌ Old: registry missing mcp_servers/projects → ✅ Registry now defines `mcp_servers`+`decisions` with real conventions; `projects` replaced by `project_registry`.
- ❌ Old: auth used argon2/`role` → ✅ Now pbkdf2 + `access_group_id`.

## 7. Diagram Index

| # | Diagram | PNG | Drawio |
|---|---------|-----|--------|
| 1 | ER Diagram (real sa4e_db + new tables) | [er-diagram.png](diagrams/er-diagram.png) | [er-diagram.drawio](diagrams/er-diagram.drawio) |
| 2 | Auth Flow (pbkdf2 + group RBAC) | [auth-flow.png](diagrams/auth-flow.png) | [auth-flow.drawio](diagrams/auth-flow.drawio) |
| 3 | Decision Flow | [decision-flow.png](diagrams/decision-flow.png) | [decision-flow.drawio](diagrams/decision-flow.drawio) |
| 4 | Migration Flow | [migration-flow.png](diagrams/migration-flow.png) | [migration-flow.drawio](diagrams/migration-flow.drawio) |
| 5 | MCP CRUD Flow | [admin-crud-flow.png](diagrams/admin-crud-flow.png) | [admin-crud-flow.drawio](diagrams/admin-crud-flow.drawio) |
| 6 | API Flow | [api-flow.png](diagrams/api-flow.png) | [api-flow.drawio](diagrams/api-flow.png) |
| 7 | Test Strategy | [pending.png](diagrams/pending.png) | [pending.drawio](diagrams/pending.drawio) |
