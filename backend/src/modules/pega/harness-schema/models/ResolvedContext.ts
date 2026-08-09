/**
 * SA4E-95 — ResolvedContext is the result of page context resolution.
 * Determines where in the schema hierarchy a field belongs.
 */

/** How the context was resolved */
export type ContextSource = 'primary' | 'named' | 'dataPage' | 'relative' | 'indexed';

/** Result of resolving pyUsingPage to a target class and path */
export interface ResolvedContext {
  /** Resolved target class name */
  className: string;
  /** Path in schema (empty for root, dotted for nested) */
  objectPath: string;
  /** Resolution strategy used (BR-03 to BR-06) */
  source: ContextSource;
}
