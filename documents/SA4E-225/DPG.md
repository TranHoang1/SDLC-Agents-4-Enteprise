# Deployment Guide (DPG)

## SDLC-Agents-4-Enterprise code-intel indexer — SA4E-225: Regex symbol-extraction patterns for 9 languages + extToLanguage()/DEFAULT_EXTENSIONS extension

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-225 |
| Title | Incomplete language support: Scala, C/C++, C#, Ruby, PHP, Swift, Bash, PowerShell lack parser/regex patterns for symbol extraction |
| Author | DevOps Agent |
| Version | 1.0 |
| Date | 2026-08-28 |
| Status | Draft |
| Related TDD | documents/SA4E-225/TDD.md (v1.0) |
| Related STP | documents/SA4E-225/STP.md (v1.0) |

> **Deployment Model Note:** This is a **backend library/parser change** inside the `code-intel` indexer (`backend/` TypeScript workspace). There is **NO runtime deployment** — no new container, no database migration, no environment-specific configuration service, and no production topology change. The change ships as part of the normal backend build (`npm run build` / `tsc`) and is exercised by the `vitest` test suite. "Deployment" below refers to the build → test → merge → tag lifecycle and the verification that the new patterns are observable once the rebuilt indexer runs.

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-28 | DevOps Agent | Initiate document — adapted from TDD v1.0, STP v1.0, STC v1.0 and project build config |

---

## Sign-Off

| Name | Role | Signature and date |
|------|------|--------------------|
| | Dev Lead | ☐ Approved for merge |
| | QA Lead | ☐ Testing completed (incl. TC-12 ReDoS gate) |
| | Ops Lead | ☐ N/A — no infra change |

---

## 1. Overview

### 1.1 Feature Summary

Remediates Bug SA4E-225 by enabling regex-based symbol extraction for nine languages that are currently recognized by the indexer but routed to `GENERIC_PATTERNS` only, and by un-skipping PowerShell (`.ps1`):

- Add 9 `PatternDef[]` regex sets (`SCALA_PATTERNS`, `C_PATTERNS`, `CPP_PATTERNS`, `CSHARP_PATTERNS`, `RUBY_PATTERNS`, `PHP_PATTERNS`, `SWIFT_PATTERNS`, `BASH_PATTERNS`, `POWERSHELL_PATTERNS`).
- Extend `extToLanguage()` in `tree-sitter-indexer.ts` with 9 extension→id entries.
- Add `.ps1` to `DEFAULT_EXTENSIONS` (`config/index.ts`) and mirror it in `FALLBACK_EXTENSIONS` (`resolver.ts`).
- Add/extend unit tests (`signature-extractor.test.ts` and/or `languages/__tests__/*`) covering TC-1…TC-12.

Change is internal to the backend indexer — no API, database, or external-system change.

### 1.2 Deployment Scope

| Item | Type | Description |
|------|------|-------------|
| `backend/src/engine/parsers/signature-extractor.ts` | Modified | Routes 9 new language ids → dedicated `PatternDef[]` (via `LANGUAGE_PATTERNS` map); engine-only after refactor |
| `backend/src/engine/parsers/languages/*.ts` (NEW) | New | 9 new `PatternDef[]` consts (+ optional `builtin.ts` relocation of 7 existing consts) |
| `backend/src/engine/parsers/tree-sitter-indexer.ts` | Modified | `extToLanguage()` map gains 9 entries |
| `backend/src/config/index.ts` | Modified | `DEFAULT_EXTENSIONS` gains `'.ps1'` |
| `backend/src/engine/indexer/project-type/resolver.ts` | Modified | `FALLBACK_EXTENSIONS` gains `'.ps1'` |
| `backend/src/engine/parsers/__tests__/signature-extractor.test.ts` + `languages/__tests__/*` | Modified/New | TC-1…TC-12 (incl. ReDoS regression TC-12) |
| Database | — | **N/A** (no schema change) |
| Container / Runtime service | — | **N/A** (library change; picked up on next backend build) |
| Environment variables / Config service | — | **N/A** (only in-code constants changed) |

### 1.3 Target Environments

