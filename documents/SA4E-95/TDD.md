# Technical Design Document (TDD)

## SA4E — SA4E-95: Pega Rule Schema Generator Engine Upgrade

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-95 |
| Title | Pega Rule Schema Generator Engine Upgrade |
| Author | SA Agent |
| Version | 2.0 |
| Date | 2026-08-09 |
| Status | Updated |
| Related BRD | BRD-v1-SA4E-95.docx |
| Related FSD | FSD-v1-SA4E-95.docx |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | SA Agent – Solution Architect | Create document |
| Peer Reviewer | BA Agent – Business Analyst | Review completeness against BRD |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-07 | SA Agent | Initiate document |
| 2.0 | 2026-08-09 | SA Agent | Unified extension→backend schema pipeline, KB ingest, graph edges (PegaGraphProjector), file splits, UX improvements |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm the technical design in this TDD |
| | ☐ I agree and confirm the technical design in this TDD |

---

## 1. Introduction

> **Scope Boundary:** This TDD specifies HOW to implement the Pega Rule Schema Generator Engine Upgrade. Refer to FSD for use cases, business rules, and data models.

### 1.1 Purpose

Design the architecture for an automated JSON Schema generator that parses Pega RuleForm harnesses via the Pega CodeIntelligence API, resolves OOP class hierarchies and page contexts, and produces JSON Schema Draft 2020-12 files per rule type. Generated schemas are stored both on disk (`schemas/auto/`) and in the Knowledge Base for agent consumption.

### 1.2 Scope

- **Extension side**: `PegaSchemaIndexer` crawls ALL RuleForm harnesses, fetches JSON, delegates to backend
- **Backend side**: `harness-schema/` sub-module parses harness JSON → JSON Schema
- KB ingest of generated schemas for agent search
- Graph edge creation on rule ingest (`PegaGraphProjector`)
- Integration with `PegaRuleAstParser` for opt-in schema validation
- Output: JSON Schema files in `schemas/auto/` + KB entries (type=PEGA_RULE, tags=pega,schema)

### 1.3 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | 5.x |
| Runtime | Node.js | 20 LTS |
| Framework | Hono | 4.x |
| HTTP Client | Native fetch | Built-in |
| Schema Validation | Ajv | 8.x (JSON Schema Draft 2020-12) |
| Caching | File-system manifest (JSON) | N/A |
| Testing | Vitest | 1.x |
| Logging | Pino (existing) | 8.x |
| Extension | VS Code Extension API | latest |

### 1.4 Design Principles

- **Unified Pipeline** — single flow from extension crawl through backend parse to KB ingest
- **Separation of Concerns** — extension handles Pega API I/O, backend handles parsing logic
- **Pipeline Architecture** — each stage is an independent, testable unit
- **Strategy Pattern** — format-to-type mapping is configuration-driven
- **Graceful Degradation** — partial failures produce partial results
- **Backward Compatibility** — validation is opt-in; existing consumers unaffected
- **Single Responsibility** — each file ≤200 LOC, one concern per class

### 1.5 Constraints

- Pega API rate limits unknown — defensive retry with backoff required
- TEMPLATE layouts cannot be parsed statically — skip gracefully
- Maximum recursion depth = 5 levels (BR-09)
- Must not break existing PegaRuleAstParser behavior when validation disabled
- Backend DOES NOT call Pega API — extension provides all raw JSON

### 1.6 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-SA4E-95.docx |
| FSD | FSD-v1-SA4E-95.docx |
| Harness Analysis | documents/SA4E-95/ANALYSIS.md |
| Composite Diagrams | documents/SA4E-95/COMPOSITE-DIAGRAMS.md |
| Existing Parser | backend/src/modules/pega/PegaRuleAstParser.ts |

---

## 2. System Architecture

### 2.1 Architecture Overview (v2.0 — Unified Extension→Backend Pipeline)

The Schema Generator Engine uses a **unified pipeline** where the **extension** is responsible for Pega API communication (crawl + fetch) and the **backend** is responsible for parsing and schema generation. This replaces the previous dual-flow design (v1.0) where both extension and backend independently talked to Pega.

**Data Flow (Single Unified Pipeline):**

```
Extension (PegaSchemaIndexer)          Backend (Hono)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━         ━━━━━━━━━━━━━━━━━━━
                                       
1. listRulesByFilter(                  
   "Rule-HTML-Harness",               
   "pyStreamName", "RuleForm")         
   → Paginated crawl ALL harnesses     
                                       
2. For EACH harness:                   
   getRuleByInsKey(pzInsKey)           
   + fetchSections(refs)              
         │                            
         ▼                            
3. POST /api/v1/pega/schema/generate ──→ HarnessParser.parse()
   { harnessJson, sectionJsons }        PageContextResolver
                                        SchemaBuilder.build()
         ◄── { schema, coverage } ──────┘
         │                            
4. SchemaWriter → schemas/auto/        
         │                            
5. POST /api/v1/memory/ingest          
   { type:PEGA_RULE, tags:pega,schema }
   → KB entry for agent search         
```

