/**
 * SA4E-89 — Unit tests for graph fallback in mem_search.
 * Verifies: Pega pattern detection, node type inference, result conversion,
 * and end-to-end fallback execution with mocked GraphService.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isPegaQuery,
  inferNodeType,
  graphNodeToResult,
  executeGraphFallback,
} from '../dispatchers/graph-fallback.js';
import type { GraphNode } from '../../kb-graph/service/constants.js';

// --- isPegaQuery ---

describe('isPegaQuery', () => {
  it('matches Rule-Obj- prefix (case-insensitive)', () => {
    expect(isPegaQuery('Rule-Obj-Activity')).toBe(true);
    expect(isPegaQuery('rule-obj-flow')).toBe(true);
  });

  it('matches Work- prefix', () => {
    expect(isPegaQuery('Work-Claim')).toBe(true);
  });

  it('matches Data- prefix', () => {
    expect(isPegaQuery('Data-Customer')).toBe(true);
  });

  it('matches PascalCase pattern (Activity/Flow names)', () => {
    expect(isPegaQuery('ProcessClaim')).toBe(true);
    expect(isPegaQuery('ValidateAddress')).toBe(true);
  });

  it('matches pega keyword (case-insensitive)', () => {
    expect(isPegaQuery('pega rules')).toBe(true);
    expect(isPegaQuery('PEGA configuration')).toBe(true);
  });

  it('matches .pyX property pattern', () => {
    expect(isPegaQuery('.pyLabel')).toBe(true);
    expect(isPegaQuery('something.pyID')).toBe(true);
  });

  it('does NOT match generic queries', () => {
    expect(isPegaQuery('how to fix bug')).toBe(false);
    expect(isPegaQuery('npm install')).toBe(false);
    expect(isPegaQuery('typescript error')).toBe(false);
  });

  it('does NOT match lowercase-only single words', () => {
    expect(isPegaQuery('process')).toBe(false);
    expect(isPegaQuery('claim')).toBe(false);
  });
});

// --- inferNodeType ---

describe('inferNodeType', () => {
  it('returns RULE_OBJ_ACTIVITY for Activity rules', () => {
    expect(inferNodeType('Rule-Obj-Activity ValidateData')).toBe('RULE_OBJ_ACTIVITY');
  });

  it('returns RULE_OBJ_FLOW for Flow rules', () => {
    expect(inferNodeType('Rule-Obj-Flow ProcessClaim')).toBe('RULE_OBJ_FLOW');
  });

  it('returns RULE_OBJ_FLOWACTION for FlowAction rules (distinct from Flow)', () => {
    expect(inferNodeType('Rule-Obj-FlowAction SubmitForm')).toBe('RULE_OBJ_FLOWACTION');
  });

  it('returns RULE_DECLARE_DECISIONTABLE for Decision Table rules', () => {
    expect(inferNodeType('Rule-Declare-DecisionTable EligibilityCheck')).toBe('RULE_DECLARE_DECISIONTABLE');
  });

  it('returns CLASS for Work- classes', () => {
    expect(inferNodeType('Work-Claim')).toBe('CLASS');
  });

  it('returns CLASS for Data- classes', () => {
    expect(inferNodeType('Data-Customer')).toBe('CLASS');
  });

  it('returns RULE_OBJ_PROPERTY for .pyX patterns', () => {
    expect(inferNodeType('.pyLabel')).toBe('RULE_OBJ_PROPERTY');
  });

  it('returns undefined for ambiguous queries', () => {
    expect(inferNodeType('ProcessClaim')).toBeUndefined();
    expect(inferNodeType('pega configuration')).toBeUndefined();
  });
});

// --- graphNodeToResult ---

describe('graphNodeToResult', () => {
  const mockNode: GraphNode = {
    id: 'entry-123',
    label: 'ValidateAddress',
    type: 'FUNCTION',
    tier: 'SHARED',
    x: 0, y: 0, z: 0,
    level: 1,
    clusterId: null,
  };

  it('converts GraphNode to GraphFallbackResult format', () => {
    const result = graphNodeToResult(mockNode);
    expect(result.id).toBe('entry-123');
    expect(result.summary).toBe('ValidateAddress');
    expect(result.type).toBe('FUNCTION');
    expect(result.source).toBe('graph_fallback');
    expect(result.score).toBe(0.5);
    expect(result.tags).toContain('pega');
    expect(result.tags).toContain('function');
  });

  it('includes node type in content string', () => {
    const result = graphNodeToResult(mockNode);
    expect(result.content).toBe('[Graph Node] ValidateAddress (FUNCTION)');
  });

  it('produces valid ISO date string for created_at', () => {
    const result = graphNodeToResult(mockNode);
    expect(() => new Date(result.created_at)).not.toThrow();
    expect(new Date(result.created_at).toISOString()).toBe(result.created_at);
  });
});

// --- executeGraphFallback (with mocked globalThis) ---

describe('executeGraphFallback', () => {
  const mockNodes: GraphNode[] = [
    { id: 'n1', label: 'ProcessClaim', type: 'FUNCTION', tier: 'SHARED', x: 0, y: 0, z: 0, level: 1, clusterId: null },
    { id: 'n2', label: 'ValidateClaim', type: 'FUNCTION', tier: 'SHARED', x: 1, y: 1, z: 1, level: 1, clusterId: null },
  ];

  const mockEdges = [
    { source: 'n1', target: 'n3', weight: 0.8, type: 'CALLS' },
    { source: 'n2', target: 'n4', weight: 0.6, type: 'RELATED_TO' },
  ];

  const mockNeighbors: GraphNode[] = [
    { id: 'n3', label: 'ClaimHandler', type: 'CLASS', tier: 'SHARED', x: 2, y: 2, z: 2, level: 0, clusterId: null },
    { id: 'n4', label: 'ClaimValidator', type: 'CLASS', tier: 'SHARED', x: 3, y: 3, z: 3, level: 0, clusterId: null },
  ];

  beforeEach(() => {
    (globalThis as any).__sqliteGraphService = {
      searchNodes: vi.fn()
        .mockResolvedValueOnce(mockNodes)
        .mockResolvedValueOnce([...mockNodes, ...mockNeighbors]),
      getEdgesForNodeIds: vi.fn().mockResolvedValue(mockEdges),
    };
  });

  afterEach(() => {
    delete (globalThis as any).__sqliteGraphService;
  });

  it('returns empty array when graph service is unavailable', async () => {
    delete (globalThis as any).__sqliteGraphService;
    const results = await executeGraphFallback('ProcessClaim');
    expect(results).toEqual([]);
  });

  it('returns empty array when graph search finds no nodes', async () => {
    (globalThis as any).__sqliteGraphService = {
      searchNodes: vi.fn().mockResolvedValue([]),
      getEdgesForNodeIds: vi.fn().mockResolvedValue([]),
    };
    const results = await executeGraphFallback('NonExistentRule');
    expect(results).toEqual([]);
  });

  it('returns direct match results with score 0.5', async () => {
    const results = await executeGraphFallback('ProcessClaim');
    const directHits = results.filter(r => r.score === 0.5);
    expect(directHits.length).toBe(2);
    expect(directHits[0].summary).toBe('ProcessClaim');
    expect(directHits[0].source).toBe('graph_fallback');
  });

  it('includes expanded neighbor results with score 0.3', async () => {
    const results = await executeGraphFallback('ProcessClaim');
    const neighborHits = results.filter(r => r.score === 0.3);
    expect(neighborHits.length).toBeGreaterThan(0);
  });

  it('deduplicates nodes between direct hits and neighbors', async () => {
    const results = await executeGraphFallback('ProcessClaim');
    const ids = results.map(r => r.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it('gracefully handles graph service errors', async () => {
    (globalThis as any).__sqliteGraphService = {
      searchNodes: vi.fn().mockRejectedValue(new Error('DB connection lost')),
      getEdgesForNodeIds: vi.fn().mockResolvedValue([]),
    };
    const results = await executeGraphFallback('ProcessClaim');
    expect(results).toEqual([]);
  });

  it('all results have source: "graph_fallback"', async () => {
    const results = await executeGraphFallback('ProcessClaim');
    for (const r of results) {
      expect(r.source).toBe('graph_fallback');
    }
  });
});
