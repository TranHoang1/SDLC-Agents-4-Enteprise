# Software Test Cases (STC)

## SA4E-222 — Generic self-learning Pega rule understanding for LLM enrichment + rule generation

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-222 |
| Title | Generic self-learning Pega rule understanding for LLM enrichment + rule generation |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-08-27 |
| Status | Draft |
| Related STP | STP-v1-SA4E-222.docx |
| Related FSD | FSD-v1-SA4E-222.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-27 | QA Agent | Initiate document — auto-generated from FSD use cases and business rules |

---

## Test Case Summary

| Category | ID Range | Count | Priority |
|----------|----------|-------|----------|
| Functional — Happy Path | TC-001 to TC-007 | 7 | High |
| Functional — Alternative Flows | TC-100 to TC-104 | 4 | High |
| Functional — Exception/Error Flows | TC-200 to TC-205 | 6 | High |
| Business Rule Validation | TC-300 to TC-312 | 13 | High |
| Boundary & Negative Testing | TC-400 to TC-403 | 4 | Medium |
| Non-Functional (Performance, Security) | TC-600 to TC-603 | 4 | Medium |
| Integration Testing | TC-700 to TC-703 | 4 | High |
| Regression Testing | TC-800 to TC-801 | 2 | Medium |

---

## 1. Functional Test Cases — Happy Path

### TC-001: Generic extraction detects known container (UC-01)

| Field | Value |
|-------|-------|
| **ID** | TC-001 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-01, BR-A-01, BR-A-02 |
| **Preconditions** | Parsed Pega rule JSON with `pySteps` array of objects |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `extractGenericLogic(ruleJson)` | Returns string containing `LOGIC (generic: pySteps):` |
| 2 | Inspect block | Each step rendered with id/name and relationships |

**Test Data:** Activity rule fixture with `pySteps: [{pyStepName:"Step1", pyAction:"..."}]`
**Postconditions:** Non-null block; contains step identity.

---

### TC-002: Self-learning schema creation (UC-02)

| Field | Value |
|-------|-------|
| **ID** | TC-002 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-02, BR-B-01, BR-B-03 |
| **Preconditions** | Mocked `LLMService.complete` returns valid JSON schema |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `createSchemaOnTheFly("Activity", body)` | Returns `EnrichedSchema` with `rule_type="Activity"` |
| 2 | Check `extraction_hints.nested_logic_paths` | Is a `string[]` (possibly empty) |
| 3 | Call `storeSchema(schema)` | Returns positive id |

**Test Data:** Sample body ≥50 chars; mocked LLM returns `{extraction_hints:{nested_logic_paths:["pySteps"]}}`
**Postconditions:** Schema stored and findable.

---

### TC-003: Schema-driven rendering resolves paths (UC-03)

| Field | Value |
|-------|-------|
| **ID** | TC-003 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-03, BR-B-07 |
| **Preconditions** | Rule JSON with `pyModelProcess.pyShapes` array |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `renderSchemaDrivenLogic(ruleJson, ["pyModelProcess.pyShapes"], logger)` | Returns `LOGIC` block from those nodes |
| 2 | Verify formatting | Identical shape to `renderPathNodes` output |

**Test Data:** Fixture with `pyModelProcess:{pyShapes:[{pyShapeName:"A"}]}`
**Postconditions:** Block present.

---

### TC-004: Canonical schema storage round-trip (UC-04 / DISC-1)

| Field | Value |
|-------|-------|
| **ID** | TC-004 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-04, BR-B-08, BR-B-09 |
| **Preconditions** | Empty KB (knowledge_entries) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `store(schema)` with rule_type "DataTransform" | Returns id |
| 2 | `find("DataTransform")` | Returns equal schema (pure JSON content) |
| 3 | `find("Unknown")` | Returns `null` |

**Test Data:** EnrichedSchema fixture
**Postconditions:** Canonical key resolves.

---

### TC-005: Pega doc ingestion (UC-05)

| Field | Value |
|-------|-------|
| **ID** | TC-005 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-05, BR-C-01, BR-C-02, BR-C-03 |
| **Preconditions** | Injected summarizer + store captured |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `ingest([{url,title,concept:"data-transform",ruleType:"DataTransform",content}])` | Returns `{ingested:1, failed:0}` |
| 2 | Inspect stored entry | tags include `pega-doc`, `concept:data-transform`, `ruletype:datatransform` |
| 3 | Inspect stored content | Contains paraphrase + `Source: {url}` |

**Test Data:** One page fixture
**Postconditions:** KB entry created.

---

### TC-006: Pega concept retrieval (UC-06)