This change has **no environment-specific topology**. Verification is performed in CI and locally; the updated behavior propagates wherever the rebuilt backend (`dist/`) is installed/run (dev machine, CI agent, or container image built from updated source).

| Environment | How change reaches it | Deploy Order | Approval Required |
|-------------|----------------------|-------------|-------------------|
| CI (PR pipeline) | `npm run check:ci` (lint + lint:lines + build + unit tests incl. TC-12) | 1st (blocking gate) | Automated |
| DEV (local backend) | `npm run build` + `npm run dev` from updated source | 2nd | Dev |
| SIT / UAT / PROD | Rebuilt backend artifact / container image from merged source | 3rd | Standard release sign-off |

> If the indexer is run as a container via `backend/docker-compose.yml`, the change is applied by **rebuilding the image from the merged source** — no new image tag or compose change is specific to this ticket. (Standard release process; not a special deployment for SA4E-225.)

---

## 2. Prerequisites

### 2.1 Infrastructure

| Requirement | Status | Notes |
|-------------|--------|-------|
| Node.js >= 18.14.1 | Required | Defined in `backend/package.json` `engines` |
| Existing build/CI runner | Ready | Runs `npm ci` + `npm run check:ci` |
| Container registry / host | N/A for this ticket | Only relevant if indexer runs in-container; rebuilt from updated source |

### 2.2 Software Dependencies

| Dependency | Version | Status |
|-----------|---------|--------|
| Node.js | >= 18.14.1 | Installed/Pending on runner |
| vitest | ^4.1.9 | Dev dependency (`backend`) |
| typescript | ^5.5.0 | Dev dependency |
| tsx | ^4.0.0 | Dev dependency (for `dev`/`tsx -e` verification) |
| eslint | ^10.8.1 | Dev dependency (lint gate) |

### 2.3 Access Requirements

| Access | Type | Who Needs It |
|--------|------|-------------|
| Git repository (PR author) | SSH/HTTPS | Developer |
| CI pipeline (run tests on PR) | Service account | Automated |
| npm registry (if publishing) | Token | Release engineer (only for publish, not required for merge) |

### 2.4 Backup Requirements

- [x] **Not applicable** — source-only change. Rollback is performed via `git revert` (Section 8). No database, no artifact backup needed; rely on git history.

---

## 3. Pre-Deployment Checklist

| # | Item | Responsible | Status |
|---|------|-------------|--------|
| 1 | Code merged to release branch (PR opened against `master`/`release`) | Developer | ☐ |
| 2 | `npm run lint` passes (no ESLint errors) | Developer | ☐ |
| 3 | `npm run lint:lines` passes (all changed files ≤ 200 lines — AC-5 / TC-015) | Developer | ☐ |
| 4 | `npm run build` (tsc) succeeds | Developer | ☐ |
| 5 | **`npm test` / `npm run test:unit` passes — INCLUDING TC-12 ReDoS regression (mandatory gate)** | Developer/CI | ☐ |
| 6 | No regression: existing tree-sitter languages (typescript, javascript, python, kotlin, java, go, rust, apex, pega) unaffected (TC-011) | QA | ☐ |
| 7 | Security conditions verified: C1 (ReDoS, TC-12), C2 (size guard, TC-013), C4 (Swift `\s+`, TC-014) | QA | ☐ |
| 8 | Feature verification: `.ps1` no longer skipped; Scala/PowerShell symbols appear (Section 7) | QA/Dev | ☐ |
| 9 | Rollback plan reviewed (Section 8 — `git revert`) | Team | ☐ |

---

## 4. Database Migration

**N/A.** No schema, data, or migration script. `ExtractedSymbol` storage is unchanged. Skip this section.

---

## 5. Application Deployment

> Because this is a library change, "deployment" equals **build + test + merge + tag**. The steps below are the concrete commands.

### 5.1 Deployment Flow

Standard CI-gated merge flow (no topology diagram — no infrastructure change):

```
PR opened ─▶ CI: npm ci ─▶ npm run check:ci (lint + lint:lines + build + test:unit)
                                   │
                                   ├─ test:unit FAILS (incl. TC-12) ─▶ BLOCK merge ─▶ fix/revert
                                   │
                                   └─ PASS ─▶ approve ─▶ merge to master ─▶ tag vX.Y.Z
                                                                              │
                                                                              ▼
                                         (optional) rebuild container image from merged source
```

