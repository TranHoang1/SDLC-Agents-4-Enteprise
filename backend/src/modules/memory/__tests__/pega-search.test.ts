/**
 * SA4E-171 — Unit tests for pega-search module (dual-read).
 * Covers: sanitizeFtsQuery, searchPegaSymbols, mergeDedupResults.
 * Validates Security Findings #1 (strip special chars), #2 (200-char limit).
 */

import { describe, it, expect, vi } from 'vitest';
import { searchPegaSymbols, mergeDedupResults } from '../engine/pega-search.js';
import type { SearchResult } from '../models.js';

describe('pega-search', () => {
  describe('mergeDedupResults', () => {
    it('should prefer symbols over legacy when FQN matches', () => {
      const legacy: SearchResult[] = [
        { entry: { source: 'Rule-Obj-Activity:Work:Approve' } as any, score: 5, matchType: 'knowledge_fts' },
      ];
      const symbols: SearchResult[] = [
        { entry: { source: 'Rule-Obj-Activity:Work:Approve' } as any, score: 3, matchType: 'symbols_fts' },
      ];
      const result = mergeDedupResults(legacy, symbols, 10);
      // Only one result (deduped), from symbols
      expect(result).toHaveLength(1);
      expect(result[0].matchType).toBe('symbols_fts');
    });

    it('should include both when FQN does not match', () => {
      const legacy: SearchResult[] = [
        { entry: { source: 'legacy:Work:RuleA' } as any, score: 5, matchType: 'knowledge_fts' },
      ];
      const symbols: SearchResult[] = [
        { entry: { source: 'Rule-Obj-Activity:Work:RuleB' } as any, score: 3, matchType: 'symbols_fts' },
      ];
      const result = mergeDedupResults(legacy, symbols, 10);
      expect(result).toHaveLength(2);
    });

    it('should respect limit parameter', () => {
      const legacy: SearchResult[] = Array.from({ length: 5 }, (_, i) => ({
        entry: { source: `legacy${i}` } as any, score: i, matchType: 'knowledge_fts',
      }));
      const symbols: SearchResult[] = Array.from({ length: 5 }, (_, i) => ({
        entry: { source: `symbol${i}` } as any, score: i + 10, matchType: 'symbols_fts',
      }));
      const result = mergeDedupResults(legacy, symbols, 7);
      expect(result).toHaveLength(7);
    });

    it('should sort by score descending', () => {
      const legacy: SearchResult[] = [
        { entry: { source: 'a' } as any, score: 10, matchType: 'knowledge_fts' },
      ];
      const symbols: SearchResult[] = [
        { entry: { source: 'b' } as any, score: 20, matchType: 'symbols_fts' },
      ];
      const result = mergeDedupResults(legacy, symbols, 10);
      expect(result[0].score).toBeGreaterThan(result[1].score!);
    });

    it('should handle empty arrays', () => {
      expect(mergeDedupResults([], [], 10)).toHaveLength(0);
      const legacy: SearchResult[] = [
        { entry: { source: 'a' } as any, score: 1, matchType: 'knowledge_fts' },
      ];
      expect(mergeDedupResults(legacy, [], 10)).toHaveLength(1);
      expect(mergeDedupResults([], legacy, 10)).toHaveLength(1);
    });
  });

  describe('searchPegaSymbols', () => {
    it('should return empty array when no projectId', async () => {
      const mockAdapter = {} as any;
      const result = await searchPegaSymbols(mockAdapter, 'test', 10, undefined);
      expect(result).toHaveLength(0);
    });

    it('should return empty array when projectId is empty', async () => {
      const mockAdapter = {} as any;
      const result = await searchPegaSymbols(mockAdapter, 'test', 10, { projectId: '' } as any);
      expect(result).toHaveLength(0);
    });

    it('should return empty for unsupported engine', async () => {
      const mockAdapter = {
        getEngine: () => 'mysql',
      } as any;
      const result = await searchPegaSymbols(mockAdapter, 'test', 10, { projectId: 'proj1' } as any);
      expect(result).toHaveLength(0);
    });

    it('should call sqlite FTS when engine is sqlite', async () => {
      const mockRows = [
        { id: 1, name: 'TestRule', kind: 'pega_activity', signature: 'fqn1', doc_comment: 'doc', summary: 'sum', enrichment_status: null, score: -1.5 },
      ];
      const mockAdapter = {
        getEngine: () => 'sqlite',
        allAsync: vi.fn().mockResolvedValue(mockRows),
      } as any;
      const result = await searchPegaSymbols(mockAdapter, 'TestRule', 10, { projectId: 'proj1' } as any);
      expect(result).toHaveLength(1);
      expect(mockAdapter.allAsync).toHaveBeenCalledOnce();
      // Verify project_id is passed (SEC-04)
      const callArgs = mockAdapter.allAsync.mock.calls[0][1];
      expect(callArgs).toContain('proj1');
    });

    it('should sanitize FTS query — strip colons and quotes (SEC Finding #1)', async () => {
      const mockAdapter = {
        getEngine: () => 'sqlite',
        allAsync: vi.fn().mockResolvedValue([]),
      } as any;
      await searchPegaSymbols(mockAdapter, 'test:inject"quote', 10, { projectId: 'p1' } as any);
      const ftsArg = mockAdapter.allAsync.mock.calls[0][1][0];
      // Should not contain : or "
      expect(ftsArg).not.toContain(':');
      expect(ftsArg).not.toContain('"');
    });

    it('should limit query to 200 chars (SEC Finding #2)', async () => {
      const longQuery = 'a'.repeat(300);
      const mockAdapter = {
        getEngine: () => 'sqlite',
        allAsync: vi.fn().mockResolvedValue([]),
      } as any;
      await searchPegaSymbols(mockAdapter, longQuery, 10, { projectId: 'p1' } as any);
      const ftsArg = mockAdapter.allAsync.mock.calls[0][1][0];
      expect(ftsArg.length).toBeLessThanOrEqual(200);
    });
  });
});