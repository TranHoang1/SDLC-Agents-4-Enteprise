# Deployment Guide — SA4E-222

**Title:** Generic self-learning Pega rule understanding for LLM enrichment + rule generation
**Ticket:** SA4E-222 | **Project:** SA4E | **Type:** Story | **Priority:** Medium
**Depends on:** SA4E-214 (groundwork reused, not rebuilt)
**Document version:** v1.0 | **Status:** Ready for Deployment
**Author:** DevOps Engineer (agent) | **Date:** 2026-08-26

**Source inputs:** `docs/SA4E-222-BRD.md`, `docs/SA4E-222-FSD.md`, `docs/SA4E-222-TDD.md`, `docs/SA4E-222-STP.md`, `docs/SA4E-222-STC.md`, `docs/SA4E-222-TEST-REPORT.md`, Jira SA4E-222, and direct inspection of `backend/` (package.json, Dockerfile, docker-compose.yml, tsconfig.json, `.env.example`, the new modules and scripts).

---

## 1. Overview

SA4E-222 adds **generic, self-learning Pega rule understanding** across three scopes. All changes are **application code additions + one backward-compatible model extension**; there is **no database schema migration** (the `knowledge_entries` table already exists and is reused).

| Scope | What ships | New runtime behavior |
|-------|-----------|----------------------|
| **A** | `PegaGenericLogicExtractor` | Deterministic, LLM-free extraction for any rule type lacking a dedicated extractor (replaces shallow `buildLogicBlocks`). |
| **B** | `SchemaDrivenRenderer`, `PegaSchemaCreator` | Self-learning schema-driven extraction wired to SA4E-214 `EnrichedSchema`. Fixes DISC-1 (canonical key `pega-schema:{ruleType}`). |
| **C** | `PegaDocsIngestor`, `retrievePegaConcept`, `scripts/ingest-pega-docs.ts` | Out-of-band ingestion of Pega Platform docs into the KB with source attribution. **NOT executed at backend runtime** (backend has no internet). |

**Deployment model:**
- Backend runtime is `tsx watch` in dev and `node dist/index.js` in production (Dockerfile `node:20-alpine`).
- Scopes A/B are **in-process** logic used by `PegaContentExtractor.buildLogic` and `PegaSymbolSync` — they deploy automatically with the build.
- Scope C doc ingestion is a **one-off, out-of-band script** run by DevOps/CI on a network-capable host; it is **not** part of the long-running backend container or the normal startup path.
- Re-enrichment of existing symbols is a **manual, out-of-band script** (`reenrich-pega.ts --kind`).

**No new API keys or credentials** are introduced. Source attribution for docs is a public `docs.pega.com` URL stored in the KB row — not a secret (FR-C-5 / NFR-5).

---

## 2. Prerequisites

### 2.1 Infrastructure
- **Node.js:** `>=18.14.1` (Docker image uses `node:20-alpine`). Build step requires `npm ci` + `tsc`.
- **Database:** Either SQLite (default, file `data/agent.db`) or PostgreSQL (`pgvector/pgvector:pg16`). The `knowledge_entries` table must already exist (created by existing migrations; nothing new for SA4E-222).
- **LLM endpoint (local):** `LLMService` points at a local LM Studio / Ollama instance. No cloud API key is required by these modules. Used by (a) Scope C ingestion summarizer and (b) Scope B on-the-fly schema creation.
- **Network (out-of-band only):** The `ingest-pega-docs.ts` script requires egress to `docs.pega.com` and to the local LLM. The **production backend container does NOT need and does NOT have internet** (constraint R-3).

### 2.2 Access / Materials
- Release artifact: built `dist/` (from `npm run build`) or a tagged Docker image.
- For re-enrichment: the **original raw Pega rule JSON export directory** (the rule JSON is not persisted in the DB; only the extracted text is), passed via `--src`.
- For out-of-band ingestion: a checkout of the repo with `node_modules` (run `npm ci` to get `tsx` and dev deps) on a host with internet + LLM reachability, plus connectivity to the target DB (tunnel/port-forward to Postgres, or operate on the SQLite file).

### 2.3 Backward compatibility / dependency
- **SA4E-214 must already be deployed** (its `EnrichedSchema` / `SchemaStorageService` / `CodeEnrichmentHandler` are reused). SA4E-222 does not add new tables; it only extends the `ExtractionHints` model with optional fields (`nested_logic_paths`, `path_render_hint`) that default to `[]`/`null`, so **existing stored schemas remain valid** (FR-B-1, TC-B-10).