### 5.2 Deployment / Build Steps

Run from the **repository root** (monorepo) or `backend/` workspace:

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Install dependencies | `npm ci` (or `npm install`) from repo root | `node_modules/` present |
| 2 | Lint | `npm run lint` (root, runs `lint --workspaces`) | 0 ESLint errors |
| 3 | Line-count guard (AC-5) | `npm run lint:lines` (root → `scripts/check-line-count.sh`) | All changed files ≤ 200 lines |
| 4 | Build (tsc) | `npm run build` (root, `build --workspaces`) | `backend/dist/` emitted, no type errors |
| 5 | **Run unit tests (CI gate)** | `npm test` (root, `test --workspaces`) **or** `cd backend && npm run test:unit` | 0 failures; TC-12 present in output and PASSING |
| 6 | Merge to master | `git checkout master && git merge <branch> --no-ff` | Merge commit created |
| 7 | Tag release | `git tag -a vX.Y.Z -m "SA4E-225: ..."` | Tag pushed |
| 8 | (Optional) Rebuild container | `docker compose -f backend/docker-compose.yml build` | New image from merged source |

> **Recommended single CI command:** `npm run check:ci` (from `backend/`) runs `lint && lint:lines && build && test:unit` in one go — this is the natural blocking gate and already covers lint, the ≤200-line rule (TC-015), build, and unit tests (which include TC-12 ReDoS). See Section 10 for CI wiring.

### 5.3 Docker Deployment (if indexer runs in-container)

No compose change is required for this ticket. The new behavior is included automatically when the image is rebuilt from merged source:

```bash
# From repo root, after merge
docker compose -f backend/docker-compose.yml build sdlc-agent-4-enterprise-server
docker compose -f backend/docker-compose.yml up -d
docker logs <container> --tail 50   # confirm startup, no crash
```

> Use an explicit version tag for production images — never `latest`. The image version should match the git tag from Step 7.

---

## 6. Configuration Changes

### 6.1 New Environment Variables

**None.** No env-var, secret, or config-service change.

### 6.2 Application Properties / Code Constants

| Constant | Old Value | New Value | File |
|----------|-----------|-----------|------|
| `DEFAULT_EXTENSIONS` | (no `.ps1`) | adds `'.ps1'` | `backend/src/config/index.ts` |
| `FALLBACK_EXTENSIONS` | (no `.ps1`) | adds `'.ps1'` | `backend/src/engine/indexer/project-type/resolver.ts` |
| `extToLanguage()` map | 9 langs missing | 9 new ext→id entries | `backend/src/engine/parsers/tree-sitter-indexer.ts` |
| `getPatterns()` / `LANGUAGE_PATTERNS` | 9 langs → `GENERIC_PATTERNS` | 9 dedicated `PatternDef[]` | `backend/src/engine/parsers/signature-extractor.ts` + `languages/*` |

> **User-override note (TDD §10.1):** If a project supplies its own `includeExtensions` in `config.json`, `.ps1` indexing only applies when `.ps1` is included there. Document this for downstream users who override extension lists.

### 6.3 Feature Flags

**None.** The change is unconditional (TDD §10.2).

---

## 7. Post-Deployment Verification

> Verification goal: confirm the new patterns are actually exercised once the rebuilt indexer runs, and that PowerShell is no longer skipped.

### 7.1 Run the New Tests Locally (vitest)

The new tests (TC-1…TC-12) live in `backend/src/engine/parsers/__tests__/signature-extractor.test.ts` and/or `backend/src/engine/parsers/languages/__tests__/*.test.ts`, both matched by `backend/vitest.config.ts` (`include: ['src/**/*.test.ts', 'tests/**/*.test.ts']`).

```bash
# From repo root — run the whole backend suite (includes TC-12 ReDoS gate)
npm test

# From backend/ — run only unit tests (covers signature-extractor + languages tests)
cd backend && npm run test:unit

# Run the specific symbol-extractor file directly
cd backend && npx vitest run src/engine/parsers/__tests__/signature-extractor.test.ts

# Run per-language tests (if added under languages/__tests__)
cd backend && npx vitest run src/engine/parsers/languages/__tests__/
```

