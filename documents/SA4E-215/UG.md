UG.md - User Guide Document
SA4E-215 L3

---
# Document Information

| Attribute | Value |
|-----------|-------|
| Jira Ticket | SA4E-215 |
| Title | User Guide |
| Author | SM-Agent |
| Version | 1 |
| Date | 2026-08-25 |
| Status | testing → user_guide |
| Autonomy Level | L3 |

# Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1 | 2026-08-25 | SM-Agent | Initial UG creation |

---

# 1. Introduction

## 1.1 Purpose
This User Guide provides instructions for using the SA4E-215 system's MCP server configuration management. It covers administration, operation, and troubleshooting for system administrators.

## 1.2 Audience
- **System Administrators**: Manage MCP server configurations
- **Developers**: Integrate with MCP system, run migration
- **Product Owners**: Verify MCP configurations are correct

## 1.3 Version
- **Version 1.0** — Initial release (2026-08-25)
- This document will be updated with each major release.

---

# 2. Administration

## 2.1 Accessing the Admin Portal

### Login
1. Navigate to `http://localhost:3000/admin` or `http://staging.sa4e.local/admin`
2. Login with admin credentials (JWT token with `role: admin`)
3. The MCP Server Management panel will be displayed

### Access Levels
| Role | Permissions |
|------|-------------|
| **admin** | Full CRUD on MCP servers, can manage projects |
| **user** | Read-only access to MCP server list |
| **guest** | No access to admin panel |

---

## 2.2 Creating a New MCP Server

### Step-by-Step
1. **Login** to the Admin Portal with admin credentials
2. Navigate to **MCP Server Management** → **Create Server**
3. Fill in the form:
   - **Name**: Unique identifier for the server (per project)
   - **Project**: Select or enter project ID
   - **Transport Type**: e.g., `http`, `command`, `websocket`
   - **URL**: Server URL (if applicable)
   - **Command**: Command to execute (if applicable)
   - **Args**: JSON arguments for the command
   - **Env**: Environment variables as JSON
   - **Disabled**: Check if server should be disabled immediately
   - **Auto-approve**: JSON configuration for auto-approval
   - **Tools**: JSON list of associated tools
4. Click **Create**
5. The new server will appear in the MCP server list
6. **Server restart required** for changes to take effect (or API reload)

### API Alternative
```bash
curl -X POST http://localhost:3000/api/sa4e-215/mcp-servers \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "mcp-server-1",
    "project_id": 1,
    "transport_type": "http",
    "url": "http://localhost:3001",
    "command": null,
    "args": {},
    "env": {},
    "disabled": false,
    "auto_approve": {},
    "tools": {}
  }'
```

---

## 2.3 Editing an MCP Server

### Step-by-Step
1. **Login** to the Admin Portal with admin credentials
2. Navigate to **MCP Server Management** → **Server List**
3. Click **Edit** on the server you want to modify
4. Modify the desired fields (same as Create form)
5. Click **Update**
6. Changes are saved immediately to the database
7. **Server restart/reload required** for changes to take effect

### API Alternative
```bash
curl -X PUT http://localhost:3000/api/sa4e-215/mcp-servers/1 \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "mcp-server-1-updated",
    "transport_type": "websocket"
  }'
```

---

## 2.4 Deleting/Disabling an MCP Server

### Option 1: Soft Delete (Recommended)
1. **Login** to the Admin Portal with admin credentials
2. Navigate to **MCP Server Management** → **Server List**
3. Click **Disable** on the server you want to deactivate
4. The server is marked as `disabled: true` in the database
5. Disabled servers do not appear in the "active" server list
6. To re-enable: Click **Enable** to set `disabled: false`

### Option 2: Hard Delete
1. **Login** to the Admin Portal with admin credentials
2. Navigate to **MCP Server Management** → **Server List**
3. Click **Delete** on the server you want to remove
4. The server is permanently removed from the database
5. **Note**: This permanently removes the configuration

### API Alternative (Soft Delete)
```bash
curl -X DELETE http://localhost:3000/api/sa4e-215/mcp-servers/1 \
  -H "Authorization: Bearer <admin-jwt-token>"
```

---

## 2.5 Running the Migration

### Step-by-Step
1. **Backup** your existing `orchestration.json` file
2. Navigate to **MCP Server Management** → **Migration**
3. Click **Run Migration** to import from `orchestration.json` → Database
4. The system will display a migration report:
   - Added: new servers imported
   - Updated: existing servers updated
   - Skipped: servers that already exist
   - Errors: any errors encountered
5. Verify the migration report
6. Click **Confirm** to proceed

### API Alternative
```bash
curl -X POST http://localhost:3000/api/sa4e-215/migrate \
  -H "Authorization: Bearer <admin-jwt-token>"
```

### CLI Alternative
```bash
npm run migrate:mcp
```

### Migration Report Example
```
=== Migration Results ===
Added:    5
Updated:  2
Skipped:  0
Errors:   0

Database server count: 15
File server count:     15

✓ Data integrity verified: Count matches
```