**Key Design Decision (v2.0):** Backend is a pure computation service — receives raw JSON, returns schema. All Pega API I/O is in the extension. This enables:
- Extension reuses existing `PegaHttpClient` with auth/retry logic
- Backend remains stateless and testable without Pega credentials
- Schema generation can be tested with fixture JSON files

### 2.2 Component Diagram

| Component | Location | Responsibility | LOC |
|-----------|----------|---------------|-----|
| `IndexingService` | extension/src/services/ | Orchestrator — delegates to specialized indexers | 143 |
| `PegaSchemaIndexer` | extension/src/services/ | Batch schema generation (crawl → fetch → backend → write → KB) | 134 |
| `PegaProjectIndexer` | extension/src/services/ | Pega rule crawl & ingest (enumerate → fetch → stream ingest) | 133 |
| `DocumentIndexer` | extension/src/services/ | SDLC document discovery & ingestion | 66 |
| `PegaService` | backend/src/modules/pega/ | Core service: rule ingest, checksum, AST parse | 198 |
| `PegaGraphProjector` | backend/src/modules/pega/ | Graph node projection + dependency edge creation | 69 |
| `pega-utils` | backend/src/modules/pega/ | Shared utilities (category rules, tag parsing) | 47 |
| `pega-schema-routes` | backend/src/server/routes/ | HTTP route: POST /pega/schema/generate | ~100 |
| `HarnessParser` | backend/src/modules/pega/harness-schema/parser/ | Recursive descent parser | ~150 |
| `SchemaBuilder` | backend/src/modules/pega/harness-schema/generator/ | JSON Schema construction | ~120 |
| `FormatTypeMapper` | backend/src/modules/pega/harness-schema/generator/ | pyFormat → JSON Schema type mapping | ~40 |
| `PageContextResolver` | backend/src/modules/pega/harness-schema/resolver/ | pyUsingPage resolution | ~80 |
| `ClassHierarchyResolver` | backend/src/modules/pega/harness-schema/resolver/ | OOP section resolution | ~60 |
| `SchemaValidator` | backend/src/modules/pega/harness-schema/validator/ | Ajv-based rule validation (opt-in) | ~60 |
| `SchemaCacheManager` | backend/src/modules/pega/harness-schema/cache/ | Cache manifest management | ~50 |

### 2.3 Integration Points

| From | To | Protocol | Pattern | Description |
|------|----|----------|---------|-------------|
| PegaSchemaIndexer | Pega API | HTTPS REST | Sync | Crawl harness list + fetch rule JSON |
| PegaSchemaIndexer | Backend `/pega/schema/generate` | HTTP POST | Sync | Send raw JSON, receive schema |
| PegaSchemaIndexer | Backend `/memory/ingest` | HTTP POST | Sync | Store schema in KB |
| PegaSchemaIndexer | File System | File I/O | Sync | Write schema to `schemas/auto/` |
| PegaService.ingestRule | PegaGraphProjector | In-process | Sync | Project node + create edges |
| PegaGraphProjector | graph_nodes table | SQL | Sync | INSERT/UPSERT graph node |
| PegaGraphProjector | graph_edges table | SQL | Sync | INSERT dependency edges |
| SchemaValidator | Ajv | In-process | Sync | Validate rule JSON |

### 2.4 Existing Components (Unchanged)

| Component | Integration | Status |
|-----------|-------------|--------|
| `PegaRuleFetcherService` | Wrapped by PegaHttpClient in extension | Unchanged |
| `PegaMetaModelRegistry` | Stores generated class definitions | Unchanged |
| `PegaSchemaInferrer` | Complemented by harness-derived schema | Unchanged |
| `PegaRuleAstParser` | Extended with opt-in schema validation | Unchanged |
| `PegaSchemaLoader` | Loads schemas from `schemas/auto/` | Unchanged |
| `HarnessParser` | Core parser logic | Unchanged |
| `SchemaBuilder` | Schema construction | Unchanged |
| `FormatTypeMapper` | Format→type mapping | Unchanged |
| `PageContextResolver` | pyUsingPage resolution | Unchanged |
| `ClassHierarchyResolver` | OOP hierarchy | Unchanged |

---

## 3. API Design

### 3.1 HTTP API — Schema Generation Endpoint (NEW in v2.0)

**Route:** `POST /api/v1/pega/schema/generate`
**File:** `backend/src/server/routes/pega-schema-routes.ts`
**Purpose:** Receives raw harness JSON from extension, parses it, returns JSON Schema.

#### Request

```typescript
interface SchemaGenerateRequest {
  harnessJson: Record<string, unknown>;   // Full harness rule JSON from Pega API
  sectionJsons?: Record<string, Record<string, unknown>>; // Pre-fetched sections by name
  ruleType?: string;                       // e.g. "Rule-Obj-Activity"
}
```

