# Release Notes (RLN)

## SDLC-Agents-4-Enterprise — SA4E-185: LSP Diagnostics Feed — Realtime errors into agent loop

---

## Release Information

| Field | Value |
|-------|-------|
| Release Version | **v1.32.0** |
| Release Date | 2026-08-20 (planned — pending QA/SIT sign-off) |
| Jira Ticket | SA4E-185 |
| Environment | VS Code Marketplace + Open VSX (PROD); VSIX for DEV/SIT/UAT |
| Author | DevOps Agent |
| Status | Draft |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-20 | DevOps Agent | Initiate document — release notes for SA4E-185 (v1.32.0) |

---

## 1. What's New

### 1.1 Feature Summary

The Kiro VS Code extension now watches language-server diagnostics in real time and feeds them back into the AI agent loop. When the agent edits or writes files (including `write_file`), any errors the language server reports for those touched files are gathered and shown to the agent on its very next turn, so it can **self-correct** — e.g., fix the type error it just introduced — without the user having to describe the problem. If the summary contains errors, the agent receives an advisory instruction to attempt fixes (still gated by the usual approval rules and a safety bound of 12 iterations).

For end users this means fewer manual copy-paste rounds of "fix the error you introduced" — the extension detects the problem itself and lets the agent propose a fix.

### 1.2 User-Facing Changes

| # | Change | Description | Impact |
|---|--------|-------------|--------|
| 1 | New setting `kiroSdlc.enableDiagnosticsFeed` (default ON) | Master switch for the realtime diagnostics feed; appears in Settings at install | Medium |
| 2 | Agent sees live errors in-conversation | After a write/edit, the next agent turn includes a compact `[Diagnostics feed]` summary for touched files | High |
| 3 | Advisory auto-fix | When diagnostics contain errors, the agent is advised to fix them (approval gates + iteration bound 12 still apply) | High |
| 4 | `write_file` now classified as a write tool | File hooks now fire for `write_file` (OI-1 fix) — intended, beneficial behavior, verify custom hooks | Low |
| 5 | No reload / no redeploy to toggle | Turning the feed off is instant via the setting; the agent loop behaves exactly as before when off | Low |

### 1.3 Screenshots (if applicable)

None — no new dedicated UI surface in v1 (Chat Panel indicator deferred as nice-to-have).

---

## 2. Technical Changes

### 2.1 API Changes

| Type | Endpoint | Method | Description |
|------|----------|--------|-------------|
| **None** | — | — | Extension-internal feature: no HTTP/REST endpoints added or modified (TDD §3) |

### 2.2 Database Changes

| Type | Object | Description |
|------|--------|-------------|
| **None** | — | Explicitly no DB changes (TDD §4.1) — feed state is in-memory per session |

### 2.3 Configuration Changes

| Property | Change Type | Description |
|----------|-----------|-------------|
| `kiroSdlc.enableDiagnosticsFeed` | New | Boolean, default `true` — master switch / feature flag (BR-8). Off → node no-ops, zero behavior change |

### 2.4 Infrastructure Changes

| Component | Change | Description |
|-----------|--------|-------------|
| Kiro VS Code extension | Modified (in-process only) | New `DiagnosticsFeedService` + `inject_diagnostics` node + `diagnosticsContext` channel; no new services/containers/ports |
| CI/CD | Added | `.github/workflows/ci-sa4e-185.yml` — lint + compile + vitest (PBT/UT/IT/E2E-API) + vsce package + gate |
| Release pipeline | Unchanged | `publish.yml` re-used on tag `v1.32.0` |

---

## 3. Bug Fixes

| # | Jira Ticket | Summary | Severity |
|---|------------|---------|----------|
| 1 | SA4E-185 (OI-1) | `write_file` missing from `TOOL_CATEGORIES` — file hooks/logic ignored it | Major (addressed) |
| 2 | SA4E-185 (OI-2) | `injectedPrompts` discarded at `chat-graph-nodes.ts:334` — replaced by channel-authoritative `diagnosticsContext` injection | Major (addressed) |

> No unrelated bug fixes included in this release.

---

## 4. Known Issues & Limitations

| # | Issue | Impact | Workaround | Target Fix |
|---|-------|--------|------------|------------|
| 1 | Feed reacts only to **agent-touched files** — non-touched diagnostics are not injected (by design, BR-4/5) | Limits context to work the agent performed; existing `get_diagnostics` pull tool remains for full workspace queries | Use pull-based `get_diagnostics` tool | By design |
| 2 | Summary caps: 20 entries/file, 50 total, ~8000 chars — storms are truncated with a marker (EF-02, TC-09) | Rarely loses detail under extreme diagnostics storms | Re-run after fixing root errors | By design |
| 3 | Feed state is per-session (in-memory) — not persisted across VS Code restarts | No accumulation across sessions | Re-produce diagnostics after restart | By design |
| 4 | Open-issues already resolved: OI-1 (write_file) and OI-2 (channel) closed in this release | — | — | — |
| 5 | Default is ON (per BRD). If your agent loop is sensitive to prompt overhead, you can disable via `kiroSdlc.enableDiagnosticsFeed: false` | Slight prompt context growth when errors are present | Setting toggle | Product decision documented (SIT-76) |