---

## 3. Pre-Deployment Checklist

- [ ] Code merged to the release branch and `package.json` version bumped (suggested `1.39.0`, see Release Notes).
- [ ] `npm ci` succeeded on the build host.
- [ ] `npm run lint` clean (ESLint over `src/`).
- [ ] `npx tsc --noEmit` clean (exit 0) — verified in QA (TEST-REPORT §1, cmd 2).
- [ ] `npx vitest run` green — full suite **2660/2660**, SA4E-222-relevant **44/44** (TEST-REPORT §1).
- [ ] Database backup taken (SQLite: copy `data/agent.db`; Postgres: `pg_dump`). Even though there is no schema migration, the out-of-band scripts write additive KB rows (see rollback).
- [ ] Target DB is the SA4E-214-enabled schema (knowledge_entries present).
- [ ] For out-of-band ingestion: network + LLM reachability confirmed on the runner; DB connectivity from runner confirmed.
- [ ] Rollback plan (Section 8) reviewed and a previous release tag/image is available.

---

## 4. Build & Run (Scopes A & B — in-process)

Scopes A/B require no separate service; they compile into `dist/` and run inside the backend.

```bash
cd backend

# 1. Install (reproducible)
npm ci

# 2. Type-check (also enforced by build)
npx tsc --noEmit

# 3. Lint
npm run lint

# 4. Build (tsc + copy src/viewer -> dist/viewer)
npm run build

# 5a. Run in dev (tsx watch)
npm run dev

# 5b. Run in production (compiled)
npm start          # node dist/index.js  (PORT via env, default 48721)
```

**Docker:**

```bash
cd backend
docker build -t sa4e-backend:1.39.0 .
# from compose root:
docker compose -f docker-compose.yml up -d backend
```

> **NOTE — no `index` script.** The task brief referenced an `index` script in `package.json` as an "empty placeholder (build handles generation)". **This is inaccurate:** there is **no `index` script** in `backend/package.json` (or the root workspace `package.json`). Generation is handled entirely by `npm run build` (`tsc && copy ./src/viewer -> ./dist/viewer`, see `package.json` line 12). Do **not** add an `index` placeholder; `build` is the only generation step.

The Dockerfile/Compose already expose `PORT 48721` and a `/health` endpoint (`HEALTHCHECK` in Dockerfile). No Compose change is needed for SA4E-222 — Scopes A/B run inside the existing `backend` service, and Scope C ingestion is a one-off script (not a service).

---

## 5. Out-of-Band Operations

### 5.1 Scope C — Pega docs KB ingestion (`ingest-pega-docs.ts`)

Because the backend has **no internet at runtime** (R-3), run this **on a network-capable host** (CI runner / workstation), pointing at the **same target DB** as production. **Do not run it inside the slim prod container.**

```bash
cd backend
npm ci                      # ensures tsx + deps are present
export DB_ENGINE=postgresql # or sqlite
export DATABASE_URL=postgresql://<user>:<pass>@<host>:5432/sa4e_db   # or DB_PATH for sqlite
# (LLM endpoint is configured via the existing LLMService local settings — no API key)

# ingest the 7 BRD seed concept areas (default), or limit:
npx tsx scripts/ingest-pega-docs.ts --limit 7
```

What it does:
- Fetches the 7 seed `docs.pega.com` Platform pages (`SEED_CONCEPTS` in the script).
- Summarizes each via the local LLM (**paraphrase only**, never verbatim — NFR-5 / FR-C-5).
- Inserts one row per page into `knowledge_entries` with:
  - `type = 'PEGA_DOC'`
  - `tags = 'pega-doc,concept:{name}[,ruletype:{x}]'`
  - `content` ending with `Source: <url>` and `source = <url>` (attribution preserved, TC-C-02).

> **Idempotency caveat:** the insert has **no `ON CONFLICT`** — re-running creates duplicate `PEGA_DOC` rows. Run once per environment. To re-run cleanly, first purge prior rows (see rollback §8.2) or dedupe by `source` before insert.

Connectivity options from the runner to the prod DB:
- **Postgres:** port-forward / VPN to the DB host, set `DATABASE_URL`.
- **SQLite:** copy `data/agent.db` to the runner, run ingestion against it, copy back (or mount a volume). Ensure no backend is writing concurrently.

### 5.2 Re-enrich existing symbols (`reenrich-pega.ts --kind`)

After deploy, regenerate existing symbol bodies so they benefit from the new Scope A/B extractors (NFR-4, DISC-2 fix). Requires the **raw Pega rule JSON export directory** (not in DB).

