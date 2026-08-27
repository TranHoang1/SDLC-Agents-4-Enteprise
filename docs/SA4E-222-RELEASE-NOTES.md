# Release Notes — SA4E-222

**Title:** Generic self-learning Pega rule understanding for LLM enrichment + rule generation
**Ticket:** SA4E-222 | **Project:** SA4E | **Type:** Story | **Priority:** Medium
**Depends on:** SA4E-214 (groundwork reused, not rebuilt)
**Document version:** v1.0 | **Date:** 2026-08-26

| Field | Value |
|-------|-------|
| **Proposed version** | `v1.39.0` (MINOR bump — new feature; current `backend` version is `1.38.0`, per `release-versioning` semver: MINOR = new feature) |
| **Git tag** | `v1.39.0` (to be created on `master` after merge, per release-versioning skill) |
| **Branch** | `SA4E-222` |
| **Status** | Ready for release (no code committed/tagged yet — DevOps scope is documentation only) |

> The version above is **proposed**; no tag is created by this DevOps pass (per instruction: do not commit). Apply the release-versioning flow (merge → tag → README changelog → branch cleanup) at release time.

---

## 1. What's New

SA4E-222 makes Pega rule understanding **generic and self-learning** so that new rule types need **no hand-written TypeScript**, and the LLM gets **real Pega domain knowledge** for both enrichment (summaries/pseudo-code) and future rule generation.

- **Scope A — Generic deterministic extractor.** A new `PegaGenericLogicExtractor` walks rule JSON, skips internal `px*`/`pz*` fields, detects logic-bearing collections by structural heuristics, and renders them with structure (id/name + relationships like `from→to`, `when→result`). **No LLM calls** — fast, deterministic, suitable for bulk re-enrichment. It becomes the default fallback for any rule type without a dedicated extractor.
- **Scope B — Schema-driven self-learning extractor.** A `SchemaDrivenRenderer` + `PegaSchemaCreator` wire the SA4E-214 `EnrichedSchema` into mechanical extraction. On first encounter of an unseen complex type, the LLM characterizes it and stores `nested_logic_paths`; subsequent instances render structured logic with **no new code**. Fixes **DISC-1** (canonical schema key).
- **Scope C — Pega Platform docs in the KB.** An out-of-band `PegaDocsIngestor` + `retrievePegaConcept` helper ingest and summarize `docs.pega.com` into the KB with structured tags (`pega-doc`, `concept:{name}`, `ruletype:{x}`) and **source attribution** — giving the LLM Pega domain grounding.

For end users / consumers: richer, non-hallucinated rule summaries for previously-unsupported Pega rule types, and (future) better-grounded rule generation.

---

## 2. Technical Changes

### 2.1 New modules (all ≤ 200 lines — code-standards compliant, TC-X-04)
| File | Lines | Role |
|------|-------|------|
| `src/modules/pega/extraction/PegaGenericLogicExtractor.ts` | 155 | Scope A generic extractor + shared `renderPathNodes` |
| `src/modules/pega/extraction/SchemaDrivenRenderer.ts` | 89 | Scope B path resolution + rendering |
| `src/modules/pega/extraction/types.ts` | 28 | `ExtractOptions`, `LogicRenderResult`, `RELATIONSHIP_KEYS` |
| `src/modules/pega/extraction/PegaDocsIngestor.ts` | 75 | Scope C ingestion logic module |
| `src/modules/pega/schema/PegaSchemaCreator.ts` | 91 | Scope B schema creation (fixes DISC-1) |
| `src/modules/memory/pega-concept-retriever.ts` | 88 | `retrievePegaConcept` KB retrieval helper |
| `scripts/ingest-pega-docs.ts` | 104 | Out-of-band CLI (internet + LLM) |
| `scripts/reenrich-pega.ts` | 89 | Re-enrich by kind (fixes DISC-2) |

### 2.2 Modified files
- `src/models/pega-schema.models.ts` — `ExtractionHints` extended with optional `nested_logic_paths` + `path_render_hint` (**backward compatible**, defaults applied).
- `src/modules/pega/PegaContentExtractor.ts` — `buildLogic` dispatch order: **dedicated → schema-driven → generic → metadata fallback** (file is 227 lines; it is a pre-existing *modified* file, not new — BRD requirement satisfied; see OBS-2).
- `src/modules/pega/PegaSymbolSync.ts` — resolves `nested_logic_paths` via `SchemaStorageService.find` and passes `ExtractOptions` (no LLM at index time).
- `src/modules/pega/schema/SchemaAnalyzeService.ts`, `src/engine/enrichment/CodeEnrichmentHandler.ts` — delegate creation to `PegaSchemaCreator`; `formatSchemaForPrompt` surfaces `nested_logic_paths`.

### 2.3 Key behavioral fixes
- **DISC-1 (High):** `PegaSchemaCreator` stores via `SchemaStorageService` using the canonical key `pega-schema:{ruleType}` (pure JSON), replacing the legacy `pega-schema-enriched/{ruleType}` format, so schema-driven renderers actually find on-the-fly schemas.
- **DISC-2 (Med):** `reenrich-pega.ts --kind` now exists (the FSD referenced a non-existent `reenrich-pega-all.ts`), enabling re-enrichment of existing symbols.

