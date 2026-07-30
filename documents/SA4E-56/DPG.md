# Deployment Guide (DPG)

## Code Intelligence MCP Server — SA4E-56: Unified Code & Pega Rule Indexing Pipeline

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-56 |
| Title | Unified Code & Pega Rule Indexing Pipeline |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2026-07-26 |
| Status | Draft |
| Related TDD | TDD-v1-SA4E-56.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-26 | DevOps Agent | Initiate document — auto-generated from TDD and project context |

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

The **Unified Code & Pega Rule Indexing Pipeline** (SA4E-56) extends the Code Intelligence MCP Server with a unified indexing endpoint (`POST /api/index/source`) that handles all file types including Pega rule files (`.pega`). Key capabilities include:

- **Unified Indexing API**: Single endpoint for source code and Pega rules with version-aware deduplication via SHA-256 content hashes
- **Dependency Resolution Engine**: Automatic cross-file import/reference resolution for TypeScript/JavaScript, Java, Python, and Pega rules
- **Pega Rule Parser**: 20+ specialized AST builders for different Pega rule types (Activity, DataTransform, Flow, When, Decision, etc.)
- **Pega Platform Integration**: VS Code extension settings panel for Pega connection configuration, credential management via SecretStorage, BFS-based rule crawling
- **Login UX Improvement**: Auth remembers last username

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| Backend — POST /api/index/source | Modified | Extended to accept `.pega` files, gitHash/checksum dedup, dependency resolution |
| Backend — DependencyResolver | New | Module resolving imports for TS/JS, Java, Python, Pega to FileDependency objects |
| Backend — PegaFileParser | New | ILanguageParser implementation for `.pega` files with 20+ rule type builders |
| Backend — PegaRuleAstParser | New | Specialized AST builders for Pega rule types |
| Backend — Pega API Routes | New | `/api/v1/pega/*` endpoints for crawl-plan, crawl-batch, check-rule, ingest-rule |
| Extension — PegaHttpClient | New | REST client for Pega Platform communication |
| Extension — SettingsPanel | Modified | Added Pega Platform Connection section |
| Extension — IndexingService | Modified | Added Pega project detection and BFS crawl orchestration |
| Extension — AuthManager | Modified | Persists last username |
| Database | None | No schema migration required — existing `files`, `symbols`, `relationships` tables support new data |

### 1.3 Target Environments

| Environment | URL | Deploy Order | Approval Required |
|-------------|-----|-------------|-------------------|
| DEV | http://localhost:48721 | 1st | No |
| SIT | http://sit-server:48721 | 2nd | No |
| UAT | http://uat-server:48721 | 3rd | QA Sign-off |
| PROD | https://prod-server:48721 | 4th | PM + Business Sign-off |

---

## 2. Prerequisites

### 2.1 Infrastructure

| Requirement | Status | Notes |
|-------------|--------|-------|
| Node.js runtime >= 18.x | Required | Both backend and extension build require Node.js 18+ |
| Backend server (VM or container) | Required | Runs Hono HTTP server on port 48721 |
| PostgreSQL 15+ or Better-SQLite3 | Required | Database for indexed files, symbols, relationships |
| Pega Platform (optional) | Optional | Required only for Pega rule crawling features |
| VS Code (for extension) | Required | Extension runs inside VS Code ≥ 1.85.0 |
| OS Keychain (for credentials) | Required | SecretStorage requires OS-level keychain |

### 2.2 Software Dependencies

| Dependency | Version | Status |
|-----------|---------|--------|
| Node.js | >= 18.14.1 | Required |
| npm | >= 9.x | Required |
| PostgreSQL | >= 15 | Recommended (SQLite also supported) |
| VS Code | >= 1.85.0 | Required (for extension) |
| tree-sitter WASM grammars | Latest | Loaded at runtime |

### 2.3 Access Requirements

| Access | Type | Who Needs It |
|--------|------|-------------|
| Backend server SSH/container | Key-based | DevOps team |
| Database admin | Credentials | DBA |
| Pega Platform (if used) | Basic Auth credentials | Developer (configured via extension settings) |
| npm registry | Read | Build pipeline |
| GitHub releases | Read | VSIX download/install |

### 2.4 Backup Requirements

