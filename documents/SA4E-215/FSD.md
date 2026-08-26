FSD.md - Functional Specification Document
SA4E-215 L3

---
# Document Information

| Attribute | Value |
|-----------|-------|
| Jira Ticket | SA4E-215 |
| Title | Functional Specification |
| Author | SM-Agent |
| Version | 1 |
| Date | 2026-08-25 |
| Status | requirements → specification |
| Autonomy Level | L3 |

# Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1 | 2026-08-25 | SM-Agent | Initial FSD creation |

---

# 1. Introduction

## 1.1 Purpose
This document specifies the functional requirements for SA4E-215, defining what the system must do from a user and business perspective. The ticket aims to refactor MCP server configuration storage from file-based to database-based.

## 1.2 Scope
### In Scope
- MCP server CRUD operations via database API
- Multi-tenant project scoping for server configurations
- Migration script from orchestration.json to database
- Repository/service layer for MCP server management
- Refactored admin routes and orchestration module
- Transaction/atomicity improvements over file-based CRUD

### Out of Scope
- UI/UX design for MCP server management interface
- Third-party integrations beyond API scope
- Complete overhaul of MCP server runtime functionality
- Infrastructure provisioning and deployment (Phase 7)

## 1.3 Preliminary Requirements
- System must support CRUD operations for MCP server configuration via database
- Configuration must be project-scoped (multi-tenant isolation)
- Migration from existing orchestration.json must be backward-compatible
- All CRUD operations must have transaction/atomicity (no race conditions)
- Database must be the single source of truth (file can remain as read-only export)

---

# 2. Functional Requirements

## 2.1 MCP Server CRUD Operations

| ID | Requirement | Description |
|----|-----------|-------------|
| **FR-001** | **Create MCP Server** | System shall allow administrators to create new MCP server configurations via API POST /api/sa4e-215/mcp-servers. Input shall include: name (unique per project), transport_type, url, command, args (JSON), env (JSON), disabled, auto_approve (JSON). Database must enforce uniqueness of name per project_id. |
| **FR-002** | **Read MCP Server** | System shall allow retrieval of MCP server configuration via API GET /api/sa4e-215/mcp-servers/{id} or GET /api/sa4e-215/mcp-servers?project_id={id}. Response shall include all fields: id, project_id, name, transport_type, url, command, args, env, disabled, auto_approve, tools, created_at, updated_at. |
| **FR-003** | **Update MCP Server** | System shall allow administrators to update MCP server configuration via API PUT /api/sa4e-215/mcp-servers/{id}. Input shall support partial updates to any field. Database must use transactions to prevent race conditions during concurrent updates. |
| **FR-004** | **Delete MCP Server** | System shall allow administrators to delete MCP server configuration via API DELETE /api/sa4e-215/mcp-servers/{id}. Database must use soft delete (set disabled=1) or hard delete with cascade removal from related tables. |

## 2.2 Multi-Tenancy & Project Scoping

| ID | Requirement | Description |
|----|-----------|-------------|
| **FR-005** | **Project-Scoped Names** | MCP server names must be unique per project_id. Same server name can exist in different projects. Database schema must include project_id column on mcp_servers table. |
| **FR-006** | **Isolated Configuration** | Each project's MCP server configuration must be isolated. Queries must filter by project_id automatically (via middleware or views). No cross-project config leakage. |
| **FR-007** | **Migration Scope** | Migration script must scope all operations by project_id. Existing orchestration.json data must be tagged with project_id during import. |

## 2.3 Migration Requirements

| ID | Requirement | Description |
|----|-----------|-------------|
| **FR-008** | **Data Integrity** | Migration script must verify that all MCP servers from orchestration.json are imported to DB. Verification: same count, same attributes, same attribute values. |
| **FR-009** | **Backward Compatibility** | After migration, orchestration.json must remain as read-only export. System must read MCP config from DB by default, fall back to orchestration.json only if DB query returns no results. |
| **FR-010** | **One-Time Execution** | Migration script must be idempotent or clearly marked as one-time execution. Running multiple times must not duplicate data or cause errors. |

## 2.4 Transaction & Atomicity Requirements

| ID | Requirement | Description |
|----|-----------|-------------|
| **FR-011** | **Transaction Writes** | All CRUD write operations (CREATE, UPDATE, DELETE) must use database transactions. No file .tmp rename patterns. Must roll back on any error. |
| **FR-012** | **Concurrent Safety** | System must handle concurrent CRUD operations without data corruption. Tests must verify: same input → same output, no race conditions, no corrupt state. |
| **FR-013** | **Error Structured Responses** | All API errors must return structured JSON: { success: false, error: { code, message, details } }. No raw database errors exposed to clients. |

## 2.5 API Endpoints

| Method | Endpoint | Description | Request Fields | Response |
|--------|----------|-------------|----------------|----------|
| **POST** | `/api/sa4e-215/mcp-servers` | Create new MCP server | {name, project_id, transport_type, url, command, args, env, disabled, auto_approve, tools} | { success: true, data: { id, ... } } |
| **GET** | `/api/sa4e-215/mcp-servers` | List MCP servers | {project_id?, page?, page_size?} | { success: true, data: [...], meta: { total, page, page_size } } |
| **GET** | `/api/sa4e-215/mcp-servers/{id}` | Get single MCP server | {id} | { success: true, data: { id, ... } } |
| **PUT** | `/api/sa4e-215/mcp-servers/{id}` | Update MCP server | {id} + partial fields | { success: true, data: { id, ... } } |
| **DELETE** | `/api/sa4e-215/mcp-servers/{id}` | Delete MCP server | {id} | { success: true } |

---

# 3. System Requirements