| Field | Value |
|-------|-------|
| **ID** | TC-006 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-06, BR-C-05, BR-C-06, BR-C-07 |
| **Preconditions** | KB seeded with `pega-doc` entry for `concept:data-transform` |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `retrievePegaConcept(engine, {ruleType:"DataTransform"})` | Returns attributed context containing source URL |
| 2 | Call with `ruleType:"Unknown"` | Returns `''` (no matching tags) |

**Test Data:** Seeded doc entry
**Postconditions:** Context or empty string.

---

### TC-007: Re-enrichment backfill (UC-07)

| Field | Value |
|-------|-------|
| **ID** | TC-007 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | UC-07 |
| **Preconditions** | KB without schemas for observed rule types |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `reenrich-pega.ts` over indexed Pega symbols | Schemas created for seen rule types |
| 2 | Verify `find` | Each observed rule type returns a schema |

**Test Data:** Indexed symbols set
**Postconditions:** Learned schemas populated.

---

## 2. Functional Test Cases — Alternative Flows

### TC-100: Generic detects by relationship keys (AF-01)

| Field | Value |
|-------|-------|
| **ID** | TC-100 |
| **Priority** | High |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-01 AF-01, BR-A-02 |
| **Preconditions** | Rule JSON array with keys `from`+`to` but not in allowlist |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `extractGenericLogic` | Detected as logic-bearing (≥2 relationship keys) |

**Test Data:** `{edges:[{from:"A",to:"B"}]}`
**Postconditions:** Block rendered.

---

### TC-101: Schema creation parses fenced JSON (AF-01)

| Field | Value |
|-------|-------|
| **ID** | TC-101 |
| **Priority** | High |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-02 AF-01 |
| **Preconditions** | Mocked LLM returns ```json ... ``` wrapped response |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `createSchemaOnTheFly` | Returns valid schema (fence stripped) |

**Test Data:** Fenced JSON
**Postconditions:** Parsed correctly.

---

### TC-102: Doc ingest without ruleType (AF-01)

| Field | Value |
|-------|-------|
| **ID** | TC-102 |
| **Priority** | High |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-05 AF-01, BR-C-03 |
| **Preconditions** | Page with no `ruleType` |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `ingest([page])` | tags = `pega-doc,concept:{name}` (no ruletype) |

**Test Data:** Page without ruleType
**Postconditions:** Stored without ruletype tag.

---

### TC-103: Schema-driven wildcard path (AF-01)

| Field | Value |
|-------|-------|
| **ID** | TC-103 |
| **Priority** | High |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-03 AF-01, BR-B-07 |
| **Preconditions** | Path `pyStages[].pyProcesses[]` with multiple stages |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `renderSchemaDrivenLogic` with wildcard path | All matching nodes across arrays rendered |

**Test Data:** Multi-stage fixture
**Postconditions:** All nodes rendered.

---

## 3. Functional Test Cases — Exception/Error Flows

### TC-200: LLM schema creation fails (EF-01)

| Field | Value |
|-------|-------|
| **ID** | TC-200 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Requirement** | UC-02 EF-01, BR-B-02 |
| **Preconditions** | Mocked LLM throws |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `createSchemaOnTheFly` | Returns `null`; no partial schema written |

**Test Data:** LLM throws
**Postconditions:** Enrichment continues without schema.

---

### TC-201: Unparseable LLM JSON (EF-02)

| Field | Value |
|-------|-------|
| **ID** | TC-201 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Requirement** | UC-02 EF-02 |
| **Preconditions** | Mocked LLM returns prose without JSON |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `createSchemaOnTheFly` | Returns `null` |

**Test Data:** Non-JSON string
**Postconditions:** No schema.

---

### TC-202: Duplicate schema store (EF-03)

| Field | Value |
|-------|-------|
| **ID** | TC-202 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Requirement** | UC-04 EF-02, BR-B-08 |
| **Preconditions** | Schema already stored for rule type |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `store` again | Throws `SchemaAlreadyExistsError` |

**Test Data:** Same rule_type
**Postconditions:** No duplicate row.

---

### TC-203: Update unknown rule type (EF-03)

| Field | Value |
|-------|-------|
| **ID** | TC-203 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Requirement** | UC-04 EF-03 |
| **Preconditions** | No schema for "Ghost" |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `update("Ghost", fields)` | Throws `SchemaNotFoundError` |

**Test Data:** Unknown rule type
**Postconditions:** No write.

---

### TC-204: Doc ingest page failure (EF-01)

| Field | Value |
|-------|-------|
| **ID** | TC-204 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Requirement** | UC-05 EF-01, BR-C-04 |
| **Preconditions** | One good page, one page whose store throws |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `ingest([good, bad])` | Returns `{ingested:1, failed:1}`; batch continues |

