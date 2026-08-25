# User Guide (UG)

## SDLC Agents 4 Enterprise — SA4E-214: Extension-driven Schema Creation for Pega Rule Types

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-214 |
| Title | Extension-driven Schema Creation for Pega Rule Types |
| Author | DEV Agent |
| Reviewer | BA Agent |
| Version | 1.0 |
| Date | 2025-07-09 |
| Status | Draft |
| Related BRD | BRD-v1-SA4E-214.docx |
| Related FSD | FSD-v1-SA4E-214.docx |
| Related TDD | TDD-v1-SA4E-214.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-09 | DEV Agent | Initial document |

---

## 1. Overview

### 1.1 Purpose

This feature automatically creates enriched schemas for Pega rule types during BFS indexing. When the extension encounters a new rule type for the first time, it fetches the harness RuleForm from Pega, sends it to the backend for analysis, recursively discovers sub-sections, and builds a structured schema describing all known fields, their categories, and extraction hints.

The resulting schema is then used as LLM prompt context during code enrichment — producing more accurate `pseudo_code` and `summary` for Pega rules.

### 1.2 Audience

| Audience | What They Need |
|----------|---------------|
| Extension User | Understanding how schemas appear automatically during indexing |
| System Administrator | How to configure thresholds, timeouts, and feature flags |
| Developer / Integrator | Backend API reference for schema endpoints |

### 1.3 Key Benefits

- **Automatic** — No manual schema creation needed; schemas are built on-the-fly during indexing
- **Non-blocking** — Schema creation never interrupts the BFS indexing pipeline
- **Self-improving** — Schemas grow over time as more rule instances are encountered (progressive enrichment)
- **Dual-strategy** — Rule-based parsing first (fast, deterministic), LLM fallback for stream-rendered harnesses

---

## 2. How It Works

### 2.1 On-the-fly Schema Creation Flow

When BFS indexing encounters a rule type for the first time (no schema in cache or KB):

```
BFS Indexer → first encounter of rule type
    ↓
PegaSchemaOrchestrator.createSchema(ruleType)
    ↓
1. Check local cache → miss
2. Check backend KB (GET /pega/schema/find) → miss
3. Fetch Harness RuleForm from Pega server
4. POST harness JSON to backend (POST /pega/schema/analyze)
    Backend returns: fields + sub-sections + extraction hints
5. For each sub-section (recursive, max depth 5):
    a. Fetch section from Pega
    b. POST to backend /analyze
    c. Accumulate fields
6. Aggregate all fields → build EnrichedSchema
7. Store in backend KB (POST /pega/schema/store)
8. Save to local file cache (.pega-schemas/{RuleType}.schema.json)
```

**Key constraints:**
- Total timeout: 60 seconds per rule type
- Recursive depth limit: 5 levels
- Circuit breaker: stops expansion when >20 sections found at one level
- Mutex: only one schema creation per rule type at a time

### 2.2 Schema-guided LLM Enrichment

Once a schema exists, it enhances future code enrichment:

```
CodeEnrichmentHandler receives Pega rule
    ↓
loadOrCreateSchemaContext(symbolKind)
    ↓
Find enriched schema in KB by ruleType
    ↓
Format schema as prompt context:
  - identity_fields → What identifies this rule
  - logic_fields → Where to find business logic
  - extraction_hints → How to structure pseudo_code
    ↓
LLM produces more accurate summary + pseudo_code
```

### 2.3 Progressive Enrichment Flow

After a schema exists, each new rule instance is validated against it:

```
BFS Indexer → rule instance for existing type
    ↓
SchemaValidator compares JSON keys vs schema.known_fields
    ↓
New fields found? → create FieldDescriptors
    ↓
PATCH /pega/schema/update → appends fields, increments version
    ↓
Update local cache
```

**Append-only guarantee:** Progressive enrichment never removes fields — only adds newly discovered ones.

---

## 3. Configuration

### 3.1 Extension Settings