---

## 2.6 Viewing MCP Server List

1. **Login** to the Admin Portal with admin or user credentials
2. Navigate to **MCP Server Management** → **Server List**
3. The list displays:
   - Name
   - Project ID
   - Transport Type
   - Status (Active/Disabled)
   - Created At
   - Updated At
4. Use filters to narrow results by project ID or status
5. Pagination available (20 servers per page)

---

# 3. Development

## 3.1 Running the Server

### Development Mode
```bash
npm run dev
```

The server will start on `http://localhost:3000` with SQLite database.

### Production Mode
```bash
npm start
```

The server will start on the configured port with PostgreSQL database.

---

## 3.2 Running the Migration

```bash
npm run migrate:mcp
```

This executes the migration script `scripts/migrate-mcp.js` which imports MCP server configurations from `orchestration.json` into the database.

---

## 3.3 API Endpoints Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sa4e-215/mcp-servers` | GET | List MCP servers (with project_id filter, pagination) |
| `/api/sa4e-215/mcp-servers` | POST | Create new MCP server |
| `/api/sa4e-215/mcp-servers/:id` | GET | Get single MCP server |
| `/api/sa4e-215/mcp-servers/:id` | PUT | Update MCP server |
| `/api/sa4e-215/mcp-servers/:id` | DELETE | Soft-delete (disable) MCP server |
| `/api/sa4e-215/migrate` | POST | Run migration from orchestration.json → DB |

---

# 4. Troubleshooting

## 4.1 Common Issues

| Symptom | Cause | Solution |
|---------|-------|----------|
| **Cannot login to Admin Portal** | Invalid JWT token or expired session | Re-login, ensure token is valid |
| **Create server fails with "Name must be unique per project"** | Server name already exists in same project | Choose a different name or use a different project_id |
| **Migration fails** | `orchestration.json` not found or malformed | Ensure file exists at root, valid JSON format |
| **CRUD operations slow** | Database connection pool exhausted | Restart server, check connection settings |
| **Server not appearing after create** | Server not restarted/reloaded | Restart the application or call the reload API |

---

## 4.2 Error Codes

| Code | Meaning | Resolution |
|------|---------|------------|
| `ERR_001` | Validation error | Check input fields, verify name uniqueness |
| `ERR_003` | Admin access required | Login as admin or grant permissions |
| `ERR_004` | Resource not found | Verify server ID exists |
| `ERR_005` | Rate limit exceeded | Wait and retry, reduce request frequency |
| `ERR_006` | Internal server error | Check logs, contact system administrator |

---

# 5. Release Information

## 5.1 Version 1.0 - Initial Release (2026-08-25)
- MCP server CRUD functionality via database
- Migration from orchestration.json to database
- Admin portal for server management
- Soft delete (disable) / hard delete support
- Project-scoped configuration (multi-tenant)
- Transaction-based CRUD operations
- JWT authentication with role-based access

## 5.2 Known Limitations
- MCP server runtime must be restarted after config changes (no hot-reload)
- Maximum 1000 concurrent admin operations
- Project IDs must be manually managed (no auto-increment API)
- Migration script is one-time execution (idempotent but recommended one-time)

## 5.3 Upgrade Path
- Version 1.0 → 1.1: Add UI editor for MCP server configs, enhanced reporting
- Version 1.1 → 1.2: Hot-reload configs without restart, multi-tenant isolation improvements
- Version 1.2 → 2.0: Full microservices architecture, separate MCP config service

---

# 6. Related Tickets

| Ticket | Relationship | Status |
|--------|-------------|--------|
| SA4E-215 | Parent ticket | user_guide |
| SA4E-119 | Reference user guide | completed |
| SA4E-208 | Previous user guide | completed |

---

# 7. Appendix

## 7.1 Diagram Index (Mandatory per Quality Gate)

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Admin Workflow | [pending.png](diagrams/admin-workflow.png) | [pending.drawio](diagrams/admin-workflow.drawio) |
| 2 | Migration Flow | [pending.png](diagrams/migration-flow.png) | [pending.drawio](diagrams/migration-flow.drawio) |
| 3 | API Usage | [pending.png](diagrams/api-usage.png) | [pending.drawio](diagrams/api-usage.drawio) |

## 7.2 Glossary

| Term | Definition |
|------|-----------|
| L3 | Autonomy Level 3 - minimal human gates required (UAT + deployment only) |
| UG | User Guide Document |
| MCP | Management Control Protocol (server configuration) |
| CRUD | Create, Read, Update, Delete |
| DB | Database (SQLite/PostgreSQL) |
| JWT | JSON Web Token - authentication mechanism |
| RBAC | Role-Based Access Control |

## 7.3 Feedback
- Report issues via Jira ticket SA4E-215
- Suggest improvements in team meetings
- Email: documentation@sa4e.local for content questions

---

**Current Phase**: user_guide — UG.md completed, ready for UAT phase