**Test Data:** Mixed pages
**Postconditions:** Good page stored.

---

### TC-205: Concept retrieval no hits (EF-01)

| Field | Value |
|-------|-------|
| **ID** | TC-205 |
| **Priority** | Medium |
| **Type** | Functional — Exception Flow |
| **Requirement** | UC-06 EF-01 |
| **Preconditions** | KB has no `pega-doc` entries |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `retrievePegaConcept` | Returns `''` (not error) |

**Test Data:** Empty KB
**Postconditions:** Graceful empty.

---

## 4. Business Rule Validation

### TC-300: Skip internal/non-logic keys (BR-A-01)

| Field | Value |
|-------|-------|
| **ID** | TC-300 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-A-01 |
| **Preconditions** | Rule JSON with `pxFoo`, `pzBar`, `pyParameters` |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `extractGenericLogic` | None of those keys rendered as logic |

**Test Data:** Internal-key-only fixture
**Postconditions:** `null` returned.

---

### TC-301: Relationship-key threshold (BR-A-02)

| Field | Value |
|-------|-------|
| **ID** | TC-301 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-A-02 |
| **Preconditions** | Array whose items have only 1 relationship key |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `extractGenericLogic` | Not detected (needs ≥2) |

**Test Data:** `{items:[{from:"A"}]}`
**Postconditions:** Not rendered.

---

### TC-302: Node render order (BR-A-03)

| Field | Value |
|-------|-------|
| **ID** | TC-302 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-A-03 |
| **Preconditions** | Node with id, `from`/`to`, `target`/`expression` |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Render node | Parts ordered: identity → `a -> b` → `target = expr` |

**Test Data:** Full node fixture
**Postconditions:** Correct ordering.

---

### TC-303: Max 200 nodes (BR-A-04)

| Field | Value |
|-------|-------|
| **ID** | TC-303 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-A-04 |
| **Preconditions** | Array with 500 objects |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `renderPathNodes` | At most 200 lines rendered |

**Test Data:** 500-item array
**Postconditions:** ≤200 rendered.

---

### TC-304: Shared renderer output (BR-A-05)

| Field | Value |
|-------|-------|
| **ID** | TC-304 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-A-05 |
| **Preconditions** | Same node array |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Render via generic and via schema-driven | Identical formatting |

**Test Data:** Same nodes
**Postconditions:** Byte-equal output.

---

### TC-305: Sample truncation (BR-B-01)

| Field | Value |
|-------|-------|
| **ID** | TC-305 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-B-01 |
| **Preconditions** | Body >6000 chars |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `createSchemaOnTheFly` | LLM receives ≤6000 chars (truncated) |

**Test Data:** 9000-char body
**Postconditions:** Truncated sent.

---

### TC-306: LLM failure non-fatal (BR-B-02)

| Field | Value |
|-------|-------|
| **ID** | TC-306 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-B-02 |
| **Preconditions** | LLM unavailable |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enrichment with no schema | Succeeds via generic extraction |

**Test Data:** Unavailable LLM
**Postconditions:** No crash.

---

### TC-307: nested_logic_paths filtered (BR-B-03)

| Field | Value |
|-------|-------|
| **ID** | TC-307 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-B-03 |
| **Preconditions** | LLM returns mixed-type `nested_logic_paths` |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse schema | Only string entries kept |

**Test Data:** `[ "pySteps", 42, null ]`
**Postconditions:** `["pySteps"]`.

---

### TC-308: Schema defaults (BR-B-04)

| Field | Value |
|-------|-------|
| **ID** | TC-308 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-B-04 |
| **Preconditions** | Minimal LLM response |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse schema | `schema_version=1`, `rule_type` set, all hints defaulted |

**Test Data:** `{}`
**Postconditions:** Valid schema.

---

### TC-309: Unresolvable path tolerant (BR-B-05)

| Field | Value |
|-------|-------|
| **ID** | TC-309 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-B-05 |
| **Preconditions** | Path not present in rule JSON |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Render schema-driven | Path skipped with WARN; other paths still render |

**Test Data:** `["pyNonexistent"]`
**Postconditions:** WARN logged.

---

### TC-310: All paths miss → fallback (BR-B-06)

| Field | Value |
|-------|-------|
| **ID** | TC-310 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-B-06 |
| **Preconditions** | All paths miss |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Render schema-driven | Returns `null` → caller uses generic |

**Test Data:** Wrong paths
**Postconditions:** `null`.

---

### TC-311: Doc paraphrase-only (BR-C-01)