#### Response (200 OK)

```typescript
interface SchemaGenerateResponse {
  schema: JSONSchema2020;      // Generated JSON Schema Draft 2020-12
  ruleType: string;            // Resolved rule type
  coverage: number;            // Field coverage percentage
  templateSections: string[];  // Sections skipped due to TEMPLATE layout
}
```

#### Error Response (400/500)

```json
{
  "error": "Schema generation failed",
  "details": "HarnessParser: malformed pySections array"
}
```

### 3.2 HTTP API — KB Ingest Endpoint (Used by Schema Pipeline)

**Route:** `POST /api/v1/memory/ingest`
**Purpose:** Stores generated schema in KB for agent discovery via `mem_search`.

#### Request (for schema ingest)

```typescript
{
  content: "PEGA_SCHEMA | ruleType=Rule-Obj-Activity | fields=38 | {full JSON schema}",
  type: "PEGA_RULE",
  source: "pega-schema/Rule-Obj-Activity",
  tags: "pega,schema,Rule-Obj-Activity",
  scope: "PROJECT"
}
```

#### Agent Discovery Pattern

```
// Agents find schemas via:
mem_search("pega schema Rule-Obj-Activity")
// Returns KB entry with full JSON schema content
```

### 3.3 Internal API — PegaService.ingestRule (Updated v2.0)

```typescript
interface PegaIngestRuleRequest {
  ruleJson: Record<string, unknown>;
  projectId: string;
  checksum?: string;   // SHA-256 of rule JSON for dedup
  version?: string;    // Rule version for tracking
}

interface PegaIngestRuleResponse {
  status: 'success' | 'error';
  ruleId: number;
  unresolvedDependencies: UnresolvedDependency[];
}
```

**v2.0 Change:** After KB insert, `ingestRule()` now calls:
1. `projectRuleToGraphNode()` — upsert graph node
2. `createDependencyEdges()` — create relationship edges

### 3.4 Internal API — HarnessSchemaGenerator Interface (Unchanged)

```typescript
interface IHarnessSchemaGenerator {
  generateForRuleType(ruleType: string): Promise<GeneratedSchema>;
  generateAll(): Promise<GenerationReport>;
  generateIncremental(): Promise<GenerationReport>;
}
```

### 3.5 Internal API — HarnessParser Interface (Unchanged)

```typescript
interface IHarnessParser {
  parse(harnessJson: Record<string, unknown>): ParsedHarness;
}
```

### 3.6 Internal API — SchemaValidator Interface (Unchanged)

```typescript
interface ISchemaValidator {
  validate(ruleJson: Record<string, unknown>, pxObjClass: string): ValidationResult;
  isValidationEnabled(): boolean;
}
```

---

## 4. Graph Edge Creation — PegaGraphProjector (NEW in v2.0)

### 4.1 Overview

When a Pega rule is ingested via `PegaService.ingestRule()`, the system now creates **dependency edges** in the `graph_edges` table. This enables agents to traverse rule relationships (who calls whom, inheritance chains, property ownership).

### 4.2 Architecture

```
PegaService.ingestRule(req)
  │
  ├── PegaParser.parseSymbol(ruleJson) → fqn
  ├── PegaParser.extractDependencies(ruleJson) → UnresolvedDependency[]
  ├── MemoryEngine.insert(KB entry)
  │
  └── PegaGraphProjector:
        ├── projectRuleToGraphNode(adapter, fqn, pxObjClass, projectId)
        │     → INSERT/UPSERT into graph_nodes
        │     → Node ID: "pega:{fqn}"
        │     → Type: mapped via pxObjClassToGraphType()
        │
        └── createDependencyEdges(adapter, sourceNodeId, deps)
              → For each dependency:
                 target = "pega:{ruleType}:{className}:{ruleName}"
                 INSERT into graph_edges (source, target, weight, rel_type)
                 ON CONFLICT DO NOTHING (idempotent)
```

### 4.3 Relationship Types

| Rule Type Pattern | Relationship | Example |
|-------------------|-------------|---------|
| `*Activity*`, `*Flow*` | `CALLS` | Flow step calls Activity |
| `*Class*` | `INHERITS` | Work-Claim inherits Work- |
| `*Property*` | `HAS_PROPERTY` | Class has property |
| `*Connect*` | `CONNECTS_TO` | Connector rule |
| `*Decision*`, `*When*` | `EVALUATES` | Decision table reference |
| (default) | `USES` | Generic dependency |

### 4.4 Graph Node Type Classification

Node types are resolved via `pxObjClassToGraphType()` in `pega-utils.ts`:
1. Check `pega-categories.json` rules (keyword-based)
2. Fallback: auto-extract category from pxObjClass name segments

### 4.5 Idempotency

- `graph_nodes`: Uses `ON CONFLICT (entry_id) DO UPDATE` (PostgreSQL) or `INSERT OR REPLACE` (SQLite)
- `graph_edges`: Uses `ON CONFLICT DO NOTHING` — duplicate edges are silently ignored
- Target nodes may not exist yet (forward references) — edges are created optimistically