- [ ] Database backup completed before deployment
- [ ] Previous .vsix extension artifact saved (at `extension/sdlc-agents-4-enterprise-{prev}.vsix`)
- [ ] Backend `dist/` directory or Docker image tagged with previous version
- [ ] Configuration backup (`.env`, `settings.json`, `grammar-config.json`)

---

## 3. Pre-Deployment Checklist

| # | Item | Responsible | Status |
|---|------|-------------|--------|
| 1 | Code merged to release branch (`main`) | Developer | ☐ |
| 2 | All unit tests passed (`npm test`) | Developer | ☐ |
| 3 | All integration tests passed | QA | ☐ |
| 4 | SIT/UAT sign-off obtained | QA + BA | ☐ |
| 5 | Database backup completed | DBA | ☐ |
| 6 | Configuration files prepared (`.env`, `grammar-config.json`) | DevOps | ☐ |
| 7 | Feature flags configured (`pega.enabled`, etc.) | Developer | ☐ |
| 8 | Monitoring/alerting configured | DevOps | ☐ |
| 9 | Rollback plan reviewed | Team | ☐ |
| 10 | Deployment window confirmed | PM | ☐ |
| 11 | Pega Platform endpoint accessible (if Pega features used) | DevOps | ☐ |
| 12 | tree-sitter WASM grammars bundled or accessible at runtime | DevOps | ☐ |

---

## 4. Database Migration

### 4.1 Migration Scripts

**No database migration is required.** The existing `files`, `symbols`, and `relationships` tables already support the new `.pega` file type through:

- `content_hash` column for dedup checks
- `kind` field (`'pega-rule'` as a new SymbolKind value)
- `language` field (`'pega'` as a new language value)
- `kind` field in relationships (`'references'` as a new RelationshipKind value)

### 4.2 Verification Queries

```sql
-- Verify files table can store .pega entries
SELECT language, COUNT(*) FROM files WHERE language = 'pega' GROUP BY language;

-- Verify pega-rule symbols
SELECT kind, COUNT(*) FROM symbols WHERE kind = 'pega-rule' GROUP BY kind;

-- Verify reference relationships
SELECT kind, COUNT(*) FROM relationships WHERE kind = 'references' GROUP BY kind;
```

### 4.3 Rollback Scripts

No rollback needed for database — no schema changes were made.

---

## 5. Application Deployment

### 5.1 Deployment Flow

![Deployment Flow](diagrams/deployment-flow.png)
*[Edit in draw.io](diagrams/deployment-flow.drawio)*

### 5.2 Building the Artifacts

#### Backend Build

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm ci

# Build TypeScript to dist/
npm run build

# Verify build
ls dist/index.js
```

#### Extension Build (VSIX)

```bash
# Navigate to extension directory
cd extension

# Install dependencies
npm ci

# Build production VSIX
npm run package:prod

# Verify artifact
ls sdlc-agents-4-enterprise-1.16.0.vsix
```

The VSIX artifact is approximately 4.45 MB (858 files) at:
`extension/sdlc-agents-4-enterprise-1.16.0.vsix`

### 5.3 Backend Deployment Steps

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Pull latest code | `git pull origin main` | Branch is up-to-date |
| 2 | Install dependencies | `npm ci` | No errors |
| 3 | Build TypeScript | `npm run build` | `dist/index.js` exists |
| 4 | Configure environment | Copy `.env.example` to `.env`, update values | Config values verified |
| 5 | Start backend (dev) | `npm run dev` | Server starts on port 48721 |
| 6 | Start backend (prod) | `node dist/index.js` | Server starts on port 48721 |
| 7 | Health check | `curl http://localhost:48721/health` | Returns 200 with `status: "healthy"` |

#### Docker Deployment

```bash
# Build Docker image
docker build -t sa4e-backend:1.16.0 -f backend/Dockerfile backend/

# Run with Docker Compose
cd backend
docker-compose up -d

# Verify
docker logs sa4e-backend --tail 20
curl http://localhost:48721/health
```

### 5.4 Extension Deployment Steps

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Build VSIX | `cd extension && npm run package:prod` | `sdlc-agents-4-enterprise-1.16.0.vsix` created |
| 2 | Install in VS Code | `code --install-extension sdlc-agents-4-enterprise-1.16.0.vsix` | Installed successfully |
| 3 | Or install via VS Code UI | Extensions → ⋮ → Install from VSIX... | Extension appears in installed list |
| 4 | Verify activation | Open VS Code, run "SDLC Agents: Show Status" | Extension activates without errors |
| 5 | Verify new settings | Open Settings → SDLC Agents 4 Enterprise | `kiroSdlc.pegaEndpoint` and `kiroSdlc.pegaUsername` visible |

