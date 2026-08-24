# Release Notes (RLN)

## SDLC Agents 4 Enterprise (Kiro Extension) — SA4E-193: Config Commands with ValidationGate

---

## Release Information

| Field | Value |
|-------|-------|
| Release Version | **v1.35.0** |
| Covers | **SA4E-190 + SA4E-193** — first tagged release of the 1.35 line |
| Release Date | 2026-08-24 |
| Jira Ticket | SA4E-193 (release also carries SA4E-190 content — see §1) |
| Parent Epic | SA4E-181 — Chat Module — OpenCode Parity + Agentic Config System |
| Environment | PROD (released on default branch `main`) |
| Git Tag | `v1.35.0` (annotated, → `f9c64a8`) |
| Author | DevOps Agent |
| Status | Released |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-24 | DevOps Agent | Initiate document for release v1.36.0 (interim) |
| 1.1 | 2026-08-24 | DevOps Agent | Release version correction v1.36.0 → v1.35.0 per PO decision (v1.35.0 was never released; SA4E-193 ships as official v1.35.0) |

---

## Git Release Record

| Item | Value |
|------|-------|
| Merge commit into `main` | `3d924ca` — "Merge branch 'SA4E-193' — Config Commands with ValidationGate (fixes D-1..D-7)" (parents `d4836f3` + `3a3b6c4`) |
| Final feature commit lineage includes | `a618e0b` — ConfigCommands refactor (593 → 195 lines) + ValidationGate modules + 64 regression tests; `6a6b42e` — phase docs sync |
| Version commit (**tag target**) | `f9c64a8` — "SA4E-193: set official release version to 1.35.0": all 3 package.json corrected **1.36.0 → 1.35.0** (correction commit) + README changelog consolidated into a single `### v1.35.0 (2026-08-24)` entry covering SA4E-190 + SA4E-193 |
| Annotated tag | `v1.35.0` → points to `f9c64a8` (pushed to origin, verified via `git ls-remote`: `v1.35.0^{commit}` = `f9c64a8`) |
| Version history (superseded — record only) | Intermediate bump `cb83296` (all 3 package.json 1.35.0 → 1.36.0) and its annotated tag `v1.36.0` (→ `cb83296`) were **reverted/deleted local + remote** after PO confirmed the 1.35 line had never been released; earlier README changelog commits (`c492837`, docs bookkeeping `01ba3e0`) superseded by `f9c64a8` |
| Tag hygiene | Stale tag `v1.34.0` deleted local+remote earlier (had pointed at wrong commit `1a7a800` of SA4E-206); interim tag `v1.36.0` deleted local+remote on this correction. Official tag is now `v1.35.0`; last valid released baseline remains **v1.33.0** |

---

## 1. What's New

### 1.1 Feature Summary

> **Release scope:** **v1.35.0 covers SA4E-190 + SA4E-193** — this is the first tagged release of the 1.35 line (no v1.34.0 was ever published; SA4E-190 had raised package.json to 1.35.0 without ever tagging/releasing it). The changelog content of release v1.35.0 therefore combines:
>
> - **SA4E-190 — SDLC Pipeline Autonomy L3 Reset & Rebuild:** full SDLC pipeline reset from requirements to deployment at Autonomy Level L3; rebuilt BRD, FSD, TDD, STP, STC, UG, TEST-REPORT, DPG, RLN; implemented backend module `backend/src/sa4e-190/` with PipelineController, StatusManager, repository, and unit/integration/e2e tests (all PASS).
> - **SA4E-193 — Config Commands with ValidationGate:** detailed in the remainder of these release notes.

Kiro chat giờ có **4 lệnh slash mới** giúp lập trình viên tạo cấu hình agent/hook/steering/skill chỉ bằng cách mô tả bằng ngôn ngữ tự nhiên — không cần nhớ cú pháp YAML frontmatter hay JSON schema. Hệ thống dùng LLM để sinh file cấu hình hoàn chỉnh, kiểm tra tính hợp lệ theo schema (**ValidationGate**) trước khi ghi xuống workspace, rồi mở file trong editor và cập nhật UI tự động qua hot-reload.