### 4.6 File: `PegaGraphProjector.ts` (69 LOC)

```typescript
// Key exports:
export async function projectRuleToGraphNode(
  adapter: DatabaseAdapter, fqn: string, pxObjClass: string, projectId: string
): Promise<string>  // returns "pega:{fqn}"

export async function createDependencyEdges(
  adapter: DatabaseAdapter, sourceNodeId: string, deps: UnresolvedDependency[]
): Promise<void>
```

---

## 5. Database Design

### 5.1 Graph Tables (Used by PegaGraphProjector)

**graph_nodes** (existing table, new usage):

| Column | Type | Description |
|--------|------|-------------|
| entry_id | TEXT PK | `pega:{ruleType}:{className}:{ruleName}` |
| label | TEXT | Full FQN for display |
| type | TEXT | Category via `pxObjClassToGraphType()` |
| tier | TEXT | Always `SEMANTIC` for Pega rules |
| project_id | TEXT | Tenant project ID |
| x, y, z | REAL | Random position for visualization |
| level | INTEGER | 0 (flat) |
| cluster_id | TEXT | `pega-cluster` |

**graph_edges** (existing table, new usage):

| Column | Type | Description |
|--------|------|-------------|
| source | TEXT | Source node entry_id |
| target | TEXT | Target node entry_id |
| weight | REAL | 0.7 (default relationship strength) |
| rel_type | TEXT | CALLS, INHERITS, HAS_PROPERTY, CONNECTS_TO, EVALUATES, USES |

### 5.2 KB Entries for Schemas

| Storage | Format | Location |
|---------|--------|----------|
| Generated schemas (disk) | JSON Schema files | `schemas/auto/{RuleType}.schema.json` |
| Generated schemas (KB) | knowledge_entries row | type=PEGA_RULE, source=`pega-schema/{RuleType}` |
| Cache manifest | JSON | `schemas/auto/.cache-manifest.json` |

### 5.3 KB Entry Structure for Schema

```json
{
  "content": "PEGA_SCHEMA | ruleType=Rule-Obj-Activity | fields=38 | {full schema JSON}",
  "type": "PEGA_RULE",
  "source": "pega-schema/Rule-Obj-Activity",
  "tags": "pega,schema,Rule-Obj-Activity",
  "scope": "PROJECT"
}
```

---

## 6. Class / Module Design

### 6.1 Extension File Structure (v2.0)

```
extension/src/services/
├── IndexingService.ts          (143 LOC) — Orchestrator: delegates to specialized indexers
├── PegaSchemaIndexer.ts        (134 LOC) — Batch schema generation pipeline
├── PegaProjectIndexer.ts       (133 LOC) — Pega rule crawl & ingest
├── DocumentIndexer.ts          (66 LOC)  — Document discovery & ingestion
├── IndexerHttpClient.ts                  — HTTP client for backend communication
├── PegaHttpClient.ts                     — Pega CodeIntelligence API client
├── PegaCrawlHelper.ts                    — Parallel fetch utilities
├── PegaRuleSetEnumerator.ts              — RuleSet enumeration logic
├── PegaStreamIngester.ts                 — NDJSON stream ingest to backend
└── SchemaWriter.ts                       — Write schema JSON to disk
```

**IndexingService (Orchestrator Pattern):**
```typescript
export class IndexingService {
  async indexWorkspace(root, options, token?, secrets?): Promise<string[]> {
    // 1. Auto-enable schema gen if no schemas in KB
    // 2. Delegate to PegaSchemaIndexer (if schemas enabled)
    // 3. Delegate to PegaProjectIndexer (if sync enabled)
    // 4. Delegate to DocumentIndexer (if documents enabled)
    // 5. Handle code indexing / Pega project detection
  }
}
```

**PegaSchemaIndexer (Pipeline):**
```typescript
export class PegaSchemaIndexer {
  async run(root, report, pegaClient): Promise<string> {
    // 1. crawlAllHarnesses() — paginated listRulesByFilter
    // 2. For each: generateForHarness() → POST /pega/schema/generate
    // 3. SchemaWriter.writeSchema() → disk
    // 4. ingestSchemaToKB() → POST /memory/ingest
  }
}
```

### 6.2 Backend File Structure (v2.0)