Expected: 0 failures; the ReDoS regression test (TC-12) must be present in the run summary and **PASS**. A hang/timeout in TC-12 = Critical ReDoS defect → blocks release.

### 7.2 Smoke Verification on Real Samples (Scala + PowerShell)

After building, confirm end-to-end that Scala symbols appear and `.ps1` is no longer skipped. Example inline check via `tsx` (does not modify source — run ad hoc):

```bash
cd backend && npx tsx -e "
import('./src/engine/parsers/signature-extractor.ts').then(m => {
  const scala = m.extractSymbols('object Foo {\n  trait Animal\n  case class Cat(name: String)\n  def greet(): Unit = {}\n  val answer = 42\n}', 'scala');
  console.log('SCALA:', scala.map(s => s.kind + ':' + s.name));
  const ps = m.extractSymbols('function Get-Data { param(\$Path) }\nclass Person { [string]\$Name }', 'powershell');
  console.log('POWERSHELL:', ps.map(s => s.kind + ':' + s.name));
});
"
```

Expected output contains at least:
- `SCALA:` → `module:Foo`, `trait:Animal`, `class:Cat`, `function:greet`, `constant:answer` (≥5 distinct kinds).
- `POWERSHELL:` → `function:Get-Data`, `class:Person`, `variable:Path` (≥4 distinct kinds).

### 7.3 Indexer Run Verification (optional SIT)

Point a running rebuilt indexer (`npm run dev` or container) at a mixed-language sample repo containing `.scala` and `.ps1` files, then query symbols / inspect logs:
- Scala file → symbols `object`/`trait`/`case class`/`def`/`val` present (not just `GENERIC`).
- `.ps1` file → present in file stats and symbol extraction (previously it was **skipped entirely**).

### 7.4 Monitoring / Logs

- Existing `pino` logger in `tree-sitter-indexer` logs parse-timeout degradation. Optional debug line (TDD §9) can confirm a new language id is routed:
  `logger.debug({ ext, language }, '[indexer] regex-fallback language resolved');`
- No new metrics/health-checks required.

---

## 8. Rollback Plan

### 8.1 Rollback Flow

Source-only change → rollback = revert the branch/PR via git.

```
Issue detected ─▶ decide rollback
        │
        ▼
git revert <merge-commit>  (or git revert <commit-range> on the branch)
        │
        ▼
npm run build  (confirm it still compiles)
        │
        ▼
npm test  (confirm green again)
        │
        ▼
merge revert ─▶ tag patch (if already released)
```

### 8.2 Rollback Decision Criteria

| Condition | Action |
|-----------|--------|
| TC-12 ReDoS test fails / indexer hangs on real input | **Immediate** — do not merge; fix or revert branch |
| Regression: existing tree-sitter language loses symbols (TC-011 fails) | Immediate — revert |
| `.ps1` still skipped after change | Immediate — revert (config gap) |
| Minor false-positive noise in new language symbols | Hotfix — no full rollback required |

### 8.3 Rollback Steps

| Step | Action | Command | Verification |
|------|--------|---------|-------------|
| 1 | Revert the change | `git revert <sha>` (or `git revert -m 1 <merge-sha>`) | Revert commit created |
| 2 | Rebuild | `npm run build` (backend) | Compiles; `dist/` regenerated |
| 3 | Re-run tests | `npm test` | 0 failures; TC-12 no longer relevant |
| 4 | (If released) tag patch | `git tag -a vX.Y.Z+1 -m "revert SA4E-225"` | Tag pushed |
| 5 | (If container) rebuild image | `docker compose -f backend/docker-compose.yml build` | Image rolled back to prior behavior |

### 8.4 Rollback Time Estimate

| Action | Estimated Time |
|--------|---------------|
| Git revert + push | 1–5 min |
| Rebuild (`tsc`) | 1–3 min |
| Re-run test suite | 1–5 min |
| **Total** | **~3–13 min** |

No database or data rollback needed.

---

## 9. Environment-Specific Notes

