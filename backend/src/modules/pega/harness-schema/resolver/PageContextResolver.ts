/**
 * SA4E-95 - PageContextResolver resolves pyUsingPage values to target class and schema path.
 * Implements BR-03, BR-04, BR-05, BR-06: empty=primary, D_=DataPage, .=relative, named=lookup.
 */
import type { PageContext } from '../models/ParsedHarness.js';
import type { ResolvedContext } from '../models/ResolvedContext.js';

/** Interface for page context resolution */
export interface IPageContextResolver {
  resolve(
    pyUsingPage: string,
    contextPages: PageContext[],
    primaryClass: string
  ): ResolvedContext;
}

/**
 * Resolves pyUsingPage values to determine target class and schema nesting path.
 * Strategy selection based on pyUsingPage prefix pattern.
 */
export class PageContextResolver implements IPageContextResolver {
  /**
   * Resolve a pyUsingPage value to its target class and schema path.
   * @param pyUsingPage - Raw pyUsingPage value from section body
   * @param contextPages - Available page contexts from pyPagesAndClasses
   * @param primaryClass - Harness primary class (fallback)
   */
  resolve(
    pyUsingPage: string,
    contextPages: PageContext[],
    primaryClass: string
  ): ResolvedContext {
    // BR-03: Empty means primary page context
    if (!pyUsingPage || pyUsingPage.trim() === '') {
      return { className: primaryClass, objectPath: '', source: 'primary' };
    }

    // BR-04: D_ prefix indicates Data Page reference
    if (pyUsingPage.startsWith('D_')) {
      return this.resolveDataPage(pyUsingPage, contextPages, primaryClass);
    }

    // BR-06: Indexed reference like .pyList(1)
    if (this.isIndexedReference(pyUsingPage)) {
      return this.resolveIndexedReference(pyUsingPage, contextPages, primaryClass);
    }

    // BR-05: Dot prefix indicates relative property reference
    if (pyUsingPage.startsWith('.')) {
      return this.resolveRelativeReference(pyUsingPage, contextPages, primaryClass);
    }

    // Named page: lookup in pyPagesAndClasses
    return this.resolveNamedPage(pyUsingPage, contextPages, primaryClass);
  }

  /** Resolve D_ prefixed Data Page references */
  private resolveDataPage(
    page: string,
    contextPages: PageContext[],
    primaryClass: string
  ): ResolvedContext {
    const found = contextPages.find((cp) => cp.page === page);
    return {
      className: found?.className ?? primaryClass,
      objectPath: page,
      source: 'dataPage',
    };
  }

  /** Resolve dot-prefixed relative property references */
  private resolveRelativeReference(
    page: string,
    contextPages: PageContext[],
    primaryClass: string
  ): ResolvedContext {
    const propName = page.substring(1);
    const found = contextPages.find((cp) => cp.page === page);
    return {
      className: found?.className ?? primaryClass,
      objectPath: propName,
      source: 'relative',
    };
  }

  /** Resolve named page references via pyPagesAndClasses lookup */
  private resolveNamedPage(
    page: string,
    contextPages: PageContext[],
    primaryClass: string
  ): ResolvedContext {
    const found = contextPages.find((cp) => cp.page === page);
    return {
      className: found?.className ?? primaryClass,
      objectPath: page,
      source: 'named',
    };
  }

  /** Resolve indexed list references like .pyList(1) (BR-06) */
  private resolveIndexedReference(
    page: string,
    contextPages: PageContext[],
    primaryClass: string
  ): ResolvedContext {
    // Strip index suffix: .pyList(1) -> .pyList
    const basePath = page.replace(/\(\d+\)$/, '');
    const propName = basePath.startsWith('.') ? basePath.substring(1) : basePath;
    const found = contextPages.find((cp) => cp.page === basePath || cp.page === page);
    return {
      className: found?.className ?? primaryClass,
      objectPath: propName,
      source: 'indexed',
    };
  }

  /** Check if reference contains array index like .prop(N) */
  private isIndexedReference(page: string): boolean {
    return /\.\w+\(\d+\)$/.test(page);
  }
}