### 5.5 Configuration Update in Extension

After installing the new VSIX, configure Pega Platform settings:

1. Open VS Code
2. Run `SDLC Agents: Settings` command
3. In the Settings panel, navigate to **Pega Platform Connection** section
4. Enter Pega Endpoint URL (e.g., `http://pega-server:8080/prweb`)
5. Enter Pega Operator Username
6. Enter Pega Password (stored in OS keychain via SecretStorage)
7. Click **Test Connection** to verify
8. Click **Fetch Context** to populate Pega project metadata

---

## 6. Configuration Changes

### 6.1 New Environment Variables

| Variable | Description | DEV | SIT | UAT | PROD |
|----------|-------------|-----|-----|-----|------|
| `pega.enabled` | Enable/disable Pega crawling | `true` | `true` | `true` | `true` |
| `pega.crawl.maxIterations` | Max BFS crawl iterations | `1000` | `1000` | `1000` | `1000` |
| `indexer.maxFileSize` | Max file size for tree-sitter parsing (bytes) | `1048576` | `1048576` | `1048576` | `1048576` |

### 6.2 Extension Settings Changes

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `kiroSdlc.pegaEndpoint` | string | `http://localhost:8080/prweb` | Pega Platform REST API Endpoint URL |
| `kiroSdlc.pegaUsername` | string | `""` | Pega Operator ID (Username) |

**Note:** Pega password is NOT stored in settings. It is stored in VS Code SecretStorage (OS keychain) via `secrets.store(SECRET_KEYS.pega)`.

### 6.3 Feature Flags

| Flag | DEV | SIT | UAT | PROD |
|------|-----|-----|-----|------|
| `pega.enabled` | true | true | true | true |
| `pega.crawl.maxIterations` | 1000 | 1000 | 1000 | 1000 |
| `indexer.maxFileSize` | 1048576 | 1048576 | 1048576 | 1048576 |

### 6.4 Environment-Specific Configuration

| Property | DEV | SIT | UAT | PROD |
|----------|-----|-----|-----|------|
| `config.projectId` | `dev-project` | `sit-project` | `uat-project` | `prod-project` |
| `config.workspace` | `./workspaces/dev` | `./workspaces/sit` | `./workspaces/uat` | `./workspaces/prod` |
| `kiroSdlc.pegaEndpoint` | `http://localhost:8080/prweb` | `http://pega-sit:8080/prweb` | `http://pega-uat:8080/prweb` | `https://pega-prod:443/prweb` |
| `kiroSdlc.pegaUsername` | `dev@jira` | `sit@jira` | `uat@jira` | `PROD_PLACEHOLDER` |

---

## 7. Post-Deployment Verification

### 7.1 Health Checks

| Check | Endpoint/Command | Expected Result | Timeout |
|-------|-----------------|-----------------|---------|
| Backend health | `GET /health` | `200 OK`, `status: "healthy"`, `version: "1.16.0"` | 10s |
| Pega API routes | `POST /api/v1/pega/detect-project` (empty body) | Non-404 response (400 if body missing is acceptable) | 10s |
| Backend process | `docker ps` or `ps aux | grep "node dist/index"` | Process running on port 48721 | 5s |

### 7.2 Smoke Tests

| # | Scenario | Steps | Expected Result |
|---|----------|-------|-----------------|
| 1 | Index a TypeScript file | `POST /api/index/source` with `{ files: [{ path: "test.ts", content: "const x = 1;" }] }` + Bearer token | `written: 1, skipped: 0, rejected: []` |
| 2 | Index a .pega file | `POST /api/index/source` with valid `.pega` JSON content | `written: 1`, symbol kind = `pega-rule` |
| 3 | Dedup check | Same file with same gitHash sent twice | Second call returns `skipped: 1` |
| 4 | Path traversal rejected | Send file with path `../../etc/passwd` | `rejected: ["../../etc/passwd"]` |
| 5 | Unauthenticated request | POST to `/api/index/source` without Authorization header | HTTP 401 |
| 6 | Extension settings panel | Open VS Code → SDLC Agents: Settings | Pega Platform Connection section visible |
| 7 | Extension test Pega connection | Configure valid Pega endpoint + credentials, click "Test Connection" (if Pega available) | "Connected as {operatorId}" or appropriate error |

