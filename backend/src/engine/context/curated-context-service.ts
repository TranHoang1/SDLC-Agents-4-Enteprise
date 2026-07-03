/**
 * KSA-160: Curated Context Service — NL query → parallel search → RRF merge → budget allocation.
 */

import Database from 'better-sqlite3';
import { QueryAnalyzer } from './query-analyzer.js';
import { RRFMerger } from './rrf-merger.js';
import { BudgetAllocator, AllocatedResult } from './budget-allocator.js';
import { SymbolResolver } from '../graph/symbol-resolver.js';
import { GraphTraverser } from '../graph/traverser.js';
import { QueryLayer } from '../query/query-layer.js';
import {
  CuratedContextParams, CuratedContextResponse, ContextSection, ContextItem,
  SourceWeights, MergedResult
} from './types.js';

export class CuratedContextService {
  private analyzer: QueryAnalyzer;
  private merger: RRFMerger;
  private allocator: BudgetAllocator;
  private db: Database.Database;
  private queryLayer: QueryLayer;
  private traverser: GraphTraverser;
  private resolver: SymbolResolver;

  constructor(
    db: Database.Database,
    queryLayer: QueryLayer,
    traverser: GraphTraverser,
    resolver: SymbolResolver
  ) {
    this.analyzer = new QueryAnalyzer();
    this.merger = new RRFMerger();
    this.allocator = new BudgetAllocator();
    this.db = db;
    this.queryLayer = queryLayer;
    this.traverser = traverser;
    this.resolver = resolver;
  }

  /** Execute curated context search with NL query. */
  async getContext(params: CuratedContextParams): Promise<CuratedContextResponse> {
    const startTime = Date.now();
    const {
      query,
      max_tokens = 4000,
      include_source = true,
      include_memory = true,
      include_graph = true,
      source_weights
    } = params;

    // 1. Analyze query
    const analysis = this.analyzer.analyze(query);

    // 2. Parallel search
    const [codeResults, memoryResults] = await Promise.all([
      include_source ? this.searchCode(analysis) : Promise.resolve({ source: 'code', results: [] }),
      include_memory ? this.searchMemory(analysis) : Promise.resolve({ source: 'memory', results: [] })
    ]);

    // 3. Graph expansion (depends on code results)
    let graphResults = { source: 'graph', results: [] as any[] };
    if (include_graph && codeResults.results.length > 0) {
      graphResults = await this.expandGraph(codeResults.results.slice(0, 5));
    }

    // 4. Merge with RRF
    const merged = this.merger.merge(
      { code: codeResults, memory: memoryResults, graph: graphResults },
      source_weights
    );

    // 5. Allocate token budget
    const allocated = this.allocator.allocate(merged, max_tokens);

    // 6. Format response
    const sections = this.formatSections(allocated);
    const tokensUsed = allocated.reduce((sum, r) => sum + r.tokens, 0) + 100;

    return {
      query,
      sections,
      metadata: {
        tokens_used: tokensUsed,
        tokens_budget: max_tokens,
        sources_queried: [
          ...(include_source ? ['code'] : []),
          ...(include_memory ? ['memory'] : []),
          ...(include_graph ? ['graph'] : [])
        ],
        total_candidates: codeResults.results.length + memoryResults.results.length + graphResults.results.length,
        results_returned: allocated.length,
        execution_time_ms: Date.now() - startTime
      }
    };
  }

  private async searchCode(analysis: { ftsQuery: string; symbolCandidates: string[] }): Promise<{ source: string; results: any[] }> {
    try {
      const ftsResults = this.queryLayer.searchCode(analysis.ftsQuery, 30);

      // Also try direct symbol resolution for candidates
      const symbolResults: any[] = [];
      for (const candidate of analysis.symbolCandidates.slice(0, 5)) {
        const resolved = this.resolver.resolve(candidate);
        for (const sym of resolved.slice(0, 3)) {
          symbolResults.push({
            id: sym.id,
            name: sym.name,
            kind: sym.kind,
            file: sym.filePath,
            line: sym.line,
            signature: null
          });
        }
      }

      // Combine FTS + symbol results (mini-RRF)
      const combined = this.miniRRF(
        ftsResults.map(r => ({
          id: undefined,
          name: r.name,
          kind: r.kind,
          file: r.filePath,
          line: r.startLine,
          signature: r.signature,
          source_code: null
        })),
        symbolResults
      );

      return { source: 'code', results: combined.slice(0, 20) };
    } catch {
      return { source: 'code', results: [] };
    }
  }