All settings are under the `pegaSchema` prefix in VS Code/Kiro settings:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `pegaSchema.enabled` | boolean | `true` | Master switch: enable/disable on-the-fly schema creation |
| `pegaSchema.maxDepth` | number | `5` | Maximum recursive section discovery depth |
| `pegaSchema.circuitBreakerThreshold` | number | `20` | Max sections at one level before circuit breaker triggers |
| `pegaSchema.totalTimeout` | number (ms) | `60000` | Total time allowed per schema creation (milliseconds) |
| `pegaSchema.llmTimeout` | number (ms) | `30000` | LLM call timeout for backend analysis |
| `pegaSchema.llmFallback` | boolean | `true` | Enable LLM fallback for stream-rendered harnesses |
| `pegaSchema.progressiveEnrichment` | boolean | `true` | Enable progressive field discovery from rule instances |
| `pegaSchema.cacheDir` | string | `.pega-schemas` | Local schema cache directory (relative to workspace) |

### 3.2 Configuration Examples

#### Minimal (defaults work for most setups)

No configuration needed — schema creation is enabled by default.

#### Conservative (slower LLM, strict limits)

```json
{
  "pegaSchema.maxDepth": 3,
  "pegaSchema.circuitBreakerThreshold": 10,
  "pegaSchema.totalTimeout": 30000,
  "pegaSchema.llmTimeout": 15000
}
```

#### Disabled (schema creation off)

```json
{
  "pegaSchema.enabled": false
}
```

### 3.3 Backend Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_PROVIDER` | LLM provider for analysis fallback | `lmstudio` |
| `LLM_MODEL` | Model name for LLM analysis | `qwen2.5-vl-7b-instruct` |
| `LLM_BASE_URL` | LLM API base URL | `http://localhost:1234/v1` |
| `LLM_API_KEY` | API key (if required by provider) | _(none)_ |

---

## 4. Feature Flags

Three independent feature flags control different aspects of schema creation:

| Flag | Default | Effect When Disabled |
|------|---------|---------------------|
| `pegaSchema.enabled` | `true` | All schema creation stops. Existing schemas remain in cache/KB and continue to be used for enrichment. |
| `pegaSchema.llmFallback` | `true` | Only rule-based analysis is used. Stream-rendered harnesses return empty (coverage=0). |
| `pegaSchema.progressiveEnrichment` | `true` | Schemas are not updated when new fields are discovered from instances. Existing schemas remain static. |

### Disabling at Runtime

Change the VS Code/Kiro setting — takes effect immediately for the next indexing run. No restart required.

### Rollback Strategy

1. Set `pegaSchema.enabled` to `false` — schema creation stops immediately
2. Existing enrichment pipeline continues (schema context is optional)
3. To clear cached schemas: delete the `.pega-schemas/` directory in workspace root
4. Backend KB data persists but is harmlessly ignored when flag is off

---

## 5. Progressive Enrichment

### 5.1 How Schemas Improve Over Time

Schemas grow as the extension encounters more rule instances of the same type:

| Event | Schema Change |
|-------|---------------|
| First encounter | Schema created: initial fields from harness analysis |
| Second instance | New JSON keys not in `known_fields` → appended as `metadata` category, `rare` frequency |
| Subsequent instances | More new fields discovered → schema version increments |

### 5.2 Field Discovery Logic

When a rule instance is indexed:

1. Load existing schema from cache
2. Compare rule JSON keys against `schema.known_fields`
3. Skip internal Pega fields (`px*`, `pz*` prefixes)
4. For each new key: create a `FieldDescriptor` with inferred type and `metadata` category
5. Send `PATCH /pega/schema/update` → backend increments `schema_version`

### 5.3 Conflict Resolution

If the same field path appears with different types across instances, the **first-wins** rule applies. The first occurrence defines the field; subsequent discoveries are ignored. Conflicts are rare edge cases and are logged at DEBUG level.

### 5.4 Schema Versioning

- `schema_version` starts at 1 on creation
- Each progressive update increments by 1
- Version is tracked in both local cache and backend KB
- Schema version has no expiry — it only grows

---

## 6. Troubleshooting

### 6.1 Common Issues

