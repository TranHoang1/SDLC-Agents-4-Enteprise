# CI/CD Pipeline — SA4E-191 (AI Chat Assistant: 7 Slash Commands)

**Pipeline file:** `ci-sa4e-191.yml`
**Feature branch:** `SA4E-191`
**Monorepo layout:** npm workspaces (`backend`, `extension`)
**Runtime:** Node.js 20 (CI), engines `>=18.14.1` local
**Owner:** DevOps (generated for ticket SA4E-191)

---

## 1. Purpose

This document describes the continuous integration and continuous delivery
pipeline that guards every change to the AI Chat Assistant feature delivering
**7 slash commands** (`/help`, `/summary`, `/explain`, `/review`, `/test`,
`/doc`, `/ask`). The pipeline enforces code quality, property-based test
coverage, API and UI end-to-end verification, and gated promotion to UAT and
Production.

The pipeline is implemented as a single GitHub Actions workflow
`ci-sa4e-191.yml` (see `.github/workflows/ci-sa4e-191.yml`) and is triggered
on `push` and `pull_request` to any branch matching `SA4E-191`, plus a manual
`workflow_dispatch` run.

---

## 2. Triggers

| Event           | Ref pattern        | Behavior                                  |
|-----------------|--------------------|-------------------------------------------|
| `push`          | `SA4E-191*`        | Full pipeline (all jobs)                  |
| `pull_request`  | `SA4E-191*`        | Full pipeline (required status checks)    |
| `workflow_dispatch` | —              | Manual run, selectable `ref`              |

Branches outside the `SA4E-191*` pattern are ignored by this workflow so
trunk pipelines remain separate.

---

## 3. Stages

The pipeline executes the following ordered stages inside the `test` job
(plus a separate `release-gate` job that depends on it):

1. **install** — `npm ci` (clean, deterministic install using `package-lock.json`).
2. **lint** — `npm run lint` (eslint across workspaces). If the script is
   absent, falls back to `npx eslint .`.
3. **typecheck** — `npx tsc --noEmit` (no root `typecheck` script exists;
   workspace-level `tsc` is invoked from the repo root).
4. **unit+PBT** — `npm test` (vitest unit tests). Property-Based Testing is
   part of the unit suite via `fast-check` (shrinking, coverage of edge cases
   for each slash-command handler and the command registry).
5. **integration** — vitest integration profile exercising the command
   registry wiring, dispatcher routing, and backend endpoints together.
6. **e2e-api** — `npx vitest run --project api` (HTTP-level API tests against
   the chat assistant endpoints for all 7 commands).
7. **e2e-ui** — `npx playwright test` against the extension/UI surface
   (slash-command palette, rendering of responses). Requires
   `npx playwright install --with-deps chromium` first.
8. **build** — `npm run build` (builds all workspaces: `backend`, `extension`).
9. **release-gate** — separate job that aggregates quality gates and blocks
   promotion until UAT and Deployment human approvals are recorded.

---

## 4. Tools

| Tool            | Role                                              |
|-----------------|---------------------------------------------------|
| `npm ci`        | Deterministic dependency install                  |
| `eslint`        | Static analysis / linting                         |
| `tsc`           | Type checking (`--noEmit`)                        |
| `vitest`        | Unit + integration + API e2e execution            |
| `fast-check`    | Property-Based Testing inside the unit stage      |
| `Playwright`    | UI end-to-end (chromium only for cost control)    |
| GitHub Actions  | Orchestration, artifacts, job dependencies        |

---

## 5. Quality Gates

The pipeline fails (red) and blocks merge/promotion if any gate is violated:

| Gate                          | Threshold / Rule                                  | Enforcement stage     |
|-------------------------------|---------------------------------------------------|-----------------------|
| Line coverage (handlers+registry) | **≥ 90%** line coverage for all slash-command handler files and the command `registry` module | unit+PBT (coverage report) |
| Overall test pass rate        | **≥ 95%** of executed tests must pass             | all test stages       |
| Defects (Critical/High)       | **0** open Critical or High severity defects      | integration + e2e     |
| Lint                          | 0 errors (warnings allowed but reported)           | lint                  |
| Type check                    | 0 type errors                                     | typecheck             |
| Build                         | Must complete without error                        | build                 |

Coverage is produced with `vitest --coverage` and uploaded as a workflow
artifact (`coverage`) so reviewers can inspect per-file numbers. The
`release-gate` job parses the coverage summary and asserts the handler+registry
subtotal meets 90%.

---

