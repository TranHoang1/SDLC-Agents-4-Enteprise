# Deployment Guide (DPG)

## SDLC Agents 4 Enterprise — SA4E-65: Pega MetaModel Engine

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-65 |
| Title | Pega MetaModel Engine — Auto-Schema Loading & Runtime Strategy Compilation |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2026-07-27 |
| Status | Draft |
| Related TDD | TDD.md |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-27 | DevOps Agent | Initiate document — MetaModel Engine deployment configuration |

---

## 1. Overview

### 1.1 Feature Summary

This deployment covers the Pega MetaModel Engine — a runtime schema loading and strategy compilation system. It loads 239+ Pega rule schema JSON files from a directory, resolves inheritance chains, and dynamically compiles IPegaRuleParserStrategy instances at runtime. No database migration required.

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| Pega MetaModel — PegaClassDefinition | New | Type definitions for class/property/child |
| Pega MetaModel — PegaMetaModelLoader | New | Schema scanning, inheritance resolution, property/child merging |
| Pega MetaModel — PegaMetaModelRegistry | New | Singleton registry holding all class definitions |
| Pega MetaModel — PegaMetaModelCompiler | New | Compiles definitions into IPegaRuleParserStrategy with specificity ordering |
| Pega MetaModel — PegaMetaModelService | New | Orchestrator: loads, compiles, registers in one call |
| Test Files | New | 2 test files, 41 total tests |
| Database | No change | All schema processing is file-based |

### 1.3 Target Environments

| Environment | URL | Deploy Order | Approval Required |
|-------------|-----|-------------|-------------------|
| DEV | http://127.0.0.1:48721 | 1st | No |
| SIT | http://127.0.0.1:48721 | 2nd | No |
| UAT | http://127.0.0.1:48721 | 3rd | QA Sign-off |
| PROD | http://127.0.0.1:48721 | 4th | PM + Business Sign-off |

---

## 2. Prerequisites

### 2.1 Infrastructure

| Requirement | Status | Notes |
|-------------|--------|-------|
| Node.js 18+ | Required | ESM modules support |
| No new infrastructure | N/A | Same single-process Hono server |

### 2.2 Software Dependencies

| Dependency | Version | Status |
|-----------|---------|--------|
| Node.js | 18+ | Required |
| Hono | 4.x | Already in project |
| vitest | Latest | Already in devDependencies |

### 2.3 Backup Requirements

- [ ] Previous backend build artifact saved
- [ ] Environment configuration backed up
- [ ] Schema directory backed up (if custom schemas added)

---

## 3. Pre-Deployment Checklist

| # | Item | Responsible | Status |
|---|------|-------------|--------|
| 1 | Code merged to release branch | Developer | ☐ |
| 2 | All 41 unit tests passed | Developer | ☐ |
| 3 | 239+ schema files present in schemas/ directory | Developer | ☐ |
| 4 | Schema directory path configured correctly | DevOps | ☐ |

---

## 4. Database Migration

No database migration required. All MetaModel Engine processing is file-based. The existing Better-SQLite3 database continues to serve the indexing pipeline unchanged.

---

## 5. Application Deployment

### 5.1 Deployment Steps

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Build backend | `npm run build` in `backend/` | Build completes without errors |
| 2 | Run unit tests | `npx vitest run` in `backend/` | All 41 tests pass |
| 3 | Verify schema directory | Check `backend/src/modules/pega/schemas/` exists with 239+ files | Directory populated |
| 4 | Start Hono server | `npm run dev` | Server starts on port 48721 |
| 5 | Health check | `curl http://127.0.0.1:48721/api/health` | 200 OK with status |

### 5.2 Docker Deployment (if applicable)

```bash
# Build image
docker build -t sdlc-agents-backend:1.18.0 -f backend/Dockerfile .

# Stop existing container
docker stop sdlc-backend

# Start new container
docker run -d --name sdlc-backend \
  -p 48721:48721 \
  -e PEGA_SCHEMA_DIR=/app/backend/src/modules/pega/schemas \
  sdlc-agents-backend:1.18.0

# Verify
curl http://127.0.0.1:48721/api/health
```

---

## 6. Configuration Changes

### 6.1 New Environment Variables

| Variable | Description | DEV | SIT | UAT | PROD |
|----------|-------------|-----|-----|-----|------|
| PEGA_SCHEMA_DIR | Path to schema JSON files | default (./schemas) | default | default | default |

### 6.2 Feature Flags

| Flag | DEV | SIT | UAT | PROD |
|------|-----|-----|-----|------|
| pega.metamodel.enabled | true | true | true | true |
| pega.metamodel.hotReload | true | true | false | false |

---

## 7. Post-Deployment Verification

### 7.1 Health Checks

| Check | Endpoint/Command | Expected Result | Timeout |
|-------|-----------------|-----------------|---------|
| Application health | GET /api/health | 200 OK, status: UP | 30s |

### 7.2 Smoke Tests

| # | Scenario | Steps | Expected Result |
|---|----------|-------|-----------------|
| 1 | MetaModel initialization | Trigger app startup, check logs for schema loading | "Loaded 239+ schemas" in logs |
| 2 | Strategy compilation | Check logs for compilation | "Compiled 175+ strategies" in logs |
| 3 | API parse | POST /api/pega/parse with sample Activity JSON | 200 OK, symbol returned |

### 7.3 Log Verification

| Log Entry | Level | Expected | Location |
|-----------|-------|----------|----------|
| MetaModel initialization started | INFO | After startup | Application log |
| Schema loading completed | INFO | N schemas loaded | Application log |
| Strategies compiled | INFO | N strategies generated | Application log |

---

## 8. Rollback Plan

### 8.1 Rollback Decision Criteria

| Condition | Action |
|-----------|--------|
| Schema loading fails for required classes | Immediate rollback |
| Strategy compilation produces incorrect matching | Immediate rollback |
| Inheritance resolution produces wrong merged properties | Immediate rollback |
| Feature flag disable | 1 minute |
| Application rollback | 5 minutes |
| Verification | 10 minutes |
| **Total** | **16 minutes** |

### 8.2 Rollback Steps

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Disable feature flags | Set pega.metamodel.enabled to false | Feature returns 404 |
| 2 | Deploy previous build | Restore previous backend artifact | Health check passes |
| 3 | Verify existing parsing still working | Run existing tests | Tests pass |

### 8.3 Rollback Time Estimate

| Action | Estimated Time |
|--------|---------------|
| Feature flag disable | 1 minute |
| Application rollback | 5 minutes |
| Verification | 10 minutes |
| **Total** | **16 minutes** |

---

## 9. Performance Considerations

| Operation | CPU Impact | Notes |
|-----------|------------|-------|
| Schema loading | Moderate | One-time at startup (~500ms for 239 files) |
| Inheritance resolution | Low | Recursive merge, cached per class |
| Strategy compilation | Low | In-memory, one-time at startup |

---

## 10. Appendix

### Contacts

| Role | Name | Contact |
|------|------|---------|
| DevOps Lead | DevOps Agent | Project channel |
| On-Call Dev | DEV Agent | Project channel |

### Related Tickets

| Ticket | Summary | Relationship |
|--------|---------|-------------|
| SA4E-65 | Pega MetaModel Engine | Main ticket |