---

## 5. Dependencies

### 5.1 Pre-requisite Releases

| Release | Version | Status | Required Before |
|---------|---------|--------|-----------------|
| Main branch baseline | v1.31.0 | Deployed | This release (v1.32.0) |
| SA4E-186 (adjacent extension feature) | on main | Coexists | Independent — no ordering constraint |

### 5.2 External System Changes

| System | Change Required | Status | Contact |
|--------|----------------|--------|---------|
| VS Code Marketplace | None (publish pipeline already configured) | Ready | DevOps |
| Open VSX (Kiro IDE) | None | Ready | DevOps |
| LSP providers (TS/ESLint servers in user workspaces) | None — consumed via `onDidChangeDiagnostics` | Ready | N/A |

---

## 6. Migration Notes

### 6.1 Data Migration

| Migration | Description | Automated | Estimated Time |
|-----------|-------------|-----------|----------------|
| None | No data migration — feature is in-memory, per-session | N/A | 0 min |

### 6.2 Breaking Changes

| Change | Impact | Migration Path |
|--------|--------|---------------|
| `write_file` now classified as write tool (OI-1) | Custom file hooks (`hook-loader`) will now fire for `write_file` — intended, but must verify your hook definitions | Verify hooks in staging pre-release (TDD §10.3); no code change required |

> Otherwise: **No breaking changes in this release. Fully backward compatible.** (TDD §10.4)

### 6.3 Backward Compatibility

| Scenario | Behavior |
|----------|----------|
| Feed param `undefined` (tests / old call sites) | Node no-ops; graph identical (E-8) |
| Setting key absent | Default `true` (out of the box) |
| Headless / non-VS Code | Treated as disabled (EF-01) |
| No workspace / no LSP provider | No events → no injection |
| KSA-178 + `get_diagnostics` | Untouched; regression-verified (TC-18) |
| Both chat-graph variants (RAG/standard) | Identical wiring applied (V14) |

---

## 7. Testing Summary

Target (from STP — actuals filled on QA completion):

| Test Level | Total | Passed | Failed | Blocked | Pass Rate |
|-----------|-------|--------|--------|---------|-----------|
| PBT | 8 | — | — | — | — |
| Unit | 29 | — | — | — | — |
| Integration | 16 | — | — | — | — |
| E2E-API | 12 | — | — | — | — |
| E2E-UI | 6 | — | — | — | — |
| SIT (manual) | 7 | — | — | — | — |
| **Total** | **78 (71 automated = 91%)** | | | | |

### Defect Summary

| Severity | Found | Fixed | Open | Deferred |
|----------|-------|-------|------|----------|
| Critical | — | — | — | — |
| Major | — | — | — | — |
| Minor | — | — | — | — |

---

## 8. Deployment Instructions

See: [Deployment Guide](DPG-v1-SA4E-185.docx)

### Quick Reference

| Step | Action | Estimated Time |
|------|--------|---------------|
| 1 | Merge `SA4E-185` → `main`; CI gate green (`ci-sa4e-185.yml`) | ~10–20 min (tests) |
| 2 | Bump version to 1.32.0 + create tag `v1.32.0` | 5 min |
| 3 | `publish.yml` builds VSIX + publishes to Marketplace/Open VSX | ~10–15 min |
| 4 | Post-release verification (smoke tests DPG §7.2) | 15–30 min |
| **Total** | | **≤ 1 hour (automated)** |

---

## 9. Rollback Plan

See: [Deployment Guide](DPG-v1-SA4E-185.docx) §8 — full steps + diagrams.

**Rollback Decision Criteria:**
- Immediate rollback: loop corruption, context leak across tabs, C-1/C-2 security violation, unbounded iteration, perf degradation > 50%
- Hotfix path (no rollback): log noise, cap-marker wording, summary formatting

**Instant user-level rollback:** `"kiroSdlc.enableDiagnosticsFeed": false` — no reload, no redeploy.
**Release rollback:** reinstall previous VSIX (v1.31.0) — no DB, no server rollback.

**Estimated Rollback Time:** ≤ 40 min (user-level < 1 min).

---

## 10. Contacts

| Role | Name | Contact | Responsibility |
|------|------|---------|---------------|
| Release Manager | SM Agent | (pipeline) | Release coordination |
| Dev Lead | DEV Agent | (implementation) | Technical issues |
| QA Lead | QA Agent | (test sign-off) | Testing sign-off |
| DevOps | DevOps Agent | (pipeline owner) | Deployment execution |
| Business Owner | PM | (sign-off) | Business sign-off |

---

## 11. Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Dev Lead | | | ☐ Approved |
| QA Lead | | | ☐ Approved |
| Business Owner | | | ☐ Approved |
| Release Manager | | | ☐ Approved |