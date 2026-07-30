/**
 * SA4E-50 — Shared database constants (single source of truth).
 * Centralizes values previously duplicated across route files.
 * Implements: BR-02, UC-04
 */

/** Symbol kinds used in symbols table queries (lowercase). */
export const SYMBOL_KINDS = [
  'function', 'class', 'interface', 'method',
  'type', 'enum', 'constructor',
] as const;

/** Pre-computed SQL IN clause string for SYMBOL_KINDS. */
export const SYMBOL_KINDS_SQL = SYMBOL_KINDS.map(k => `'${k}'`).join(',');

/** Type alias for symbol kind values. */
export type SymbolKind = typeof SYMBOL_KINDS[number];
