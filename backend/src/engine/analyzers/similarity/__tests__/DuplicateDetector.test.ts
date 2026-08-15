/**
 * KSA-168 — Unit tests for DuplicateDetector embedding similarity and clustering.
 */

import { describe, it, expect } from 'vitest';
import { DuplicateDetector } from '../DuplicateDetector.js';
import { makeFakeAdapter } from './fake-adapter.js';

function vec(numbers: number[]): Buffer {
  return Buffer.from(new Float32Array(numbers).buffer);
}

function embedding(symbolId: number, vector: number[], filePath: string): Record<string, unknown> {
  return {
    symbol_id: symbolId, chunk_index: 0, embedding: vec(vector), token_count: vector.length,
    id: symbolId, name: `sym${symbolId}`, kind: 'function',
    start_line: 1, end_line: 10, file_path: filePath,
  };
}

describe('DuplicateDetector', () => {
  it('clusters similar symbols with statistics and suggestion', async () => {
    const adapter = makeFakeAdapter();
    adapter.routeAll('FROM body_embeddings', [
      embedding(1, [1, 0, 0], 'src/a.ts'),
      embedding(2, [0.9, 0.1, 0], 'src/a.ts'),
    ]);

    const detector = new DuplicateDetector(adapter, 0.85, 5, 'p1');
    const report = await detector.detect();

    expect(report.clusters).toHaveLength(1);
    expect(report.totalPairsScanned).toBe(1);
    expect(report.totalDuplicates).toBe(2);
    expect(report.clusters[0].members.map(m => m.symbolId).sort()).toEqual([1, 2]);
    expect(report.clusters[0].avgSimilarity).toBeCloseTo(0.9939, 3);
    expect(report.clusters[0].suggestion).toBe('Extract shared logic from 2 similar functions in src/a.ts');
  });

  it('suggests a cross-file extraction when members span files', async () => {
    const adapter = makeFakeAdapter();
    adapter.routeAll('FROM body_embeddings', [
      embedding(1, [1, 0, 0], 'src/a.ts'),
      embedding(2, [1, 0, 0], 'src/b.ts'),
    ]);

    const detector = new DuplicateDetector(adapter, 0.85, 5, 'p1');
    const report = await detector.detect();
    expect(report.clusters[0].avgSimilarity).toBe(1);
    expect(report.clusters[0].suggestion).toBe('Consider extracting a shared utility from 2 similar functions across 2 files');
  });

  it('respects the minSimilarity threshold', async () => {
    const adapter = makeFakeAdapter();
    adapter.routeAll('FROM body_embeddings', [
      embedding(1, [1, 0, 0], 'src/a.ts'),
      embedding(2, [0.9, 0.1, 0], 'src/a.ts'),
    ]);

    const detector = new DuplicateDetector(adapter, 0.999, 5, 'p1');
    const report = await detector.detect();
    expect(report.clusters).toEqual([]);
    expect(report.totalPairsScanned).toBe(1);
  });

  it('excludes orthogonal embeddings', async () => {
    const adapter = makeFakeAdapter();
    adapter.routeAll('FROM body_embeddings', [
      embedding(1, [1, 0], 'src/a.ts'),
      embedding(2, [0, 1], 'src/a.ts'),
    ]);

    const detector = new DuplicateDetector(adapter, 0.5, 5, 'p1');
    const report = await detector.detect();
    expect(report.clusters).toEqual([]);
    expect(report.totalDuplicates).toBe(0);
  });

  it('short-circuits when fewer than two embeddings exist', async () => {
    const adapter = makeFakeAdapter();
    adapter.routeAll('FROM body_embeddings', [embedding(1, [1, 0, 0], 'src/a.ts')]);

    const detector = new DuplicateDetector(adapter, 0.85, 5, 'p1');
    const report = await detector.detect();
    expect(report.clusters).toEqual([]);
    expect(report.totalPairsScanned).toBe(0);
    expect(report.scanDurationMs).toBe(0);
  });

  it('applies the filePath filter', async () => {
    const adapter = makeFakeAdapter();
    adapter.routeAll('FROM body_embeddings', [
      embedding(1, [1, 0, 0], 'src/a.ts'),
      embedding(2, [1, 0, 0], 'src/b.ts'),
    ]);

    const detector = new DuplicateDetector(adapter, 0.85, 5, 'p1');
    await detector.detect({ filePath: 'src/' });
    expect(adapter.calls.join('\n')).toContain('f.relative_path LIKE');
  });
});