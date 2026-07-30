# Release Notes (RLN)

## SDLC Agents 4 Enterprise — SA4E-66: Pega Rule Type Coverage — 7 Parser Modules

---

## Release Information

| Field | Value |
|-------|-------|
| Release Version | 1.18.0 |
| Release Date | 2026-07-27 |
| Jira Ticket | SA4E-66 |
| Environment | DEV / SIT / UAT / PROD |
| Author | DevOps Agent |
| Status | Draft |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-27 | DevOps Agent | Initiate document |

---

## 1. What's New

### 1.1 Feature Summary

Version 1.18.0 expands the Pega Parser coverage from ~15% to ~70% of rule types through 7 new explicit parser modules, with 100% effective coverage via the MetaModel fallback for any unrecognized rule type. All parsers implement the `IPegaRuleParserStrategy` interface and are registered in a central `ParserRegistry`.

### 1.2 User-Facing Changes

| # | Change | Description | Impact |
|---|--------|-------------|--------|
| 1 | Connect Parser Module | Parse Rule-Connect-* and Rule-Service-* rules (REST, SOAP, SQL, File, etc.) | High |
| 2 | Declare Parser Module | Parse all Rule-Declare-* rules (Expression, OnChange, Trigger, Pages, Decision) | High |
| 3 | Access Parser Module | Parse Rule-Access-*, Rule-Admin-*, Data-Admin-* rules | High |
| 4 | Portal Parser Module | Parse Rule-HTML-*, Rule-Portal, Rule-Navigation rules | High |
| 5 | Decisioning Parser Module | Parse Rule-Decision-* and Rule-Strategy-* rules | High |
| 6 | Misc Parser Module | Parse 15+ catch-all rule types (CaseType, Stage, Report, Utility, etc.) | High |
| 7 | MetaModel Fallback | Generic AST parser for any unrecognized pxObjClass | Critical |

---

## 2. Technical Changes

### 2.1 API Changes

No new API endpoints. All parser modules are internally consumed by the existing rule ingestion pipeline.

### 2.2 Database Changes

| Type | Object | Description |
|------|--------|-------------|
| No change | — | All parsing is in-memory. No database migration required. |

### 2.3 Configuration Changes

| Property | Change Type | Description |
|----------|-----------|-------------|
| PEGA_PARSER_CONNECT_ENABLED | New | Enable/disable Connect parser (default: true) |
| PEGA_PARSER_DECLARE_ENABLED | New | Enable/disable Declare parser (default: true) |
| PEGA_PARSER_ACCESS_ENABLED | New | Enable/disable Access parser (default: true) |
| PEGA_PARSER_PORTAL_ENABLED | New | Enable/disable Portal parser (default: true) |
| PEGA_PARSER_DECISIONING_ENABLED | New | Enable/disable Decisioning parser (default: true) |
| PEGA_PARSER_MISC_ENABLED | New | Enable/disable Misc parser (default: true) |
| PEGA_PARSER_METAMODEL_ENABLED | New | Enable/disable MetaModel fallback (default: true) |

### 2.4 Infrastructure Changes

| Component | Change | Description |
|-----------|--------|-------------|
| Backend (Hono) | Modified | ParserRegistry integration |
| No new services | — | All within existing process |

### 2.5 New Files Added

```
backend/src/modules/pega/
├── IPegaRuleParserStrategy.ts
├── BasePegaRuleParser.ts
├── ParserRegistry.ts
├── MetaModelParserStrategy.ts
├── connect/
│   ├── ConnectParser.ts
│   ├── strategies/
│   ├── types/
│   └── __tests__/
├── declare/
│   ├── DeclareParser.ts
│   ├── strategies/
│   ├── types/
│   └── __tests__/
├── access/
│   ├── AccessParser.ts
│   ├── strategies/
│   ├── types/
│   └── __tests__/
├── portal/
│   ├── PortalParser.ts
│   ├── strategies/
│   ├── types/
│   └── __tests__/
├── decisioning/
│   ├── DecisioningParser.ts
│   ├── strategies/
│   ├── types/
│   └── __tests__/
└── misc/
    ├── MiscParser.ts
    ├── strategies/
    ├── types/
    └── __tests__/
```

