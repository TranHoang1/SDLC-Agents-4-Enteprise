/**
 * SA4E-95 - ClassHierarchyResolver: OOP most-specific-class resolution for sections.
 * Implements BR-07, BR-08: walk up class hierarchy, first match wins.
 */
import type { HarnessFetcher } from '../fetcher/HarnessFetcher.js';

/** Resolved section with its source class */
export interface ResolvedSection {
  sectionJson: Record<string, unknown>;
  resolvedClass: string;
}

/** Interface for class hierarchy resolution */
export interface IClassHierarchyResolver {
  resolveSection(
    sectionName: string,
    targetClass: string
  ): Promise<ResolvedSection | null>;
  getClassHierarchy(className: string): string[];
}

/**
 * Resolves sections by walking up the Pega class hierarchy.
 * Most-specific class wins: e.g., Rule-Obj-Activity overrides @baseclass.
 * Uses Pega naming convention to derive hierarchy without API call.
 */
export class ClassHierarchyResolver implements IClassHierarchyResolver {
  private readonly hierarchyCache = new Map<string, string[]>();

  constructor(private readonly fetcher: HarnessFetcher) {}

  /**
   * Find a section by walking up the class hierarchy.
   * @param sectionName - Section name to find
   * @param targetClass - Starting class (most specific)
   * @returns Resolved section JSON + class, or null if not found
   */
  async resolveSection(
    sectionName: string,
    targetClass: string
  ): Promise<ResolvedSection | null> {
    const hierarchy = this.getClassHierarchy(targetClass);

    for (const cls of hierarchy) {
      const section = await this.fetcher.fetchSection(sectionName, cls);
      if (section) {
        return { sectionJson: section, resolvedClass: cls };
      }
    }
    return null;
  }

  /**
   * Derive class hierarchy from Pega naming convention.
   * Rule-Obj-Activity -> Rule-Obj- -> Rule- -> @baseclass
   * @param className - Starting class name
   * @returns Array from most-specific to least-specific
   */
  getClassHierarchy(className: string): string[] {
    if (this.hierarchyCache.has(className)) {
      return this.hierarchyCache.get(className)!;
    }

    const hierarchy = this.buildHierarchy(className);
    this.hierarchyCache.set(className, hierarchy);
    return hierarchy;
  }

  /** Build hierarchy array using Pega dash-separated naming convention */
  private buildHierarchy(className: string): string[] {
    const result: string[] = [className];

    // Walk up by removing last segment (after last dash)
    let current = className;
    while (current.includes('-')) {
      const lastDash = current.lastIndexOf('-');
      current = current.substring(0, lastDash + 1);
      if (current !== className) {
        result.push(current);
      }
      // Remove trailing dash for next iteration
      current = current.substring(0, lastDash);
    }

    // Always end with @baseclass as ultimate fallback
    if (!result.includes('@baseclass')) {
      result.push('@baseclass');
    }
    return result;
  }
}
