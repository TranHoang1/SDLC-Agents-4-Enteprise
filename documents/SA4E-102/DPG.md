# Deployment Guide (DPG)

## SDLC-Agents-4-Enterprise — SA4E-102: Index Jira Project → Knowledge Base

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-102 |
| Title | Index Jira Project → Knowledge Base |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2026-08-29 |
| Status | Draft |
| Related TDD | N/A — design embedded in FSD |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-29 | DevOps Agent | Initiate document — auto-generated for UAT pass deployment |

---

## 1. Overview

### 1.1 Feature Summary
Thêm option "Index Jira Project" cho phép batch sync và on-demand auto-cache Jira tickets vào Knowledge Base, cùng graph nodes/edges cho ticket relationships. Đã pass UAT.

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| Extension JiraProjectIndexer | Modified | New batch sync + on-demand cache modules |
| Backend MCP mem_ingest/mem_graph | Existing | Upsert semantics for tickets |
| KB SQLite | Existing | Store ticket entries |
| Graph DB | Existing | TICKET nodes + DEPENDS_ON/RELATES_TO/IMPLEMENTS edges |
| Configuration | Modified | jira.conf auto-detect project key |

### 1.3 Target Environments

| Environment | URL | Deploy Order | Approval Required |
|-------------|-----|-------------|-------------------|
| DEV | local | 1st | No |
| SIT | sit | 2nd | No |
| UAT | uat | 3rd | QA Sign-off |
| PROD | prod | 4th | PM + Business Sign-off |

---

## 2. Prerequisites

### 2.1 Infrastructure
| Requirement | Status | Notes |
|-------------|--------|-------|
| VS Code Extension installed | Ready | extension/ |
| Backend MCP server running | Ready | port 48721 |
| Atlassian MCP server connected | Ready | Jira credentials configured |

### 2.2 Software Dependencies
| Dependency | Version | Status |
|-----------|---------|--------|
| Node.js | >=18 | Installed |
| VS Code | >=1.90 | Installed |

### 2.3 Access Requirements
| Access | Type | Who Needs It |
|--------|------|-------------|
| VS Code extension activation | Auto | Developer |
| Backend MCP | Service account | Automated |

### 2.4 Backup Requirements
- [x] KB SQLite backup completed before deployment
- [x] Extension artifact saved
- [x] Configuration backup

---

## 3. Pre-Deployment Checklist

| # | Item | Responsible | Status |
|---|------|-------------|--------|
| 1 | Code merged to release branch | Developer | ☐ |
| 2 | All unit tests passed | Developer | ☐ |
| 3 | All integration tests passed | QA | ☐ |
| 4 | UAT sign-off obtained | QA + BA | ☑ |
| 5 | Database backup completed | DBA | ☑ |
| 6 | Configuration files prepared | DevOps | ☑ |
| 7 | Feature flags configured | Developer | ☐ |
| 8 | Monitoring/alerting configured | DevOps | ☐ |
| 9 | Rollback plan reviewed | Team | ☑ |
| 10 | Deployment window confirmed | PM | ☐ |

---

## 4. Database Migration

No schema changes. KB uses upsert semantics.

Verify:
```sql
SELECT * FROM kb_entries WHERE source LIKE 'jira/%';
```

Rollback: restore KB SQLite from backup.

---

## 5. Application Deployment

Step 1: Stop extension host → VS Code reload
Step 2: Deploy new extension build
Step 3: Restart backend MCP
Step 4: Reload VS Code
Step 5: Health check: `mem_search("SA4E-102")` returns ticket

---

## 6. Configuration Changes

jira.conf autoDetectKey enabled.

---

## 7. Post-Deployment Verification

Health Checks:
- Command Palette shows "Index Jira Project"
- Batch sync produces output summary
- On-demand cache works via `jira_get_issue`
- Graph nodes created

Monitoring: Output channel logs, error rate <1%

---

## 8. Rollback Plan

Decision criteria: critical defect, crash.

Rollback steps:
1. Stop extension
2. Restore previous extension version
3. Restore KB backup if needed
4. Verify

Estimated time: 10 minutes

---

## 9. Environment-Specific Notes

UAT deployed after QA sign-off. PROD window 22:00-23:00.

---

## 10. Appendix

Contacts: DevOps Agent
