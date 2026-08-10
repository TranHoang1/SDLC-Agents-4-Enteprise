# User Guide — SA4E-95: Pega Rule Schema Generator Engine

## Document Information

| Field | Value |
|-------|-------|
| Ticket | SA4E-95 |
| Module | `backend/src/modules/pega/harness-schema/` + `extension/src/services/PegaSchemaIndexer.ts` |
| Version | 2.0 |
| Author | DEV Agent |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-07 | DEV Agent | Initial release — schema generation engine |
| 2.0 | 2026-08-09 | DEV Agent | Schema-first QuickPick, auto-enable, KB storage, graph edges, Pega project detection |

---

## 1. Overview

The Pega Rule Schema Generator Engine parses RuleForm harnesses from the Pega CodeIntelligence API and produces JSON Schema Draft 2020-12 files for each rule type. Generated schemas are stored both as files (`schemas/auto/`) and in the Knowledge Base for agent consumption.

**Key capabilities (v2.0):**
- Schemas generated and ingested into KB — agents query via `mem_search`
- Graph edges created during indexing — enables dependency visualization
- Pega project auto-detection — no confusing "No source files found" messages
- Auto-enable schema generation when no schemas exist

**Pipeline stages:**
1. **Fetch** — Retrieve harness/section JSON from Pega API
2. **Parse** — Recursive descent through harness → sections → fields
3. **Resolve** — OOP class hierarchy + page context resolution
4. **Generate** — Produce JSON Schema with type mappings
5. **Ingest** — Store schema in KB + create graph edges

---

## 2. Quick Start

### 2.1 VS Code / Kiro Extension (Recommended)

Run the **"SDLC: Index Workspace"** command (Ctrl+Shift+P):

1. A QuickPick dialog appears with these options:
   - **$(symbol-class) Index Pega Rule Schemas** — selected by default, listed first
   - $(code) Index Source Code
   - $(book) Index Documents
   - $(sync) Sync Code → Memory

2. Click OK. The Output panel shows:

```
=== Pega Rule Schema Generation Started ===
[SchemaGen] Crawled 110 harness summaries in 1 pages.
[SchemaGen] ✅ Schema written for Rule-Service-MCP
[SchemaGen] ✅ Schema written for Rule-Obj-Activity
...
=== Pega Rule Schema Generation Summary ===
📐 Pega Rule Schemas: Generated 108 schemas for 110 rule types (2 failed)
```

3. Schemas are written to `schemas/auto/` AND ingested into KB.

**Auto-enable behavior:** If `schemas/auto/` is empty (no `.json` files), schema generation is automatically enabled even if unchecked in the QuickPick. This ensures first-time users always get schemas generated.

### 2.2 Programmatic API (Backend Module)

```typescript
import {
  HarnessSchemaGenerator,
  HarnessFetcher,
  HarnessParser,
  PageContextResolver,
  ClassHierarchyResolver,
  SchemaCacheManager,
} from './modules/pega/harness-schema/index.js';
import { PegaRuleFetcherService } from './modules/pega/PegaRuleFetcherService.js';

// 1. Create dependencies
const fetcherService = new PegaRuleFetcherService();
const config = {
  pegaEndpoint: process.env.PEGA_API_ENDPOINT!,
  username: process.env.PEGA_API_USER!,
  password: process.env.PEGA_API_PASSWORD!,
  timeout: 10000,
  maxRetries: 1,
};

const fetcher = new HarnessFetcher(fetcherService, config);
const contextResolver = new PageContextResolver();
const hierarchyResolver = new ClassHierarchyResolver(fetcher);
const parser = new HarnessParser(fetcher, hierarchyResolver, contextResolver);
const cacheManager = new SchemaCacheManager('./schemas/auto');

// 2. Create orchestrator
const generator = new HarnessSchemaGenerator(fetcher, parser, cacheManager, {
  outputDir: './schemas/auto',
  cacheEnabled: true,
  maxConcurrent: 5,
});

// 3. Generate schema for one rule type
const result = await generator.generateForRuleType('Rule-Obj-Activity');
console.log(`Coverage: ${result.coverage}%`);

// 4. Generate all rule types
const report = await generator.generateAll([
  'Rule-Obj-Activity',
  'Rule-Obj-Model',
  'Rule-Connect-REST',
]);
console.log(`Generated: ${report.generated}, Failed: ${report.failed}`);
```