```bash
cd backend
export DB_ENGINE=sqlite          # or postgresql + DATABASE_URL
export PROJECT_ID=default        # match the symbols' project_id
npx tsx scripts/reenrich-pega.ts --kind Rule-Obj-Activity --src ./pega-export
```

- `--kind` filters by `pxObjClass` (optional; omit to process all types in `--src`).
- `--src` defaults to `./pega-export` (directory of `*.json` rule files).
- For each file it resolves the matching `symbols` row (`kind = pega_<tail>`, `name`) and calls `refreshRuleSymbolBody`, regenerating the body. Non-matching / unreadable files are skipped and counted (never silently swallowed).
- **Non-destructive:** only symbol body text is rewritten; no schema change.

---

## 6. Configuration / Environment

No new environment variables are introduced by SA4E-222. The existing `.env.example` set remains sufficient. Relevant vars consumed by the scripts:

| Variable | Used by | Purpose | Default |
|----------|---------|---------|---------|
| `DB_ENGINE` | both scripts | `sqlite` or `postgresql` | `sqlite` |
| `DB_PATH` | both scripts (sqlite) | path to `agent.db` | `data/agent.db` |
| `DATABASE_URL` | both scripts (postgres) | Postgres connection string | — |
| `DATABASE_ADAPTER` | backend runtime | selects adapter | `postgresql` |
| `PROJECT_ID` | `reenrich-pega.ts` | scope of symbol lookup | `default` |
| `NODE_ENV`, `PORT` | backend runtime | server config / health port | `development` / `48721` |
| LLM endpoint (local) | `ingest-pega-docs.ts`, `PegaSchemaCreator` | summarization / schema creation | existing `LLMService` config |

**Secrets:** none added. Doc attribution is a public URL stored as data, not a credential. No cloud API keys are referenced by these modules.

---

## 7. Post-Deployment Verification

1. **Static / CI gates (must be green before promoting):**
   - `npm run lint` → no errors.
   - `npx tsc --noEmit` → exit 0.
   - `npx vitest run` → full suite **2660/2660**; SA4E-222 subset **44/44** (TEST-REPORT §1, Appendix B).
2. **Health check:** `GET http://<host>:48721/health` returns 200 (Dockerfile `HEALTHCHECK`).
3. **Smoke — Scope A (generic):** index an unhandled rule type (e.g., `Rule-Obj-MapValue`) and inspect the generated symbol body; it must contain a structured `LOGIC (generic: …)` block, **not** a flat `FIELDS` dump (AC-A-1, TC-A-01/08/09).
4. **Smoke — Scope B (schema-driven, optional / LLM):** on first encounter of a complex unseen type with the LLM available, confirm a canonical `pega-schema:{ruleType}` row is created and subsequent instances render via `SchemaDrivenRenderer` without new TypeScript (AC-B-1; end-to-end is a manual item TC-B-14).
5. **Smoke — Scope C (if ingestion ran):** query the KB for `pega-doc` rows; `retrievePegaConcept({ ruleType })` returns concept context with `(source: <url>)` attribution (TC-C-04/05/06).
6. **Logs:** no unexpected `ERROR`/`FATAL`; per code-standards every `catch` logs at WARN/ERROR (no silent swallow).

---

## 8. Rollback Plan

SA4E-222 is a **code-only + additive-KB** change with **no DB schema migration**. Rollback is therefore low-risk.

### 8.1 Application rollback (primary)
- Re-deploy the **previous release tag / image**:
  ```bash
  git checkout <previous-tag> && cd backend && npm ci && npm run build
  # or
  docker build -t sa4e-backend:<previous> . && docker compose up -d backend
  ```
- Scopes A/B disappear from the build; dedicated extractors are unchanged so no behavior regression.
- **Decision criteria to trigger rollback:** `/health` fails after deploy, `vitest` regression in the dedicated-extractor suite, or error rate > 5% on enrichment. Roll back immediately.

### 8.2 KB data rollback (only if you want to undo Scope C / learned schemas)
The scripts write **additive, benign** rows. If you must revert them:
```sql
-- Remove out-of-band doc entries:
DELETE FROM knowledge_entries WHERE type = 'PEGA_DOC' AND tags LIKE '%pega-doc%';

-- (Optional) Remove on-the-fly learned schemas so extraction falls back to generic:
DELETE FROM knowledge_entries WHERE type = 'PEGA_SCHEMA_ENRICHED' AND source LIKE 'pega-schema:%';
```
- These deletes are safe and non-destructive to the rest of the system. If left in place, they simply continue to provide grounding/learned paths; no harm on rollback of code.
- Re-enrichment (`reenrich-pega.ts`) rewrites symbol bodies; to revert those, re-run it against the **previous** extractors after the code rollback (or restore the `symbols` body column from the pre-deploy DB backup).

