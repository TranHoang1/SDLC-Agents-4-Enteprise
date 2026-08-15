/**
 * RelativeExtractor — Schema-driven dependency extraction with recursive nested array support.
 * Implements FSD Appendix C pseudocode (traversePath + resolveValue).
 * SA4E-156: Fixes nested array bug OI-04 in KbDrivenPegaParserStrategy.
 */

import type { UnresolvedDependency } from '../models.js';
import type { PegaRuleKbSchema } from '../strategies/KbDrivenPegaParserStrategy.js';

/** Tracks schema misses for observability logging */
type SchemaMissCounter = Map<string, number>;

/**
 * Schema-driven relative discovery supporting recursive nested arrays.
 * Pattern: Strategy — configurable extraction via schemaMap, no hardcoded conditionals.
 */
export class RelativeExtractor {
  private readonly schemaMissCounter: SchemaMissCounter = new Map();

  constructor(private readonly schemaMap: Map<string, PegaRuleKbSchema>) {}

  /**
   * Extract relatives from a rule JSON using its schema's dependencyPaths.
   * @param ruleJson - Full Pega rule JSON
   * @returns Deduplicated list of discovered dependencies
   */
  extract(ruleJson: Record<string, unknown>): UnresolvedDependency[] {
    const pxObjClass = (ruleJson.pxObjClass as string) || '';
    const schema = this.schemaMap.get(pxObjClass);
    if (!schema) {
      this.incrementSchemaMiss(pxObjClass);
      return [];
    }
    const paths = schema.dependencyPaths || [];
    if (paths.length === 0) return [];

    return this.collectDependencies(ruleJson, paths);
  }

  /**
   * Traverse a dependency path supporting nested arrays.
   * Path syntax: "array[].nested[].prop" — recursive at each "[]." boundary.
   * @param obj - Current object context
   * @param pathStr - Dependency path expression
   * @returns All non-empty string values found at the path
   */
  traversePath(obj: unknown, pathStr: string): string[] {
    if (obj === null || obj === undefined) return [];

    const arrayMarkerIdx = pathStr.indexOf('[].');
    if (arrayMarkerIdx !== -1) {
      return this.traverseArrayPath(obj, pathStr, arrayMarkerIdx);
    }

    // No array marker — simple property access
    const value = this.navigateToProperty(obj, pathStr);
    if (typeof value === 'string' && value.trim().length > 0) {
      return [value.trim()];
    }
    return [];
  }

  /**
   * Resolve an extracted string value to an UnresolvedDependency.
   * Handles 5 patterns: insKey, .Property, ClassName.RuleName, simple name, unresolvable.
   * Filters: skip operators, page refs, literals.
   * @param value - Raw extracted string
   * @param ruleJson - Parent rule (provides pyClassName context)
   * @returns Resolved dependency or null if unresolvable/filtered
   */
  resolveValue(value: string, ruleJson: Record<string, unknown>): UnresolvedDependency | null {
    if (!value || value.trim().length === 0) return null;
    if (this.isFilteredValue(value)) return null;

    const currentClassName = (ruleJson.pyClassName as string) || '@baseclass';
    return this.matchPattern(value, currentClassName);
  }

  /** Get schema miss report for post-indexing observability. */
  getSchemaMissReport(): Map<string, number> {
    return new Map(this.schemaMissCounter);
  }

  // ─── Private Helpers ────────────────────────────────────────────────────

  private collectDependencies(
    ruleJson: Record<string, unknown>,
    paths: string[],
  ): UnresolvedDependency[] {
    const deps: UnresolvedDependency[] = [];
    const seen = new Set<string>();

    for (const pathStr of paths) {
      const values = this.traversePath(ruleJson, pathStr);
      for (const val of values) {
        const resolved = this.resolveValue(val, ruleJson);
        if (resolved) {
          const key = `${resolved.ruleType}:${resolved.className}:${resolved.ruleName}`;
          if (!seen.has(key)) {
            seen.add(key);
            deps.push(resolved);
          }
        }
      }
    }
    return deps;
  }