| # | Symptom | Cause | Solution |
|---|---------|-------|----------|
| 1 | "Schema creation failed" in Output | Pega server unreachable during harness fetch | Verify Pega server URL and credentials in extension settings. Indexing continues without schema. |
| 2 | Schema has 0% coverage | Stream-rendered harness with LLM fallback disabled | Enable `pegaSchema.llmFallback` or accept partial schema |
| 3 | "Total timeout exceeded" | Complex rule type with many sections | Increase `pegaSchema.totalTimeout` or reduce `pegaSchema.maxDepth` |
| 4 | "Circuit breaker" warning | >20 sections at one recursion level (template explosion) | Expected safety behavior. Schema uses partial results. Increase `pegaSchema.circuitBreakerThreshold` if the rule type genuinely has many sections. |
| 5 | "LLM timeout" on backend | Local LLM too slow or overloaded | Ensure LM Studio/Ollama is running. Check `LLM_BASE_URL`. Increase `pegaSchema.llmTimeout`. |
| 6 | "Already creating {type}" log | Concurrent duplicate trigger | Normal mutex behavior — second request is skipped. Schema will be available after first creation completes. |
| 7 | No schemas being created | Feature flag disabled | Verify `pegaSchema.enabled` is `true` in settings |
| 8 | Backend returns 503 | Database adapter not available | Check backend startup logs. Ensure SQLite/PostgreSQL DB is configured. |

### 6.2 Error Codes

| Code | HTTP Status | Description | Action |
|------|-------------|-------------|--------|
| `SCHEMA_INVALID_REQUEST` | 400 | Missing or invalid fields in request body | Check harnessJson is a valid object, ruleType is non-empty |
| `SCHEMA_ANALYSIS_FAILED` | 500 | Parser or LLM threw unexpected error | Check backend logs for stack trace |
| `SCHEMA_LLM_TIMEOUT` | 504 | LLM call exceeded 30s timeout | Increase `pegaSchema.llmTimeout` or disable `llmFallback` |
| `SCHEMA_NOT_FOUND` | 404 | Update/find for non-existent schema | Schema must be created before it can be updated |
| `SCHEMA_ALREADY_EXISTS` | 409 | Duplicate store attempt for same rule type | Schema already in KB — use PATCH /update for changes |
| `SCHEMA_EMPTY_UPDATE` | 400 | Update request has empty `new_fields` array | Provide at least one field in the update |

### 6.3 Logs

| Log Location | Content | Useful For |
|-------------|---------|------------|
| Extension Output Channel | `[Schema]` prefixed messages: creation progress, circuit breaker, timeout | Debugging schema creation flow |
| Backend Pino logs | `[schema-analyze]` and `[schema-store]` prefixed entries | Debugging analysis and storage |

### 6.4 Log Message Examples

```
[Schema] 🔧 Creating schema for Rule-Obj-Flow...
[Schema] ⚡ Circuit breaker: 25 sections at depth 2 for Rule-Obj-Flow
[Schema] ✅ Rule-Obj-Flow: 24 fields, 85% coverage
[Schema] ❌ Rule-HTML-Property failed: Total timeout exceeded (60000ms)
[Schema] 📐 Rule-Obj-Activity: found 3 new fields — updating
[Schema] ⚠️ KB store failed for Rule-Obj-Flow: Connection refused
```

### 6.5 Indexing Summary

After BFS completes, the extension reports schema statistics:

```
📐 Schemas: 5 generated, 12 from cache, 1 failed (Rule-HTML-Property: timeout)
```

---

## 7. API Reference

### 7.1 POST /api/v1/pega/schema/analyze

Analyze harness/section JSON using dual-strategy (rule-based + LLM fallback).

| Attribute | Value |
|-----------|-------|
| Method | POST |
| Path | `/api/v1/pega/schema/analyze` |
| Auth | None (localhost only) |
| Body Limit | 5MB |

**Request Body:**