Nếu LLM không khả dụng, hệ thống tự động sinh bộ khung chuẩn từ template — việc tạo cấu hình **không bao giờ bị chặn**.

### 1.2 User-Facing Changes

| # | Change | Description | Impact |
|---|--------|-------------|--------|
| 1 | `/create-new-agent` | Mô tả vai trò agent bằng tiếng thường → nhận file `.md` hoàn chỉnh (frontmatter + system prompt) tại `.code-intel/agents/` | High |
| 2 | `/create-new-hook` | Mô tả trigger/action → nhận hook `.json` đúng hook schema tại `.code-intel/hooks/` | High |
| 3 | `/create-new-steering` | Mô tả rule → nhận steering `.md` tại `.code-intel/steering/` | High |
| 4 | `/create-new-skill` | Mô tả mục đích → nhận folder skill + `SKILL.md` chuẩn tại `.code-intel/skills/{name}/` | High |
| 5 | Validate-before-write | File lỗi schema **không bao giờ** được ghi ra disk; lỗi hiển thị rõ lý do kèm hướng dẫn retry | Medium |
| 6 | Offline-safe fallback | Khi Copilot/LLM lỗi hoặc mất kết nối → sinh scaffold từ template thay vì báo lỗi | Medium |
| 7 | Hot-reload pickup | File mới xuất hiện trong UI list trong ≤ 1 giây, không cần restart extension | Low |

### 1.3 Screenshots

See UG.md v2 (`documents/SA4E-193/UG.md`) for command walkthroughs and example outputs.

---

## 2. Technical Changes

### 2.1 API Changes

None — no HTTP/API surface changes. The change is extension-host internal:

| Type | Surface | Description |
|------|---------|-------------|
| New | VS Code commands `create-new-agent`, `create-new-hook`, `create-new-steering`, `create-new-skill` (slash-menu wired) | Registered via `registerConfigCommands()`; skipped when no workspace root |

### 2.2 Database Changes

None — persistence is plain files under the user workspace (`.code-intel/`), created on demand. No migration required.

![Deployment Architecture](diagrams/deployment-architecture.png)

*[Edit in draw.io](diagrams/deployment-architecture.drawio)*

### 2.3 Configuration Changes

| Property | Change Type | Description |
|----------|-----------|-------------|
| `version` ×3 package.json | Modified | 1.36.0 → **1.35.0** (correction commit `f9c64a8`; supersedes intermediate bump `cb83296`, which was never released) |
| *(runtime config)* | None added | LLM via built-in `vscode.lm.selectChatModels({vendor:"copilot"})`; hot-reload globs unchanged from SA4E-189 |

### 2.4 Infrastructure / Code Structure Changes

| Component | Change | Description |
|-----------|--------|-------------|
| `extension/src/commands/ConfigCommands.ts` | Refactored | 593 → 195 lines — thin per-type orchestrators sharing one 8-step pipeline |
| `validation-gate.ts` ★ new | Added | Pure validate-before-write gate: normalize (strip fences/echoed frontmatter/empty) + per-type schema validation + canonical hook serialization — closes GAP-01/GAP-02, fixes D-1/D-2/D-4/D-5/D-7 |
| `hook-gate.ts`, `llm-prompts.ts`, `template-provider.ts`, `frontmatter-utils.ts`, `file-writer.ts`, `config-command-specs.ts`, `name-extractor.ts` ★ new | Added | Single-source-of-truth templates & prompts (fixes D-6), safe path-confined writer, kebab-case name extraction (BR-04) |
| `config-templates/` | Added | Per-command field-spec templates bundled in VSIX (offline fallback source) |
| Distribution artifact | Unchanged model | VSIX package via `vsce package --no-dependencies`; no servers/containers affected |

---
## 3. Bug Fixes

