/**
 * KSA-162: Main Function Detector — Detects main() entry points.
 */

import type { EntryPoint } from '../types.js';
import { PatternRegistry } from '../PatternRegistry.js';

export class MainDetector {
  private registry: PatternRegistry;

  constructor(registry: PatternRegistry) {
    this.registry = registry;
  }

  /** Detect main entry points from source code. */
  detect(
    symbols: Array<{ id: number; name: string; filePath: string; startLine: number }>,
    source: string,
    language: string
  ): EntryPoint[] {
    const mainPattern = this.registry.getMainPattern(language);
    if (!mainPattern) return [];

    const results: EntryPoint[] = [];

    // Check for main function in symbols
    for (const sym of symbols) {
      if (sym.name === 'main' || sym.name === '__main__') {
        results.push(this.createEntryPoint(sym));
      }
    }

    // Check source for language-specific main patterns
    if (results.length === 0 && source.includes(mainPattern.pattern)) {
      const lines = source.split('\n');
      const patternLine = lines.findIndex(l => l.includes(mainPattern.pattern));
      if (patternLine >= 0) {
        const closest = symbols.reduce<typeof symbols[0] | null>((best, sym) => {
          if (!best) return sym;
          const bestDist = Math.abs(best.startLine - patternLine);
          const symDist = Math.abs(sym.startLine - patternLine);
          return symDist < bestDist ? sym : best;
        }, null);

        if (closest) {
          results.push(this.createEntryPoint(closest));
        }
      }
    }

    return results;
  }

  private createEntryPoint(sym: { id: number; name: string; filePath: string; startLine: number }): EntryPoint {
    return {
      symbol_id: sym.id, symbol_name: sym.name,
      file_path: sym.filePath, start_line: sym.startLine,
      entry_type: 'MAIN', framework: null,
      http_method: null, route_path: null, full_route: null,
      middleware: [], has_auth: false, controller: null,
      event_name: null, confidence: 'High',
    };
  }
}
