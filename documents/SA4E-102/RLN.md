# Release Notes (RLN)

## SDLC-Agents-4-Enterprise — SA4E-102: Index Jira Project → Knowledge Base

---

## Release Information

| Field | Value |
|-------|-------|
| Release Version | 1.0 |
| Release Date | 2026-08-29 |
| Jira Ticket | SA4E-102 |
| Environment | UAT |
| Author | DevOps Agent |
| Status | Draft |

---

## 1. What's New

### 1.1 Feature Summary
Index Jira Project feature deployed to UAT. Enables batch sync and on-demand auto-cache of Jira tickets into Knowledge Base, with graph nodes and edges for ticket relationships.

### 1.2 User-Facing Changes

| # | Change | Description | Impact |
|---|--------|-------------|--------|
| 1 | Index Jira Project command | New Quick Pick option to batch index project tickets | High |
| 2 | On-demand auto-cache | `jira_get_issue` automatically ingests ticket to KB | High |
| 3 | Graph integration | TICKET nodes and dependency edges created | Medium |

---

## 2. Technical Changes

### 2.1 API Changes
None. Extends existing `jira_get_issue` with async ingest.

### 2.2 Database Changes
No schema changes. KB entries upsert by source `jira/{PROJECT}/{KEY}`.

### 2.3 Configuration Changes
jira.conf auto-detect project key enabled.

### 2.4 Infrastructure Changes
Extension JiraProjectIndexer modules added.

---

## 3. Bug Fixes
No bug fixes in this release. Feature complete.

---

## 4. Known Issues & Limitations
No known issues at UAT pass.

---

## 5. Dependencies
Atlassian MCP server and Backend MCP server must be running.

---

## 6. Migration Notes
No breaking changes. Fully backward compatible.

---

## 7. Testing Summary

UAT passed. Batch sync, on-demand auto-cache, graph nodes/edges verified.

Discrepancies closed:
- D-1 On-demand auto-cache in jira_get_issue — CLOSED
- D-2 Graph node per ticket — CLOSED
- D-3 Graph edges DEPENDS_ON/IMPLEMENTS/RELATES_TO — CLOSED

---

## 8. Deployment Instructions
See Deployment Guide DPG.md.

---

## 9. Rollback Plan
Restore previous extension version and KB backup if needed. Estimated rollback 10 minutes.

---

## 10. Contacts
DevOps Agent