---

## 3. Configuration Reference

### VS Code Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `kiroSdlc.pegaUsername` | string | `""` | Pega API username (e.g., SSA@TGB) |
| `kiroSdlc.pegaPassword` | secret | — | Stored in VS Code SecretStorage |
| `kiroSdlc.backend.url` | string | `http://127.0.0.1:48721` | Backend MCP server URL |

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PEGA_API_ENDPOINT` | Yes | — | Pega CodeIntelligence API base URL |
| `PEGA_API_USER` | Yes | — | API username (SSA@TGB) |
| `PEGA_API_PASSWORD` | Yes | — | API password |
| `SCHEMA_VALIDATION_ENABLED` | No | `false` | Enable opt-in schema validation |
| `SCHEMA_OUTPUT_DIR` | No | `schemas/auto` | Output directory for generated schemas |
| `SCHEMA_GENERATION_TIMEOUT` | No | `10000` | API request timeout (ms) |
| `SCHEMA_MAX_CONCURRENT` | No | `5` | Max concurrent API requests |
| `SCHEMA_MAX_DEPTH` | No | `5` | Max section recursion depth |

### PegaApiConfig

```typescript
interface PegaApiConfig {
  pegaEndpoint: string;   // Base URL
  username: string;       // API user
  password: string;       // API password
  authHeader?: string;    // Pre-built Basic auth header (optional)
  timeout?: number;       // Request timeout in ms (default: 10000)
  maxRetries?: number;    // Retry count on failure (default: 1)
}
```

### GeneratorConfig

```typescript
interface GeneratorConfig {
  outputDir: string;         // Where to write .schema.json files
  maxConcurrent?: number;    // Parallel fetch limit (default: 5)
  cacheEnabled?: boolean;    // Enable cache-aside (default: true)
}
```

---

## 4. Usage

### 4.1 Index Workspace Command (QuickPick)

The QuickPick presents four options. Selection order and defaults:

| # | Option | Default | Description |
|---|--------|---------|-------------|
| 1 | Index Pega Rule Schemas | ✅ Selected | Generate schemas from RuleForm harnesses |
| 2 | Index Source Code | ✅ Selected | Re-index all code symbols |
| 3 | Index Documents | ✅ Selected | Index SDLC documents into KB |
| 4 | Sync Code → Memory | ✅ Selected | Sync code entities into memory graph |

**Pega Project behavior:** When `pega-project.json` exists in the workspace root, the following messages appear instead of generic errors:

| Option | Pega Project Message |
|--------|---------------------|
| Index Source Code | `✅ Source code: Pega rules are the source code — already indexed above` |
| Sync Code → Memory | `✅ Code symbol sync: Pega rules projected to KB graph during indexing` |

### 4.2 Schema Storage in Knowledge Base

Generated schemas are ingested into KB with the following format:

```
PEGA_SCHEMA | ruleType=Rule-Obj-Activity | fields=12 | {"$schema":"...","properties":{...}}
```

**Agent search pattern:**

```typescript
// Search for a specific rule type schema
mem_search("pega schema Rule-Obj-Activity")

// Search all schemas
mem_search("PEGA_SCHEMA", { type: "PEGA_RULE", limit: 50 })
```

KB entry metadata:
- `type`: `PEGA_RULE`
- `source`: `pega-schema/{RuleType}`
- `tags`: `pega,schema,{RuleType}`
- `scope`: `PROJECT`

File backups remain at `schemas/auto/{RuleType}.schema.json` for human reference.

### 4.3 Graph Edges (Dependency Relationships)

When rules are indexed via "Sync Code → Memory", dependency relationships are created as graph edges. This enables:

- "Who calls whom" — trace Activity → Activity call chains
- Inheritance chains — class hierarchy visualization
- Property ownership — which class owns which properties

**Relationship types:**

| Edge Type | Meaning | Example |
|-----------|---------|---------|
| `CALLS` | Rule invokes another rule | Activity A calls Activity B |
| `INHERITS` | Class extends parent class | `Work-Claim` inherits `Work-` |
| `HAS_PROPERTY` | Class owns a property | `Work-Claim` has `ClaimAmount` |
| `CONNECTS_TO` | Connector/integration link | REST connector → external service |
| `EVALUATES` | Decision rule evaluation | When rule evaluates condition |
| `USES` | General dependency | Flow uses Decision Table |

**Query graph edges:**

```typescript
// Find neighbors of a rule node
mem_graph({ action: "neighbors", node_id: 42 })

