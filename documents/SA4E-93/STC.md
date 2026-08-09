# System Test Cases (STC)

## SDLC-Agents-4-Enterprise — SA4E-93: Pega Rule Schema Generator

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-93 |
| Title | Pega Rule Schema Generator — System Test Cases |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-08-07 |
| Status | Draft |
| Related STP | STP-v1-SA4E-93.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-07 | QA Agent | Initial STC from STP v1.0 |

---


## 1. Property-Based Tests (PBT)

### TC-PBT-01: ControlTypeMapper — All 13 Known Types

| Field | Value |
|-------|-------|
| ID | TC-PBT-01 |
| Level | PBT |
| Component | ControlTypeMapper |
| BR | BR-03 |
| Priority | High |

**Property:** For every known PegaControlType, `mapControlToSchema()` returns the correct JSON Schema type.

**Generator:** `fc.constantFrom('TextInput','TextArea','NumberInput','Checkbox','Dropdown','RadioButtons','DatePicker','Autocomplete','Link','Integer','Hidden','PageList','PageGroup')`

**Oracle:**

| Input | Expected type |
|-------|--------------|
| TextInput | "string" |
| TextArea | "string" |
| NumberInput | "number" |
| Checkbox | "boolean" |
| Dropdown | "string" (+ enum) |
| RadioButtons | "string" (+ enum) |
| DatePicker | "string" (format:"date-time") |
| Autocomplete | "string" |
| Link | "string" (format:"uri") |
| Integer | "integer" |
| Hidden | "string" |
| PageList | "array" |
| PageGroup | "object" |

**Iterations:** 1000
**Pass Criteria:** Zero failures across all iterations.
**Test Data:** `test-data/control-type-mappings.csv`
---

### TC-PBT-02: ControlTypeMapper — Unknown Fallback

| Field | Value |
|-------|-------|
| ID | TC-PBT-02 |
| Level | PBT |
| Component | ControlTypeMapper |
| BR | BR-03 |
| Priority | High |

**Property:** Any string NOT in the 13 known types returns `"string"`.

**Generator:** `fc.string().filter(s => !KNOWN_TYPES.includes(s))`

**Pass Criteria:** `inferJsonType(unknownType) === "string"` for all generated values.

---

### TC-PBT-03: HarnessSectionParser — Nested Depth Flattening

| Field | Value |
|-------|-------|
| ID | TC-PBT-03 |
| Level | PBT |
| Component | HarnessSectionParser |
| BR | AC4 |
| Priority | High |

**Property:** For any nesting depth N (0-10), `extractControls()` returns a flat array (not nested).

**Generator:** Custom generator producing section trees of depth N with random controls at each level.

**Pass Criteria:** `Array.isArray(result)` and `result.every(c => 'fieldName' in c)` — no nested arrays.

---

### TC-PBT-04: Schema Required subset of Properties

| Field | Value |
|-------|-------|
| ID | TC-PBT-04 |
| Level | PBT |
| Component | PegaSchemaGenerator |
| BR | BR-02 |
| Priority | High |

**Property:** Every entry in `schema.required[]` exists as a key in `schema.properties`.

**Generator:** `fc.array(controlDefArbitrary)` where `controlDefArbitrary` generates random ControlDefinitions.

**Pass Criteria:** `schema.required.every(f => f in schema.properties)` for all inputs.

---

### TC-PBT-05: additionalProperties Always True

| Field | Value |
|-------|-------|
| ID | TC-PBT-05 |
| Level | PBT |
| Component | PegaSchemaGenerator |
| BR | BR-06 |
| Priority | High |

**Property:** `buildSchema()` always sets `additionalProperties: true` regardless of input.

**Generator:** Any array of ControlDefinitions (including empty).

**Pass Criteria:** `schema.additionalProperties === true` for every generated schema.

---

### TC-PBT-06: SchemaWriter — Filename Sanitization Characters

| Field | Value |
|-------|-------|
| ID | TC-PBT-06 |
| Level | PBT |
| Component | SchemaWriter |
| BR | BR-09 |
| Priority | Medium |

**Property:** Output of `sanitizeFileName()` contains only `[a-zA-Z0-9_-.]`.

**Generator:** `fc.string({minLength: 1, maxLength: 100})`

**Pass Criteria:** `/^[a-zA-Z0-9_\-.]+$/.test(sanitizeFileName(input))` for all inputs.
**Test Data:** `test-data/filename-sanitization.csv`

---

### TC-PBT-07: SchemaWriter — Non-Empty Output

| Field | Value |
|-------|-------|
| ID | TC-PBT-07 |
| Level | PBT |
| Component | SchemaWriter |
| BR | BR-09 |
| Priority | Medium |

