# Technical Design Document (TDD)

## SA4E-108: [Indexing] Project-Type-Aware Workspace Indexing Strategy

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-108 |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-08-13 |
| Status | Draft |
| Related FSD | FSD-v1-SA4E-108.docx |
| Related BRD | BRD-v1-SA4E-108.docx |

---

## 1. Architecture Overview

### 1.1 Design Philosophy

- **KB-Driven**: All project type definitions stored in Knowledge Base, not code
- **Strategy Pattern**: Each type resolves to an IndexingStrategy via registry
- **Open/Closed**: New types added via KB ingestion — zero code changes
- **Graceful Degradation**: KB unavailable → built-in fallback defaults
- **Performance**: In-memory caching, async LLM discovery (non-blocking)

### 1.2 Module Placement

| New Module | Location | Responsibility |
|------------|----------|----------------|
| `ProjectTypeDetector` | `backend/src/engine/indexer/project-type/detector.ts` | Load KB configs, scan build files, score confidence |
| `IndexingStrategyResolver` | `backend/src/engine/indexer/project-type/resolver.ts` | Map DetectionResult → IndexingConfig |
| `LLMDiscoveryService` | `backend/src/engine/indexer/project-type/discovery.ts` | Async LLM-based type discovery |
| `ProjectTypeCache` | `backend/src/engine/indexer/project-type/cache.ts` | SQLite cache read/write/invalidate |
| `project-type-seeds.json` | `backend/src/data/project-type-seeds.json` | 15 seed type definitions |
| Models | `backend/src/engine/indexer/project-type/models.ts` | Interfaces + Zod schemas |

---

## 2. Detailed Design

### 2.1 Models (`models.ts`)

```typescript
import { z } from 'zod';

export const SignalSchema = z.object({
  file: z.string(),
  confidence: z.number().min(0).max(1),
});

export const ProjectTypeConfigSchema = z.object({
  type_id: z.string().min(1),
  display_name: z.string().min(1),
  signals: z.array(SignalSchema).min(1),
  source_roots: z.array(z.string()).min(1),
  test_roots: z.array(z.string()).optional(),
  exclude_patterns: z.array(z.string()).min(1),
  extensions: z.array(z.string()).min(1),
  mono_repo_signals: z.array(z.string()).optional(),
  priority: z.number().optional().default(0),
  auto_discovered: z.boolean().optional().default(false),
});

export type ProjectTypeConfig = z.infer<typeof ProjectTypeConfigSchema>;
export type Signal = z.infer<typeof SignalSchema>;

export interface DetectionResult {
  project_type: string;
  build_tool: string;
  confidence: number;
  detected_files: string[];
  source_roots: string[];
  test_roots: string[];
  exclude_patterns: string[];
  extensions: string[];
  is_mono_repo: boolean;
  sub_projects?: SubProject[];
}

export interface SubProject {
  path: string;
  type: string;
  source_roots: string[];
}

export interface IndexingConfig {
  sourceRoots: string[];
  excludePatterns: string[];
  includeExtensions: string[];
  testRoots: string[];
  scanOrder: 'source_first' | 'default';
}
```

### 2.2 ProjectTypeDetector (`detector.ts`)

```typescript
/** SA4E-108 — Detects project type from workspace build files via KB. */
export class ProjectTypeDetector {
  private configCache: ProjectTypeConfig[] | null = null;

  constructor(
    private readonly kb: KBClient,
    private readonly cache: ProjectTypeCache,
    private readonly logger: Logger,
  ) {}

  async loadTypeDefinitions(): Promise<ProjectTypeConfig[]> {
    if (this.configCache) return this.configCache;
    const results = await this.kb.search('project-type-config', { type: 'ARCHITECTURE', limit: 50 });
    const configs = results
      .map(r => ProjectTypeConfigSchema.safeParse(JSON.parse(r.content)))
      .filter(r => r.success)
      .map(r => r.data!);
    if (configs.length === 0) return this.loadBuiltInDefaults();
    this.configCache = configs.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return this.configCache;
  }

  async detect(workspacePath: string): Promise<DetectionResult> {
    const cached = await this.cache.get(workspacePath);
    if (cached && await this.isCacheValid(cached)) return cached;
    const configs = await this.loadTypeDefinitions();
    const buildFiles = await this.scanBuildFiles(workspacePath, 2);
    const matches = this.scoreAll(configs, buildFiles)
      .filter(m => m.score >= 0.5)
      .sort((a, b) => b.score - a.score);
    if (matches.length === 0) return this.fallbackResult(workspacePath, buildFiles);
    const best = matches[0];
    if (this.hasMonoRepoSignals(best.config, buildFiles)) {
      return this.detectSubProjects(workspacePath, best, buildFiles);
    }
    const result = this.buildResult(best, buildFiles);
    await this.cache.set(workspacePath, result);
    return result;
  }

  async redetect(path: string): Promise<DetectionResult> {
    await this.cache.invalidate(path);
    return this.detect(path);
  }

  invalidateConfigCache(): void { this.configCache = null; }
}
```

### 2.3 IndexingStrategyResolver (`resolver.ts`)