  private traverseArrayPath(obj: unknown, pathStr: string, markerIdx: number): string[] {
    const arrayProp = pathStr.substring(0, markerIdx);
    const remainder = pathStr.substring(markerIdx + 3);
    const arrayObj = this.navigateToProperty(obj, arrayProp);
    if (!Array.isArray(arrayObj)) return [];

    const results: string[] = [];
    for (const item of arrayObj) {
      if (item !== null && typeof item === 'object') {
        results.push(...this.traversePath(item, remainder));
      }
    }
    return results;
  }

  /** Navigate dot-separated path (no array markers). */
  private navigateToProperty(obj: unknown, path: string): unknown {
    const segments = path.split('.');
    let current: unknown = obj;
    for (const seg of segments) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[seg];
    }
    return current;
  }

  /** Filter out values that are not rule references. */
  private isFilteredValue(value: string): boolean {
    // Operators: =, !=, <, >, <=, >=
    if (/^[=<>!]+$/.test(value)) return true;
    // Quoted literals
    if (/^".*"$/.test(value)) return true;
    // Numeric literals
    if (/^\d+$/.test(value)) return true;
    // Page references (runtime context, not rules)
    if (value.startsWith('Param.')) return true;
    if (value.startsWith('Primary.')) return true;
    if (value.startsWith('pyWorkPage.')) return true;
    return false;
  }

  /** Match value against 5 resolution patterns in priority order. */
  private matchPattern(value: string, currentClassName: string): UnresolvedDependency | null {
    // Pattern 1: insKey format (RULE-OBJ-ACTIVITY Work-Cover- CreateWorkObject)
    if (this.isInsKeyFormat(value)) {
      return this.parseInsKey(value);
    }
    // Pattern 2: ".PropertyName"
    if (value.startsWith('.')) {
      return this.parsePropertyRef(value, currentClassName);
    }
    // Pattern 3: "ClassName.RuleName" — split at LAST dot
    const lastDotIdx = value.lastIndexOf('.');
    if (lastDotIdx > 0 && lastDotIdx < value.length - 1) {
      return this.parseQualifiedRef(value, lastDotIdx);
    }
    // Pattern 4: Simple name (no dot, no space)
    if (!value.includes(' ') && !value.includes('.')) {
      return { ruleType: 'Unknown', className: currentClassName, ruleName: value };
    }
    // Pattern 5: Unresolvable — still return for BFS discovery
    return { ruleType: 'Unknown', className: '@baseclass', ruleName: value };
  }

  private isInsKeyFormat(value: string): boolean {
    return value.startsWith('RULE-') || value.startsWith('Rule-') || value.startsWith('DATA-');
  }

  private parseInsKey(value: string): UnresolvedDependency | null {
    const parts = value.split(/\s+/);
    if (parts.length >= 3) {
      return { insKey: value, ruleType: parts[0], className: parts[1], ruleName: parts[2] };
    }
    return null;
  }

  private parsePropertyRef(value: string, currentClassName: string): UnresolvedDependency | null {
    const propName = value.substring(1);
    if (propName.length === 0) return null;
    return { ruleType: 'Rule-Obj-Property', className: currentClassName, ruleName: propName };
  }

  private parseQualifiedRef(value: string, lastDotIdx: number): UnresolvedDependency | null {
    const className = value.substring(0, lastDotIdx);
    const ruleName = value.substring(lastDotIdx + 1);
    // Only resolve if className looks like a Pega class (hyphenated or PascalCase)
    if (className.includes('-') || /^[A-Z]/.test(className)) {
      return { ruleType: 'Unknown', className, ruleName };
    }
    return null;
  }

  private incrementSchemaMiss(pxObjClass: string): void {
    this.schemaMissCounter.set(
      pxObjClass,
      (this.schemaMissCounter.get(pxObjClass) || 0) + 1,
    );
  }
}