**Property:** Non-empty input always produces non-empty output.

**Generator:** `fc.string({minLength: 1})`

**Pass Criteria:** `sanitizeFileName(input).length > 0`

---

## 2. Unit Tests (UT)

### TC-UT-01: ControlTypeMapper — TextInput to String

| Field | Value |
|-------|-------|
| ID | TC-UT-01 |
| Level | UT |
| Component | ControlTypeMapper |
| BR | BR-03, BR-01 |
| Priority | High |

**Preconditions:** ControlTypeMapper instantiated.

**Steps:**
1. Create ControlDefinition: `{ fieldName: 'pyName', controlType: 'TextInput', required: true, maxLength: 100 }`
2. Call `mapControlToSchema(control)`
3. Verify returned property

**Expected:**
`json
{ "type": "string", "maxLength": 100 }
`

**Pass/Fail:** Result matches expected JSON exactly.

---

### TC-UT-02: ControlTypeMapper — Checkbox to Boolean

| Field | Value |
|-------|-------|
| ID | TC-UT-02 |
| Level | UT |
| Component | ControlTypeMapper |
| BR | BR-03 |
| Priority | High |

**Steps:**
1. Create ControlDefinition: `{ fieldName: 'pyEnabled', controlType: 'Checkbox', required: true }`
2. Call `mapControlToSchema(control)`

**Expected:**
`json
{ "type": "boolean", "default": false }
`

---

### TC-UT-03: ControlTypeMapper — Dropdown to Enum

| Field | Value |
|-------|-------|
| ID | TC-UT-03 |
| Level | UT |
| Component | ControlTypeMapper |
| BR | BR-03 |
| Priority | High |

**Steps:**
1. Create ControlDefinition: `{ fieldName: 'pyStatus', controlType: 'Dropdown', validValues: ['Active','Inactive','Pending'] }`
2. Call `mapControlToSchema(control)`

**Expected:**
`json
{ "type": "string", "enum": ["Active", "Inactive", "Pending"] }
`

---

### TC-UT-04: ControlTypeMapper — Unknown Fallback

| Field | Value |
|-------|-------|
| ID | TC-UT-04 |
| Level | UT |
| Component | ControlTypeMapper |
| BR | BR-03 |
| Priority | High |

**Steps:**
1. Create ControlDefinition: `{ fieldName: 'pyCustom', controlType: 'FancyWidget3000' }`
2. Call `mapControlToSchema(control)`

**Expected:**
`json
{ "type": "string" }
`

---

### TC-UT-05: HarnessSectionParser — Single Section

| Field | Value |
|-------|-------|
| ID | TC-UT-05 |
| Level | UT |
| Component | HarnessSectionParser |
| BR | AC4 |
| Priority | High |

**Steps:**
1. Create section JSON with `pyControls` containing 3 controls (TextInput, Checkbox, Dropdown)
2. Call `extractControls(harnessJson)` where harnessJson has pyContentSection = section

**Expected:** Array of 3 ControlDefinitions with correct fieldNames and types.

**Test Data:** `test-data/harness-full-json.csv` row 1

---

### TC-UT-06: HarnessSectionParser — Nested Sections (2 Levels)

| Field | Value |
|-------|-------|
| ID | TC-UT-06 |
| Level | UT |
| Component | HarnessSectionParser |
| BR | AC4 |
| Priority | High |

**Steps:**
1. Create harness JSON with pyContentSection containing:
   - 2 controls at level 1
   - 1 nested pySections with 3 controls at level 2
2. Call `extractControls(harnessJson)`

**Expected:** Flat array of 5 ControlDefinitions (2 + 3).

---

### TC-UT-07: HarnessSectionParser — Empty Section

| Field | Value |
|-------|-------|
| ID | TC-UT-07 |
| Level | UT |
| Component | HarnessSectionParser |
| Priority | Medium |

**Steps:**
1. Create harness JSON with pyContentSection having empty pyControls and no pySections
2. Call `extractControls(harnessJson)`

**Expected:** Empty array `[]`.

---

### TC-UT-08: HarnessSectionParser — Deduplication

| Field | Value |
|-------|-------|
| ID | TC-UT-08 |
| Level | UT |
| Component | HarnessSectionParser |
| Priority | Medium |

**Steps:**
1. Create harness with 2 controls having same fieldName "pyClassName"
2. Call `extractControls(harnessJson)`

**Expected:** Array with 1 ControlDefinition (deduplicated by fieldName).

---

### TC-UT-09: HarnessSectionParser — Header+Content+Footer

| Field | Value |
|-------|-------|
| ID | TC-UT-09 |
| Level | UT |
| Component | HarnessSectionParser |
| Priority | High |

