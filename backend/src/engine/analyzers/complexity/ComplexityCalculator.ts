/**
 * KSA-161: Core complexity calculation engine.
 * Delegates to language-specific counters via strategy pattern.
 */

import type { SyntaxNode } from '../../parsers/types.js';
import type { ComplexityBreakdown } from './types.js';
import { BaseNodeCounter } from './counters/BaseNodeCounter.js';
import { TypeScriptCounter } from './counters/TypeScriptCounter.js';
import { PythonCounter } from './counters/PythonCounter.js';
import { JavaCounter } from './counters/JavaCounter.js';
import { KotlinCounter } from './counters/KotlinCounter.js';
import { GoCounter } from './counters/GoCounter.js';

export class ComplexityCalculator {
  private counters: Map<string, BaseNodeCounter> = new Map();

  constructor() {
    // Register built-in counters
    this.registerCounter(new TypeScriptCounter());
    this.registerCounter(new PythonCounter());
    this.registerCounter(new JavaCounter());
    this.registerCounter(new KotlinCounter());
    this.registerCounter(new GoCounter());
    // JS uses same rules as TS
    this.counters.set('javascript', new TypeScriptCounter());
  }

  /** Register a language-specific counter. */
  registerCounter(counter: BaseNodeCounter): void {
    this.counters.set(counter.language, counter);
  }

  /** Calculate cyclomatic complexity for a function body AST node. */
  calculate(bodyNode: SyntaxNode, language: string): ComplexityBreakdown | null {
    const counter = this.counters.get(language);
    if (!counter) return null;

    const counts = counter.countDecisionPoints(bodyNode);
    const nestingDepth = counter.calculateNestingDepth(bodyNode);
    const earlyReturns = counter.countEarlyReturns(bodyNode);

    const cc = 1 + counts.branches + counts.loops + counts.logical_ops + counts.exception_handlers;

    return {
      cyclomatic_complexity: cc,
      branches: counts.branches,
      loops: counts.loops,
      logical_ops: counts.logical_ops,
      exception_handlers: counts.exception_handlers,
      nesting_depth: nestingDepth,
      early_returns: earlyReturns,
    };
  }

  /** Check if a language is supported. */
  supportsLanguage(language: string): boolean {
    return this.counters.has(language);
  }

  /** Get list of supported languages. */
  getSupportedLanguages(): string[] {
    return [...this.counters.keys()];
  }
}
