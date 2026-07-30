# Deployment Guide (DPG)

## SDLC Agents 4 Enterprise — SA4E-66: Pega Rule Type Coverage — 7 Parser Modules

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-66 |
| Title | Pega Rule Type Coverage — 7 Parser Modules |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2026-07-27 |
| Status | Draft |
| Related TDD | TDD.md |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-27 | DevOps Agent | Initiate document — 7 parser modules deployment configuration |

---

## 1. Overview

### 1.1 Feature Summary

This deployment covers the Pega Rule Type Coverage expansion — adding 7 new parser modules (Connect, Declare, Access, Portal, Decisioning, Misc, Data+Process) and the MetaModel fallback to the existing Pega parser architecture. All parsing is CPU-bound and in-memory; no database migration required.

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| Parser Module — connect/ | New | 5+ files: ConnectParser, strategies, AST types |
| Parser Module — declare/ | New | 5+ files: DeclareParser, sub-type strategies, AST types |
| Parser Module — access/ | New | 5+ files: AccessParser, sub-type strategies, AST types |
| Parser Module — portal/ | New | 5+ files: PortalParser, sub-type strategies, AST types |
| Parser Module — decisioning/ | New | 5+ files: DecisioningParser, sub-type strategies, AST types |
| Parser Module — misc/ | New | 5+ files: MiscParser, sub-type strategies, AST types |
| Parser Core — ParserRegistry | Modified | Strategy registration and resolution logic |
| Parser Core — MetaModelParserStrategy | New | Fallback generic JSON-to-AST parser |
| Parser Core — BasePegaRuleParser | New | Abstract base class with common utilities |
| Database | No change | All parsing is in-memory |

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
| Node.js 18+ | Required | Parser modules are CPU-bound |
| 1+ CPU core | Required | Parsing is single-threaded per request |
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

---

## 3. Pre-Deployment Checklist

| # | Item | Responsible | Status |
|---|------|-------------|--------|
| 1 | Code merged to release branch | Developer | ☐ |
| 2 | All 495 unit tests passed | Developer | ☐ |
| 3 | Parser registry resolution tests passed | Developer | ☐ |
| 4 | MetaModel fallback tests passed | Developer | ☐ |
| 5 | Edge case tests (empty JSON, missing fields) passed | QA | ☐ |

---

## 4. Database Migration

No database migration required. All parser modules operate in-memory, transforming raw rule JSON into typed ASTs. The existing Better-SQLite3 database continues to serve the indexing pipeline unchanged.

---

## 5. Application Deployment

### 5.1 Deployment Steps

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Build backend | `npm run build` in `backend/` | Build completes without errors |
| 2 | Run unit tests | `npx vitest run` in `backend/` | All 495 tests pass |
| 3 | Start Hono server | `npm run dev` | Server starts on port 48721 |
| 4 | Health check | `curl http://127.0.0.1:48721/api/pega/health` | 200 OK with status |

### 5.2 Docker Deployment (if applicable)

```bash
# Build image
docker build -t sdlc-agents-backend:1.18.0 -f backend/Dockerfile .

# Stop existing container
docker stop sdlc-backend

# Start new container
docker run -d --name sdlc-backend \
  -p 48721:48721 \
  sdlc-agents-backend:1.18.0

# Verify
curl http://127.0.0.1:48721/api/pega/health
```

---

## 6. Configuration Changes

### 6.1 New Environment Variables

No new environment variables required. All parser modules are self-configuring via the ParserRegistry.

### 6.2 Feature Flags

| Flag | DEV | SIT | UAT | PROD |
|------|-----|-----|-----|------|
| pega.parser.connect | true | true | true | true |
| pega.parser.declare | true | true | true | true |
| pega.parser.access | true | true | true | true |
| pega.parser.portal | true | true | true | true |
| pega.parser.decisioning | true | true | true | true |
| pega.parser.misc | true | true | true | true |
| pega.parser.metamodel | true | true | true | true |

---

## 7. Post-Deployment Verification

### 7.1 Health Checks

| Check | Endpoint/Command | Expected Result | Timeout |
|-------|-----------------|-----------------|---------|
| Application health | GET /api/pega/health | 200 OK, status: UP | 30s |
| Parser registry loaded | GET /api/pega/health → parsers | 7 parsers registered | 10s |

### 7.2 Smoke Tests

| # | Scenario | Steps | Expected Result |
|---|----------|-------|-----------------|
| 1 | Parse REST connect rule | Submit REST rule JSON to parser | Typed ConnectRuleAST returned |
| 2 | Parse DeclareExpression rule | Submit expression rule JSON to parser | Typed DeclareExpressionRuleAST returned |
| 3 | Parse AccessGroup rule | Submit access group rule JSON to parser | Typed AccessGroupRuleAST returned |
| 4 | Parse Section rule | Submit section rule JSON to parser | Typed SectionRuleAST returned |
| 5 | Parse Strategy rule | Submit strategy rule JSON to parser | Typed StrategyRuleAST returned |
| 6 | Parse unknown rule type | Submit JSON with unrecognized pxObjClass | GenericMetaModelAST returned |

---

## 8. Rollback Plan

### 8.1 Rollback Decision Criteria

| Condition | Action |
|-----------|--------|
| ParserRegistry fails to resolve known rule types | Immediate rollback |
| MetaModel fallback returns corrupt AST | Immediate rollback |
| Parsing errors for valid rule JSON payloads | Immediate rollback |
| Performance degradation > 50% for existing parse operations | Immediate rollback |

### 8.2 Rollback Steps

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Disable feature flags | Set all pega.parser.* flags to false | Parser endpoints return 404 |
| 2 | Deploy previous build | Restore previous backend artifact | Health check passes |
| 3 | Verify L1-L2 still working | Run existing indexing tests | Pipeline completes |

### 8.3 Rollback Time Estimate

| Action | Estimated Time |
|--------|---------------|
| Feature flag disable | 1 minute |
| Application rollback | 5 minutes |
| Verification | 10 minutes |
| **Total** | **16 minutes** |