### 2.4 Infrastructure / Config
- **No new environment variables, no new secrets, no new Docker services.** Existing `.env.example` set is sufficient.
- **No database schema migration.** The `knowledge_entries` table is reused; new rows are purely additive.
- Dockerfile / `docker-compose.yml` require **no changes** for SA4E-222.

---

## 3. Test Status

| Check | Result |
|-------|--------|
| Full regression + feature suite (`npx vitest run`) | **2660 / 2660 green** (dev baseline) |
| SA4E-222-relevant tests (7 files) | **44 / 44 passed**, duration 1.66s (TEST-REPORT §1) |
| `npx tsc --noEmit` | **exit 0** (clean) |
| `npm run lint` | clean (ESLint over `src/`) |
| Dedicated extractors regression (Flow, CaseType, When, Decision, Declare-Expression, Activity, Model) | **unchanged / green** (AC-A-2, NFR-2, TC-X-01) |

Coverage: 100% of FSD functional requirements (FR/AC) have at least one test case. No Critical/Major defects.

---

## 4. Known Issues & Limitations

| ID | Severity | Description | Workaround |
|----|----------|-------------|------------|
| **OBS-1** | Minor | `extractGenericLogic` walks only **top-level** arrays; an unhandled type whose logic array is nested one level deeper may fall back to the `FIELDS` dump. Not a failure for the 3 validated samples (MapValue, Validate, DecisionTree). | Extend walk to 1 nested level (recommended follow-up). |
| **OBS-2** | Minor | `PegaContentExtractor.ts` is 227 lines (over the 200-line *new-file* guideline). It is a pre-existing modified file, not new; BRD only requires NEW extractors be separate (satisfied). TDD expected it to drop below 200. | Acceptable per BRD; note for awareness. |
| **OBS-3** | Minor | No dedicated automated integration test seeds a KB `pega-schema:` row and asserts the full `resolveNestedLogicPaths → extractRuleContent` path (TC-B-11). Unit support proven. | Add an IT seeding a canonical schema (recommended follow-up). |
| **OBS-4** | Minor | FR-A-2 (`px*`/`pz*` skip inside the generic extractor) not asserted by a dedicated unit test; relies on `isInternalKey` reuse. | Add an explicit assertion (recommended follow-up). |
| **Out-of-band doc ingestion** | By design | Backend has **no internet**; `ingest-pega-docs.ts` must run on a network-capable host (R-3). Live `docs.pega.com` crawl is a manual/out-of-band item (TC-C-10). | Run from CI runner / workstation with DB connectivity; never in-container. |
| **LLM first-encounter non-determinism** | Inherent | Scope B schema creation and Scope C summarization call the LLM; outputs (especially `nested_logic_paths`) are non-deterministic across runs. The extractor tolerates bad paths (falls back to Scope A). | Safe fallback; re-running creation refines paths progressively. |

---

## 5. Dependencies

- **SA4E-214 must be deployed/merged first.** SA4E-222 **reuses** (does not rebuild) its `EnrichedSchema` / `ExtractionHints` / `FieldDescriptor` models, `SchemaStorageService`, `SchemaAnalyzeService`, and `CodeEnrichmentHandler` wiring.
- **External:** `docs.pega.com` (Scope C source, licensed — summaries/paraphrases with attribution only). Local LLM (LM Studio/Ollama) for summarization and schema creation. No third-party API keys.

---

## 6. Migration / Upgrade & Backward Compatibility

- **No DB migration required.** The `knowledge_entries` table is reused; new Scope C rows are **additive** (`type='PEGA_DOC'`), and Scope B learned schemas are **additive** (`source='pega-schema:{ruleType}'`, `type='PEGA_SCHEMA_ENRICHED'`).
- **Model backward compatibility:** `ExtractionHints.nested_logic_paths` and `path_render_hint` are **optional with defaults** (`[]` / `null`). Schemas already stored by SA4E-214 (without these keys) continue to parse and function (FR-B-1, TC-B-10).
- **Canonical schema key:** SA4E-222 standardizes on `pega-schema:{ruleType}` (pure JSON) everywhere via `SchemaStorageService`. Downstream consumers should read schemas from this key. **Breaking only if something still wrote the legacy `pega-schema-enriched/{ruleType}` format — that path is removed by DISC-1.**
- **Dedicated extractors unchanged:** existing per-type extractors (Flow, CaseType, When, Decision, Declare-Expression, Activity, Model) remain the preferred path and produce identical output — **zero regression** (AC-A-2, NFR-2).
- **Rollback:** code-only + additive KB; revert by redeploying the previous tag/image (see Deployment Guide §8). KB doc/schema rows can be purged if desired.

---

## 7. Upgrade Steps (summary)
1. Ensure SA4E-214 is live (schema + services present).
2. Build & deploy `sa4e-backend:1.39.0` (or run `npm run dev` / `npm start` from built `dist/`).
3. *(Optional, out-of-band)* Run `npx tsx scripts/ingest-pega-docs.ts --limit 7` from a network-capable host against the target DB.
4. *(Optional)* Run `npx tsx scripts/reenrich-pega.ts --kind <pxObjClass> --src <export-dir>` to refresh existing symbol bodies.
5. Verify `/health`, lint, `tsc --noEmit`, and the Scope A smoke (structured `LOGIC` block).

---

*End of Release Notes — SA4E-222 (v1.0).*