## 6. Parallelization

To keep the feedback loop short, the workflow spreads work across runners:

- `lint`, `typecheck`, and `unit+PBT` run sequentially within the `test` job
  because each is fast and the later depends on the earlier's contract.
- `e2e-api` and `e2e-ui` are defined as **matrix/separate steps but can be
  split into parallel jobs** if runtime grows; the current `test` job runs them
  sequentially to keep artifact handling simple, with a comment marking where
  to extract them into `needs: test` fan-out jobs.
- The `release-gate` job uses `needs: test` so it only starts after all tests
  and the build succeed.

Recommended fan-out (if CI minutes allow): split `e2e-api` and `e2e-ui` into
their own jobs with `runs-on: ubuntu-latest` and `needs: [test-core]` where
`test-core` holds install/lint/typecheck/unit/integration/build.

---

## 7. Artifacts

| Artifact            | Produced by        | Retention | Notes                                  |
|---------------------|--------------------|-----------|----------------------------------------|
| `coverage`          | unit+PBT           | 14 days   | HTML + lcov; gate source of truth      |
| `playwright-report` | e2e-ui             | 14 days   | Traces/screenshots on failure          |
| `dist-backend`      | build              | 30 days   | Built backend output for deploy        |
| `dist-extension`    | build              | 30 days   | Built extension output for deploy      |

All artifacts are uploaded with `actions/upload-artifact@v4` and never contain
secrets (see §9).

---

## 8. Secrets Handling

- Secrets are injected **only** via GitHub Actions encrypted secrets
  (`${{ secrets.* }}`). They are never `echo`ed, never written to logs, and
  never embedded in artifacts.
- The `e2e-ui` and `e2e-api` stages read runtime configuration from
  environment variables prefixed `SA4E_*` that are mapped from secrets at
  runtime; the values are masked automatically by Actions.
- Coverage and Playwright reports are scanned to ensure no `.env`, token, or
  key material is captured; the build steps use `npm ci` (no `.npmrc` auth
  leakage) and the `dist-*` artifacts contain only compiled code.
- Any step that must use a token sets `if: false` logging paths and uses
  `::add-mask::` for dynamically resolved values.

---

## 9. Branch Policy (SA4E-191)

- The feature is developed exclusively on branch `SA4E-191` (or
  `SA4E-191*`) and merged to `main` only via a pull request.
- The `test` job is a **required status check** on the branch protection rule
  for `SA4E-191*`, so the PR cannot merge until green.
- `workflow_dispatch` allows a maintainer to re-run the full pipeline against a
  chosen ref (e.g., to validate a release candidate tag).
- No force-push to `SA4E-191*`; reviews require at least one approver.

---

## 10. Human Gates: UAT and Deployment

The pipeline implements two explicit pause points controlled by humans:

### 10.1 UAT Gate
- After `test` (incl. e2e-ui) passes and `dist-*` artifacts are produced, the
  `release-gate` job enters a **UAT pending** state (implemented as a manual
  approval job or a labeled wait). The QA/PO signs off UAT by applying the
  label `uат-approved` (configurable) or approving the `release-gate` job.
- Only when UAT is approved does the pipeline flag the build as
  "UAT-passed" and make artifacts eligible for the Deployment gate.

### 10.2 Deployment Gate
- The actual deploy to Production is **not** automatic. A separate
  `deploy` job (or external runbook triggered from the release) requires a
  manual trigger (`workflow_dispatch` with `environment: production`) and an
  approver from the DevOps/Release roster.
- The Deployment gate verifies: UAT label present, coverage ≥90% on
  handlers+registry, 0 Critical/High defects, and the git tag for the release
  exists. On approval it promotes `dist-backend` / `dist-extension`.
- Rollback: if post-deploy smoke fails, the previous tagged artifact is
  redeployed via the same `deploy` job with `direction: rollback`.

---

## 11. Pipeline Summary (file: `ci-sa4e-191.yml`)

```
push/PR(SA4E-191*) ─▶ install ─▶ lint ─▶ typecheck ─▶ unit+PBT
                                                              │
                                                              ▼
                                                  integration ─▶ e2e-api ─▶ e2e-ui
                                                              │
                                                              ▼
                                                           build
                                                              │
                                                              ▼
                                                       release-gate
                                                   (UAT human ✓) ─▶ Deployment human ✓ ─▶ PROD
```

The workflow file name is **`ci-sa4e-191.yml`** and lives under
`.github/workflows/`. It is the single source of truth for the stages, gates,
and triggers described above.