```json
{
  "harnessJson": { "pxObjClass": "Rule-HTML-Harness", "...": "..." },
  "ruleType": "Rule-Obj-Flow",
  "depth": 0
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `harnessJson` | object | Yes | Raw harness/section JSON from Pega server |
| `ruleType` | string | Yes | Pega rule class (e.g., "Rule-Obj-Flow") |
| `depth` | number | No | Current recursion depth (0–5, default 0) |

**Response — 200 OK:**

```json
{
  "fields": [
    {
      "path": "pyFlowSteps",
      "category": "logic",
      "type": "array",
      "description": "Flow step definitions",
      "frequency": "always"
    }
  ],
  "sub_sections": ["pyFlowSteps", "pyConnectors", "pyDecisions"],
  "rule_based_coverage": 75,
  "llm_fallback_used": false,
  "hints": {
    "primary_logic_field": "pyFlowSteps",
    "logic_structure": "sequential_steps",
    "summary_focus": null
  }
}
```

**Error Responses:**

| Status | Code | When |
|--------|------|------|
| 400 | `SCHEMA_INVALID_REQUEST` | Body validation fails |
| 500 | `SCHEMA_ANALYSIS_FAILED` | Parser/LLM throws |
| 504 | `SCHEMA_LLM_TIMEOUT` | LLM exceeds 30s |

---

### 7.2 POST /api/v1/pega/schema/store

Store a completed enriched schema in the backend KB.

| Attribute | Value |
|-----------|-------|
| Method | POST |
| Path | `/api/v1/pega/schema/store` |
| Auth | None (localhost only) |

**Request Body:**

```json
{
  "schema": {
    "rule_type": "Rule-Obj-Flow",
    "schema_version": 1,
    "created_at": "2025-07-09T10:00:00Z",
    "updated_at": "2025-07-09T10:00:00Z",
    "identity_fields": {},
    "logic_fields": {},
    "connectivity_fields": {},
    "extraction_hints": {
      "primary_logic_field": "pyFlowSteps",
      "logic_structure": "sequential_steps",
      "summary_focus": null
    },
    "known_fields": ["pyFlowSteps", "pyConnectors"],
    "coverage": 85,
    "discovered_sections": ["pyFlowSteps", "pyConnectors"]
  }
}
```

**Response — 201 Created:**

```json
{ "success": true, "id": 42 }
```

**Error Responses:**

| Status | Code | When |
|--------|------|------|
| 400 | `SCHEMA_INVALID_SCHEMA` | Zod validation fails on schema object |
| 409 | `SCHEMA_ALREADY_EXISTS` | Schema for this rule type already in KB |
| 500 | `SCHEMA_STORE_FAILED` | DB write fails |

---

### 7.3 GET /api/v1/pega/schema/find

Retrieve an enriched schema by rule type.

| Attribute | Value |
|-----------|-------|
| Method | GET |
| Path | `/api/v1/pega/schema/find` |
| Auth | None (localhost only) |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ruleType` | string | Yes | Pega rule class (e.g., "Rule-Obj-Flow") |

**Example:** `GET /api/v1/pega/schema/find?ruleType=Rule-Obj-Flow`

**Response — 200 OK:** Full `EnrichedSchema` JSON object (same structure as store request body).

**Response — 404 Not Found:**

```json
{ "error": "Schema not found for rule type", "ruleType": "Rule-Obj-Flow" }
```

---

### 7.4 PATCH /api/v1/pega/schema/update

Progressively append new fields to an existing schema.

| Attribute | Value |
|-----------|-------|
| Method | PATCH |
| Path | `/api/v1/pega/schema/update` |
| Auth | None (localhost only) |

**Request Body:**

```json
{
  "ruleType": "Rule-Obj-Flow",
  "new_fields": [
    {
      "path": "pyCustomField",
      "category": "metadata",
      "type": "string",
      "description": "Custom field discovered from instance",
      "frequency": "rare"
    }
  ]
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ruleType` | string | Yes | Target rule type to update |
| `new_fields` | FieldDescriptor[] | Yes | Array of new fields (min 1, max 100) |

**Response — 200 OK:**

```json
{ "success": true, "new_version": 4 }
```

**Error Responses:**

| Status | Code | When |
|--------|------|------|
| 400 | `SCHEMA_EMPTY_UPDATE` | `new_fields` array empty or invalid |
| 404 | `SCHEMA_NOT_FOUND` | No schema exists for the specified rule type |

---

### 7.5 POST /api/v1/pega/schema/generate (Legacy)

Legacy endpoint retained for backward compatibility. Internally calls the harness parser and schema builder. Not used by the new SA4E-214 flow.

