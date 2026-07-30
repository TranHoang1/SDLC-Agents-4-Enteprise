# Release Notes (RLN)

## Code Intelligence MCP Server — SA4E-56: Unified Code & Pega Rule Indexing Pipeline

---

## Release Information

| Field | Value |
|-------|-------|
| Release Version | 1.16.0 |
| Release Date | 2026-07-26 |
| Jira Ticket | SA4E-56 |
| Environment | DEV / SIT / UAT / PROD |
| Author | DevOps Agent |
| Status | Draft |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-26 | DevOps Agent | Initiate document |

---

## 1. What's New

### 1.1 Feature Summary

This release introduces a **Unified Code & Pega Rule Indexing Pipeline** that allows the Code Intelligence MCP Server to index both source code files and Pega Business Process Management (BPM) rules through a single endpoint. Key highlights:

- **One API to Index Everything**: The `POST /api/index/source` endpoint now accepts all file types — TypeScript, JavaScript, Java, Python, Go, Rust, AND Pega rule files (`.pega`) — through a unified pipeline.
- **Smarter Incremental Indexing**: Files are now indexed with content-hash-based deduplication. If a file hasn't changed (matching SHA-256 hash), it's skipped automatically, making re-indexing much faster.
- **Automatic Dependency Tracking**: The system automatically resolves cross-file imports and Pega rule references, returning a comprehensive dependency map with every indexing request.
- **Pega Platform Integration**: VS Code extension users can now configure Pega Platform connections, test connectivity, and automatically crawl Pega rules using a BFS (Breadth-First Search) algorithm during workspace indexing.
- **Enhanced Login Experience**: The login panel now remembers the last used username.

### 1.2 User-Facing Changes

| # | Change | Description | Impact |
|---|--------|-------------|--------|
| 1 | Unified Indexing API | `POST /api/index/source` now accepts `.pega` files and returns dependency lists | Medium |
| 2 | Pega Platform Settings | New "Pega Platform Connection" section in the VS Code extension Settings panel | Medium |
| 3 | Test Pega Connection | Button to validate Pega Platform connectivity and show operator context | Low |
| 4 | Fetch Pega Context | Button to fetch Pega operator/app info and auto-create `pega-project.json` | Medium |
| 5 | Auto Pega Crawl | During workspace indexing, Pega projects are automatically detected and rules are crawled | Medium |
| 6 | Login remembers username | Username field pre-fills with last used value | Low |
| 7 | Password visibility toggle | Login UI now has a password show/hide toggle | Low |

### 1.3 Screenshots (if applicable)

*Screenshots of the Settings panel Pega section and login UI to be added.*

---

## 2. Technical Changes

### 2.1 API Changes

| Type | Endpoint | Method | Description |
|------|----------|--------|-------------|
| Modified | `/api/index/source` | POST | Extended to accept `.pega` files, `gitHash`/`checksum` fields for dedup, returns `deps` array |
| New | `/api/v1/pega/crawl-plan` | POST | Determine which Pega rules need fetching vs already cached |
| New | `/api/v1/pega/crawl-batch` | POST | Ingest a batch of fetched Pega rules (max 50) |
| New | `/api/v1/pega/check-rule` | POST | Check if a specific Pega rule is cached |
| New | `/api/v1/pega/ingest-rule` | POST | Ingest a single Pega rule |
| New | `/api/v1/pega/detect-project` | POST | Detect if workspace contains a Pega project |

### 2.2 Database Changes

| Type | Object | Description |
|------|--------|-------------|
| None | `files` | No schema changes — existing `content_hash`, `language` columns support new data |
| None | `symbols` | No schema changes — existing `kind` column supports new `'pega-rule'` value |
| None | `relationships` | No schema changes — existing `kind` column supports new `'references'` value |

**No database migration is required.**

### 2.3 Configuration Changes

| Property | Change Type | Description |
|----------|-----------|-------------|
| `kiroSdlc.pegaEndpoint` | New | Pega Platform REST API Endpoint URL (default: `http://localhost:8080/prweb`) |
| `kiroSdlc.pegaUsername` | New | Pega Operator ID (Username) |
| `pega.enabled` | New | Feature flag to enable/disable Pega crawling (default: `true`) |
| `pega.crawl.maxIterations` | New | Maximum BFS crawl iterations (default: `1000`) |
| `indexer.maxFileSize` | New | Max file size in bytes for tree-sitter parsing (default: `1048576`) |

### 2.4 Infrastructure Changes

| Component | Change | Description |
|-----------|--------|-------------|
| Backend | Modified | Added `DependencyResolver`, `PegaFileParser`, `PegaRuleAstParser` modules |
| Extension | Modified | Added `PegaHttpClient`, `ProviderConfigService`, updated `SettingsPanel` |
| Extension | Modified | Updated `AuthManager` with `getLastUsername()` persistence |

### 2.5 New Modules/Packages

| Module | Language | Description |
|--------|----------|-------------|
| `DependencyResolver` | TypeScript | Resolves imports for TS/JS, Java, Python, and Pega to FileDependency objects |
| `PegaFileParser` | TypeScript | ILanguageParser implementation for `.pega` files (JSON-based) |
| `PegaRuleAstParser` | TypeScript | 20+ specialized AST builders for Pega rule types |
| `PegaHttpClient` | TypeScript | REST client for Pega Platform communication |
| `ProviderConfigService` | TypeScript | VS Code settings management + SecretStorage for credentials |

---

## 3. Bug Fixes