### 8.3 Verification after rollback
- `/health` 200; `npm run lint` + `npx tsc --noEmit` clean on the restored version.
- Re-run the Scope A smoke (structured `LOGIC` block) to confirm the restored extractor path.
- Confirm no `PEGA_DOC`/`pega-schema:` rows remain if you executed §8.2.

---

## 9. Environment-Specific Notes

| Environment | Build/run | Out-of-band ingestion | Re-enrich | Approval |
|-------------|-----------|----------------------|-----------|----------|
| **DEV** | `npm run dev` (tsx watch) | optional, dev runner | optional | Dev |
| **SIT** | Docker image `sa4e-backend:1.39.0` | run from CI runner w/ network + DB tunnel | after deploy | QA/DevOps |
| **UAT** | Docker image | run from CI runner w/ network + DB tunnel; verify `pega-doc` rows | after deploy | PO/DevOps |
| **PROD** | Docker image, `restart: unless-stopped` | **out-of-band only**, on secured runner; never in-container; audit attribution | after deploy, off-peak | Change Advisory |

**General:** SA4E-214 must be live first. No Compose service addition is required. The ingestion and re-enrich scripts are executed manually/out-of-band, never as part of backend startup.

---

*End of Deployment Guide — SA4E-222 (v1.0).*
---

## 10. CI/CD Notes (suggested pipeline)

There is **no existing CI configuration** in the repo (no `.github/workflows`, `.gitlab-ci.yml`, or `Jenkinsfile`). The following is a **recommended** pipeline that references the suite already present in `backend/package.json`.

### 10.1 Suggested stages
| Stage | Command | Purpose / Gate |
|-------|---------|----------------|
| Install | `npm ci` | Reproducible deps (backend) |
| Lint | `npm run lint` (`eslint src/ --ext .ts`) | Static quality (code-standards) |
| Type-check | `npx tsc --noEmit` | Whole-project type safety (must be exit 0) |
| Test | `npm test` → `vitest run` | **Full suite 2660/2660**; SA4E-222 subset **44/44** |
| Build | `npm run build` (`tsc && copy src/viewer`) | Produce `dist/` |
| Docker build & push | `docker build -t sa4e-backend:${VERSION} .` | Immutable artifact |
| Deploy | `docker compose up -d backend` (or k8s rollout) | Zero-downtime promote |
| Post-deploy verify | `curl /health` + Scope A smoke (structured `LOGIC` block) | Sanity before sign-off |

### 10.2 What is deliberately NOT in the standard pipeline
- **Scope C doc ingestion (`ingest-pega-docs.ts`)** requires internet egress + a local LLM and must run **out-of-band** on a network-capable runner (backend runtime has no internet, R-3). Run it as a separate manual/CI job, never as a build/deploy step.
- **Re-enrichment (`reenrich-pega.ts --kind`)** is a post-deploy, data-mutating operation — run manually/off-peak, not in the gating pipeline.

### 10.3 Flag: the `index` script does NOT exist
The brief stated the `index` script in `package.json` is an "empty placeholder (build handles generation)." **This is incorrect** — there is **no `index` script** in `backend/package.json` (or the root workspace `package.json`). Generation is performed solely by `npm run build` (`tsc && copy ./src/viewer → ./dist/viewer`). A CI `build` step should invoke `npm run build` (or `npx tsc --noEmit` for the type-check gate); do **not** reference an `npm run index` step, as it would fail.

### 10.4 Test references (existing suite)
- Unit/integration/e2e entry points already wired: `test` (`vitest run`), `test:unit`, `test:integration`, `test:e2e-api`, `test:e2e-ui`. For the gating stage use `npm test` (full `vitest run`).
- SA4E-222-specific test files (all green, 44/44): `PegaGenericLogicExtractor.test.ts`, `SchemaDrivenRenderer.test.ts`, `PegaSchemaCreator.test.ts`, `pega-concept-retriever.test.ts`, `PegaDocsIngestor.test.ts`, `PegaContentExtractor.test.ts`, `PegaSymbolSync.test.ts`.
- No new test infrastructure is required; the existing Vitest config (`vitest.config.ts`) covers them.

*End of CI/CD Notes.*