**Steps:**
1. Create harness JSON with:
   - pyHeaderSection: 1 control
   - pyContentSection: 2 controls
   - pyFooterSection: 1 control
2. Call `extractControls(harnessJson)`

**Expected:** Array of 4 ControlDefinitions from all 3 sections.

---

### TC-UT-10: PegaHttpClient — Filter Params Correct

| Field | Value |
|-------|-------|
| ID | TC-UT-10 |
| Level | UT |
| Component | PegaHttpClient |
| BR | BR-12 |
| Priority | High |

**Steps:**
1. Mock `fetchWithRetry()` to capture request body
2. Call `listRulesByFilter('Rule-HTML-Harness', 'pyStreamName', 'RuleForm', 50, 1)`
3. Verify captured body contains correct ObjClass, FilterPropName, FilterPropValue, PageSize, PageIndex

**Expected:** Request body has `ObjClass=Rule-HTML-Harness`, `FilterPropName=pyStreamName`, `FilterPropValue=RuleForm`.

---

### TC-UT-11: PegaHttpClient — Pagination Loop

| Field | Value |
|-------|-------|
| ID | TC-UT-11 |
| Level | UT |
| Component | PegaHttpClient |
| BR | BR-05 |
| Priority | High |

**Steps:**
1. Mock 3 responses: page1 (pxMore=true, 50 items), page2 (pxMore=true, 50 items), page3 (pxMore=false, 10 items)
2. Call `crawlHarnesses(report)`
3. Verify all 110 items collected

**Expected:** 3 API calls made, result array has 110 HarnessSummary items.
**Test Data:** `test-data/harness-summaries.csv`

---

### TC-UT-12: PegaSchemaGenerator — groupByRuleType

| Field | Value |
|-------|-------|
| ID | TC-UT-12 |
| Level | UT |
| Component | PegaSchemaGenerator |
| BR | BR-11 |
| Priority | High |

**Steps:**
1. Create 5 HarnessSummary objects: pyClassName = ['Rule-Obj-Activity', 'Rule-Obj-Flow', 'Rule-Obj-Activity', 'Rule-Obj-Model', 'Rule-Obj-Flow']
2. Call `groupByRuleType(summaries)`

**Expected:** Map with 3 entries (Activity, Flow, Model). Deduplicates by pyClassName.

---

### TC-UT-13: PegaSchemaGenerator — buildSchema Validity

| Field | Value |
|-------|-------|
| ID | TC-UT-13 |
| Level | UT |
| Component | PegaSchemaGenerator |
| BR | BR-01, BR-06 |
| Priority | High |

**Steps:**
1. Create controls: [{fieldName:'pyName', controlType:'TextInput', required:true}, {fieldName:'pyEnabled', controlType:'Checkbox', required:false}]
2. Call `buildSchema('Rule-Obj-Activity', controls)`
3. Validate result with ajv against draft-07 meta-schema

**Expected:**
- `` = "http://json-schema.org/draft-07/schema#"
- `additionalProperties` = true
- `required` = ["pyName"] (only mandatory fields)
- ajv compilation succeeds

---

### TC-UT-14: SchemaWriter — Filename Preserves Casing

| Field | Value |
|-------|-------|
| ID | TC-UT-14 |
| Level | UT |
| Component | SchemaWriter |
| BR | BR-09 |
| Priority | High |

**Steps:**
1. Call `sanitizeFileName('Rule-Obj-Activity')`

**Expected:** `"Rule-Obj-Activity"` (casing preserved, hyphens kept).

---

### TC-UT-15: SchemaWriter — Invalid Chars Replaced

| Field | Value |
|-------|-------|
| ID | TC-UT-15 |
| Level | UT |
| Component | SchemaWriter |
| BR | BR-09 |
| Priority | High |

**Steps:**
1. Call `sanitizeFileName('Rule/With\\Special:Chars*Here')`

**Expected:** `"Rule-With-Special-Chars-Here"` (invalid chars replaced with `-`).
**Test Data:** `test-data/filename-sanitization.csv`

---

### TC-UT-16: Error — No Harnesses Found (AF-01)

| Field | Value |
|-------|-------|
| ID | TC-UT-16 |
| Level | UT |
| Component | PegaSchemaGenerator |
| BR | AF-01 |
| Priority | Medium |

**Steps:**
1. Mock listRulesByFilter to return `{ pxResults: [], pxMore: false }`
2. Call `generateSchemas(report)`

**Expected:** Result has `schemasGenerated=0`, `errors=[]`. No exception thrown. Info-level log.

---

### TC-UT-17: Error — Single Fetch 404 (BR-08)

| Field | Value |
|-------|-------|
| ID | TC-UT-17 |
| Level | UT |
| Component | PegaSchemaGenerator |
| BR | BR-08 |
| Priority | High |

