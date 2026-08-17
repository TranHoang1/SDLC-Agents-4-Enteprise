/**
 * SA4E-108 — ProjectTypeCache.
 * Database-agnostic cache for detected project types.
 * Uses QueryDatabaseAdapter (async) — supports SQLite + PostgreSQL.
 */
import type { QueryDatabaseAdapter } from '../../../database/adapters/DatabaseAdapter.js';
import type { DetectionResult } from './models.js';

const CREATE_TABLE_SQL = `
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
)`;

/**
 * Caches detected project types via DatabaseAdapter.
 * Rate-limits LLM discovery (BR-11: 1/workspace/24h).
 */
export class ProjectTypeCache {
  private initialized = false;

  constructor(private readonly db: QueryDatabaseAdapter) {}

  private async ensureTable(): Promise<void> {
    if (this.initialized) return;
    await this.db.execAsync(CREATE_TABLE_SQL);
    this.initialized = true;
  }

  async get(workspacePath: string): Promise<DetectionResult | null> {
    await this.ensureTable();
    const row = await this.db.getAsync<CacheRow>(
      'SELECT * FROM project_type_cache WHERE workspace_path = ?',
      [workspacePath],
    );
    return row ? this.rowToResult(row) : null;
  }

  async set(workspacePath: string, result: DetectionResult): Promise<void> {
    await this.ensureTable();
    const now = new Date().toISOString();
    await this.db.runAsync(
      `INSERT OR REPLACE INTO project_type_cache
       (workspace_path, project_type, build_tool, source_roots, test_roots,
        exclude_patterns, extensions, detection_confidence, is_mono_repo,
        sub_projects, detected_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [workspacePath, result.project_type, result.build_tool,
       JSON.stringify(result.source_roots), JSON.stringify(result.test_roots),
       JSON.stringify(result.exclude_patterns), JSON.stringify(result.extensions),
       result.confidence, result.is_mono_repo ? 1 : 0,
       JSON.stringify(result.sub_projects ?? []), now, now],
    );
  }

  async invalidate(workspacePath: string): Promise<void> {
    await this.ensureTable();
    await this.db.runAsync(
      'DELETE FROM project_type_cache WHERE workspace_path = ?', [workspacePath],
    );
  }

  /** Rate limit: 1 discovery per workspace per 24h (BR-11) */
  async canDiscover(workspacePath: string): Promise<boolean> {
    await this.ensureTable();
    const row = await this.db.getAsync<{ last_discovery_at: string | null }>(
      'SELECT last_discovery_at FROM project_type_cache WHERE workspace_path = ?',
      [workspacePath],
    );
    if (!row?.last_discovery_at) return true;
    const hours = (Date.now() - new Date(row.last_discovery_at).getTime()) / 3_600_000;
    return hours >= 24;
  }

  async markDiscovered(workspacePath: string): Promise<void> {
    await this.ensureTable();
    await this.db.runAsync(
      'UPDATE project_type_cache SET last_discovery_at = ?, updated_at = ? WHERE workspace_path = ?',
      [new Date().toISOString(), new Date().toISOString(), workspacePath],
    );
  }

  private rowToResult(row: CacheRow): DetectionResult {
    return {
      project_type: row.project_type,
      build_tool: row.build_tool ?? 'unknown',
      confidence: row.detection_confidence,
      detected_files: [],
      source_roots: JSON.parse(row.source_roots),
      test_roots: JSON.parse(row.test_roots ?? '[]'),
      exclude_patterns: JSON.parse(row.exclude_patterns),
      extensions: JSON.parse(row.extensions),
      is_mono_repo: row.is_mono_repo === 1,
      sub_projects: JSON.parse(row.sub_projects ?? '[]'),
    };
  }
}

interface CacheRow {
  workspace_path: string; project_type: string; build_tool: string | null;
  source_roots: string; test_roots: string | null; exclude_patterns: string;
  extensions: string; detection_confidence: number; build_file_hash: string | null;
  is_mono_repo: number; sub_projects: string | null; last_discovery_at: string | null;
  detected_at: string; updated_at: string;
}
