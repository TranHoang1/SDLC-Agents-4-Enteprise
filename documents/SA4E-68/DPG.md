# Deployment Guide (DPG)

## SDLC Agents 4 Enterprise — SA4E-68: Quality & Verification Tools for Pega Parser

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-68 |
| Title | Quality & Verification — Golden Dataset, Round-Trip Validator, Mutation Tester, Schema Inference, Understanding Service, Artifact Analyzer |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2026-07-27 |
| Status | Draft |
| Related TDD | TDD.md |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-27 | DevOps Agent | Initiate document — quality & verification deployment configuration |

---

## 1. Overview

### 1.1 Feature Summary

This deployment covers the Quality & Verification tools for the Pega Parser. All components are backend-only (Node.js TypeScript). Quality tools operate on in-memory JSON — no external dependencies. Schema KB persistence uses the existing `knowledge_entries` table with type `PEGA_SCHEMA`. No new database tables required.

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| Pega Module — quality/ | New | 3 files: PegaGoldenDataset.ts, PegaRoundTripValidator.ts, PegaMutationTester.ts |
| Pega Module — inference/ | New | 4 files: PegaSchemaInferrer.ts, PegaFieldDocumentor.ts, PegaSchemaKBService.ts, PegaSchemaAutoLearner.ts |
| Pega Module — understanding/ | New | 1 file: PegaRuleUnderstandingService.ts |
| Engine Tools — artifact-analyzer/ | New | 8 files: types.ts, detector.ts, ArtifactAnalyzerRegistry.ts, index.ts + 4 analyzers |
| Engine Tools — register-tools.ts | Modified | New analyze_artifact MCP tool registration |
| Database | Minor | knowledge_entries gains PEGA_SCHEMA type entries (no schema migration) |

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
| Node.js 18+ | Required | In-memory quality tools — no special infra |
| Better-SQLite3 | Required | Existing — used for KB schema persistence |

### 2.2 Software Dependencies

| Dependency | Version | Status |
|-----------|---------|--------|
| Node.js | 18+ | Required |
| Hono | 4.x | Already in project |
| vitest | Latest | Already in devDependencies |
| pino | Latest | Already in project (logger) |

### 2.3 Backup Requirements

- [ ] Database backup (Better-SQLite3 file) completed before deployment
- [ ] Previous backend build artifact saved

---

## 3. Pre-Deployment Checklist

| # | Item | Responsible | Status |
|---|------|-------------|--------|
| 1 | Code merged to release branch | Developer | ☐ |
| 2 | All 108 quality + inference tests passed | Developer | ☐ |
| 3 | TypeScript compilation clean (`npx tsc --noEmit`) | Developer | ☐ |
| 4 | Lint check passed | Developer | ☐ |

---

## 4. Database Migration

No schema migration required. Quality tools use in-memory JSON only. Schema inference uses the existing `knowledge_entries` table with new `PEGA_SCHEMA` type entries. The existing Better-SQLite3 database continues to serve all existing modules.

---

## 5. Application Deployment

### 5.1 Deployment Steps

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Build backend | `npm run build` in `backend/` | Build completes without errors |
| 2 | Run unit tests | `npx vitest run` in `backend/` | All 108+ tests pass |
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

| Variable | Description | DEV | SIT | UAT | PROD |
|----------|-------------|-----|-----|-----|------|
| PEGA_KB_AUTO_LEARN | Auto-learn unknown schemas on parse | true | true | true | true |
| PEGA_SCHEMA_LOAD_ON_STARTUP | Load persisted schemas from KB | true | true | true | true |

### 6.2 Feature Flags

| Flag | DEV | SIT | UAT | PROD |
|------|-----|-----|-----|------|
| pega.quality.goldenDataset | true | true | true | true |
| pega.quality.roundTrip | true | true | true | true |
| pega.quality.mutationTest | true | true | true | true |
| pega.inference.schemaInferrer | true | true | true | true |
| pega.inference.fieldDocumentor | true | true | true | true |
| pega.inference.kbPersistence | true | true | true | true |
| pega.understanding.service | true | true | true | true |
| pega.artifactAnalyzer | true | true | true | true |

---

## 7. Post-Deployment Verification

### 7.1 Health Checks

| Check | Endpoint/Command | Expected Result | Timeout |
|-------|-----------------|-----------------|---------|
| Application health | GET /api/pega/health | 200 OK, status: UP | 30s |

### 7.2 Smoke Tests

| # | Scenario | Steps | Expected Result |
|---|----------|-------|-----------------|
| 1 | Round-trip validation | POST /api/mcp with analyze_artifact, content = Activity JSON | 200 OK, analysis with type pega_rule |
| 2 | Artifact analysis (code) | POST /api/mcp with analyze_artifact, content = TypeScript snippet | 200 OK, analysis with type code, language detected |
| 3 | Artifact analysis (JSON) | POST /api/mcp with analyze_artifact, content = JSON object | 200 OK, analysis with type structured_data |
| 4 | Artifact analysis (unknown) | POST /api/mcp with analyze_artifact, content = plain text | 200 OK, analysis with type unknown |

### 7.3 Log Verification

| Log Entry | Level | Expected | Location |
|-----------|-------|----------|----------|
| Pega schemas loaded from KB | INFO | count > 0 | Application log |
| analyze_artifact tool registered | INFO | Tool name | Application log |

---

## 8. Rollback Plan

### 8.1 Rollback Decision Criteria

| Condition | Action |
|-----------|--------|
| Quality tools produce incorrect verification results | Immediate rollback |
| Schema inference corrupts KB data | Immediate rollback |
| Artifact analyzer causes crashes | Immediate rollback |
| Minor field documentation gaps | Hotfix — no rollback |

### 8.2 Rollback Steps

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Disable feature flags | Set all pega.quality.*, pega.inference.* flags to false | Feature endpoints return 404 |
| 2 | Deploy previous build | Restore previous backend artifact | Health check passes |
| 3 | Verify existing features | Run existing indexing tests | Pipeline completes |

### 8.3 Rollback Time Estimate

| Action | Estimated Time |
|--------|---------------|
| Feature flag disable | 1 minute |
| Application rollback | 5 minutes |
| Verification | 10 minutes |
| **Total** | **16 minutes** |