**Steps:**
1. Mock: 3 rule types discovered. queryRuleByTriple returns 404 for type 2, success for types 1 and 3
2. Call `generateSchemas(report)`

**Expected:** `schemasGenerated=2`, `schemasFailed=1`, `errors[0].ruleType='Type2'`, `errors[0].phase='fetch'`.

---

### TC-UT-18: Error — Unparseable JSON (AF-03)

| Field | Value |
|-------|-------|
| ID | TC-UT-18 |
| Level | UT |
| Component | HarnessSectionParser |
| BR | AF-03 |
| Priority | Medium |

**Steps:**
1. Pass malformed object `{ pyContentSection: "not-an-object" }` to `extractControls()`

**Expected:** Returns empty array or throws caught error. Does not crash.

---

### TC-UT-19: SchemaWriter — Auto-Create Directory (AF-04)

| Field | Value |
|-------|-------|
| ID | TC-UT-19 |
| Level | UT |
| Component | SchemaWriter |
| BR | AF-04 |
| Priority | Medium |

**Steps:**
1. Ensure `schemas/auto/` directory does NOT exist
2. Call `writeSchema('Rule-Obj-Activity', schema, workspaceRoot)`

**Expected:** Directory created, file written successfully.

---

### TC-UT-20: Error — Network Unreachable (EF-01)

| Field | Value |
|-------|-------|
| ID | TC-UT-20 |
| Level | UT |
| Component | PegaSchemaGenerator |
| BR | EF-01 |
| Priority | High |

**Steps:**
1. Mock fetchWithRetry to throw ECONNREFUSED
2. Call `generateSchemas(report)`

**Expected:** Promise rejects with fatal error. State = ERROR. No schemas written.

---

### TC-UT-21: Error — Auth Failure 401 (EF-02)

| Field | Value |
|-------|-------|
| ID | TC-UT-21 |
| Level | UT |
| Component | PegaSchemaGenerator |
| BR | EF-02 |
| Priority | High |

**Steps:**
1. Mock HTTP response with status 401
2. Call `generateSchemas(report)`

**Expected:** Promise rejects with auth error. State = ERROR. Clear message.

---

### TC-UT-22: Error — All Fetches Fail (EF-03)

| Field | Value |
|-------|-------|
| ID | TC-UT-22 |
| Level | UT |
| Component | PegaSchemaGenerator |
| BR | EF-03 |
| Priority | High |

**Steps:**
1. Mock: 3 types discovered, ALL queryRuleByTriple return 500
2. Call `generateSchemas(report)`

**Expected:** `schemasGenerated=0`, `schemasFailed=3`, all 3 in errors[].

---

### TC-UT-23: Error — File Write Permission (EF-04)

| Field | Value |
|-------|-------|
| ID | TC-UT-23 |
| Level | UT |
| Component | SchemaWriter |
| BR | EF-04 |
| Priority | Medium |

**Steps:**
1. Mock fs.writeFile to throw EACCES
2. Call `writeSchema('Rule-Obj-Activity', schema, '/readonly/path')`

**Expected:** Error logged, included in SchemaError result. Pipeline continues.

---

## 3. Integration Tests (IT)

### TC-IT-01: Happy Path — Full Pipeline (3 Rule Types)

| Field | Value |
|-------|-------|
| ID | TC-IT-01 |
| Level | IT |
| Component | PegaSchemaGenerator + all services |
| UC | UC-01 |
| Priority | High |

**Preconditions:** PegaHttpClient mocked at HTTP layer. Real HarnessSectionParser, ControlTypeMapper, SchemaWriter instances.

**Steps:**
1. Configure mock server: 1 page with 5 harnesses, 3 unique pyClassNames
2. Configure mock: queryRuleByTriple returns valid harness JSON for each type
3. Call `generateSchemas(report)`
4. Verify file system has 3 schema files in `schemas/auto/`

**Expected:**
- `schemasGenerated = 3`
- `uniqueRuleTypes = 3`
- Files: `Rule-Obj-Activity.json`, `Rule-Obj-Flow.json`, `Rule-Obj-Model.json`
- Each file is valid JSON Schema draft-07

**Test Data:** `fixtures/harness-activity.json`, `fixtures/harness-flow.json`, `fixtures/harness-model.json`

---

### TC-IT-02: State Machine Transitions

| Field | Value |
|-------|-------|
| ID | TC-IT-02 |
| Level | IT |
| Component | PegaSchemaGenerator |
| UC | FSD Section 5 |
| Priority | High |

**Steps:**
1. Instrument state observer on PegaSchemaGenerator
2. Run full pipeline with 2 rule types
3. Record state transitions