```
backend/src/modules/pega/
├── PegaService.ts              (198 LOC) — Core service: ingest, check, parse, AST
├── PegaGraphProjector.ts       (69 LOC)  — Graph node + edge projection
├── pega-utils.ts               (47 LOC)  — Shared utilities (category, tags)
├── PegaParser.ts                          — Symbol extraction + dependency extraction
├── PegaRuleAstParser.ts                   — AST parsing for rule JSON
├── PegaSchemaLoader.ts                    — Load schemas from disk/DB
├── PegaDeclarativeEngine.ts               — Declare Expression tracking
├── models.ts                              — Interfaces & types
├── strategies/                            — Parser strategy implementations
└── harness-schema/                        — Schema generation sub-module
    ├── index.ts
    ├── HarnessSchemaGenerator.ts          — Pipeline orchestrator
    ├── models/                            — IR data models
    ├── fetcher/HarnessFetcher.ts          — API communication wrapper
    ├── parser/HarnessParser.ts            — Recursive descent parser
    ├── resolver/
    │   ├── PageContextResolver.ts         — pyUsingPage resolution
    │   └── ClassHierarchyResolver.ts      — OOP section resolution
    ├── generator/
    │   ├── SchemaBuilder.ts               — JSON Schema construction
    │   └── FormatTypeMapper.ts            — pyFormat → type mapping
    ├── validator/SchemaValidator.ts        — Ajv-based validation
    └── cache/SchemaCacheManager.ts        — Cache manifest management

backend/src/server/routes/
├── pega-schema-routes.ts       (~100 LOC) — POST /pega/schema/generate
└── ... (other routes)
```

### 6.3 Key Class Interactions (v2.0 Flow)

```
Extension:
  IndexingService
    └── PegaSchemaIndexer
          ├── PegaHttpClient (Pega API)
          ├── IndexerHttpClient → Backend /pega/schema/generate
          ├── SchemaWriter (disk I/O)
          └── IndexerHttpClient → Backend /memory/ingest

Backend:
  pega-schema-routes.ts
    ├── HarnessParser (parse harness JSON)
    │     ├── PageContextResolver
    │     └── ClassHierarchyResolver (local, from provided sections)
    └── SchemaBuilder (generate JSON Schema)

  PegaService.ingestRule()
    ├── PegaParser.parseSymbol()
    ├── PegaParser.extractDependencies()
    ├── PegaRuleAstParser.parse()
    ├── MemoryEngine.insert()
    └── PegaGraphProjector
          ├── projectRuleToGraphNode()
          └── createDependencyEdges()
```

### 6.4 Design Patterns

| Pattern | Where Used | Rationale |
|---------|-----------|-----------|
| Pipeline | PegaSchemaIndexer, HarnessSchemaGenerator | Clear stage separation, each stage testable |
| Strategy | FormatTypeMapper | Configuration-driven type mapping |
| Decorator | SchemaValidator wrapping PegaRuleAstParser | Opt-in validation |
| Orchestrator | IndexingService | Delegates to specialized indexers |
| Singleton | PegaMetaModelRegistry | Shared class registry |
| Template Method | HarnessParser.parseSectionBody | Common parse with type-specific extraction |
| Cache-Aside | SchemaCacheManager | Check cache before regenerating |
| Observer | Progress reporting via vscode.Progress | UX feedback during long operations |

### 6.5 Error Handling

| Exception | Severity | Recovery |
|-----------|----------|----------|
| ApiAuthenticationError | Critical | Abort, report "credentials not configured" |
| ApiTimeoutError | Warning | Retry once with backoff, then skip type |
| ApiRateLimitError | Warning | Wait Retry-After, retry |
| HarnessNotFoundError | Info | Skip rule type, log |
| SectionUnresolvedError | Warning | Use partial schema |
| CircularReferenceError | Warning | Break cycle, log |
| MaxDepthExceededError | Warning | Truncate, log |
| Backend 4xx/5xx | Warning | Skip rule type, log error body |
| KB ingest failure | Info | Non-fatal — file already written to disk |
| Graph projection failure | Info | Non-fatal — KB entry already created |

---

## 7. Integration Design

### 7.1 External System: Pega CodeIntelligence API

| Attribute | Value |
|-----------|-------|
| Protocol | HTTPS REST |
| Base URL | Configured via extension settings (`kiroSdlc.pegaEndpoint`) |
| Authentication | Basic Auth (from VS Code SecretStorage) |
| Timeout | 10 seconds |
| Retry Policy | 1 retry with exponential backoff (2s, then 4s) |
| Rate Limit Handling | Respect Retry-After header |
| Caller | Extension only (PegaHttpClient) |

**API Endpoints Used (by Extension):**

| Endpoint | Purpose | Parameters |
|----------|---------|------------|
| GET /rules/listRules | Discover harness/section rules | ObjClass, FilterPropName, FilterPropValue |
| GET /rules/{pzInsKey} | Fetch full rule JSON | URL-encoded pzInsKey |
| GET /rules/directChildren | Class hierarchy resolution | className |

### 7.2 Internal: Extension → Backend Communication

| Route | Purpose | Caller | Handler |
|-------|---------|--------|---------|
| POST /api/v1/pega/schema/generate | Parse harness → schema | PegaSchemaIndexer | pega-schema-routes.ts |
| POST /api/v1/memory/ingest | Store schema in KB | PegaSchemaIndexer | memory routes |
| POST /api/v1/pega/rules/ingest | Bulk rule ingest (NDJSON) | PegaProjectIndexer | pega routes |

