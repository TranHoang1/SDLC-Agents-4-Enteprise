/**
 * SA4E-214 — SchemaLocalCache: file-based + memory cache for enriched schemas.
 * Provides fast in-memory lookups with persistent disk backing in `.pega-schemas/`.
 * R-02: Sanitizes ruleType before using in file paths (path traversal prevention).
 */

import * as fs from 'fs';
import * as path from 'path';
import type { EnrichedSchema } from '../models/EnrichedSchema';
import { EnrichedSchemaSchema } from '../models/EnrichedSchema';

/** Interface for schema caching (TDD §5.2) */
export interface ISchemaCache {
  get(ruleType: string): EnrichedSchema | null;
  set(ruleType: string, schema: EnrichedSchema): void;
  has(ruleType: string): boolean;
}

/**
 * Dual-layer cache: in-memory Map + disk `.pega-schemas/*.schema.json`.
 * Memory cache is session-scoped; disk cache persists across sessions.
 */
export class SchemaLocalCache implements ISchemaCache {
  private readonly memoryCache = new Map<string, EnrichedSchema>();
  private readonly cacheDir: string;

  constructor(workspaceRoot: string) {
    this.cacheDir = path.join(workspaceRoot, '.pega-schemas');
  }

  /** Retrieve schema — memory first, then disk fallback. */
  get(ruleType: string): EnrichedSchema | null {
    const cached = this.memoryCache.get(ruleType);
    if (cached) return cached;

    // Disk fallback
    const filePath = this.filePath(ruleType);
    if (!filePath || !fs.existsSync(filePath)) return null;

    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = EnrichedSchemaSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) return null;
      this.memoryCache.set(ruleType, parsed.data);
      return parsed.data;
    } catch {
      return null;
    }
  }

  /** Store schema in both memory and disk. */
  set(ruleType: string, schema: EnrichedSchema): void {
    this.memoryCache.set(ruleType, schema);
    const filePath = this.filePath(ruleType);
    if (!filePath) return; // R-02: invalid ruleType → skip disk write

    this.ensureCacheDir();
    fs.writeFileSync(filePath, JSON.stringify(schema, null, 2), 'utf-8');
  }

  /** Check existence — memory first, then disk. */
  has(ruleType: string): boolean {
    if (this.memoryCache.has(ruleType)) return true;
    const filePath = this.filePath(ruleType);
    return filePath !== null && fs.existsSync(filePath);
  }

  /**
   * Build safe file path for a ruleType.
   * R-02: Sanitize to prevent path traversal — only allow alphanumeric + dash.
   * @returns Absolute path or null if ruleType contains dangerous characters.
   */
  private filePath(ruleType: string): string | null {
    // R-02: Strip anything except letters, digits, and dashes
    const sanitized = ruleType.replace(/[^a-zA-Z0-9\-]/g, '_');
    if (sanitized.length === 0 || sanitized.includes('..')) return null;
    const filename = `${sanitized}.schema.json`;
    const full = path.resolve(this.cacheDir, filename);

    // Double-check resolved path stays inside cacheDir
    if (!full.startsWith(path.resolve(this.cacheDir))) return null;
    return full;
  }

  /** Create cache directory if it doesn't exist. */
  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }
}