**Expected:** State sequence: IDLE -> CRAWLING -> GROUPING -> FETCHING_DETAIL -> PARSING -> GENERATING -> FETCHING_DETAIL -> PARSING -> GENERATING -> COMPLETED

---

### TC-IT-03: Pagination Integration

| Field | Value |
|-------|-------|
| ID | TC-IT-03 |
| Level | IT |
| Component | PegaHttpClient + PegaSchemaGenerator |
| BR | BR-05 |
| Priority | High |

**Steps:**
1. Mock: 3 pages of 50 items each (total 150), last page pxMore=false
2. Run pipeline
3. Verify all 150 harnesses consumed in grouping

**Expected:** 3 HTTP calls to listRulesByFilter (page 1,2,3). GroupByRuleType receives 150 items.

---

### TC-IT-04: Grouping Deduplication Integration

| Field | Value |
|-------|-------|
| ID | TC-IT-04 |
| Level | IT |
| Component | PegaSchemaGenerator + SchemaWriter |
| BR | BR-11 |
| Priority | High |

**Steps:**
1. Mock: 10 harnesses, 4 unique pyClassNames
2. Run pipeline
3. Count queryRuleByTriple calls and schema files

**Expected:** Exactly 4 queryRuleByTriple calls. 4 schema files written. No duplicates.

---

### TC-IT-05: Schema Meta-Validation

| Field | Value |
|-------|-------|
| ID | TC-IT-05 |
| Level | IT |
| Component | PegaSchemaGenerator -> ajv |
| BR | BR-01 |
| Priority | High |

**Steps:**
1. Run full pipeline with real parser+mapper
2. Load each generated schema file
3. Validate against JSON Schema draft-07 meta-schema using ajv

**Expected:** All generated schemas compile successfully with `ajv.compile(schema)` — no errors.

---

### TC-IT-06: File Path Correct

| Field | Value |
|-------|-------|
| ID | TC-IT-06 |
| Level | IT |
| Component | SchemaWriter |
| BR | BR-04 |
| Priority | High |

**Steps:**
1. Run pipeline for rule type "Rule-Obj-Activity"
2. Check file system

**Expected:** File exists at `{workspaceRoot}/schemas/auto/Rule-Obj-Activity.json`.

---

### TC-IT-07: Partial Success (1 of 3 Fails)

| Field | Value |
|-------|-------|
| ID | TC-IT-07 |
| Level | IT |
| Component | PegaSchemaGenerator |
| BR | BR-08 |
| Priority | High |

**Steps:**
1. Mock: 3 rule types. Type 2 queryRuleByTriple returns HTTP 500 (after retries)
2. Run pipeline

**Expected:**
- `schemasGenerated = 2`
- `schemasFailed = 1`
- 2 schema files exist
- errors[0] has phase='fetch', ruleType contains type 2 name

---

### TC-IT-08: Schema Validation — Valid Rule (UC-02)

| Field | Value |
|-------|-------|
| ID | TC-IT-08 |
| Level | IT |
| Component | Generated schema + ajv |
| UC | UC-02 |
| Priority | High |

**Steps:**
1. Generate schema for Rule-Obj-Activity (from pipeline)
2. Create valid rule JSON matching the schema (all required fields present, correct types)
3. Validate rule JSON against schema using ajv

**Expected:** `ajv.validate(schema, ruleJson) === true`, no errors.

---

### TC-IT-09: Idempotency (Run Twice)

| Field | Value |
|-------|-------|
| ID | TC-IT-09 |
| Level | IT |
| Component | PegaSchemaGenerator + SchemaWriter |
| BR | BR-07 |
| Priority | Medium |

**Steps:**
1. Run pipeline with same mock data
2. Record file contents (JSON string)
3. Run pipeline again with same mock data
4. Compare file contents

**Expected:** Files are byte-for-byte identical between run 1 and run 2.

---

### TC-IT-10: Schema Not Found — Permissive Mode (BR-10)

| Field | Value |
|-------|-------|
| ID | TC-IT-10 |
| Level | IT |
| Component | Dual-Tier Layer 1 |
| BR | BR-10 |
| Priority | Medium |

**Steps:**
1. Attempt to validate rule JSON with `pxObjClass = 'Rule-Obj-Unknown'`
2. No schema file exists at `schemas/auto/Rule-Obj-Unknown.json`

**Expected:** Warning logged. Validation returns `{ valid: true, warnings: ['Schema not found...'] }`. Rule NOT blocked.

---

### TC-IT-11: Schema Corrupted — Skip Validation (AF-07)

| Field | Value |
|-------|-------|
| ID | TC-IT-11 |
| Level | IT |
| Component | Dual-Tier Layer 1 |
| UC | UC-02 AF-07 |
| Priority | Medium |

