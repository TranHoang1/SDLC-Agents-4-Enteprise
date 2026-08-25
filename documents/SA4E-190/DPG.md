# Deployment Guide (DPG)

## SDLC Agents 4 Enterprise — SA4E-190: Autonomy L3 Pipeline Automation for SDLC Agents 4 Enterprise

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-190 |
| Title | Autonomy L3 Pipeline Automation for SDLC Agents 4 Enterprise |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2026-08-23 |
| Status | Draft |
| Related TDD | TDD-v1.0-SA4E-190.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-23 | DevOps Agent | Initiate document — auto-generated from TDD and project context |

---

## Sign-Off

| Name | Role | Signature and date |
|------|------|--------------------|
| | Dev Lead | ☐ Approved for deployment |
| | QA Lead | ☐ Testing completed |
| | Ops Lead | ☐ Infrastructure ready |

---

## 1. Overview

### 1.1 Feature Summary

Pipeline automation for Autonomy L3 with human-in-the-loop approval gates. The deployment enables Pipeline Controller service to reset SDLC pipeline to requirements phase with autonomyLevel L3, BA Agent to generate BRD.md from Jira tickets following template, Draw.io diagram generation and PNG export, STATUS.json tracking with completedAt timestamps, and Knowledge Base ingestion for cross-agent access.

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| Pipeline Controller | Modified | Reset pipeline, enforce autonomy gates |
| BA Agent | Modified | BRD synthesis and template rendering |
| Status Manager | Modified | Read/write STATUS.json |
| SQLite DB | Migration/New Table | pipeline_status, brd_document, diagram_artifact |
| Configuration | Modified | JIRA_URL, DRAWIO_PATH, statusFilePath |

### 1.3 Target Environments

| Environment | URL | Deploy Order | Approval Required |
|-------------|-----|-------------|-------------------|
| DEV | http://dev.local:48721 | 1st | No |
| SIT | http://sit.local:48721 | 2nd | No |
| UAT | http://uat.local:48721 | 3rd | QA Sign-off |
| PROD | http://prod.local:48721 | 4th | PM + Business Sign-off |

---

## 2. Prerequisites

### 2.1 Infrastructure

| Requirement | Status | Notes |
|-------------|--------|-------|
| Docker host available | Ready | Node.js 20 alpine base |
| Network access configured | Ready | Internal service mesh |
| Draw.io CLI installed | Ready | C:\Program Files\draw.io\draw.io.exe |

### 2.2 Software Dependencies

| Dependency | Version | Status |
|-----------|---------|--------|
| Node.js | 20.x | Installed |
| TypeScript | 5.x | Installed |
| SQLite better-sqlite3 | 12.x | Installed |
| Docker | 24.x | Installed |
| npm | 10.x | Installed |

### 2.3 Access Requirements

| Access | Type | Who Needs It |
|--------|------|-------------|
| SSH to server | Key-based | DevOps team |
| Database admin | Credentials | DBA |
| CI/CD pipeline | Service account | Automated |

### 2.4 Backup Requirements

- [x] Database backup completed before deployment
- [x] Application backup (previous version artifact saved)
- [x] Configuration backup

---

## 3. Pre-Deployment Checklist

| # | Item | Responsible | Status |
|---|------|-------------|--------|
| 1 | Code merged to release branch | Developer | ☐ |
| 2 | All unit tests passed | Developer | ☐ |
| 3 | All integration tests passed | QA | ☐ |
| 4 | SIT/UAT sign-off obtained | QA + BA | ☐ |
| 5 | Database backup completed | DBA | ☐ |
| 6 | Configuration files prepared | DevOps | ☐ |
| 7 | Feature flags configured | Developer | ☐ |
| 8 | Monitoring/alerting configured | DevOps | ☐ |
| 9 | Rollback plan reviewed | Team | ☐ |
| 10 | Deployment window confirmed | PM | ☐ |

---

## 4. Database Migration

### 4.1 Migration Scripts

| Order | Script | Description | Estimated Time |
|-------|--------|-------------|----------------|
| 1 | V1__create_pipeline_status.sql | Create pipeline_status table | 30s |
| 2 | V1__create_brd_document.sql | Create brd_document table | 20s |
| 3 | V1__create_diagram_artifact.sql | Create diagram_artifact table | 20s |

### 4.2 Execution Steps

```bash
# Step 1: Backup database
sqlite3 sa4e.db ".backup sa4e_backup_$(date +%Y%m%d).db"

# Step 2: Run migration
sqlite3 sa4e.db < V1__create_pipeline_status.sql
sqlite3 sa4e.db < V1__create_brd_document.sql
sqlite3 sa4e.db < V1__create_diagram_artifact.sql

# Step 3: Verify migration
sqlite3 sa4e.db "SELECT name FROM sqlite_master WHERE type='table';"
```

### 4.3 Verification Queries

```sql
-- Verify tables created
SELECT name FROM sqlite_master WHERE type='table' AND name IN ('pipeline_status','brd_document','diagram_artifact');

-- Verify data integrity
SELECT COUNT(*) FROM pipeline_status;
```

### 4.4 Rollback Scripts

```sql
-- Rollback migration
DROP TABLE IF EXISTS diagram_artifact;
DROP TABLE IF EXISTS brd_document;
DROP TABLE IF EXISTS pipeline_status;
```