| Attribute | Value |
|-----------|-------|
| Method | POST |
| Path | `/api/v1/pega/schema/generate` |
| Auth | None (localhost only) |

**Request Body:**

```json
{
  "harnessJson": { "...": "..." },
  "sectionJsons": { "sectionName": { "...": "..." } },
  "ruleType": "Rule-Obj-Flow"
}
```

---

## 8. Data Model Reference

### 8.1 EnrichedSchema Structure

| Field | Type | Description |
|-------|------|-------------|
| `rule_type` | string | Pega rule class (e.g., "Rule-Obj-Flow") |
| `schema_version` | number | Increments on each progressive update |
| `created_at` | ISO string | Timestamp of initial creation |
| `updated_at` | ISO string | Timestamp of last update |
| `identity_fields` | Record<string, FieldDescriptor> | Fields identifying the rule (class, name, version) |
| `logic_fields` | Record<string, FieldDescriptor> | Fields containing business logic |
| `connectivity_fields` | Record<string, FieldDescriptor> | Fields describing connections to other rules |
| `extraction_hints` | ExtractionHints | Hints for LLM on how to extract logic |
| `known_fields` | string[] | All discovered field paths |
| `coverage` | number (0–100) | Analysis coverage percentage |
| `discovered_sections` | string[] | Harness sections discovered recursively |

### 8.2 FieldDescriptor

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `path` | string | — | JSON path in rule instance |
| `category` | enum | `identity`, `logic`, `connectivity`, `metadata`, `configuration` | Semantic category |
| `type` | string | `string`, `number`, `boolean`, `array`, `object` | Data type |
| `description` | string | — | Human-readable description |
| `frequency` | enum | `always`, `common`, `rare`, `optional` | How often populated |

### 8.3 ExtractionHints

| Field | Type | Description |
|-------|------|-------------|
| `primary_logic_field` | string \| null | Main field containing business logic |
| `logic_structure` | string \| null | How to interpret logic: `sequential_steps`, `decision_tree`, `expression_list`, `key_value_map` |
| `summary_focus` | string \| null | Focus area for summary generation |

---

## 9. Appendix

### 9.1 Glossary

| Term | Definition |
|------|------------|
| Enriched Schema | Structured description of a Pega rule type's fields with semantic categories and extraction hints |
| Dual-strategy | Analysis approach: rule-based parser first (fast), LLM fallback when empty |
| Progressive Enrichment | Incrementally adding newly discovered fields to an existing schema |
| Circuit Breaker | Safety mechanism stopping section expansion when >20 found at one level |
| RuleForm | A Pega harness that renders the editing interface for a specific rule type |
| BFS Indexing | Breadth-first traversal of Pega rules during code intelligence indexing |

### 9.2 Related Documents

| Document | Location |
|----------|----------|
| BRD | BRD-v1-SA4E-214.docx |
| FSD | FSD-v1-SA4E-214.docx |
| TDD | TDD-v1-SA4E-214.docx |

### 9.3 File Locations

| Component | Path |
|-----------|------|
| Orchestrator | `extension/src/services/PegaSchemaOrchestrator.ts` |
| Local Cache | `extension/src/services/SchemaLocalCache.ts` |
| API Client | `extension/src/clients/SchemaApiClient.ts` |
| Models (extension) | `extension/src/models/EnrichedSchema.ts` |
| Models (backend) | `backend/src/models/pega-schema.models.ts` |
| Routes | `backend/src/server/routes/pega-schema-routes.ts` |
| Analyze Service | `backend/src/modules/pega/schema/SchemaAnalyzeService.ts` |
| Storage Service | `backend/src/modules/pega/schema/SchemaStorageService.ts` |
| Aggregator | `backend/src/modules/pega/schema/SchemaAggregator.ts` |
| Local cache dir | `.pega-schemas/` (workspace root) |

### 9.4 Performance Targets

| Operation | Target |
|-----------|--------|
| Schema creation (total per type) | ≤ 60s |
| Single analyze (rule-based) | ≤ 2s |
| Single analyze (with LLM) | ≤ 30s |
| Schema find (from KB) | ≤ 5ms |
| Schema find (from local cache) | ≤ 1ms |
| Progressive validation per instance | ≤ 50ms |