**Steps:**
1. Write invalid JSON to `schemas/auto/Rule-Obj-Activity.json` (e.g., "not json {{{")
2. Attempt to validate rule JSON for Rule-Obj-Activity

**Expected:** Error logged. Validation skipped (permissive mode). Rule NOT blocked.

---

## 4. End-to-End API Tests (E2E-API)

### TC-E2E-API-01: Filter Params Verified

| Field | Value |
|-------|-------|
| ID | TC-E2E-API-01 |
| Level | E2E-API |
| Component | Full pipeline |
| BR | BR-12 |
| Priority | High |

**Setup:** nock intercept on Pega server endpoint.

**Steps:**
1. Trigger full pipeline
2. Capture outgoing HTTP request to `/rules/listRules`

**Expected:** Request body contains:
- `ObjClass = "Rule-HTML-Harness"`
- `FilterPropName = "pyStreamName"`
- `FilterPropValue = "RuleForm"`

---

### TC-E2E-API-02: Multi-Page Crawl (150 Harnesses)

| Field | Value |
|-------|-------|
| ID | TC-E2E-API-02 |
| Level | E2E-API |
| Component | Full pipeline |
| BR | BR-05 |
| Priority | High |

**Setup:** nock serves 3 pages (50+50+50, last pxMore=false).

**Steps:**
1. Trigger full pipeline
2. Count total harnesses processed

**Expected:** 150 harnesses fetched across 3 paginated requests.
**Test Data:** `fixtures/pega-list-page1.json`, `fixtures/pega-list-page2.json`, `fixtures/pega-list-page3.json`

---

### TC-E2E-API-03: Group and Fetch Per Type (20 Types)

| Field | Value |
|-------|-------|
| ID | TC-E2E-API-03 |
| Level | E2E-API |
| Component | Full pipeline |
| BR | BR-11 |
| Priority | High |

**Setup:** nock serves 110 harnesses with 20 unique pyClassNames. Each type has queryRuleByTriple mock.

**Steps:**
1. Trigger full pipeline
2. Count queryRuleByTriple calls

**Expected:** Exactly 20 queryRuleByTriple calls (one per unique type). 20 schema files generated.

---

### TC-E2E-API-04: All Schemas Valid Draft-07

| Field | Value |
|-------|-------|
| ID | TC-E2E-API-04 |
| Level | E2E-API |
| Component | Full pipeline |
| BR | BR-01, BR-06 |
| Priority | High |

**Steps:**
1. Run full pipeline
2. Load all generated schema files
3. For each: validate against JSON Schema draft-07 meta-schema
4. Verify additionalProperties=true in each

**Expected:** All schemas pass meta-validation. All have `additionalProperties: true`.

---

### TC-E2E-API-05: File Output Structure

| Field | Value |
|-------|-------|
| ID | TC-E2E-API-05 |
| Level | E2E-API |
| Component | Full pipeline |
| BR | BR-04, BR-09 |
| Priority | High |

**Steps:**
1. Run full pipeline
2. List files in `schemas/auto/`
3. Verify naming convention

**Expected:**
- All files in `schemas/auto/` directory
- Filenames match `{RuleType}.json` pattern
- Casing preserved from pxObjClass
- No invalid filename characters

---

### TC-E2E-API-06: Validation Integration (Valid + Invalid Rule)

| Field | Value |
|-------|-------|
| ID | TC-E2E-API-06 |
| Level | E2E-API |
| Component | Schema + Validator |
| UC | UC-02 |
| Priority | High |

**Steps:**
1. Generate schemas (pipeline)
2. Create valid rule JSON (all required fields, correct types) -> validate
3. Create invalid rule JSON (missing required field) -> validate

**Expected:**
- Valid rule: `validation.valid === true`
- Invalid rule: `validation.valid === false`, errors include field path + expected type

---

### TC-E2E-API-07: Empty Server (Zero Results)

| Field | Value |
|-------|-------|
| ID | TC-E2E-API-07 |
| Level | E2E-API |
| Component | Full pipeline |
| UC | AF-01 |
| Priority | Medium |

**Setup:** nock returns `{ pxResults: [], pxMore: false }` on first page.

**Steps:**
1. Trigger pipeline

**Expected:** `schemasGenerated=0`, no errors, info-level "No RuleForm harnesses found" message.

---

### TC-E2E-API-08: Partial Failure (2/5 Types Fail)

| Field | Value |
|-------|-------|
| ID | TC-E2E-API-08 |
| Level | E2E-API |
| Component | Full pipeline |
| BR | BR-08 |
| Priority | High |

**Setup:** 5 unique types. Types 2 and 4 return 404 on queryRuleByTriple.