### 7.3 Internal: PegaRuleAstParser Extension

The existing parser is extended via composition (not inheritance) for opt-in validation:

```typescript
export class ValidatingPegaRuleAstParser {
  constructor(
    private parser: PegaRuleAstParser,
    private validator: SchemaValidator,
    private config: { validationEnabled: boolean }
  ) {}

  parse(json: Record<string, unknown>): PegaRuleAst {
    const ast = this.parser.parse(json);
    if (this.config.validationEnabled) {
      const result = this.validator.validate(json, json.pxObjClass as string);
      if (!result.valid) { ast.validationErrors = result.errors; }
    }
    return ast;
  }
}
```

---

## 8. Security Design

### 8.1 Authentication

| Aspect | Implementation |
|--------|---------------|
| Pega API credentials | VS Code SecretStorage (extension-side only) |
| Backend access | Local-only (127.0.0.1), no auth required |
| Credential flow | Extension reads from SecretStorage → sends to Pega API directly |
| Token refresh | Session-based, auto-re-auth via PegaHttpClient |

### 8.2 Data Protection

| Data Type | At Rest | In Transit | In Logs |
|-----------|---------|------------|---------|
| Pega API credentials | VS Code SecretStorage (encrypted) | Basic Auth over HTTPS | Excluded |
| Harness JSON | Not persisted (in-memory only) | HTTP to localhost backend | Excluded (large) |
| Generated schemas | Plain JSON (non-sensitive metadata) | HTTP to localhost | Not logged |
| KB entries | SQLite DB (local) | N/A | Not logged |

### 8.3 Input Validation

| Input | Validation | Sanitization |
|-------|-----------|--------------|
| Backend schema/generate body | JSON parse + harnessJson required check | Return 400 if missing |
| Rule type parameter | Derived from harness pyClassName | Strip unknown characters |
| pyValue field bindings | Regex validation (dot-prefixed) | Strip leading dot |
| Section depth | Max 5 enforced | Truncate on exceed |
| Circular references | Visited set tracking | Break cycle |

### 8.4 Threat Mitigations

| Threat | Mitigation |
|--------|------------|
| API credential exposure | SecretStorage, never in code/logs/disk |
| Infinite recursion | Max depth 5 + visited set |
| Large response DoS | Response size implicit limit (Pega API) |
| Man-in-the-middle | HTTPS for Pega API; localhost for backend |
| Unauthorized backend access | Backend binds to 127.0.0.1 only |

---

## 9. Performance & Scalability

### 9.1 Caching Strategy

| Cache | What | TTL | Eviction | Technology |
|-------|------|-----|----------|------------|
| Schema Cache (disk) | Generated JSON Schema files | Until harness changes | Version-based | File system |
| Schema Cache (KB) | KB entries with schema content | Overwritten on regen | Replace on source key | SQLite |
| Hierarchy Cache | Class hierarchy arrays | Session lifetime | LRU (50) | In-memory Map |
| Section Cache | Fetched section JSON | Duration of single gen run | Clear after pipeline | In-memory Map |

### 9.2 Performance Targets

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Single rule type (end-to-end) | < 5 seconds | API fetch + backend parse + write + KB ingest |
| Full generation (20+ types) | < 2 minutes | Cold start, all types sequentially |
| Schema validation (per rule) | < 10ms | Ajv compiled schema |
| Graph edge creation (per rule) | < 5ms | SQL INSERT with ON CONFLICT |

### 9.3 Optimization Strategies

- **Sequential per-type** (current): simple, avoids Pega API rate limits
- **Ajv schema compilation**: Pre-compile on load, reuse compiled validators
- **Section deduplication**: Cache parsed sections across rule types (shared @baseclass)
- **Checksum-based skip**: Skip re-ingest if rule checksum unchanged
- **Auto-enable heuristic**: Only run schema gen if `schemas/auto/` is empty

---

## 10. UX Design (v2.0 Improvements)

### 10.1 Progress Reporting

| UX Element | Before (v1.0) | After (v2.0) |
|------------|---------------|--------------|
| Banner title | "Workspace Indexing" | "Pega Rule Schema Generation Started" |
| Progress messages | Generic "Indexing..." | `[3/20] Rule-Obj-Activity...` |
| QuickPick order | Schema gen buried | Schema gen FIRST in list |
| Auto-enable | Manual selection required | Auto-enabled if no schemas in KB |
| Pega project detection | "No source files found" | "Rules are the source code" |
| Log language | Vietnamese mixed | English only |

### 10.2 QuickPick Behavior

```typescript
// Schema gen is first option + auto-selected for Pega projects
// If no schemas in KB → auto-enable without user intervention
if (!hasExistingSchemas(root)) {
  options.schemas = true;
  log("Auto-enabling schema generation (no schemas found).");
}
```

### 10.3 Output Summary Format