  private async searchMemory(analysis: { ftsQuery: string; keywords: string[] }): Promise<{ source: string; results: any[] }> {
    try {
      // Search memory/KB using FTS on knowledge entries
      const query = analysis.keywords.slice(0, 5).join(' ');
      const rows = this.db.prepare(`
        SELECT id, content, summary, type, tags, created_at
        FROM knowledge_entries
        WHERE id IN (
          SELECT rowid FROM knowledge_fts WHERE knowledge_fts MATCH ?
        )
        ORDER BY created_at DESC
        LIMIT 10
      `).all(query) as any[];

      return {
        source: 'memory',
        results: rows.map(r => ({
          id: r.id,
          name: r.summary || r.content?.substring(0, 50) || 'entry',
          kind: r.type || 'memory',
          content: r.summary || r.content?.substring(0, 200),
          file: undefined,
          line: undefined
        }))
      };
    } catch {
      // KB tables may not exist
      return { source: 'memory', results: [] };
    }
  }

  private async expandGraph(topSymbols: any[]): Promise<{ source: string; results: any[] }> {
    const expanded: any[] = [];
    const seen = new Set<string>();

    for (const symbol of topSymbols) {
      try {
        const startNode = this.traverser.resolveNode(symbol.name);
        if (!startNode) continue;

        const results = this.traverser.traverse(startNode, {
          edgeTypes: ['calls', 'imports', 'inherits'],
          nodeTypes: [],
          direction: 'both',
          maxDepth: 1,
          maxResults: 5
        });

        for (const r of results) {
          const key = `${r.node.name}:${r.node.filePath}`;
          if (seen.has(key)) continue;
          seen.add(key);

          expanded.push({
            id: r.node.id,
            name: r.node.name,
            kind: r.node.kind,
            file: r.node.filePath,
            line: r.node.startLine,
            relationship: `${r.edgeType} ${symbol.name}`
          });
        }
      } catch {
        // Skip if symbol not in graph
      }
    }

    return { source: 'graph', results: expanded };
  }

  private miniRRF(listA: any[], listB: any[]): any[] {
    const k = 60;
    const scores = new Map<string, { score: number; item: any }>();

    for (let i = 0; i < listA.length; i++) {
      const key = listA[i].name + ':' + (listA[i].file || '');
      scores.set(key, { score: 1 / (k + i), item: listA[i] });
    }

    for (let i = 0; i < listB.length; i++) {
      const key = listB[i].name + ':' + (listB[i].file || '');
      if (scores.has(key)) {
        scores.get(key)!.score += 1 / (k + i);
      } else {
        scores.set(key, { score: 1 / (k + i), item: listB[i] });
      }
    }

    return Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .map(e => e.item);
  }

  private formatSections(allocated: AllocatedResult[]): ContextSection[] {
    const bySource = new Map<string, ContextItem[]>();

    for (const item of allocated) {
      const source = (item.sources?.[0] || 'code') as 'code' | 'memory' | 'graph';
      if (!bySource.has(source)) bySource.set(source, []);

      bySource.get(source)!.push({
        name: item.name,
        kind: item.kind,
        file: item.file,
        line: item.line,
        relevance: item.relevance_score,
        detail: item.detail,
        content: item.content,
        relationship: item.relationship
      });
    }

    const sections: ContextSection[] = [];
    const titleMap: Record<string, string> = {
      code: 'Code Symbols',
      memory: 'Knowledge Base',
      graph: 'Related (Graph)'
    };

    for (const [source, items] of bySource) {
      sections.push({
        title: titleMap[source] || source,
        source: source as 'code' | 'memory' | 'graph',
        items
      });
    }

    return sections;
  }
}