// Search graph by label
execute_dynamic_tool({
  tool_name: "kb_graph_query",
  arguments: { query: "ProcessClaim", type: "FUNCTION" }
})
```

### 4.4 Generate Schema for a Single Rule Type

```typescript
const result = await generator.generateForRuleType('Rule-Obj-Activity');
// result.schema — JSON Schema object
// result.coverage — % of fields parsed (vs template-skipped)
// result.templateSections — sections that couldn't be parsed
// result.version — SHA-256 hash for change detection
```

### 4.5 Full Generation (All Types)

```typescript
const report = await generator.generateAll([
  'Rule-Obj-Activity',
  'Rule-Obj-Model',
  'Rule-Obj-When',
  'Rule-Connect-REST',
  'Rule-Declare-DecisionTable',
]);
// report.generated, report.failed, report.skipped
// report.averageCoverage, report.duration
// report.details — per-type breakdown
```

### 4.6 Incremental Generation (Cache-Aware)

```typescript
// Only regenerates schemas whose pzUpdateDateTime changed
const report = await generator.generateIncremental(ruleTypes);
```

### 4.7 Schema Validation (Opt-In)

```typescript
import { SchemaValidator } from './modules/pega/harness-schema/index.js';

const validator = new SchemaValidator({
  schemasDir: './schemas/auto',
  enabled: true,
});

const result = validator.validate(ruleJson, 'Rule-Obj-Activity');
if (!result.valid) {
  for (const err of result.errors) {
    console.log(`${err.path}: ${err.message}`);
  }
}
```

### 4.8 Format Type Mapping

```typescript
import { FormatTypeMapper } from './modules/pega/harness-schema/index.js';

const mapper = new FormatTypeMapper();
mapper.map('pxTextInput');   // { type: 'string' }
mapper.map('pxCheckbox');    // { type: 'boolean' }
mapper.map('pxDateTime');    // { type: 'string', format: 'date-time' }
mapper.map('pxDropdown');    // { type: 'string' }
mapper.map('pxLink');        // { type: 'string', format: 'uri' }
mapper.map('unknown');       // { type: 'string', 'x-unknown-format': 'unknown' }
```

---

## 5. Generated Schema Output

Schemas are written to `{outputDir}/{RuleType}.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "pega://schemas/Rule-Obj-Activity.schema.json",
  "title": "Rule-Obj-Activity",
  "description": "Auto-generated schema from RuleForm harness parsing",
  "type": "object",
  "properties": {
    "pyLabel": { "type": "string", "description": "Rule label" },
    "pyClassName": { "type": "string" },
    "pySteps": {
      "type": "array",
      "items": { "$ref": "#/$defs/Embed-Activity-Steps" },
      "x-page-list-class": "Embed-Activity-Steps"
    }
  },
  "required": ["pyClassName"],
  "$defs": {
    "Embed-Activity-Steps": {
      "type": "object",
      "properties": {}
    }
  },
  "x-generation-metadata": {
    "generatedAt": "2026-08-07T10:00:00Z",
    "harnessInsKey": "RULE-HTML-HARNESS RULE-OBJ-ACTIVITY RULEFORM",
    "coverage": 72.5,
    "templateSections": ["pzDefinition"]
  }
}
```

---

## 6. Architecture

### Module Structure

```
harness-schema/
├── index.ts                    — Public barrel exports
├── HarnessSchemaGenerator.ts   — Pipeline orchestrator
├── models/                     — IR interfaces (ParsedHarness, etc.)
├── fetcher/HarnessFetcher.ts   — API communication with retry
├── parser/
│   ├── HarnessParser.ts        — Recursive descent parser
│   └── FieldExtractor.ts       — Cell → field extraction
├── resolver/
│   ├── PageContextResolver.ts  — pyUsingPage resolution
│   └── ClassHierarchyResolver.ts — OOP section resolution
├── generator/
│   ├── SchemaBuilder.ts        — IR → JSON Schema conversion
│   ├── FormatTypeMapper.ts     — pyFormat → type mapping
│   └── ReportBuilder.ts        — Generation report assembly
├── validator/SchemaValidator.ts — Ajv-based validation
└── cache/SchemaCacheManager.ts  — File-based cache manifest

