/**
 * SA4E-108 — Extension-side Project Type Detection (Hybrid).
 * Detects locally (fast), fetches KB configs from backend on cache miss.
 */
import * as vscode from 'vscode';

export interface Signal { file: string; confidence: number; }

export interface ProjectTypeConfig {
  type_id: string;
  display_name: string;
  signals: Signal[];
  source_roots: string[];
  test_roots?: string[];
  exclude_patterns: string[];
  extensions: string[];
  mono_repo_signals?: string[];
  priority?: number;
  auto_discovered?: boolean;
}

export interface DetectionResult {
  project_type: string;
  confidence: number;
  detected_files: string[];
  source_roots: string[];
  test_roots: string[];
  exclude_patterns: string[];
  extensions: string[];
}

const CONFIDENCE_THRESHOLD = 0.5;
const FALLBACK_TYPE = 'fallback';

/** Detects workspace project type via local filesystem scan. */
export class ProjectTypeDetector {
  private configCache: ProjectTypeConfig[] | null = null;

  constructor(
    private readonly backendUrl: string,
    private readonly channel?: vscode.OutputChannel,
  ) {}

  /** Detect project type — fast local scan, no network if cached */
  async detect(workspaceRoot: string): Promise<DetectionResult> {
    const configs = await this.getConfigs();
    if (configs.length === 0) return this.fallback();
    const rootFiles = await this.listRootFiles(workspaceRoot);
    const matches = this.scoreAll(configs, rootFiles);
    if (matches.length === 0) return this.fallback();
    const best = matches[0];
    this.log(`Detected: ${best.config.display_name} (${best.score.toFixed(2)})`);
    return {
      project_type: best.config.type_id,
      confidence: best.score,
      detected_files: best.matchedFiles,
      source_roots: best.config.source_roots,
      test_roots: best.config.test_roots ?? [],
      exclude_patterns: best.config.exclude_patterns,
      extensions: best.config.extensions,
    };
  }

  /** VS Code glob for file inclusion based on detected type */
  getFileGlob(det: DetectionResult): string {
    if (det.project_type === FALLBACK_TYPE) return '**/*.{ts,js,kt,java,py,go,rs,tsx,jsx}';
    const exts = det.extensions.map(e => e.replace('.', '')).join(',');
    return `**/*.{${exts}}`;
  }

  /** VS Code glob for exclusion based on detected type */
  getExcludeGlob(det: DetectionResult): string {
    if (det.project_type === FALLBACK_TYPE) return '{node_modules,**/node_modules,dist,.git,build,out,vendor}/**';
    const pats = det.exclude_patterns.map(p => p.replace(/\/$/, '')).flatMap(p => [p, `**/${p}`]).join(',');
    return `{${pats},.git,**/.git}/**`;
  }

  async refreshConfigs(): Promise<void> { this.configCache = null; }

  private async getConfigs(): Promise<ProjectTypeConfig[]> {
    if (this.configCache) return this.configCache;
    try { this.configCache = await this.fetchFromBackend(); }
    catch { this.configCache = []; }
    return this.configCache;
  }

  private async fetchFromBackend(): Promise<ProjectTypeConfig[]> {
    const url = `${this.backendUrl}/api/v1/project-types`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json() as { configs: string[] };
    return data.configs.map(j => { try { return JSON.parse(j); } catch { return null; } }).filter(Boolean);
  }

  private async listRootFiles(root: string): Promise<string[]> {
    try {
      const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(root));
      return entries.map(([name]) => name);
    } catch { return []; }
  }

  private scoreAll(configs: ProjectTypeConfig[], files: string[]) {
    return configs
      .map(c => ({ config: c, ...this.matchSignals(c.signals, files) }))
      .filter(m => m.score >= CONFIDENCE_THRESHOLD)
      .sort((a, b) => b.score - a.score);
  }

  private matchSignals(signals: Signal[], files: string[]) {
    let max = 0; const matched: string[] = [];
    for (const s of signals) {
      const found = files.filter(f => this.fileMatches(f, s.file));
      if (found.length > 0) { max = Math.max(max, s.confidence); matched.push(...found); }
    }
    return { score: max, matchedFiles: [...new Set(matched)] };
  }

  private fileMatches(name: string, pattern: string): boolean {
    if (pattern.includes('*')) {
      return new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$').test(name);
    }
    return name === pattern;
  }

  private fallback(): DetectionResult {
    return { project_type: FALLBACK_TYPE, confidence: 0, detected_files: [], source_roots: [], test_roots: [], exclude_patterns: [], extensions: [] };
  }

  private log(msg: string) { this.channel?.appendLine(`[ProjectType] ${msg}`); }
}
