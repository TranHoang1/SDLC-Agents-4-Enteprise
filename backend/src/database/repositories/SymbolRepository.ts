/**
 * SA4E-50 — SymbolRepository: queries index.db for code symbol counts.
 * Eliminates raw SQL from analytics.ts.
 * Implements: UC-02, BR-02
 */

import type { DatabaseAdapter } from '../adapters/DatabaseAdapter.js';
import type { ISymbolRepository } from './interfaces.js';
import type { SymbolDetail } from './types.js';
import { SYMBOL_KINDS_SQL } from '../constants.js';
import { translateError } from '../errors/index.js';

/**
 * Repository for code symbol queries against the symbols table.
 * Uses pre-computed SYMBOL_KINDS_SQL constant for the IN clause.
 */
export class SymbolRepository implements ISymbolRepository {
  constructor(private readonly adapter: DatabaseAdapter) {}

  /**
   * Count code symbols matching canonical SYMBOL_KINDS.
   * @returns Number of matching symbols in the index
   * @throws RepositoryError on database failure
   */
  getSymbolCount(): number {
    try {
      const row = this.adapter.get<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM symbols WHERE kind IN (${SYMBOL_KINDS_SQL})`,
      );
      return row?.cnt ?? 0;
    } catch (err) {
      throw translateError(err);
    }
  }

  /**
   * Get full detail of a single symbol by ID (joined with files table).
   * @param symbolId - The symbol primary key
   * @returns Symbol detail or null if not found
   * @throws RepositoryError on database failure
   */
  getSymbolDetail(symbolId: string): SymbolDetail | null {
    try {
      const row = this.adapter.get<any>(
        `SELECT s.id, s.name, s.kind, s.signature, s.start_line, s.end_line,
                s.parent_symbol, s.visibility, s.doc_comment,
                f.relative_path, f.language, f.module
         FROM symbols s JOIN files f ON s.file_id = f.id
         WHERE s.id = ?`,
        [symbolId],
      );
      if (!row) return null;
      return {
        id: row.id, name: row.name, kind: row.kind,
        signature: row.signature ?? null,
        startLine: row.start_line ?? null, endLine: row.end_line ?? null,
        parentSymbol: row.parent_symbol ?? null,
        visibility: row.visibility ?? null,
        docComment: row.doc_comment ?? null,
        relativePath: row.relative_path ?? null,
        language: row.language ?? null, module: row.module ?? null,
      };
    } catch (err) {
      throw translateError(err);
    }
  }
}