| # | Defect | Summary | Severity |
|---|--------|---------|----------|
| 1 | D-1 | Agent path echoed its own frontmatter block → duplicated `---` header; gate now strips ONE leading frontmatter before canonical prepend (GAP-02) | Major |
| 2 | D-2 | No schema validation before write — invalid JSON/markdown could be persisted; ValidationGate now blocks persistence with reason (GAP-01) | Critical |
| 3 | D-3 | Editor-open failure misclassified the whole command as failed; post-write steps isolated as warn-only — success toast preserved | Major |
| 4 | D-4 | Empty LLM stream treated as success → empty file; empty stream now promotes to template fallback | Major |
| 5 | D-5 | Skill fallback scaffold ignored confirmed name; scaffolds are now `confirmedName`-aware and gate forces skill `name` = folder name | Minor |
| 6 | D-6 | Dead-artifact drift between inline constants and `config-templates/`; TemplateProvider is now the single accessor | Minor |
| 7 | D-7 | Hook serialization emitted inconsistent empty action fields; canonical serializer omits them deterministically | Minor |
| 8 | E2E-API ×13 | 13 backend E2E-API failures (hardcoded port, missing JWT auth on `/mcp/tools/list`, wrong `complexity_analysis` assertion, harness limitations) resolved by refactor `a618e0b` — full green | Major |

---

## 4. Known Issues & Limitations

| # | Issue | Impact | Workaround | Target Fix |
|---|-------|--------|------------|------------|
| 1 | E2E-UI tests not configured (no Playwright config in repo) | No browser-level E2E coverage for extension webviews | Manual smoke matrix per DPG §7.2 | Backlog (Dev + QA) |
| 2 | `admin-ui.e2e.test.ts` and `lod-collapse.e2e.test.ts` excluded from E2E suite | Admin UI & LOD collapse lack automated E2E coverage | Run manually when touching those areas | Backlog |
| 3 | STP.md / STC.md remain template placeholders | Test documentation incomplete for audit trail | TEST-REPORT v3.0 carries execution evidence | Before UAT of next epic |
| 4 | Dual-tab Form+Text editor not yet available (SA4E-190 To Do) | Generated files open in standard text editor instead of custom editor | None needed — flow completes normally; editor upgrade lands with SA4E-190 | SA4E-190 |
| 5 | Target-file collision policy unconfirmed (OI-01/GAP-05) | Existing target surfaces a warning; silent overwrite forbidden until policy decided | Choose a different kebab-case name | Backlog decision |
| 6 | Hot-reload refreshes UI lists only — no `hookEngine.reload()` / system-prompt rebuild / graph recompile (SA4E-189 scope) | New hook rules affect UI immediately; runtime engine behavior picks up per existing reload semantics | Restart window if immediate runtime pickup is required | By design |
| 7 | Non-English description handling unguaranteed (OI-09) | LLM output language may vary for non-English input | Use English descriptions for deterministic results | TBD with PO |

---

## 5. Dependencies

### 5.1 Pre-requisite Releases

| Release | Version | Status | Required Before |
|---------|---------|--------|-----------------|
| SA4E-189 Hot-Reload System | v1.33.0+ | ✅ Deployed | This release (file pickup) |

### 5.2 External System Changes

| System | Change Required | Status | Contact |
|--------|----------------|--------|---------|
| GitHub Copilot LLM (`vscode.lm`) | Active Copilot subscription on user machines | ✅ Available | Platform owner |
| SA4E-190 Dual-Tab Editors | Optional future enhancement (graceful fallback active) | ⏳ To Do | Epic SA4E-181 |

---

## 6. Migration Notes

### 6.1 Data Migration

None. Workspace files under `.code-intel/` are untouched by install/upgrade/uninstall; new sub-directories are created on demand.

### 6.2 Breaking Changes

**No breaking changes in this release. Fully backward compatible.**

### 6.3 Backward Compatibility

Fully compatible: v1.35.0 only adds commands and modules; no existing command, config format, or watcher behavior changed. Files generated by v1.35.0 remain readable by older versions (standard `.code-intel` conventions).