```typescript
/** SA4E-108 — Resolves DetectionResult into IndexingConfig. */
export class IndexingStrategyResolver {
  private static readonly BASE_EXCLUDES = ['.git', '.svn', '.hg'];

  resolve(detection: DetectionResult): IndexingConfig {
    return {
      sourceRoots: detection.source_roots,
      excludePatterns: [...IndexingStrategyResolver.BASE_EXCLUDES, ...detection.exclude_patterns],
      includeExtensions: detection.extensions,
      testRoots: detection.test_roots,
      scanOrder: 'source_first',
    };
  }

  getFallback(): IndexingConfig {
    return { sourceRoots: [], excludePatterns: DEFAULT_EXCLUDE, includeExtensions: DEFAULT_EXTENSIONS, testRoots: [], scanOrder: 'default' };
  }
}
```

### 2.4 ProjectTypeCache (`cache.ts`)

```typescript
/** SA4E-108 — SQLite cache for detected project types. */
export class ProjectTypeCache {
  constructor(private readonly db: DatabaseAdapter) { this.ensureTable(); }
  async get(path: string): Promise<DetectionResult | null> { ... }
  async set(path: string, result: DetectionResult): Promise<void> { ... }
  async invalidate(path: string): Promise<void> { ... }
  async canDiscover(path: string): Promise<boolean> { /* <24h */ }
  async markDiscovered(path: string): Promise<void> { ... }
}
```

### 2.5 LLMDiscoveryService (`discovery.ts`)

```typescript
/** SA4E-108 — Async LLM discovery. Fire-and-forget, non-blocking. */
export class LLMDiscoveryService {
  constructor(private readonly kb: KBClient, private readonly cache: ProjectTypeCache, private readonly llm: LLMProvider) {}

  async discoverAsync(workspacePath: string, files: string[]): Promise<void> {
    if (!await this.cache.canDiscover(workspacePath)) return;
    setImmediate(async () => {
      try {
        const response = await this.llm.complete(this.buildPrompt(files), { timeout: 30000 });
        const parsed = ProjectTypeConfigSchema.safeParse(JSON.parse(response));
        if (!parsed.success) return;
        const config = { ...parsed.data, auto_discovered: true };
        const existing = await this.kb.search(`project-type-config ${config.type_id}`);
        if (existing.length > 0) return;
        await this.kb.ingest(JSON.stringify(config), { type: 'ARCHITECTURE', tags: `project-type-config,${config.type_id},auto-discovered` });
        await this.cache.markDiscovered(workspacePath);
      } catch { /* log */ }
    });
  }
}
```

### 2.6 Pipeline Integration

```typescript
export async function indexWorkspace(workspacePath: string): Promise<void> {
  const detection = await detector.detect(workspacePath);
  if (detection.project_type === 'fallback') {
    discovery.discoverAsync(workspacePath, await listRootFiles(workspacePath, 50));
  }
  const config = detection.project_type === 'fallback' ? resolver.getFallback() : resolver.resolve(detection);
  for await (const file of scanWorkspaceAsync(config)) {
    await indexFile(file, categorizeFile(file, config));
  }
}
```

---

## 3. Database Schema

```sql
CREATE TABLE IF NOT EXISTS project_type_cache (
  workspace_path TEXT PRIMARY KEY,
  project_type TEXT NOT NULL,
  build_tool TEXT,
  source_roots TEXT NOT NULL,
  test_roots TEXT,
  exclude_patterns TEXT NOT NULL,
  extensions TEXT NOT NULL,
  detection_confidence REAL NOT NULL,
  build_file_hash TEXT,
  is_mono_repo INTEGER DEFAULT 0,
  sub_projects TEXT,
  last_discovery_at TEXT,
  detected_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

## 4. Security Design

| Concern | Mitigation |
|---------|------------|
| LLM prompt injection | Sanitize filenames before prompt |
| Malicious KB entries | Zod validation on read |
| Path traversal | Resolve relative to workspace root |
| DoS | 50 entry limit, in-memory cache |
| Rate limit bypass | Server-side DB check |

---

## 5. Error Handling

| Scenario | Handling |
|----------|----------|
| KB unreachable | Built-in defaults |
| Invalid KB JSON | Skip (safeParse) |
| Detection timeout | Fallback |
| LLM timeout | Skip discovery |
| DB write fail | Continue uncached |

---

## 6. Implementation Checklist

| # | Task | File | Hours |
|---|------|------|-------|
| 1 | Models + Zod | `project-type/models.ts` | 1 |
| 2 | Detector | `project-type/detector.ts` | 3 |
| 3 | Resolver | `project-type/resolver.ts` | 1 |
| 4 | Cache | `project-type/cache.ts` | 2 |
| 5 | Discovery | `project-type/discovery.ts` | 2 |
| 6 | Seed data | `data/project-type-seeds.json` | 2 |
| 7 | Scanner mod | `async-file-scanner.ts` | 2 |
| 8 | Pipeline | `index-workspace.ts` | 2 |
| 9 | Startup seed | `index.ts` | 0.5 |
| 10 | Unit tests | `__tests__/` | 3 |
| 11 | Integration | `__tests__/` | 2 |
| **Total** | | | **20.5h** |

---

## 7. Diagram Index

| # | Diagram | Image | Source |
|---|---------|-------|--------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