extension/src/services/
├── IndexingService.ts          — Orchestrates indexing + auto-enable logic
├── PegaSchemaIndexer.ts        — Batch crawl + generate + KB ingest
├── PegaProjectIndexer.ts       — Rule crawl + graph edge creation
└── PegaStreamIngester.ts       — NDJSON stream ingest to KB + graph
```

### Pipeline States

| State | Description |
|-------|-------------|
| `IDLE` | Not running |
| `FETCHING` | Calling Pega API |
| `PARSING` | Recursive descent through harness |
| `GENERATING` | Building JSON Schema |
| `INGESTING` | Storing in KB + creating graph edges |
| `COMPLETE` | Pipeline finished |
| `ERROR` | Pipeline failed |

---

## 7. Troubleshooting

### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `⚠️ Pega Schema: credentials not configured` | `pegaUsername` or password not set | Set `kiroSdlc.pegaUsername` in settings + store password via login command |
| `No harness found for: X` | Rule type has no RuleForm harness | Verify rule type exists via Pega Dev Studio |
| Coverage = 0% | All sections are TEMPLATE | Expected for some JS-rendered rule types |
| API timeout | Pega server unresponsive | Increase `SCHEMA_GENERATION_TIMEOUT` |
| Cache manifest corrupted | Partial write / disk error | Delete `.cache-manifest.json` — next run regenerates |
| Validation always returns valid | `enabled: false` (default) | Set `SCHEMA_VALIDATION_ENABLED=true` |
| Schema gen ran even though unchecked | `schemas/auto/` was empty | Expected — auto-enable ensures schemas exist on first run |
| `❌ Pega Schema Generation Failed` | Fatal error (network, auth) | Check Output panel for stack trace |

### Pega Project Detection Messages

| Old Message (v1) | New Message (v2) | When |
|------------------|------------------|------|
| "No source files found" | `✅ Source code: Pega rules are the source code — already indexed above` | Pega project + rules already indexed |
| "Code symbol sync failed" | `✅ Code symbol sync: Pega rules projected to KB graph during indexing` | Pega project detected |

### Output Panel Banners

| Banner | Meaning |
|--------|---------|
| `=== Pega Rule Schema Generation Started ===` | Schema generation is running |
| `=== Pega Rule Schema Generation Summary ===` | Schema generation complete |
| `=== Workspace Indexing Started ===` | Multiple tasks selected (generic) |

### Retry Behavior

The fetcher retries once on failure with exponential backoff:
- 1st attempt: immediate
- 2nd attempt: after 2 seconds
- After 2nd failure: throws error, rule type marked failed in report

### Circular Reference Detection

If section A includes section B which includes section A, the parser breaks the cycle. Second encounter of a section name in the same parse path returns an empty section. Warning recorded, no crash.

### Max Depth (5 levels)

Section nesting beyond 5 levels is truncated. Pega harnesses rarely exceed 4 levels of nesting in practice.

---

## 8. Error Codes

| Code | Severity | Description | Recovery |
|------|----------|-------------|----------|
| `ERR_AUTH_FAILED` | Critical | Pega API auth failure (401/403) | Check credentials in settings |
| `ERR_API_TIMEOUT` | Warning | Request exceeded timeout | Retry with larger timeout |
| `ERR_NO_HARNESS` | Info | Rule type has no harness | Skip (expected for some types) |
| `ERR_SECTION_UNRESOLVED` | Warning | Section not found in hierarchy | Partial schema produced |
| `ERR_CIRCULAR_REF` | Warning | Circular section reference detected | Cycle broken automatically |
| `ERR_MAX_DEPTH` | Warning | Recursion depth exceeded 5 | Truncated at depth 5 |
| `ERR_MALFORMED_JSON` | Critical | Harness JSON unparseable | Skip rule type |
| `ERR_WRITE_FAILED` | Critical | Cannot write schema to disk | Check permissions |
| `ERR_KB_INGEST_FAILED` | Warning | KB ingest failed (non-fatal) | Schema file still written, retry indexing |

---

## 9. API Reference

### HarnessSchemaGenerator

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `generateForRuleType` | `ruleType: string` | `Promise<GeneratedSchema>` | Generate for one rule type |
| `generateAll` | `ruleTypes: string[]` | `Promise<GenerationReport>` | Generate all specified types |
| `generateIncremental` | `ruleTypes: string[]` | `Promise<GenerationReport>` | Regenerate only changed types |
| `getState` | — | `PipelineState` | Current pipeline state |

### SchemaValidator

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `validate` | `ruleJson, pxObjClass` | `ValidationResult` | Validate rule against schema |
| `isValidationEnabled` | — | `boolean` | Check if validation active |

### FormatTypeMapper

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `map` | `pyFormat: string` | `SchemaTypeDefinition` | Map format to schema type |
| `isKnownFormat` | `pyFormat: string` | `boolean` | Check if format is mapped |
| `getSupportedFormats` | — | `string[]` | List all supported formats |

### PegaSchemaIndexer (Extension)

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `run` | `root, report, pegaClient` | `Promise<string>` | Batch generate all RuleForm schemas + ingest to KB |

---

## 10. FAQ

### Q: Why does schema generation run even when I uncheck it?

If `schemas/auto/` contains no `.json` files, the IndexingService auto-enables schema generation to ensure the workspace has schemas for agents to use. This only happens on the first run or after clearing the schemas directory.

### Q: Where are schemas stored now?

Schemas are stored in two places:
1. **Knowledge Base** (primary) — agents search via `mem_search("pega schema Rule-Obj-Activity")`
2. **File system** (`schemas/auto/`) — human-readable backup for reference and version control

### Q: What are graph edges and how do I use them?

When rules are indexed, dependency relationships (CALLS, INHERITS, HAS_PROPERTY, etc.) are created as graph edges in the KB. Use `mem_graph(action: "neighbors", node_id: N)` to explore connected rules.

### Q: Why does "Index Source Code" show a different message for my Pega project?

For Pega projects (detected via `pega-project.json`), Pega rules ARE the source code. The system shows `✅ Source code: Pega rules are the source code — already indexed above` instead of scanning for traditional source files.

### Q: How do I know if my workspace is detected as a Pega project?

Place a `pega-project.json` file at the workspace root with `"isPegaProject": true`. The Output panel shows `🏛️ Pega Project Detected: "pega:{appName}"` during indexing.

### Q: What does the banner "Pega Rule Schema Generation Started" mean?

This replaces the generic "Workspace Indexing" banner when schema generation is the primary (or only) task selected. It appears in the Output panel at the start of schema generation.

---

## 11. Design Decisions

| Decision | Rationale |
|----------|-----------|
| Schema-first in QuickPick | Schemas are prerequisite for other indexing — generate first |
| Auto-enable when empty | First-time experience — users shouldn't need to know about schemas |
| Dual storage (KB + files) | KB for agent consumption, files for human review and git tracking |
| Graph edges during indexing | Enables rich queries without separate "build graph" step |
| Pega project detection | Eliminates confusing "no source files" errors for Pega workspaces |
| File-based cache (not DB) | Schema files already on disk; manifest is simple JSON |
| Pega naming convention for hierarchy | Avoids extra API calls; correct for 95%+ of cases |
| Template sections marked (not failed) | TEMPLATE layouts are runtime-only; partial coverage expected |
| Validation opt-in by default | Backward compatibility — existing consumers unaffected |
| Max depth 5 | Empirically, Pega harnesses rarely exceed 4 levels |
| SHA-256 for change detection | Standard, collision-resistant, fast for small content |
| KB ingest non-fatal on failure | File backup ensures schemas are not lost if KB is temporarily unavailable |
