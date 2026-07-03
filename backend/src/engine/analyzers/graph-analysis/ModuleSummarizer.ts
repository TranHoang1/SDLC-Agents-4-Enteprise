/**
 * KSA-163: Module Summarizer — Aggregates quality metrics per module.
 */

import Database from 'better-sqlite3';
import type { ModuleSummary } from './types.js';
import { GraphLoader } from './utils/GraphLoader.js';
import { CircularDepDetector } from './CircularDepDetector.js';
import { HotPathAnalyzer } from './HotPathAnalyzer.js';
import { DeadImportDetector } from './DeadImportDetector.js';

export class ModuleSummarizer {
  private db: Database.Database;
  private graphLoader: GraphLoader;

  constructor(db: Database.Database) {
    this.db = db;
    this.graphLoader = new GraphLoader(db);
  }

  /** Generate summary for a specific module or all modules. */
  summarize(moduleName?: string): ModuleSummary[] {
    const modules = this.getModules(moduleName);
    const results: ModuleSummary[] = [];

    for (const mod of modules) {
      const circularDetector = new CircularDepDetector(this.graphLoader);
      const hotPathAnalyzer = new HotPathAnalyzer(this.graphLoader);
      const deadImportDetector = new DeadImportDetector(this.db);

      const circularDeps = circularDetector.detect({ module: mod.name });
      const hotPaths = hotPathAnalyzer.analyze({ module: mod.name, limit: 5 });
      const deadImports = deadImportDetector.detect({ module: mod.name });
      const avgComplexity = this.getAvgComplexity(mod.name);

      results.push({
        module: mod.name,
        fileCount: mod.fileCount,
        symbolCount: mod.symbolCount,
        circularDeps: circularDeps.length,
        hotPaths,
        deadImports: deadImports.length,
        avgComplexity,
      });
    }

    return results;
  }

  private getModules(name?: string): Array<{ name: string; fileCount: number; symbolCount: number }> {
    let sql = 'SELECT name, file_count as fileCount, symbol_count as symbolCount FROM modules';
    const params: unknown[] = [];
    if (name) {
      sql += ' WHERE name = ?';
      params.push(name);
    }
    return this.db.prepare(sql).all(...params) as Array<{
      name: string; fileCount: number; symbolCount: number;
    }>;
  }

  private getAvgComplexity(module: string): number | null {
    const row = this.db.prepare(`
      SELECT AVG(c.cyclomatic_complexity) as avg
      FROM complexity c
      JOIN symbols s ON s.id = c.symbol_id
      JOIN files f ON f.id = s.file_id
      WHERE f.module = ?
    `).get(module) as { avg: number | null } | undefined;
    return row?.avg ?? null;
  }
}
