# Deployment Plan Guide & Release Notes (DPG & RLN) — SA4E-58

**Title**: Pega KB AST Semantic Engine & Dynamic MCP Tools Integration  
**Ticket Key**: SA4E-58  
**Author**: DevOps Agent (Coordinated with SM Agent)  
**Status**: APPROVED  
**Date**: 2026-07-27  
**Version**: 2.0.0 (Enterprise Spec)  

---

## 1. Deployment Checklist & Instructions

### 1.1 Prerequisites
1. Pega Instance URL: `https://9ucseukj.pegaacademy.net/prweb/api/HRAppsV2Service/V1`
2. Pega Service Package: `KiroAgents` (Version `V1`) deployed with 7 Custom REST Services.
3. Node.js environment: `>= v18.0.0`.

### 1.2 Deployment Execution Steps
1. Biên dịch Extension Module:
   ```bash
   cd extension
   npm run compile
   ```
2. Chạy toàn bộ Test Suite xác minh:
   ```bash
   npm run test
   ```
3. Kiểm tra Health-Check Backend MCP Services:
   ```bash
   curl http://127.0.0.1:48721/admin
   ```

---

## 2. Release Notes (RLN)

### Summary of Changes (Ticket SA4E-58)
- **Feature**: Integrates 7 Pega Dynamic MCP Tools (`pega_get_rule`, `pega_query_rule`, `pega_list_rules`, `pega_save_rule`, `pega_checkout_rule`, `pega_run_tests`, `pega_get_class_metadata`).
- **Feature**: Integrates Local Knowledge Base AST Semantic Engine (Symbol Resolution, Graph Dependency Analysis, Few-Shot AST Template Generation, Zero-Latency Offline Reasoning).
- **Refactor**: Unified Pega REST Service Outbound Property Mapping (`.ResponseBody` & `.pyHTTPResponseCode`).
- **Bug Fix**: Fixed CaseType Indexer fallback bug in `PegaHttpClient.ts` & `PegaRuleFetcherService.ts`.

---

## 3. Verification & Sign-off

- Build Status: **CLEAN (0 Errors)**
- Test Status: **545/545 PASSED (100%)**
- Release Version: **v1.16.0**