### 7.3 Log Verification

| Log Entry | Level | Expected | Location |
|-----------|-------|----------|----------|
| Index API call received | INFO | After first POST /api/index/source | Backend stdout |
| File written to workspace | DEBUG | For each file indexed | Backend stdout |
| File skipped (dedup) | DEBUG | For matched content hash | Backend stdout |
| Pega crawl summary | INFO | After Pega project crawl (if Pega enabled) | Backend stdout |
| Grammar registered | INFO | At startup for each language | Backend stdout |

### 7.4 Monitoring Dashboard

- [ ] Backend health endpoint returns 200
- [ ] Application metrics visible in dashboard (file count, symbol count)
- [ ] Error rate within normal range
- [ ] No unexpected 4xx/5xx errors in logs
- [ ] Extension activates without errors

---

## 8. Rollback Plan

### 8.1 Rollback Flow

![Rollback Flow](diagrams/rollback-flow.png)
*[Edit in draw.io](diagrams/rollback-flow.drawio)*

### 8.2 Rollback Decision Criteria

| Condition | Action |
|-----------|--------|
| POST /api/index/source returns 500 errors | Immediate rollback |
| Health check fails after deploy | Immediate rollback |
| File indexing produces incorrect symbols/relationships | Immediate rollback |
| Pega crawl fails with authentication errors | Investigate — may be Pega config issue |
| Extension fails to activate after VSIX install | Immediate rollback |
| Path safety check fails to reject traversal attempts | Critical — Immediate rollback |
| Performance degradation > 50% on indexing | Immediate rollback |
| Minor UI issue in settings panel | Hotfix — no rollback |

### 8.3 Rollback Steps

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Stop backend service | `docker stop sa4e-backend` or kill node process | Process no longer running |
| 2 | Revert backend code | `git revert HEAD~1` or checkout previous tag | Code reverted |
| 3 | Rebuild backend (if reverted) | `npm ci && npm run build` | Build succeeds |
| 4 | Start previous backend version | `npm run dev` or `docker-compose up -d` | Server starts on port 48721 |
| 5 | Install previous extension VSIX | `code --install-extension sdlc-agents-4-enterprise-{prev}.vsix --force` | Old extension active |
| 6 | Restore configuration | Revert `.env`, `grammar-config.json` to previous versions | Config matches previous version |
| 7 | Verify rollback | `curl http://localhost:48721/health` | Returns 200 |

### 8.4 Database Rollback

**No database rollback required.** No schema changes were introduced in this release.

### 8.5 Previous Artifacts

| Artifact | Location |
|----------|----------|
| Previous backend Docker image | `sa4e-backend:{prev-version}` (tagged locally or in registry) |
| Previous extension VSIX | `extension/sdlc-agents-4-enterprise-1.14.0.vsix` (or latest stable) |
| Previous configuration | Git history or backup copies |

### 8.6 Rollback Time Estimate

| Action | Estimated Time |
|--------|---------------|
| Stop backend service | < 1 min |
| Revert code + rebuild | < 5 min |
| Start previous version | < 2 min |
| Reinstall extension | < 2 min |
| Restore config | < 1 min |
| Verification | < 3 min |
| **Total** | **< 15 min** |

---

## 9. Environment-Specific Notes

### 9.1 DEV

- Backend runs via `npm run dev` with hot reload (tsx watch)
- Database: Better-SQLite3 (local) or PostgreSQL (Docker)
- Extension installed from local VSIX build
- Pega Platform: Not required; Pega features can be tested with mock data
- Health check: `GET http://localhost:48721/health`

### 9.2 SIT

- Backend runs via `docker-compose up -d` with PostgreSQL
- Database connection string: `postgresql://sa4e_user:sa4e_local_dev_password@postgres:5432/sa4e_db`
- Extension installed from CI-built VSIX artifact
- Pega Platform endpoint: `http://pega-sit:8080/prweb` (if available)
- Integration tests should be run against this environment

### 9.3 UAT