---

## 3. Bug Fixes

No bug fixes included in this release.

---

## 4. Known Issues & Limitations

| # | Issue | Impact | Workaround | Target Fix |
|---|-------|--------|------------|------------|
| 1 | Some rare Pega rule types may have undocumented JSON structures | Low — MetaModel fallback handles them generically | Report undocumented structures for explicit parser creation | Ongoing |
| 2 | ParserRegistry ordering is registration-time dependent | Low — order matters if pxObjClass matches multiple patterns | Register more specific parsers first | Future release |
| 3 | No parallel parsing for large batch operations | Low — sequential parsing by design | Batch API calls as needed | Future release |

---

## 5. Dependencies

### 5.1 Pre-requisite Releases

| Release | Version | Status | Required Before |
|---------|---------|--------|-----------------|
| SA4E-57 (Pega REST Bridge Services) | 1.17.0 | Completed | This release |

### 5.2 External System Changes

| System | Change Required | Status | Contact |
|--------|----------------|--------|---------|
| None | All parsing is in-memory, no external system dependencies | N/A | N/A |

---

## 6. Migration Notes

### 6.1 Data Migration

| Migration | Description | Automated | Estimated Time |
|-----------|-------------|-----------|----------------|
| None | No data migration — all parsing is in-memory | N/A | N/A |

### 6.2 Breaking Changes

No breaking changes in this release. Fully backward compatible. All existing L1-L2 APIs continue to work unchanged.

### 6.3 Backward Compatibility

Fully backward compatible. Existing parsers and APIs are unaffected.

---

## 7. Testing Summary

| Test Module | Total Tests | Passed | Failed | Blocked | Pass Rate |
|-------------|-------------|--------|--------|---------|-----------|
| Connect Parser | 22 | — | — | — | Target ≥ 95% |
| Declare Parser | 20 | — | — | — | Target ≥ 95% |
| Access Parser | 33 | — | — | — | Target ≥ 95% |
| Portal Parser | 29 | — | — | — | Target ≥ 95% |
| Decisioning Parser | 37 | — | — | — | Target ≥ 95% |
| Misc Parser | 29 | — | — | — | Target ≥ 95% |
| Data+Process Parser | 28 | — | — | — | Target ≥ 95% |
| MetaModel Fallback | Included | — | — | — | Target 100% |
| Edge Cases | Included | — | — | — | Target 100% |
| **Total** | **495** | | | | |

---

## 8. Deployment Instructions

See: [Deployment Guide](DPG.md)

### Quick Reference

| Step | Action | Estimated Time |
|------|--------|---------------|
| 1 | Build backend (`npm run build`) | 2 minutes |
| 2 | Update environment configuration | 2 minutes |
| 3 | Deploy artifact | 1 minute |
| 4 | Health check + smoke tests | 5 minutes |
| **Total** | | **10 minutes** |

---

## 9. Rollback Plan

See: [Deployment Guide](DPG.md) §8

**Rollback Decision Criteria:**
- ParserRegistry fails to resolve known rule types → Immediate rollback
- MetaModel fallback returns corrupt AST → Immediate rollback
- Parsing errors for valid rule JSON payloads → Immediate rollback

**Estimated Rollback Time:** 16 minutes

---

## 10. Contacts

| Role | Name | Contact | Responsibility |
|------|------|---------|---------------|
| Release Manager | SM Agent | Project channel | Release coordination |
| Dev Lead | DEV Agent | Project channel | Technical issues |
| QA Lead | QA Agent | Project channel | Testing sign-off |
| DevOps | DevOps Agent | Project channel | Deployment execution |
| Business Owner | BA Agent | Project channel | Business sign-off |

---

## 11. Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Dev Lead | | | ☐ Approved |
| QA Lead | | | ☐ Approved |
| Business Owner | | | ☐ Approved |
| Release Manager | | | ☐ Approved |
