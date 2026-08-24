# Deployment Guide - SA4E-204 L3

## Document Information
| Field | Value |
|-------|-------|
| Ticket | SA4E-204 |
| Title | Parallel Tool Execution in Chat Graph |
| Version | 1.33.1 |
| Date | 2026-08-22 |
| Author | DevOps Agent |
| Type | Extension Deployment |

## 1. Overview
Feature summary: Upgrade `execute_tools` node to support parallel execution of independent tool calls with security remediation for command injection, path traversal, approval bypass, regex injection, prompt injection, and default deny.

Deployment scope:
- Extension source: `extension/src/langgraph/vscode/vscode-tools.ts`, `extension/src/langgraph/subgraphs/chat-graph-nodes.ts`
- Build artifact: VSIX package `sdLC-agents-4-enterprise-1.33.1.vsix`
- Configuration: Feature flag `chat.parallel.enabled`, `chat.parallel.max_concurrency`
- Target environments: DEV, SIT, UAT, PROD (Marketplace / Internal Distribution)

## 2. Prerequisites
- Node.js 20.x
- VS Code 1.101+
- `vsce` CLI installed
- Access to VS Code Marketplace / internal artifact repository
- Extension signing certificate
- Backup of existing VSIX 1.33.0

## 3. Pre-Deployment Checklist
- [ ] Code merged to release branch `main`
- [ ] Security fixes merged from REMEDIATION-LOG.md
- [ ] Unit tests pass (18/18 parallel execution)
- [ ] Pentest re-run pass TC-CRI-01, TC-HIGH-02/03/04/05/06
- [ ] CHANGELOG.md updated to 1.33.1
- [ ] Database backup N/A (no schema changes)
- [ ] Feature flags configured per environment
- [ ] Monitoring/alerting configured

## 4. Application Deployment
1. Build extension
   ```bash
   cd extension
   npm ci
   npm run compile
   vsce package --out ../dist/sdLC-agents-4-enterprise-1.33.1.vsix
   ```
2. Sign VSIX with corporate certificate
3. Publish to internal marketplace / Marketplace
   ```bash
   vsce publish patch
   ```
4. Update `extension/package.json` version to 1.33.1
5. Deploy backend feature flag config
   - DEV: `chat.parallel.enabled=true`, `chat.parallel.max_concurrency=3`
   - PROD: `chat.parallel.enabled=false` initially, rollout gradual

## 5. Configuration Changes
- New environment variables: none
- Feature flags:
  - `chat.parallel.enabled` (default false in PROD)
  - `chat.parallel.max_concurrency` (default 10 PROD, 3 DEV)
- Security defaults:
  - `execute_shell` whitelist enforced
  - Path canonicalization enabled
  - Default deny tool permissions when agentConfig absent

## 6. Post-Deployment Verification
- Install VSIX 1.33.1 in test VS Code instance
- Verify extension activates without errors
- Health check: `execute_tools` node processes parallel batch
- Smoke test: Chat graph with 3 independent tools completes <30% latency reduction
- Log verification: No ERROR/FATAL in `extension-output`
- Monitoring dashboard: tool_execution_duration p95 <30s, error rate <5%

## 7. Rollback Plan
Trigger criteria:
- Health check fail
- Error rate >5%
- Smoke test fail

Rollback steps:
1. Disable feature flag `chat.parallel.enabled` → fallback to sequential
2. If security issue persists, uninstall 1.33.1, install 1.33.0 VSIX
3. Restore previous `vscode-tools.ts` and `chat-graph-nodes.ts` from git tag v1.33.0
4. Verify rollback: extension health check pass, tools execute sequentially
5. Notify stakeholders

## 8. Monitoring
- Logs: `extension-output` channel, Pino logs for tool_execution_start/complete
- Metrics: `tool_execution_duration`, `parallel_batch_size`, `tool_execution_errors`
- Alerts: error rate >5%, p95 latency >30s
- Dashboard: Grafana Chat Module Overview

## 9. Environment-Specific Notes
DEV: Immediate parallel enable, max concurrency 3
SIT/UAT: Feature flag toggle for validation
PROD: Gradual rollout, start with 5% users, monitor 24h before full