```
📐 Pega Rule Schemas: Generated 18 schemas for 20 rule types (2 failed)
🏛️ Pega: "pega:HRAppsV2" — Ingested 1349 rules (KB: 1349, Graph: 1349)
✅ Documents: 12 discovered
```

---

## 11. Monitoring & Observability

### 11.1 Logging

| Log Event | Level | Source | When |
|-----------|-------|--------|------|
| Schema gen started | INFO | PegaSchemaIndexer | Pipeline start |
| Harness crawl complete | INFO | PegaSchemaIndexer | After pagination |
| Schema generated | INFO | pega-schema-routes | After backend parse |
| Schema written to disk | DEBUG | PegaSchemaIndexer | After SchemaWriter |
| KB ingest success | DEBUG | PegaSchemaIndexer | After memory/ingest |
| Schema gen failed (type) | WARN | PegaSchemaIndexer | Per-type failure |
| Graph node projected | DEBUG | PegaGraphProjector | After upsert |
| Dependency edges created | DEBUG | PegaGraphProjector | After edge batch |
| TEMPLATE skipped | WARN | HarnessParser | On TEMPLATE encounter |
| Circular reference | WARN | HarnessParser | On cycle detection |

### 11.2 Metrics

| Metric | Type | Description |
|--------|------|-------------|
| schema_generation_total | Counter | Rule types attempted |
| schema_generation_success | Counter | Successful schema generations |
| schema_generation_failed | Counter | Failed schema generations |
| schema_coverage_percent | Gauge | Field coverage per type |
| graph_edges_created | Counter | Dependency edges created |
| pega_api_requests_total | Counter | Pega API calls made (extension) |
| schema_kb_ingest_total | Counter | KB entries created for schemas |

---

## 12. Deployment Considerations

### 12.1 Configuration

| Property | Default | Description |
|----------|---------|-------------|
| kiroSdlc.pegaEndpoint | (required) | Pega CodeIntelligence API base URL |
| kiroSdlc.pegaUsername | (required) | API username (VS Code settings) |
| kiroSdlc.pegaPassword | (required) | API password (VS Code SecretStorage) |
| SCHEMA_VALIDATION_ENABLED | false | Enable schema validation in parser |
| SCHEMA_OUTPUT_DIR | schemas/auto | Output directory for generated schemas |
| SCHEMA_MAX_DEPTH | 5 | Max section recursion depth |

### 12.2 Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| SCHEMA_VALIDATION_ENABLED | false | Master switch for schema validation |
| SCHEMA_STRICT_MODE | false | Unknown properties cause validation failure |
| SCHEMA_CACHE_ENABLED | true | Enable/disable schema caching |
| Auto-enable schema gen | true | Auto-enable if no schemas in workspace |

### 12.3 Rollback Strategy

- Schema generation is additive (creates new files + KB entries)
- Rollback disk: delete `schemas/auto/` directory
- Rollback KB: delete entries with source=`pega-schema/*`
- Graph edges: delete from graph_edges where source LIKE 'pega:%'
- Validation: disable via `SCHEMA_VALIDATION_ENABLED=false`
- No database schema migrations required

---

## 13. Implementation Checklist (Updated v2.0)

### Phase 1: Extension Pipeline (PegaSchemaIndexer) ✅ DONE

| # | Component | Files | Status |
|---|-----------|-------|--------|
| 1.1 | PegaSchemaIndexer | `extension/src/services/PegaSchemaIndexer.ts` | ✅ Done (134 LOC) |
| 1.2 | IndexingService refactor | `extension/src/services/IndexingService.ts` | ✅ Done (143 LOC) |
| 1.3 | PegaProjectIndexer extract | `extension/src/services/PegaProjectIndexer.ts` | ✅ Done (133 LOC) |
| 1.4 | DocumentIndexer extract | `extension/src/services/DocumentIndexer.ts` | ✅ Done (66 LOC) |
| 1.5 | SchemaWriter utility | `extension/src/services/SchemaWriter.ts` | ✅ Done |
| 1.6 | KB ingest integration | In PegaSchemaIndexer.ingestSchemaToKB() | ✅ Done |

### Phase 2: Backend Schema Route ✅ DONE

| # | Component | Files | Status |
|---|-----------|-------|--------|
| 2.1 | Schema generate route | `backend/src/server/routes/pega-schema-routes.ts` | ✅ Done |
| 2.2 | Local resolver (no-op fetcher) | In pega-schema-routes.ts | ✅ Done |
| 2.3 | HarnessParser integration | Reuses existing parser | ✅ Done |
| 2.4 | SchemaBuilder integration | Reuses existing builder | ✅ Done |

### Phase 3: Graph Edge Creation ✅ DONE

| # | Component | Files | Status |
|---|-----------|-------|--------|
| 3.1 | PegaGraphProjector | `backend/src/modules/pega/PegaGraphProjector.ts` | ✅ Done (69 LOC) |
| 3.2 | pega-utils extract | `backend/src/modules/pega/pega-utils.ts` | ✅ Done (47 LOC) |
| 3.3 | PegaService integration | Calls projectRuleToGraphNode + createDependencyEdges | ✅ Done |
| 3.4 | Relationship type mapping | mapDependencyRelType() in PegaGraphProjector | ✅ Done |

