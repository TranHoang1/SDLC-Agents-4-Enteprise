# Technical Design Document (TDD) — SA4E-215

**Ticket:** SA4E-215
**Status:** Done (L3 autonomy)
**Last updated:** 2026-08-26

## 1. Architecture Overview

```
Client
  │  /api/sa4e-215/*
  ▼
Hono route handlers (auth, decisions, mcp/servers)
  │
  ▼
PrismaClient (DatabaseAdapter: SQLite dev / PostgreSQL prod)
  │
  ▼
Tables: users, decisions, audit_log, projects, mcp_servers
```

Each route module is a factory: `createAuthRoute(prisma, logger)`, `createDecisionRoute(prisma, logger)`, `createMcpServerRoute(prisma, logger)`, mounted on the Hono app.

## 2. Module Responsibilities

| Module | File | Responsibility |
|--------|------|----------------|
| Auth | `routes/sa4e-215/auth.ts` | register/login/logout, argon2 + jose JWT |
| Decisions | `routes/sa4e-215/decisions.ts` | evaluate (threshold logic) + history, audit logging |
| MCP Config | `routes/mcp/servers.ts` | CRUD on `mcp_servers`, project scoping, soft delete |
| Schema Registry | `database/schema-registry/sa4e-215.ts` | TableDef definitions (users/decisions/audit_log) |
| Migration | `scripts/migrate-mcp.js` | `orchestration.json` → `mcp_servers` upsert |

## 3. Database Schema

### 3.1 users (registry ✅)
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| email | VARCHAR(255) | UNIQUE NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL |
| role | VARCHAR(50) | NOT NULL DEFAULT 'user' |
| created_at | TIMESTAMP | NOT NULL DEFAULT NOW() |
| updated_at | TIMESTAMP | NOT NULL DEFAULT NOW() |

### 3.2 decisions (registry ✅)
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| user_id | INTEGER | NOT NULL, FK → users(id) |
| rule_set_id | VARCHAR(100) | NOT NULL |
| input_params | JSONB | |
| result | VARCHAR(50) | NOT NULL |
| confidence | REAL | NOT NULL DEFAULT 0 |
| evaluated_at | TIMESTAMP | NOT NULL DEFAULT NOW() |
| Indexes | idx_decisions_user_id, idx_decisions_evaluated_at, idx_decisions_rule_set_id | |

### 3.3 audit_log (registry ✅)
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| user_id | INTEGER | FK → users(id), nullable |
| action | VARCHAR(100) | NOT NULL |
| resource_type | VARCHAR(50) | NOT NULL |
| resource_id | INTEGER | NOT NULL |
| metadata | JSONB | NOT NULL DEFAULT '{}' |
| created_at | TIMESTAMP | NOT NULL DEFAULT NOW() |
| Indexes | idx_audit_log_user_id, idx_audit_log_action, idx_audit_log_created_at | |

### 3.4 projects (runtime only ❌ not in registry)
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| name | VARCHAR(100) | UNIQUE NOT NULL |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | DEFAULT NOW() |

### 3.5 mcp_servers (runtime only ❌ not in registry)
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| project_id | INTEGER | NOT NULL, FK → projects(id) |
| name | VARCHAR(100) | NOT NULL |
| transport_type | VARCHAR(50) | NOT NULL |
| url | TEXT | |
| command | TEXT | |
| args | JSONB | DEFAULT '{}' |
| env | JSONB | DEFAULT '{}' |
| disabled | BOOLEAN | DEFAULT false |
| auto_approve | JSONB | DEFAULT '{}' |
| tools | JSONB | DEFAULT '{}' |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | DEFAULT NOW() |
| Unique | UNIQUE (name, project_id) | |
| Indexes | idx_mcp_servers_project_id, idx_mcp_servers_name_project, idx_mcp_servers_disabled | |

> **Action item:** add `PROJECTS_TABLE` and `MCP_SERVERS_TABLE` to `schema-registry/sa4e-215.ts` to eliminate drift.

## 4. Key Algorithms

### 4.1 Password hashing
argon2 with `{ memoryCost: 2**16, timeCost: 2, parallelism: 2 }`. Verify on login; `hash()` helper dynamically imports `@node-rs/argon2`.

### 4.2 JWT
`jose.sign({ sub, email, role }, AUTH_SECRET, { expiresIn: '24h' })`. Secret from `process.env.AUTH_SECRET` (falls back to insecure default — must be set in prod).

### 4.3 Decision logic
```
score = Σ numeric values in params
if score > 50:  decision='approved'; confidence = min(0.95, 0.5 + score*0.01)
elif score > 20: decision='pending';  confidence = 0.5 + score*0.01
else:            decision='rejected'; confidence = max(0.05, 0.5 - |score|*0.01)
```

### 4.4 Uniqueness & scoping (MCP)
All reads/writes filter by `project_id`; name uniqueness enforced per project via `findFirst({ name, project_id })`.

## 5. Migration Design (`scripts/migrate-mcp.js`)

1. Parse `orchestration.json` (`mcpServers` array).
2. Connect Prisma; verify `mcp_server`/`project` tables exist.
3. For each server: resolve `project_id` (default project `name='default'`, else 1); upsert by `(name, project_id)`.
4. Print report (added/updated/skipped/errors) and verify `dbCount === fileCount`.
5. Idempotent — safe to re-run.

## 6. Security Notes

- Passwords never returned in API responses.
- Generic auth error messages (no user enumeration).
- JWT secret must be injected via env in production.

## 7. Diagram Index

| # | Diagram | PNG | Drawio |
|---|---------|-----|--------|
| 1 | ER Diagram | [er-diagram.png](diagrams/er-diagram.png) | [er-diagram.drawio](diagrams/er-diagram.drawio) |
| 2 | Migration Flow | [migration-flow.png](diagrams/migration-flow.png) | [migration-flow.drawio](diagrams/migration-flow.drawio) |
| 3 | Auth Flow | [auth-flow.png](diagrams/auth-flow.png) | [auth-flow.drawio](diagrams/auth-flow.drawio) |
| 4 | Decision Flow | [decision-flow.png](diagrams/decision-flow.png) | [decision-flow.drawio](diagrams/decision-flow.drawio) |
| 5 | API Flow | [api-flow.png](diagrams/api-flow.png) | [api-flow.drawio](diagrams/api-flow.png) |
| 6 | Test Strategy | [pending.png](diagrams/pending.png) | [pending.drawio](diagrams/pending.drawio) |
