/**
 * SA4E-108 — ProjectTypeDetector.
 * Loads type definitions from KB, scans workspace for build files,
 * scores confidence, and returns DetectionResult.
 */
import { readdir } from 'fs/promises';
import { join } from 'path';
import type { Logger } from 'pino';
import {
  type DetectionResult,
  FALLBACK_TYPE,
  type ProjectTypeConfig,
  ProjectTypeConfigSchema,
  type ScoredMatch,
  type Signal,
} from './models.js';
import type { ProjectTypeCache } from './cache.js';

/** Confidence threshold — below this, fallback activates (BR-01) */
const CONFIDENCE_THRESHOLD = 0.5;
/** Max directory depth for build file scanning */
const MAX_SCAN_DEPTH = 2;
/** Directories to skip during build file scan */
const SKIP_DIRS = ['.git', 'node_modules', 'target', 'build', 'dist', '__pycache__'];

/** KB search function signature */
export interface KBEntry { content: string; }
export type KBSearchFn = (query: string, opts: { type: string; limit: number }) => Promise<KBEntry[]>;

/**
 * Detects project type by matching workspace files against
 * KB-stored type definitions. Caches results for performance.
 */
export class ProjectTypeDetector {
  private configCache: ProjectTypeConfig[] | null = null;

  constructor(
    private readonly kbSearch: KBSearchFn,
    private readonly cache: ProjectTypeCache,
    private readonly logger: Logger,
    private readonly builtInDefaults: ProjectTypeConfig[] = [],
  ) {}

  /** Load type definitions from KB (cached in-memory) */
  async loadTypeDefinitions(): Promise<ProjectTypeConfig[]> {
    if (this.configCache) return this.configCache;
    try {
      const results = await this.kbSearch('project-type-config', { type: 'ARCHITECTURE', limit: 50 });
      const configs = this.parseConfigs(results);
      if (configs.length === 0) return this.loadBuiltInDefaults();
      this.configCache = configs.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
      return this.configCache;
    } catch (err) {
      this.logger.warn({ err }, 'KB unavailable, using built-in defaults');
      return this.loadBuiltInDefaults();
    }
  }

  /** Detect project type for workspace */
  async detect(workspacePath: string): Promise<DetectionResult> {
    const cached = await this.cache.get(workspacePath);
    if (cached) return cached;
    const configs = await this.loadTypeDefinitions();
    const buildFiles = await this.scanBuildFiles(workspacePath);
    const matches = this.scoreAll(configs, buildFiles);
    if (matches.length === 0) return this.buildFallback(workspacePath);
    const best = matches[0];
    const result = this.buildResult(best);
    await this.cache.set(workspacePath, result);
    return result;
  }

  /** Force re-detection bypassing cache (BR-06) */
  async redetect(workspacePath: string): Promise<DetectionResult> {
    await this.cache.invalidate(workspacePath);
    return this.detect(workspacePath);
  }

  /** Clear in-memory config cache */
  invalidateConfigCache(): void { this.configCache = null; }

  // --- Private ---

  private parseConfigs(results: KBEntry[]): ProjectTypeConfig[] {
    return results
      .map(r => { try { return ProjectTypeConfigSchema.safeParse(JSON.parse(r.content)); } catch { return { success: false as const, error: null, data: undefined }; } })
      .filter(r => r.success)
      .map(r => r.data) as ProjectTypeConfig[];
  }

  private loadBuiltInDefaults(): ProjectTypeConfig[] {
    this.configCache = this.builtInDefaults;
    return this.builtInDefaults;
  }

  private async scanBuildFiles(dir: string, depth = 0): Promise<string[]> {
    if (depth > MAX_SCAN_DEPTH) return [];
    const files: string[] = [];
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          files.push(entry.name);
        } else if (entry.isDirectory() && depth < MAX_SCAN_DEPTH && !SKIP_DIRS.includes(entry.name)) {
          const sub = await this.scanBuildFiles(join(dir, entry.name), depth + 1);
          files.push(...sub.map(f => join(entry.name, f)));
        }
      }
    } catch { /* permission error */ }
    return files;
  }

  private scoreAll(configs: ProjectTypeConfig[], files: string[]): ScoredMatch[] {
    return configs
      .map(config => ({ config, ...this.matchSignals(config.signals, files) }))
      .filter(m => m.score >= CONFIDENCE_THRESHOLD)
      .sort((a, b) => b.score - a.score);
  }

  /** Match signals against files — return highest confidence (PBT-01: always 0-1) */
  private matchSignals(signals: Signal[], files: string[]): { score: number; matchedFiles: string[] } {
    let maxScore = 0;
    const matched: string[] = [];
    for (const signal of signals) {
      const found = files.filter(f => this.fileMatches(f, signal.file));
      if (found.length > 0) {
        maxScore = Math.max(maxScore, signal.confidence);
        matched.push(...found);
      }
    }
    return { score: maxScore, matchedFiles: [...new Set(matched)] };
  }

  private fileMatches(filePath: string, pattern: string): boolean {
    const name = filePath.split(/[/\\]/).pop() ?? '';
    if (pattern.includes('*')) {
      const re = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
      return re.test(name);
    }
    return name === pattern;
  }

  private buildResult(match: ScoredMatch): DetectionResult {
    return {
      project_type: match.config.type_id,
      build_tool: match.config.type_id.split('-').pop() ?? 'unknown',
      confidence: match.score,
      detected_files: match.matchedFiles,
      source_roots: match.config.source_roots,
      test_roots: match.config.test_roots ?? [],
      exclude_patterns: match.config.exclude_patterns,
      extensions: match.config.extensions,
      is_mono_repo: false,
    };
  }

  private buildFallback(workspacePath: string): DetectionResult {
    this.logger.info({ workspacePath }, 'No project type detected, using fallback');
    return {
      project_type: FALLBACK_TYPE, build_tool: 'none', confidence: 0,
      detected_files: [], source_roots: [], test_roots: [],
      exclude_patterns: [], extensions: [], is_mono_repo: false,
    };
  }
}