| Field | Value |
|-------|-------|
| **ID** | TC-311 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-C-01 |
| **Preconditions** | Page with long verbatim content |

**Test Steps:**

| Step | Action** | Expected Result |
|------|--------|-----------------|
| 1 | Ingest | Stored content is paraphrase + `Source:`; not verbatim copy |

**Test Data:** Long page
**Postconditions:** No verbatim bulk copy.

---

### TC-312: Doc tag composition (BR-C-02/03)

| Field | Value |
|-------|-------|
| **ID** | TC-312 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-C-02, BR-C-03 |
| **Preconditions** | Page with/without ruleType |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `buildPegaDocTags` | Always `pega-doc`+`concept:`; `ruletype:` only when present |

**Test Data:** Two pages
**Postconditions:** Correct tags.

---

## 5. Boundary & Negative Testing

### TC-400: Empty rule JSON (generic)

| Field | Value |
|-------|-------|
| **ID** | TC-400 |
| **Priority** | Medium |
| **Type** | Boundary / Negative |
| **Requirement** | UC-01 EF-01 |
| **Preconditions** | `{}` |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `extractGenericLogic({})` | Returns `null` |

**Test Data:** `{}`
**Postconditions:** `null`.

---

### TC-401: Body too small for schema creation

| Field | Value |
|-------|-------|
| **ID** | TC-401 |
| **Priority** | Medium |
| **Type** | Boundary / Negative |
| **Requirement** | UC-02 |
| **Preconditions** | bodyText length < 50 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger schema learn | Skipped (no schema created) |

**Test Data:** 10-char body
**Postconditions:** No LLM call.

---

### TC-402: Empty paths array (schema-driven)

| Field | Value |
|-------|-------|
| **ID** | TC-402 |
| **Priority** | Medium |
| **Type** | Boundary / Negative |
| **Requirement** | UC-03 EF-01 |
| **Preconditions** | `paths = []` |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `renderSchemaDrivenLogic(json, [])` | Returns `null` immediately |

**Test Data:** `[]`
**Postconditions:** `null`.

---

### TC-403: Malformed path string

| Field | Value |
|-------|-------|
| **ID** | TC-403 |
| **Priority** | Medium |
| **Type** | Boundary / Negative |
| **Requirement** | UC-03 |
| **Preconditions** | Path with invalid segment e.g. `"pyA..pyB"` |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `resolvePath` | Returns `[]` (no crash) |

**Test Data:** `"pyA..pyB"`
**Postconditions:** Empty array.

---

## 6. UI/UX Testing

N/A — backend-only feature, no UI.

---

## 7. Non-Functional Testing

### TC-600: Generic extraction performance

| Field | Value |
|-------|-------|
| **ID** | TC-600 |
| **Priority** | Medium |
| **Type** | Non-Functional — Performance |
| **Requirement** | FSD §8 |
| **Preconditions** | Typical rule JSON |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Benchmark `extractGenericLogic` | <10ms typical |

**Acceptance Criteria:** p95 < 10ms.

---

### TC-601: Concept retrieval latency

| Field | Value |
|-------|-------|
| **ID** | TC-601 |
| **Priority** | Medium |
| **Type** | Non-Functional — Performance |
| **Requirement** | FSD §8 |
| **Preconditions** | KB seeded with docs |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `retrievePegaConcept` | <200ms |

**Acceptance Criteria:** <200ms.

---

### TC-602: IP compliance of doc ingestion

| Field | Value |
|-------|-------|
| **ID** | TC-602 |
| **Priority** | Medium |
| **Type** | Non-Functional — Security/IP |
| **Requirement** | BRD NFR-5 |
| **Preconditions** | Copyrighted Pega doc text |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ingest | Stored content is paraphrase; source attributed; no verbatim bulk copy |

**Acceptance Criteria:** Reviewer confirms no verbatim reproduction.

---

### TC-603: Reliability under LLM outage

| Field | Value |
|-------|-------|
| **ID** | TC-603 |
| **Priority** | Medium |
| **Type** | Non-Functional — Reliability |
| **Requirement** | BR-B-02 |
| **Preconditions** | LLM down |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run enrichment pipeline | Completes successfully using generic extraction |

**Acceptance Criteria:** 100% completion, 0 crashes.

---

## 8. Integration Testing

### TC-700: CodeEnrichmentHandler uses canonical key (DISC-1)

| Field | Value |
|-------|-------|
| **ID** | TC-700 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | UC-04, DISC-1 fix |
| **Preconditions** | A rule type with a schema stored via canonical key |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enrich a symbol of that rule type | Schema found via canonical key; prompt includes `Nested Logic Paths` |
| 2 | Verify legacy fallback | Legacy SA4E-214 rows still found if canonical absent |

