# Release Notes (RLN)

## SDLC Agents 4 Enterprise — SA4E-190: Autonomy L3 Pipeline Automation for SDLC Agents 4 Enterprise

---

## Release Information

| Field | Value |
|-------|-------|
| Release Version | 1.0 |
| Release Date | 2026-08-23 |
| Jira Ticket | SA4E-190 |
| Environment | DEV / SIT / UAT / PROD |
| Author | DevOps Agent |
| Status | Draft |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-23 | DevOps Agent | Initiate document |

---

## 1. What's New

### 1.1 Feature Summary

Autonomy L3 Pipeline Automation enables human-in-the-loop requirements phase automation for SDLC Agents 4 Enterprise. The release introduces pipeline reset with autonomy level L3, automated BRD generation from Jira tickets, Draw.io diagram creation and PNG export, STATUS.json tracking with completedAt timestamps, and Knowledge Base ingestion for cross-agent artifact access.

### 1.2 User-Facing Changes

| # | Change | Description | Impact |
|---|--------|-------------|--------|
| 1 | Pipeline Reset UI | Product Manager can trigger pipeline reset to requirements with L3 | High |
| 2 | BRD Auto Generation | Business Analyst can generate BRD.md from ticket | High |
| 3 | Diagram Export | Diagrams exported as .drawio and .png automatically | Medium |
| 4 | Status Tracking | STATUS.json updated with completedAt for audit trail | Medium |

### 1.3 Screenshots

N/A - Backend service only

---

## 2. Technical Changes

### 2.1 API Changes

| Type | Endpoint | Method | Description |
|------|----------|--------|-------------|
| New | /pipeline/reset | POST | Reset pipeline to phase and autonomy level |
| New | /brd/generate | POST | Generate BRD from ticket key |

### 2.2 Database Changes

| Type | Object | Description |
|------|--------|-------------|
| New Table | pipeline_status | Stores ticket, autonomyLevel, currentPhase, completedAt |
| New Table | brd_document | Tracks BRD generation artifacts |
| New Table | diagram_artifact | Tracks diagram .drawio and .png paths |

### 2.3 Configuration Changes

| Property | Change Type | Description |
|----------|-----------|-------------|
| JIRA_URL | New | Jira instance URL |
| DRAWIO_PATH | New | Path to Draw.io CLI |
| statusFilePath | New | Path to STATUS.json |

### 2.4 Infrastructure Changes

| Component | Change | Description |
|-----------|--------|-------------|
| Backend Container | Modified | Node.js 20 + Hono, exposed port 48721 |
| SQLite DB | New | File-based persistence for pipeline metadata |

---

## 3. Bug Fixes

No bug fixes included in this release.

---

## 4. Known Issues & Limitations

| # | Issue | Impact | Workaround | Target Fix |
|---|-------|--------|------------|------------|
| 1 | Manual Draw.io CLI required on Windows host | Deployment limited to Windows with Draw.io installed | Install Draw.io CLI at specified path | v1.1 |

> If no known issues, state: "No known issues at the time of release."

---

## 5. Dependencies

### 5.1 Pre-requisite Releases

| Release | Version | Status | Required Before |
|---------|---------|--------|-----------------|
| Base Backend | 1.0 | Deployed | This release |

### 5.2 External System Changes

| System | Change Required | Status | Contact |
|--------|----------------|--------|---------|
| Jira | API access token | Done | Jira Admin |
| Knowledge Base | mem_ingest API available | Done | DevOps |

---

## 6. Migration Notes

### 6.1 Data Migration

| Migration | Description | Automated | Estimated Time |
|-----------|-------------|-----------|----------------|
| Create pipeline_status | Initialize SQLite tables | Yes | 1 min |
| Seed STATUS.json | Update autonomyLevel to L3 | Yes | <10s |

### 6.2 Breaking Changes

No breaking changes in this release. Fully backward compatible.

### 6.3 Backward Compatibility

Fully compatible with existing pipeline. STATUS.json schema extended with completedAt.

---

## 7. Testing Summary

| Test Level | Total | Passed | Failed | Blocked | Pass Rate |
|-----------|-------|--------|--------|---------|-----------|
| Unit Tests | 4 | 4 | 0 | 0 | 100% |
| Integration Tests | 2 | 2 | 0 | 0 | 100% |
| SIT | 0 | 0 | 0 | 0 | N/A |
| UAT | 0 | 0 | 0 | 0 | N/A |

### Defect Summary

| Severity | Found | Fixed | Open | Deferred |
|----------|-------|-------|------|----------|
| Critical | 0 | 0 | 0 | 0 |
| Major | 0 | 0 | 0 | 0 |
| Minor | 0 | 0 | 0 | 0 |

**Overall Verdict:** ✅ PASS — Ready for Release

From TEST-REPORT.md: 8/8 automated tests passed (4 Unit, 2 Integration, 2 E2E) with 100% pass rate and zero defects.

---

## 8. Deployment Instructions

Reference the Deployment Guide for detailed steps.

See: [Deployment Guide](DPG-v1.0-SA4E-190.docx)

### Quick Reference

| Step | Action | Estimated Time |
|------|--------|---------------|
| 1 | Database migration | 1 min |
| 2 | Application deployment | 5 min |
| 3 | Configuration update | 2 min |
| 4 | Verification | 5 min |
| **Total** | | **13 min** |

---

## 9. Rollback Plan

Reference the Deployment Guide for detailed rollback steps.

**Rollback Decision Criteria:**
- Critical defect found in production
- Performance degradation > 50%
- Data integrity issue

**Estimated Rollback Time:** 15 minutes

---

## 10. Contacts

| Role | Name | Contact | Responsibility |
|------|------|---------|---------------|
| Release Manager | DevOps Agent | devops@company.com | Release coordination |
| Dev Lead | SA Agent | sa@company.com | Technical issues |
| QA Lead | QA Agent | qa@company.com | Testing sign-off |
| DevOps | DevOps Agent | devops@company.com | Deployment execution |
| Business Owner | PM | pm@company.com | Business sign-off |

---

## 11. Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Dev Lead | | | ☐ Approved |
| QA Lead | | | ☐ Approved |
| Business Owner | | | ☐ Approved |
| Release Manager | | | ☐ Approved |