**Steps:**
1. Trigger pipeline
2. Check result

**Expected:** `schemasGenerated=3`, `schemasFailed=2`. 3 schema files exist. errors[] has 2 entries.

---

### TC-E2E-API-09: Idempotency E2E

| Field | Value |
|-------|-------|
| ID | TC-E2E-API-09 |
| Level | E2E-API |
| Component | Full pipeline |
| BR | BR-07 |
| Priority | Medium |

**Steps:**
1. Run pipeline (first time)
2. Record all file checksums
3. Run pipeline (second time) with same mocks
4. Compare checksums

**Expected:** All checksums identical. Files overwritten with same content.

---

### TC-E2E-API-10: Server Unreachable

| Field | Value |
|-------|-------|
| ID | TC-E2E-API-10 |
| Level | E2E-API |
| Component | Full pipeline |
| UC | EF-01 |
| Priority | High |

**Setup:** nock disabled (no mock, connection refused).

**Steps:**
1. Trigger pipeline

**Expected:** Fatal error thrown. No schema files written. Error message: "Cannot connect to Pega server".

---

### TC-E2E-API-11: Auth Failure (401)

| Field | Value |
|-------|-------|
| ID | TC-E2E-API-11 |
| Level | E2E-API |
| Component | Full pipeline |
| UC | EF-02 |
| Priority | High |

**Setup:** nock returns 401 on first request.

**Steps:**
1. Trigger pipeline

**Expected:** Fatal error. No schemas. Error message: "Invalid Pega credentials".

---

### TC-E2E-API-12: All Types Fail (EF-03)

| Field | Value |
|-------|-------|
| ID | TC-E2E-API-12 |
| Level | E2E-API |
| Component | Full pipeline |
| UC | EF-03 |
| Priority | High |

**Setup:** 3 types discovered. All queryRuleByTriple return 500.

**Steps:**
1. Trigger pipeline

**Expected:** `schemasGenerated=0`, `schemasFailed=3`. Error message: "Schema generation failed".

---

## 5. End-to-End UI Tests (E2E-UI)

### TC-E2E-UI-01: QuickPick Shows Schema Option

| Field | Value |
|-------|-------|
| ID | TC-E2E-UI-01 |
| Level | E2E-UI |
| Component | IndexingService + indexer.ts |
| UC | UC-03 |
| Priority | High |

**Tool:** @vscode/test-electron

**Steps:**
1. Activate extension in test VS Code instance
2. Execute command `sdlc.indexWorkspace`
3. Wait for QuickPick to appear
4. Query QuickPick items

**Expected:** One item has label containing "Index Pega Rule Schemas" with icon `$(symbol-class)`.

---

### TC-E2E-UI-02: Selection Triggers Pipeline

| Field | Value |
|-------|-------|
| ID | TC-E2E-UI-02 |
| Level | E2E-UI |
| Component | IndexingService + PegaSchemaGenerator |
| UC | UC-03 |
| Priority | High |

**Steps:**
1. Programmatically select "Index Pega Rule Schemas" in QuickPick
2. Confirm selection
3. Observe progress notification

**Expected:** VS Code progress notification appears with title containing "schema" or "Generating".

---

### TC-E2E-UI-03: Completion Notification

| Field | Value |
|-------|-------|
| ID | TC-E2E-UI-03 |
| Level | E2E-UI |
| Component | PegaSchemaGenerator + VS Code notifications |
| UC | UC-03 |
| Priority | High |

**Steps:**
1. Trigger pipeline (with mocked HTTP returning valid data)
2. Wait for pipeline completion
3. Check notification messages

**Expected:** Information notification with message matching "Generated N schemas for M rule types".

---

## 6. System Integration Tests (SIT) — Manual

### TC-SIT-01: QuickPick Visual UX

| Field | Value |
|-------|-------|
| ID | TC-SIT-01 |
| Level | SIT |
| Component | Extension UI |
| UC | UC-03 |
| Priority | Medium |

**Steps (Manual):**
1. Open VS Code with extension activated
2. Press Ctrl+Shift+P, type "Index Workspace"
3. Execute command
4. Visually inspect QuickPick

**Expected:**
- Option "Index Pega Rule Schemas" visible in list
- Icon `$(symbol-class)` displays correctly
- Description "Generate JSON Schemas from Pega RuleForms" shown
- Styling consistent with other QuickPick options

**Pass/Fail:** Visual inspection by tester. Screenshot captured.

---

### TC-SIT-02: Progress Messages UX

| Field | Value |
|-------|-------|
| ID | TC-SIT-02 |
| Level | SIT |
| Component | Extension notifications |
| Priority | Medium |

