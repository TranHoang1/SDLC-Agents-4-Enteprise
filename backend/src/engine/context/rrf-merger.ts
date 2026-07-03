/**
 * KSA-160: RRF Merger — Reciprocal Rank Fusion for merging multi-source results.
 */

import { SourceWeights, MergedResult } from './types.js';

interface SourceResults {
  source: string;
  results: any[];
}

export class RRFMerger {
  private k = 60; // RRF constant

  /** Merge results from multiple sources using Reciprocal Rank Fusion. */
  merge(
    sources: { code: SourceResults; memory: SourceResults; graph: SourceResults },
    weights?: SourceWeights
  ): MergedResult[] {
    const w = weights || { code: 0.5, memory: 0.3, graph: 0.2 };
    const scores = new Map<string, { score: number; item: any; sources: string[] }>();

    this.addScores(scores, sources.code.results, w.code, 'code');
    this.addScores(scores, sources.memory.results, w.memory, 'memory');
    this.addScores(scores, sources.graph.results, w.graph, 'graph');

    return Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .map(entry => ({
        ...entry.item,
        relevance_score: entry.score,
        sources: entry.sources
      }));
  }

  private addScores(
    scores: Map<string, { score: number; item: any; sources: string[] }>,
    results: any[],
    weight: number,
    source: string
  ): void {
    for (let rank = 0; rank < results.length; rank++) {
      const item = results[rank];
      const key = this.getKey(item);
      const rrfScore = weight * (1 / (this.k + rank));

      if (scores.has(key)) {
        const existing = scores.get(key)!;
        existing.score += rrfScore;
        existing.sources.push(source);
      } else {
        scores.set(key, { score: rrfScore, item, sources: [source] });
      }
    }
  }

  private getKey(item: any): string {
    if (item.id) return String(item.id);
    if (item.name && item.file) return `${item.name}:${item.file}`;
    if (item.name) return item.name;
    return JSON.stringify(item).substring(0, 100);
  }
}