### Phase 4: UX Improvements ✅ DONE

| # | Component | Status |
|---|-----------|--------|
| 4.1 | Dynamic banner title | ✅ Done |
| 4.2 | Schema gen first in QuickPick | ✅ Done |
| 4.3 | Auto-enable if no schemas | ✅ Done |
| 4.4 | Pega project detection message | ✅ Done |
| 4.5 | English log messages | ✅ Done |

### Phase 5: Parser & Resolvers (From v1.0 — Unchanged)

| # | Component | Files | Status |
|---|-----------|-------|--------|
| 5.1 | HarnessParser | `harness-schema/parser/HarnessParser.ts` | ✅ Done |
| 5.2 | PageContextResolver | `harness-schema/resolver/PageContextResolver.ts` | ✅ Done |
| 5.3 | ClassHierarchyResolver | `harness-schema/resolver/ClassHierarchyResolver.ts` | ✅ Done |
| 5.4 | FormatTypeMapper | `harness-schema/generator/FormatTypeMapper.ts` | ✅ Done |
| 5.5 | SchemaBuilder | `harness-schema/generator/SchemaBuilder.ts` | ✅ Done |

### Phase 6: Validator + Cache (Optional — from v1.0)

| # | Component | Files | Status |
|---|-----------|-------|--------|
| 6.1 | SchemaValidator | `harness-schema/validator/SchemaValidator.ts` | SHOULD |
| 6.2 | ValidatingPegaRuleAstParser | Extension wrapper | SHOULD |
| 6.3 | SchemaCacheManager | `harness-schema/cache/SchemaCacheManager.ts` | COULD |
| 6.4 | Incremental generation | Only regenerate changed schemas | COULD |

---

## 14. Error Handling Strategy

### 14.1 Error Categories and Recovery

| Category | Strategy | Example |
|----------|----------|---------|
| Pega API Network Errors | Retry once with backoff; skip on 2nd failure | Timeout, connection refused |
| Pega API Auth Errors | Fail immediately, report "credentials not configured" | 401/403 |
| Backend Schema Parse Errors | Skip rule type, log error body, continue | Malformed harness JSON |
| KB Ingest Failure | Non-fatal — file already on disk | Backend /memory/ingest 500 |
| Graph Projection Failure | Non-fatal — KB entry already exists | SQL constraint violation |
| Circular Reference | Break cycle at visited set, continue siblings | Section A → B → A |
| Max Depth Exceeded | Truncate, log, continue | Depth > 5 |

### 14.2 Graceful Degradation Levels

| Level | Condition | Behavior |
|-------|-----------|----------|
| Full success | All types parsed + KB ingested + graph edges | Complete pipeline |
| Partial success (KB fail) | Schema on disk, KB ingest failed | Disk backup available |
| Partial success (types failed) | Some types failed | Report count, continue |
| Minimal | Credentials missing | Report config message, skip |
| Pipeline abort | Backend unreachable | Report error, no schemas |

### 14.3 Error Propagation in PegaSchemaIndexer

```
PegaSchemaIndexer.run()
├── Per-type errors → logged + added to failures list
├── Never throws for individual type failures
├── Returns summary string: "Generated X schemas (Y failed)"
└── Only throws for fatal errors (PegaHttpClient constructor fail)
```

### 14.4 Error Propagation in PegaService.ingestRule

```
PegaService.ingestRule()
├── Parser unsupported type → return success with ruleId=-1 (skip gracefully)
├── Checksum match → skip (already up-to-date)
├── KB insert → always succeeds or throws
├── Graph projection failure → try/catch, non-fatal
└── Returns unresolvedDependencies regardless of graph success
```

---

## 15. Summary of v1.0 → v2.0 Changes

| Area | v1.0 (Before) | v2.0 (After) |
|------|---------------|--------------|
| Schema pipeline | 2 separate flows (ext + backend) | Single unified extension→backend flow |
| Pega API caller | Both extension and backend | Extension ONLY |
| Backend role | Full pipeline orchestrator | Pure computation (parse harness JSON) |
| Schema storage | Filesystem only | Filesystem + KB (dual) |
| Agent access to schemas | Load from disk | `mem_search("pega schema {type}")` |
| Rule ingest graph | Node only | Node + dependency edges |
| IndexingService | 468 LOC monolith | 4 files (143 + 134 + 133 + 66 LOC) |
| PegaService | 294 LOC | 3 files (198 + 69 + 47 LOC) |
| UX banner | "Workspace Indexing" | Dynamic: "Pega Rule Schema Generation" |
| Schema gen trigger | Manual selection | Auto-enabled if no schemas |
| Log language | Vietnamese mixed | English only |
| Dependency tracking | None | 6 relationship types in graph_edges |

---