---

## 5. Application Deployment

### 5.1 Deployment Flow

![Deployment Flow](diagrams/deployment-flow.png)

### 5.2 Deployment Steps

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Stop existing service | `docker stop sa4e-backend` | Container stopped |
| 2 | Deploy new artifact | `docker build -t sa4e/backend:1.0 .` | Image built |
| 3 | Update configuration | `docker run -e JIRA_URL=...` | Env vars set |
| 4 | Start service | `docker-compose up -d backend` | Container running |
| 5 | Health check | `curl http://localhost:48721/health` | 200 OK |

### 5.3 Docker Deployment

```bash
# Pull new image
docker pull registry/sa4e/backend:1.0

# Stop existing container
docker stop sa4e-backend

# Start new container
docker run -d --name sa4e-backend \
  -p 48721:48721 \
  -e NODE_ENV=production \
  -e PORT=48721 \
  registry/sa4e/backend:1.0

# Verify
docker logs sa4e-backend --tail 50
```

---

## 6. Configuration Changes

### 6.1 New Environment Variables

| Variable | Description | DEV | SIT | UAT | PROD |
|----------|-------------|-----|-----|-----|------|
| JIRA_URL | Jira instance URL | dev.jira | sit.jira | uat.jira | PLACEHOLDER |
| DRAWIO_PATH | Draw.io CLI path | C:\Program Files\draw.io\draw.io.exe | same | same | same |
| statusFilePath | STATUS.json path | ../documents/SA4E-190/STATUS.json | same | same | same |

### 6.2 Application Properties Changes

| Property | Old Value | New Value | File |
|----------|-----------|-----------|------|
| autonomyLevel | N/A | L3 | STATUS.json |
| currentPhase | N/A | requirements | STATUS.json |

### 6.3 Feature Flags

| Flag | DEV | SIT | UAT | PROD |
|------|-----|-----|-----|------|
| autonomyL3 | true | true | true | false — enable after verification |

---

## 7. Post-Deployment Verification

### 7.1 Health Checks

| Check | Endpoint/Command | Expected Result | Timeout |
|-------|-----------------|-----------------|---------|
| Application health | `GET http://localhost:48721/health` | 200 OK | 30s |
| Database connectivity | `sqlite3 sa4e.db "SELECT 1"` | 1 | 10s |

### 7.2 Smoke Tests

| # | Scenario | Steps | Expected Result |
|---|----------|-------|-----------------|
| 1 | Reset pipeline L3 | POST /pipeline/reset with ticket SA4E-190 | STATUS.json updated, completedAt set |
| 2 | Generate BRD | POST /brd/generate with ticketKey SA4E-190 | BRD.md created at documents/SA4E-190/BRD.md |

### 7.3 Log Verification

| Log Entry | Level | Expected | Location |
|-----------|-------|----------|----------|
| Application started | INFO | Within 60s of start | docker logs |
| Feature initialized | INFO | After startup | docker logs |

### 7.4 Monitoring Dashboard

- [ ] Application metrics visible in dashboard
- [ ] Error rate within normal range
- [ ] Response time within SLA
- [ ] No unexpected alerts triggered

---

## 8. Rollback Plan

### 8.1 Rollback Flow

![Rollback Flow](diagrams/rollback-flow.png)

### 8.2 Rollback Decision Criteria

| Condition | Action |
|-----------|--------|
| Critical defect found in production | Immediate rollback |
| Performance degradation > 50% | Immediate rollback |
| Data integrity issue | Immediate rollback + DBA investigation |
| Minor UI issue | Hotfix — no rollback |

### 8.3 Rollback Steps

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Stop new version | `docker stop sa4e-backend` | Container stopped |
| 2 | Rollback database | `sqlite3 sa4e.db < rollback.sql` | Tables dropped |
| 3 | Deploy previous version | `docker run sa4e/backend:0.9` | Old image running |
| 4 | Restore configuration | `git checkout HEAD~1 documents/SA4E-190/STATUS.json` | Config restored |
| 5 | Verify rollback | `curl http://localhost:48721/health` | 200 OK |

### 8.4 Rollback Time Estimate

| Action | Estimated Time |
|--------|---------------|
| Database rollback | 5 minutes |
| Application rollback | 5 minutes |
| Verification | 5 minutes |
| **Total** | **15 minutes** |

---

## 9. Environment-Specific Notes

### 9.1 DEV

Local development. No approval required. Automatic deploy on commit.

### 9.2 SIT

Integration testing. Requires QA sign-off after smoke tests.

### 9.3 UAT

User acceptance. Business stakeholder approval required.

### 9.4 PROD

- **Deployment Window:** Sat 22:00 - 02:00
- **Approval Required From:** PM + Business Owner
- **Communication Plan:** Notify stakeholders 24h before
- **On-Call Contact:** DevOps Lead

---

## 10. Appendix

### Contacts

| Role | Name | Contact |
|------|------|---------|
| DevOps Lead | DevOps Agent | devops@company.com |
| DBA | DBA Team | dba@company.com |
| On-Call Dev | Dev Team | dev@company.com |

### Related Tickets

| Ticket | Summary | Relationship |
|--------|---------|-------------|
| SA4E-190 | Autonomy L3 Pipeline Automation | Main ticket |