**Upgrade baseline:** the last tagged release before v1.35.0 is **v1.33.0** (no v1.34.0 was ever published; the 1.35 line had been staged by SA4E-190 but never released). Workstations upgrade directly from v1.33.x → v1.35.0. The rollback target is likewise the **v1.33.x line** — no user data action required.

---

## 7. Testing Summary

Source: TEST-REPORT.md v3.0 (Phase 6 re-test on refactor commit `a618e0b`, 2026-08-24) — verdict **SUITE GREEN**.

| Test Level | Total | Passed | Failed | Blocked | Pass Rate |
|-----------|-------|--------|--------|---------|-----------|
| Extension Suite (unit + regression) | 1,621 (+64 new ValidationGate tests) | 1,621 | 0 | 0 | 100% (~78.5s) |
| Backend Suite (unit + integration + E2E-API) | 2,621 | 2,621 | 0 | 0 | 100% (~179.6s) |
| E2E-UI (Playwright) | — | — | — | — | Not configured (known issue #1) |

Defect summary: production defects **D-1..D-7 fixed** and locked by 64 new regression tests (0 regression vs 1,557-test baseline); all **13 historical E2E-API failures resolved**; 4 test-side defects found during v2.0 run also closed.

![Rollback Flow](diagrams/rollback-flow.png)

*[Edit in draw.io](diagrams/rollback-flow.drawio)*

---

## 8. Deployment Instructions

See the full Deployment Guide: [DPG.md](DPG.md)

Quick reference:

| Step | Action | Estimated Time |
|------|--------|---------------|
| 1 | Checkout tag `v1.35.0` + verify lineage (`git rev-parse v1.35.0^{commit}` → `f9c64a8`; merge `3d924ca` in history) | 2 min |
| 2 | Test gates (extension 1,621 · backend 2,621) | ~5 min |
| 3 | Package VSIX (`npm run package:prod`) | 2 min |
| 4 | Publish/side-load + reload window | 3 min |
| 5 | Smoke verification (7 scenarios) | 10 min |
| **Total** | | **~22 min** |

---

## 9. Rollback Plan

Full procedure with diagram: DPG Section 8 ([rollback-flow](diagrams/rollback-flow.png)).

**Rollback Decision Criteria:**
- Commands fail to register / activation errors on PROD workstations → rollback immediately
- ValidationGate false-negatives block > 5% of valid invocations → rollback immediately
- Invalid file ever observed on disk post-write → rollback immediately + investigate
- Minor cosmetic issue with workaround → hotfix v1.35.1, no rollback

**Estimated Rollback Time:** ≤ 15 minutes (VSIX downgrade to archived v1.33.x — the last stable released line before v1.35.0; user workspace data unaffected).

---

## 10. Contacts

| Role | Name | Contact | Responsibility |
|------|------|---------|----------------|
| Product Owner / Reporter | Duc Nguyen Minh | via Jira | Business sign-off |
| Dev Lead | Extension team lead | via Jira | Technical issues |
| QA Lead | QA team | via Jira | Testing sign-off |
| DevOps / Release Manager | DevOps rotation | on-call channel | Deployment execution |
| Scrum Master | SM agent pipeline | via Jira | Release coordination |

---

## 11. Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Dev Lead | Duc Nguyen Minh | 2026-08-24 | ☐ Approved |
| QA Lead | *(QA Agent — TEST-REPORT v3.0 SUITE GREEN)* | 2026-08-24 | ☐ Approved |
| Business Owner | Duc Nguyen Minh | | ☐ Approved |
| Release Manager | *(DevOps Agent)* | 2026-08-24 | ☐ Approved |

---

*RLN v1.1 — DevOps Agent, 2026-08-24. Release v1.35.0 · merge `3d924ca` · version/tag commit `f9c64a8` (annotated tag `v1.35.0` → `f9c64a8`). Sources: BRD v2.0, TDD v2.0, TEST-REPORT v3.0. v1.1: release version corrected v1.36.0 → v1.35.0 per PO decision.*