**Test Data:** Rule type with canonical schema
**Postconditions:** DISC-1 resolved.

---

### TC-701: Full pipeline learn + render

| Field | Value |
|-------|-------|
| **ID** | TC-701 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | UC-01/02/03 |
| **Preconditions** | Empty KB, mocked LLM |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enrich unseen rule type | Schema created + stored; logic rendered via schema-driven path |
| 2 | Enrich again | Schema reused from KB (no second LLM call) |

**Test Data:** Sample rule
**Postconditions:** Learned once, reused.

---

### TC-702: Concept retrieval grounding in enrichment

| Field | Value |
|-------|-------|
| **ID** | TC-702 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | UC-06 |
| **Preconditions** | KB seeded with `pega-doc` for the rule type |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enrichment calls `retrievePegaConcept` | Returns attributed context blended into understanding |

**Test Data:** Seeded docs
**Postconditions:** Grounding present.

---

### TC-703: Re-enrich backfill idempotency

| Field | Value |
|-------|-------|
| **ID** | TC-703 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | UC-07 |
| **Preconditions** | Symbols already enriched once |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `reenrich-pega.ts` again | No duplicate schemas (idempotent `store`) |

**Test Data:** Existing schemas
**Postconditions:** No `SchemaAlreadyExistsError` aborts run.

---

## 9. Regression Testing

### TC-800: SA4E-214 legacy schema still readable

| Field | Value |
|-------|-------|
| **ID** | TC-800 |
| **Priority** | Medium |
| **Type** | Regression |
| **Requirement** | UC-04 legacy fallback |
| **Preconditions** | KB with SA4E-214 `pega-schema-enriched/{ruleType}` row, no canonical |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enrich that rule type | Schema found via legacy fallback path |

**Test Data:** Legacy row
**Postconditions:** Enrichment works.

---

### TC-801: PegaContentExtractor reuse stable

| Field | Value |
|-------|-------|
| **ID** | TC-801 |
| **Priority** | Medium |
| **Type** | Regression |
| **Requirement** | Scope A reuse |
| **Preconditions** | `isInternalKey`/`scalarStr` exported from PegaContentExtractor |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Generic extractor uses them | Behavior unchanged vs prior extraction |

**Test Data:** Existing extractor tests
**Postconditions:** Prior tests still pass.

---

## 10. Requirements Traceability Matrix (RTM)

| Requirement | Source | Test Cases | Status |
|-------------|--------|------------|--------|
| UC-01 | FSD 3.1 | TC-001, TC-100, TC-300..304, TC-400 | Covered |
| UC-02 | FSD 3.2 | TC-002, TC-101, TC-200..201, TC-305..308 | Covered |
| UC-03 | FSD 3.3 | TC-003, TC-103, TC-309..310, TC-402..403 | Covered |
| UC-04 | FSD 3.4 | TC-004, TC-202..203, TC-700, TC-800 | Covered |
| UC-05 | FSD 3.5 | TC-005, TC-102, TC-204, TC-311..312 | Covered |
| UC-06 | FSD 3.6 | TC-006, TC-205, TC-702 | Covered |
| UC-07 | FSD 3.7 | TC-007, TC-703 | Covered |
| BR-A-* | FSD 3.1.3 | TC-300..304 | Covered |
| BR-B-* | FSD 3.2.2/3.3.2/3.4.2 | TC-305..310 | Covered |
| BR-C-* | FSD 3.5.2/3.6.2 | TC-311..312 | Covered |
| DISC-1 | BRD Story 4 | TC-004, TC-700 | Covered |

**Coverage Summary:**

| Category | Total | Covered | Coverage % |
|----------|-------|---------|------------|
| Use Cases | 7 | 7 | 100% |
| Business Rules | 12 | 12 | 100% |
| Acceptance Criteria | 15 | 15 | 100% |
| Error Flows | 6 | 6 | 100% |
| **Overall** | **40** | **40** | **100%** |

---

## 11. Appendix

### Test Data Setup Scripts

```typescript
// Vitest beforeEach: seed KB with a canonical schema
await schemaStorage.store(makeSchema("DataTransform"));
// Seed a pega-doc entry
await memoryEngine.ingest({ content: "Data Transform paraphrased...", tags: "pega-doc,concept:data-transform,ruletype:datatransform", source: "https://docs.pega.com/...", summary: "Data Transform" });
```

### Environment Configuration

- `LLMService` mocked via `vi.fn()` returning fixture JSON.
- `docs.pega.com` fetch injected; no live network in tests.