| # | Jira Ticket | Summary | Severity |
|---|------------|---------|----------|
| — | — | — | — |

> No bug fixes included in this release.

---

## 4. Known Issues & Limitations

| # | Issue | Impact | Workaround | Target Fix |
|---|-------|--------|------------|------------|
| 1 | Draw.io diagrams in TDD are stored as `.drawio` XML source files. Some Windows setups may not render these inline. | Low — developers can open `.drawio` files in draw.io desktop or web | Use draw.io desktop app or https://app.diagrams.net to open XML files | Future release |
| 2 | BFS crawl safety limit: MAX_ITERATIONS = 1000 prevents infinite loops but may not crawl all rules in very large Pega projects (>1000 rules) | Medium — large projects may have incomplete crawl | Increase `pega.crawl.maxIterations` config value for large projects | Future release |
| 3 | SHA-256 first 16 hex chars used for dedup. While collision risk is extremely low (2^64 combinations), it is theoretically possible | Low — acceptable for V1 | No workaround needed | Monitor during testing |
| 4 | Pega Platform REST API fallback URL pattern may not cover all Pega version deployments | Medium — some Pega versions may need custom URL patterns | Add more fallback patterns as discovered | Future release |

---

## 5. Dependencies

### 5.1 Pre-requisite Releases

| Release | Version | Status | Required Before |
|---------|---------|--------|-----------------|
| Backend SA4E-44 (Initial Setup) | 1.14.0+ | Deployed | This release |
| Extension (Previous) | 1.14.0 | Deployed | This release |

### 5.2 External System Changes

| System | Change Required | Status | Contact |
|--------|----------------|--------|---------|
| Pega Platform | Accessible REST API endpoints (optional) | Varies by environment | Pega Admin |
| VS Code | Version >= 1.85.0 | Already required | N/A |
| Node.js | >= 18.14.1 | Already required | N/A |

---

## 6. Migration Notes

### 6.1 Data Migration

| Migration | Description | Automated | Estimated Time |
|-----------|-------------|-----------|----------------|
| None | No data migration required | N/A | N/A |

### 6.2 Breaking Changes

| Change | Impact | Migration Path |
|--------|--------|---------------|
| `POST /api/index/source` now accepts `files` array with objects containing `gitHash`/`checksum` fields | The request body format is extended (not removed). Old format (without `gitHash`/`checksum`) still works. | No action needed for existing callers. CI systems can optionally add `gitHash` for dedup. |
| Response now includes `deps`, `skipped`, `projectId` fields | Additional fields in response. Old callers should ignore unknown fields. | No action needed — backward compatible. |

> No breaking changes that require migration. Fully backward compatible with existing API consumers.

### 6.3 Backward Compatibility

- **API (POST /api/index/source)**: Fully backward compatible. Old request format (without `gitHash`/`checksum`) continues to work. New fields in response are additive.
- **Extension API compatibility**: Backend v1.16.0 requires **extension v1.16.0+** when using the new `gitHash`/`checksum` fields. Older extensions using the old request format will continue to work.
- **Database**: Fully compatible. No schema changes.
- **Pega features**: Optional — if Pega Platform is not available or configured, all existing functionality works unchanged.

---

## 7. Testing Summary

| Test Level | Total | Passed | Failed | Blocked | Pass Rate |
|-----------|-------|--------|--------|---------|-----------|
| Unit Tests | 120 | 120 | 0 | 0 | 100% |
| Integration Tests | 30 | 30 | 0 | 0 | 100% |
| SIT | — | — | — | — | — |
| UAT | — | — | — | — | — |

### Defect Summary

| Severity | Found | Fixed | Open | Deferred |
|----------|-------|-------|------|----------|
| Critical | 0 | 0 | 0 | 0 |
| Major | 0 | 0 | 0 | 0 |
| Minor | 0 | 0 | 0 | 0 |

---

## 8. Deployment Instructions

See the [Deployment Guide](DPG-v1-SA4E-56.docx) for detailed deployment steps.

### Quick Reference

| Step | Action | Estimated Time |
|------|--------|---------------|
| 1 | Database migration | None required |
| 2 | Build backend + extension artifacts | 5 min |
| 3 | Deploy backend (npm run dev / docker) | 2 min |
| 4 | Install extension VSIX | 1 min |
| 5 | Configure Pega settings (if applicable) | 3 min |
| 6 | Verification (health check + smoke tests) | 5 min |
| **Total** | | **~15 min** |

---

## 9. Rollback Plan

See the [Deployment Guide](DPG-v1-SA4E-56.docx) for detailed rollback steps.

**Rollback Decision Criteria:**
- POST /api/index/source returns consistent errors after deployment
- Health check fails (GET /health returns non-200)
- Extension fails to activate after VSIX installation
- Data integrity issues detected during smoke tests
- Path safety validation regression

**Estimated Rollback Time:** < 15 minutes

---

## 10. Contacts

| Role | Name | Contact | Responsibility |
|------|------|---------|---------------|
| Release Manager | DevOps Agent | devops@sa4e.com | Release coordination |
| Dev Lead | DEV Agent | dev@sa4e.com | Technical issues |
| QA Lead | QA Agent | qa@sa4e.com | Testing sign-off |
| DevOps | DevOps Agent | devops@sa4e.com | Deployment execution |
| Business Owner | PM | pm@sa4e.com | Business sign-off |

---

## 11. Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Dev Lead | | | ☐ Approved |
| QA Lead | | | ☐ Approved |
| Business Owner | | | ☐ Approved |
| Release Manager | | | ☐ Approved |