**Steps (Manual):**
1. Connect to real Pega server (or mock with delay)
2. Select "Index Pega Rule Schemas"
3. Observe progress notification messages over time

**Expected:** Messages update in sequence:
1. "Crawling Pega harnesses (page N)..."
2. "Grouping N harnesses into M rule types..."
3. "Fetching harness detail (i/total)..."
4. "Parsing harness for {ruleType}..."
5. "Generating schema for {ruleType}..."
6. "Schema generation complete: N schemas for M rule types"

**Pass/Fail:** All 6 message phases observed in correct order.

---

### TC-SIT-03: Output Channel Logging

| Field | Value |
|-------|-------|
| ID | TC-SIT-03 |
| Level | SIT |
| Component | SDLC Indexing output channel |
| Priority | Medium |

**Steps (Manual):**
1. Open Output panel, select "SDLC Indexing" channel
2. Trigger schema generation
3. Read output

**Expected:** Detailed logs with:
- Timestamp per entry
- Phase transitions logged
- Individual rule type processing logged
- Error details (if any) with rule type name
- Final summary with counts

---

### TC-SIT-04: Error Notification UX

| Field | Value |
|-------|-------|
| ID | TC-SIT-04 |
| Level | SIT |
| Component | Extension error handling |
| Priority | Medium |

**Steps (Manual):**
1. Disconnect from Pega server (or use invalid credentials)
2. Trigger schema generation
3. Observe error notification

**Expected:** Clear error notification with actionable message (e.g., "Cannot connect to Pega server. Check network and endpoint configuration."). No stack trace shown to user.

---

### TC-SIT-05: Schema File Inspection

| Field | Value |
|-------|-------|
| ID | TC-SIT-05 |
| Level | SIT |
| Component | Generated output |
| Priority | Medium |

**Steps (Manual):**
1. Run successful schema generation
2. Open file explorer, navigate to `schemas/auto/`
3. Open any generated `.json` file

**Expected:**
- Valid JSON (no syntax errors)
- Properly formatted (indented, readable)
- Contains `$schema`, `title`, `type`, `properties`, `required`, `additionalProperties`
- Property descriptions present (from control labels)
- File size < 100KB

---

## 7. Test Data References

### 7.1 CSV Test Data Files

| File | Columns | Rows | Purpose |
|------|---------|------|---------|
| `test-data/control-type-mappings.csv` | pegaControlType, expectedJsonType, extraProps | 14 | PBT + UT oracle |
| `test-data/harness-summaries.csv` | pzInsKey, pxObjClass, pyClassName, pyRuleName, pyStreamName | 110 | Pagination tests |
| `test-data/filename-sanitization.csv` | input, expectedOutput | 20 | Sanitization tests |
| `test-data/invalid-inputs.csv` | inputType, inputValue, expectedBehavior | 15 | Error path tests |
| `test-data/expected-schemas.csv` | ruleType, requiredFields, propertyCount | 5 | Integration verification |
| `test-data/harness-full-json.csv` | ruleType, harnessJsonPath, expectedControlCount | 5 | Parser tests |

### 7.2 control-type-mappings.csv Sample

```csv
pegaControlType,expectedJsonType,format,extraProp
TextInput,string,,maxLength
TextArea,string,,
NumberInput,number,,minimum;maximum
Checkbox,boolean,,default:false
Dropdown,string,,enum
RadioButtons,string,,enum
DatePicker,string,date-time,
Autocomplete,string,,
Link,string,uri,
Integer,integer,,
Hidden,string,,
PageList,array,,items
PageGroup,object,,additionalProperties:true
Unknown,string,,
```

### 7.3 filename-sanitization.csv Sample

```csv
input,expectedOutput
Rule-Obj-Activity,Rule-Obj-Activity
Rule-Obj-Flow,Rule-Obj-Flow
Rule/With/Slashes,Rule-With-Slashes
Rule:Colon:Test,Rule-Colon-Test
Rule*Star,Rule-Star
Rule<Less>Greater,Rule-Less-Greater
Rule Spaces Here,Rule-Spaces-Here
RULE-ALL-CAPS,RULE-ALL-CAPS
rule-all-lower,rule-all-lower
```

---

## 8. Pass/Fail Summary Matrix

| Level | Total Cases | Must Pass | Acceptable Fail |
|-------|-------------|-----------|-----------------|
| PBT | 7 properties x 1000 | All | 0 |
| UT | 23 cases | All | 0 |
| IT | 11 cases | All | 0 |
| E2E-API | 12 cases | All | 0 |
| E2E-UI | 3 cases | All | 0 |
| SIT | 5 cases | 4/5 | 1 (cosmetic only) |
| **Total** | **61 automated + 5 manual** | **56/61 auto** | -- |

---

## Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |
