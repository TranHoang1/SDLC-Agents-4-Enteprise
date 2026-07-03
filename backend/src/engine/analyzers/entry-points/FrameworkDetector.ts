/**
 * KSA-162: Framework Detector — Identifies frameworks from import statements.
 */

import type { FrameworkInfo } from './types.js';
import { PatternRegistry } from './PatternRegistry.js';

export class FrameworkDetector {
  private registry: PatternRegistry;

  constructor(registry: PatternRegistry) {
    this.registry = registry;
  }

  /** Detect framework from file source code (import analysis). */
  detect(source: string, language: string): FrameworkInfo | null {
    const frameworks = this.registry.getFrameworksForLanguage(language);
    if (frameworks.length === 0) return null;

    let bestMatch: { name: string; score: number } | null = null;

    for (const { name, patterns } of frameworks) {
      let score = 0;
      for (const importPattern of patterns.imports) {
        if (source.includes(importPattern)) {
          score++;
        }
      }
      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { name, score };
      }
    }

    if (!bestMatch) return null;

    return {
      name: bestMatch.name,
      language,
      confidence: bestMatch.score >= 2 ? 'High' : 'Medium',
    };
  }

  /** Detect framework from a list of import strings (from relationships table). */
  detectFromImports(imports: string[], language: string): FrameworkInfo | null {
    const frameworks = this.registry.getFrameworksForLanguage(language);
    if (frameworks.length === 0) return null;

    for (const { name, patterns } of frameworks) {
      for (const importPattern of patterns.imports) {
        if (imports.some(imp => imp.includes(importPattern))) {
          return { name, language, confidence: 'High' };
        }
      }
    }
    return null;
  }
}