- Backend runs via Docker with production build
- Business sign-off required before deployment
- QA sign-off required
- Pega Platform endpoint: `http://pega-uat:8080/prweb`
- All feature flags enabled
- User acceptance testing for Pega settings panel

### 9.4 PROD

- **Deployment Window:** Sunday 02:00–04:00 UTC
- **Approval Required From:** PM + Business Owner
- **Communication Plan:** Notify team 24h before; post-deployment summary to #releases channel
- **On-Call Contact:** DevOps Lead (rotation)
- **Pega Platform endpoint:** `https://pega-prod:443/prweb` (HTTPS)
- **Credentials:** Pega password must be stored via SecretStorage (never in settings.json)
- **Monitoring:** Verify error rates for 30 minutes post-deployment
- **Performance baseline:** Measure indexing response times after deployment

---

## 10. Appendix

### 10.1 API Reference — New/Modified Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/index/source` | POST | Bearer Token | Unified indexing — accepts all file types including .pega (Modified) |
| `/api/v1/pega/crawl-plan` | POST | Session | Determine which Pega rules need fetching (New) |
| `/api/v1/pega/crawl-batch` | POST | Session | Ingest a batch of fetched Pega rules (New) |
| `/api/v1/pega/check-rule` | POST | Session | Check if a specific Pega rule is cached (New) |
| `/api/v1/pega/ingest-rule` | POST | Session | Ingest a single Pega rule (New) |
| `/api/v1/pega/detect-project` | POST | Session | Detect if workspace contains a Pega project (New) |
| `/health` | GET | None | Backend health status (Existing) |

### 10.2 Breaking Change Notice — POST /api/index/source

The request body format for `POST /api/index/source` has been updated:

**Before (v1.15.x):**
```json
{
  "files": [
    { "path": "src/file.ts", "content": "..." }
  ]
}
```

**After (v1.16.0):**
```json
{
  "files": [
    {
      "path": "src/file.ts",
      "content": "...",
      "gitHash": "a1b2c3d4e5f6...",
      "checksum": "e5f67890..."
    }
  ]
}
```

New optional fields: `gitHash` and `checksum` enable deduplication. Old-format requests without these fields continue to work (file is always indexed). The response now includes `deps` (FileDependency[]), `skipped` (number), and `projectId` (string) fields.

### 10.3 Contacts

| Role | Name | Contact |
|------|------|---------|
| DevOps Lead | DevOps Agent | devops@sa4e.com |
| Dev Lead | DEV Agent | dev@sa4e.com |
| QA Lead | QA Agent | qa@sa4e.com |
| Solution Architect | SA Agent | sa@sa4e.com |

### 10.4 Related Tickets

| Ticket | Summary | Relationship |
|--------|---------|-------------|
| SA4E-56 | Unified Code & Pega Rule Indexing Pipeline | Main ticket |
| SA4E-44 | Initial Backend Setup | Dependency |

### 10.5 File Manifest — Changed/New Files

#### Backend (New/Modified)

```
backend/src/engine/parsers/types.ts                          # Modified — new types
backend/src/engine/parsers/dependency-resolver.ts            # New
backend/src/engine/parsers/tree-sitter-indexer.ts            # Modified
backend/src/engine/parsers/grammar-registry.ts               # Modified
backend/src/engine/parsers/grammar-config.json               # Modified — .pega mapping
backend/src/engine/parsers/languages/pega-parser.ts          # New
backend/src/engine/indexer/indexing-engine.ts                # Modified — indexSingleFile()
backend/src/engine/scanner/file-scanner.ts                   # Modified — .pega detection
backend/src/modules/pega/PegaRuleAstParser.ts                # New
backend/src/modules/pega/PegaRuleAst.ts                      # New
backend/src/server/routes/api-index.ts                       # Modified — gitHash/checksum dedup
```

#### Extension (New/Modified)

```
extension/src/services/PegaHttpClient.ts                     # New
extension/src/services/IndexingService.ts                    # Modified — Pega crawl
extension/src/services/ProviderConfigService.ts              # New
extension/src/panels/settings/SettingsPanel.ts               # Modified — Pega section
extension/src/panels/settings/SettingsMessageHandler.ts      # Modified — Pega handlers
extension/src/auth/AuthManager.ts                            # Modified — getLastUsername()
extension/src/models/LlmProviderConfig.ts                    # Modified — SECRET_KEYS.pega
```
