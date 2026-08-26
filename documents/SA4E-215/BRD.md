BRD.md - Business Requirements Document
SA4E-215 L3

---
# Document Information

| Attribute | Value |
|-----------|-------|
| Jira Ticket | SA4E-215 |
| Title | Business Requirements |
| Author | SM-Agent |
| Version | 1 |
| Date | 2026-08-25 |
| Status | requirements |
| Autonomy Level | L3 |

# Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1 | 2026-08-25 | SM-Agent | Initial BRD creation |

---

# 1. Introduction

## 1.1 Purpose
This document defines the business requirements for SA4E-215, outlining the scope, stakeholders, and high-level goals for the system. The ticket aims to refactor the MCP server configuration storage from file-based to database-based.

## 1.2 Scope
### In Scope
- Moving MCP server configuration from file orchestration.json to database (SQLite/PostgreSQL)
- Multi-tenant project scoping for MCP server config
- Repository/service layer for MCP server operations
- Refactoring admin routes and orchestration module to use DB instead of file
- Migration script for existing orchestration.json data
- Transaction/atomicity improvements over file-based CRUD

### Out of Scope
- UI/UX design for MCP server management
- Third-party integrations beyond API scope
- Performance optimization beyond baseline requirements
- Complete overhaul of MCP server runtime functionality

## 1.3 Preliminary Requirements
- System must support CRUD operations for MCP server configuration via database
- Configuration must be project-scoped (multi-tenant isolation)
- Migration from existing orchestration.json must be backward-compatible
- All CRUD operations must have transaction/atomicity (no race conditions)
- Database must be the single source of truth (file can remain as read-only export)

---

# 2. Business Requirements

## 2.1 User Stories

| # | Story | Priority | Source | Acceptance Criteria |
|---|-------|----------|--------|---------------------|
| BR-001 | As a system administrator, I want to add MCP server configuration via Admin Portal so that it is stored in database | High | Ticket | MCP server added successfully, config persists in DB, not in orchestration.json |
| BR-002 | As a system administrator, I want to edit MCP server configuration so that changes are reflected immediately | High | Ticket | Modified server config saved to DB, affects server startup |
| BR-003 | As a system administrator, I want to delete MCP server configuration so that it is removed from DB | High | Ticket | MCP server removed, no longer loaded on startup |
| BR-004 | As a developer, I want MCP server config to be project-scoped so that different projects have isolated configurations | Medium | Ticket | Different project_ids have different MCP server configs, no cross-contamination |
| BR-005 | As a developer, I want migration from orchestration.json to database so that existing configs are preserved | High | Ticket | All existing servers from orchestration.json imported to DB, verified count and attributes match |
| BR-006 | As a developer, I want CRUD operations to have atomicity so that race conditions are prevented | High | Ticket | Concurrent CRUD operations don't corrupt data, transactions used |

## 2.2 High-Level Process Map

```mermaid
flowchart TD
    A[Admin Portal CRUD] --> B{Validate Input}
    B -->|Success| C[Save to Database]
    B -->|Failure| D[Error Response]
    C --> E[Update Orchestration Config (read-only)]
    E --> F[Server Restart Loads from DB]
    F --> G[MCP Server Operates from DB]
    D --> H[Display Validation Errors]
```

## 2.3 Dependencies

| Dependency | Type | Description |
|------------|------|-------------|
| Database (SQLite/PostgreSQL) | Infrastructure | Single source of truth for MCP server config |
| Orchestration.json | Legacy | Will be read-only export after migration |
| Backend Routes | Code | admin/mcp-crud.ts, mcp.ts |
| OrchestrationModule | Code | McpClientManager reads config |
| Migration Script | Tool | One-time import from file to DB |

---

# 3. Stakeholders

| Role | Responsibilities | Access Level |
|------|-----------------|--------------|
| **System Administrator** | Manages MCP server config via Admin Portal | Full access |
| **Developer** | Implements refactoring, migration, tests | Developer only |
| **MCP Server** | Reads config at startup, operates from configured settings | Runtime |
| **Product Owner** | Prioritizes refactoring work, ensures criteria met | Full access |

---

# 4. Risks and Assumptions

## 4.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Data loss during migration** | Loss of existing server configs | Low | Thorough migration script, verify count/attributes match |
| **Race conditions in CRUD** | Corrupt config, server errors | Medium | Use database transactions, not file .tmp rename |
| **Multi-tenant contamination** | Project configs affect each other | Low | DB schema with project_id scoping, tests verify isolation |
| **Server downtime** | MCP servers restart, services disrupted | Medium | Plan migration for maintenance window, graceful reload |

## 4.2 Assumptions

| Assumption | Basis |
|------------|-------|
| Database (SQLite/PostgreSQL) available | Infrastructure requirement |
| Existing orchestration.json has valid MCP server entries | Data exists to migrate |
| Admin Portal already exists or will be created | UI requirement |
| Team familiar with DatabaseAdapter pattern | Skill requirement |

---

# 5. Non-Functional Requirements

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| **Performance** | CRUD operations < 100ms | Latency histogram |
| **Reliability** | Migration preserves 100% of configs | Config count comparison |
| **Security** | DB access restricted to admin routes | Auth check |
| **Scalability** | Support adding new projects without config interference | Project isolation tests |
| **Maintainability** | Code coverage ≥ 90% for new code | Coverage report |

---

# 6. Related Tickets

| Ticket | Relationship | Status |
|--------|-------------|--------|
| SA4E-214 | Predecessor | completed |
| SA4E-119 | Reference implementation | completed |
| SA4E-208 | Previous project | completed |

---

# 7. Appendix

## 7.1 Diagram Index (Mandatory per Quality Gate)

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Database Schema ER Diagram | [pending.png](diagrams/er-diagram.png) | [pending.drawio](diagrams/er-diagram.drawio) |
| 2 | Migration Flow Diagram | [pending.png](diagrams/migration-flow.png) | [pending.drawio](diagrams/migration-flow.drawio) |
| 3 | Admin Portal MCP CRUD Flow | [pending.png](diagrams/admin-crud-flow.png) | [pending.drawio](diagrams/admin-crud-flow.drawio) |

## 7.2 Glossary

| Term | Definition |
|------|-----------|
| L3 | Autonomy Level 3 - minimal human gates required (UAT + deployment only) |
| BRD | Business Requirements Document |
| FSD | Functional Specification Document |
| DB | Database (SQLite/PostgreSQL) |
| ORM | Object-Relational Mapping |
| CRUD | Create, Read, Update, Delete |
| API | Application Programming Interface |

## 7.3 Feedback
- Report issues via Jira ticket SA4E-215
- Suggest improvements in team meetings
- Email: documentation@sa4e.local for content questions

---

**Current Phase**: requirements — BRD.md completed, ready to proceed to Phase 2 (FSD.md)