### 9.1 CI (PR pipeline) — MANDATORY GATE

- **`npm test` (or `npm run test:unit`) MUST run on every PR** and block merge on failure.
- **TC-12 (ReDoS regression) is a mandatory blocking gate** (Security condition C1). Failure ⇒ Critical defect ⇒ no merge.
- Recommended: run `npm run check:ci` so lint + `lint:lines` (≤200-line rule / TC-015) + build + unit tests all execute as the single blocking job.
- Give the ReDoS test a fast-fail timeout (see Section 10) so a catastrophic backtrack fails the build within seconds, not the 30 s global limit.

### 9.2 DEV

- Run `npm run dev` (tsx watch) from updated source; use the Section 7.2 `tsx -e` snippet to sanity-check Scala/PowerShell extraction locally.

### 9.3 SIT / UAT / PROD

- No separate deployment. Behavior propagates via the rebuilt backend artifact / container image.
- **PROD note:** if the indexer is containerized, rebuild from the merged, tagged source and deploy the version-matched image (never `latest`).

---

## 10. Appendix — CI/CD Configuration Notes (recommended)

### 10.1 Existing test configuration (no change required)

`backend/vitest.config.ts` already covers the new tests:

```ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30000,
    passWithNoTests: true,
    setupFiles: ['./tests/vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],   // ← already matches signature-extractor.test.ts AND languages/__tests__/*.test.ts
    exclude: ['node_modules', 'dist', 'tests/e2e/**'],
    coverage: { provider: 'v8', include: ['src/**/*.ts'], exclude: ['src/**/*.test.ts', 'src/types/**'] },
  },
});
```

**Conclusion (task item #2):** The existing `include` glob already matches both the extended `signature-extractor.test.ts` (under `src/engine/parsers/__tests__/`) and any per-language files under `src/engine/parsers/languages/__tests__/`. **No `vitest.config.ts` change is needed** for the new tests to be collected. (If a team later moves tests outside `src/**` or `tests/**`, the `include` array must be updated accordingly — but that is not required for SA4E-225.)

### 10.2 Ensure `npm test` is a blocking PR gate

There is currently **no** CI workflow file in the repo (`backend/` has `docker-compose*.yml` only; no `.github/workflows/`, `.gitlab-ci.yml`, or `Jenkinsfile` at root). The CI must be wired (or confirmed) to run, on every PR:

```yaml
# Example GitHub Actions job (documentation only — not written to repo)
name: ci
on: [pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '18.14.1' }
      - run: npm ci
      - run: npm run check:ci      # lint + lint:lines + build + test:unit (includes TC-12)
      # Optional extra: full suite incl. integration tests
      - run: npm test
```

**Gate requirements:**
1. `npm test` (or `npm run test:unit`, which `check:ci` already invokes) runs on PR.
2. The job **fails the build** if any test fails — `vitest run` returns non-zero on failure, which blocks merge by default.
3. **TC-12 (ReDoS) is implicitly mandatory** because it is part of the unit suite executed by `check:ci`/`test:unit`. To make the hang fail *fast*, add a short per-test timeout to TC-12 (e.g. wrap the degenerate-input call under a 5 s `test('...', () => {...}, 5000)` or rely on the 30 s global `testTimeout`). A hang that exceeds the timeout fails the build — satisfying C1.

### 10.3 Relationship to `check:ci`

`backend/package.json` defines:
```
"check:ci": "npm run lint && npm run lint:lines && npm run build && npm run test:unit"
```
This single script is the recommended CI entrypoint: it enforces lint, the ≤200-line maintainability rule (TC-015 / AC-5), a clean `tsc` build, and the unit tests (which include the ReDoS gate TC-12). Using `check:ci` as the PR gate guarantees all security conditions (C1/C2/C4) and acceptance criteria are exercised before merge.

### Contacts

| Role | Name | Contact |
|------|------|---------|
| Dev Lead | Unassigned | — |
| QA Lead | QA Agent | — |
| DevOps | DevOps Agent | — |

### Related Tickets

| Ticket | Summary | Relationship |
|--------|---------|-------------|
| SA4E-225 | Incomplete language support (9 languages + PowerShell un-skip) | Main ticket |