## 3.1 Technical Stack
- **Backend**: Hono framework (Node.js runtime)
- **Database**: SQLite (development) / PostgreSQL (production)
- **ORM/Query**: Prisma or raw DatabaseAdapter
- **Migration**: Custom migration script (up/down)
- **Auth**: Admin-only middleware for all MCP server routes

## 3.2 Performance Requirements
- **CRUD Latency**: Create/Read/Update/Delete < 100ms p95
- **Migration Throughput**: Import 100+ servers from orchestration.json < 5 seconds
- **Concurrent Users**: Support 100 simultaneous admin operations

## 3.3 Security Requirements
- **Admin-Only Routes**: All MCP server CRUD endpoints require JWT with admin role
- **Input Validation**: Zod schema validation on all API inputs
- **SQL Injection Prevention**: Parameterized queries (Prisma/pg), no raw SQL in API handlers
- **Rate Limiting**: 10 requests/minute per IP for MCP admin endpoints

---

# 4. Component Design Overview

## 4.1 Core Components
- **MCP Config Service**: Handles all DB operations for mcp_servers table
- **Migration Script**: One-time import from orchestration.json to DB
- **API Gateway**: Route handling, validation
- **Database Adapter**: SQLite/PostgreSQL connection
- **OrchestrationModule**: Updated to read config from DB instead of file

## 4.2 Data Model Key Entities

### mcp_servers table
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PRIMARY KEY, autoIncrement |
| project_id | INTEGER | NOT NULL, FK to projects table |
| name | VARCHAR(100) | NOT NULL, UNIQUE per project_id |
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

### projects table (minimal)
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PRIMARY KEY |
| name | VARCHAR(100) | NOT NULL, UNIQUE |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | DEFAULT NOW() |

---

# 5. External Interfaces

## 5.1 API Endpoints (Full Specification)

### POST /api/sa4e-215/mcp-servers
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | ✓ | Server name |
| project_id | integer | ✓ | Project identifier |
| transport_type | string | ✓ | e.g., 'http', 'command', 'websocket' |
| url | string | | Server URL (if applicable) |
| command | string | | Command to execute (if applicable) |
| args | object | | JSON arguments for command |
| env | object | | Environment variables |
| disabled | boolean | | Whether disabled |
| auto_approve | object | | Auto-approve config |
| tools | object | | Tools list |

**Response (201):** Server created with full fields
**Response (400):** Validation errors
**Response (401):** Admin auth required
**Response (409):** Name must be unique per project

### GET /api/sa4e-215/mcp-servers
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| project_id | integer | | Filter by project |
| page | integer | | Page number (default: 1) |
| page_size | integer | | Items per page (default: 20) |

**Response (200):** Paginated list of MCP servers

### GET /api/sa4e-215/mcp-servers/{id}
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | integer | ✓ | Server ID |

**Response (200):** Single MCP server object

### PUT /api/sa4e-215/mcp-servers/{id}
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | integer | ✓ | Server ID |
| Partial fields | | | Any fields to update |

**Response (200):** Server updated
**Response (400/404):** Validation/Not found

### DELETE /api/sa4e-215/mcp-servers/{id}
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | integer | ✓ | Server ID |

**Response (200):**
```json
{
  "success": true,
  "message": "MCP server soft-deleted"
}
```

---

# 6. Related Tickets

| Ticket | Relationship | Status |
|--------|-------------|--------|
| SA4E-215 | Parent ticket | specification |
| SA4E-119 | Reference refactor | completed |
| SA4E-208 | Previous project | completed |

---

# 6. Appendix

## 6.1 Diagram Index (Mandatory per Quality Gate)

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | ER Diagram mcp_servers + projects | [pending.png](diagrams/er-diagram.png) | [pending.drawio](diagrams/er-diagram.drawio) |
| 2 | Migration Flow orchestration.json → DB | [pending.png](diagrams/migration-flow.png) | [pending.drawio](diagrams/migration-flow.drawio) |
| 3 | Admin CRUD Flow API → DB → Response | [pending.png](diagrams/admin-crud-flow.png) | [pending.drawio](diagrams/admin-crud-flow.drawio) |

## 6.2 Technology Stack Decisions

| Decision | Option Chosen | Rationale |
|----------|---------------|-----------|
| Database | PostgreSQL (production) / SQLite (dev) | Mature, relational, JSONB support |
| ORM | Prisma | Type-safe, migration-friendly |
| Migration Script | Custom Node.js script | <= 200 lines, explicit |
| API Framework | Hono | Lightweight, native ES modules |
| Auth | JWT + Admin middleware | Fine-grained access control |

## 6.3 Acceptance Criteria Checklist

- [ ] FR-001 to FR-013 all implemented and tested
- [ ] All API endpoints return correct structured responses
- [ ] Migration script imports 100% of orchestration.json data
- [ ] Project name uniqueness enforced per project_id
- [ ] All CRUD operations use database transactions
- [ ] Concurrent CRUD tests pass (no race conditions)
- [ ] Admin-only auth middleware works correctly
- [ ] FR-010 migration is idempotent or one-time
- [ ] Code coverage ≥ 90% for new code
- [ ] Diagrams in Appendix indexed and pending draw.io creation

## 6.3 Glossary

| Term | Definition |
|------|-----------|
| L3 | Autonomy Level 3 - minimal human gates required (UAT + deployment only) |
| FSD | Functional Specification Document |
| BRD | Business Requirements Document |
| CRUD | Create, Read, Update, Delete |
| DB | Database (SQLite/PostgreSQL) |
| ORM | Object-Relational Mapping |
| API | Application Programming Interface |
| JSONB | JSON Binary type (PostgreSQL) |

---

**Current Phase**: specification — FSD.md completed, ready to proceed to Phase 3 (TDD.md)