/**
 * SA4E-87 — Tests for populate-graph-edges script.
 * Verifies edge extraction from Pega rule JSON and batch insertion.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { populateGraphEdges, type GraphEdgeWriter } from '../populate-graph-edges.js';
import {
  FlowEdgeExtractor,
  ActivityEdgeExtractor,
  ClassEdgeExtractor,
  BelongsToExtractor,
  DataTransformEdgeExtractor,
  DecisionTableEdgeExtractor,
} from '../edge-extractors.js';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Edge Extractors', () => {
  describe('FlowEdgeExtractor', () => {
    const extractor = new FlowEdgeExtractor();

    it('supports Rule-Obj-Flow', () => {
      expect(extractor.supports('Rule-Obj-Flow')).toBe(true);
      expect(extractor.supports('Rule-Obj-Activity')).toBe(false);
    });

    it('extracts CALLS edges from flow shapes', () => {
      const flow = {
        pxObjClass: 'Rule-Obj-Flow',
        pyClassName: 'Work-Claim',
        pyFlowName: 'ProcessClaim',
        pyShapes: [
          { pyActivityName: 'ValidateData' },
          { pyFlowActionName: 'SubmitAction' },
          { pySomeOtherField: 'ignored' },
        ],
      };
      const edges = extractor.extract(flow);
      expect(edges).toHaveLength(2);
      expect(edges[0].label).toBe('CALLS');
      expect(edges[0].sourceId).toContain('Flow');
      expect(edges[0].targetId).toContain('ValidateData');
    });

    it('returns empty for flow without shapes', () => {
      const flow = { pxObjClass: 'Rule-Obj-Flow', pyFlowName: 'Empty' };
      expect(extractor.extract(flow)).toHaveLength(0);
    });
  });

  describe('ActivityEdgeExtractor', () => {
    const extractor = new ActivityEdgeExtractor();

    it('extracts CALLS from Call steps', () => {
      const activity = {
        pxObjClass: 'Rule-Obj-Activity',
        pyClassName: 'Work-Cover',
        pyActivityName: 'MainProcess',
        steps: [
          { pyMethod: 'Call', pyMethodParameters: 'Work-Cover.SubProcess' },
          { pyMethod: 'Branch', pyMethodParameters: 'HandleError' },
        ],
      };
      const edges = extractor.extract(activity);
      const calls = edges.filter(e => e.label === 'CALLS');
      expect(calls).toHaveLength(2);
      expect(calls[0].targetId).toContain('SubProcess');
      expect(calls[1].targetId).toContain('HandleError');
    });

    it('extracts USES from Property-Set steps', () => {
      const activity = {
        pxObjClass: 'Rule-Obj-Activity',
        pyClassName: 'Work-Cover',
        pyActivityName: 'SetStatus',
        steps: [
          { pyMethod: 'Property-Set', pyMethodParameters: '.pyStatusWork' },
        ],
      };
      const edges = extractor.extract(activity);
      const uses = edges.filter(e => e.label === 'USES');
      expect(uses).toHaveLength(1);
      expect(uses[0].targetId).toContain('pyStatusWork');
    });
  });

  describe('ClassEdgeExtractor', () => {
    const extractor = new ClassEdgeExtractor();

    it('extracts INHERITS from pySuperClass', () => {
      const cls = {
        pxObjClass: 'Rule-Obj-Class',
        pyClassName: 'Work-Claim-Auto',
        pySuperClass: 'Work-Claim',
      };
      const edges = extractor.extract(cls);
      expect(edges).toHaveLength(1);
      expect(edges[0].label).toBe('INHERITS');
      expect(edges[0].targetId).toContain('Work-Claim');
    });

    it('ignores @baseclass parent', () => {
      const cls = {
        pxObjClass: 'Rule-Obj-Class',
        pyClassName: 'Work-Root',
        pySuperClass: '@baseclass',
      };
      expect(extractor.extract(cls)).toHaveLength(0);
    });
  });

  describe('BelongsToExtractor', () => {
    const extractor = new BelongsToExtractor();

    it('extracts BELONGS_TO for rule with class', () => {
      const rule = {
        pxObjClass: 'Rule-Obj-Activity',
        pyClassName: 'Work-Claim',
        pyRuleName: 'ProcessData',
      };
      const edges = extractor.extract(rule);
      expect(edges).toHaveLength(1);
      expect(edges[0].label).toBe('BELONGS_TO');
      expect(edges[0].targetId).toContain('Work-Claim');
    });

    it('skips rules with @baseclass', () => {
      const rule = {
        pxObjClass: 'Rule-Obj-Activity',
        pyClassName: '@baseclass',
        pyRuleName: 'GenericActivity',
      };
      expect(extractor.extract(rule)).toHaveLength(0);
    });
  });

  describe('DataTransformEdgeExtractor', () => {
    const extractor = new DataTransformEdgeExtractor();

    it('extracts READS and WRITES from actions', () => {
      const dt = {
        pxObjClass: 'Rule-Obj-Model',
        pyClassName: 'Work-Claim',
        pyModelName: 'MapData',
        pyActions: [
          { pyTarget: '.pyDescription', pySource: '.pyInputData' },
          { pyTarget: '.pyStatus' },
        ],
      };
      const edges = extractor.extract(dt);
      const writes = edges.filter(e => e.label === 'WRITES');
      const reads = edges.filter(e => e.label === 'READS');
      expect(writes).toHaveLength(2);
      expect(reads).toHaveLength(1);
    });
  });

  describe('DecisionTableEdgeExtractor', () => {
    const extractor = new DecisionTableEdgeExtractor();

    it('extracts EVALUATES from condition columns', () => {
      const dt = {
        pxObjClass: 'Rule-Decision-Table',
        pyClassName: 'Work-Claim',
        pyRuleName: 'EligibilityCheck',
        pyConditions: [
          { pyProperty: '.pyAge' },
          { pyColumnProperty: '.pyIncome' },
        ],
      };
      const edges = extractor.extract(dt);
      expect(edges).toHaveLength(2);
      expect(edges[0].label).toBe('EVALUATES');
      expect(edges[0].targetId).toContain('pyAge');
    });
  });
});

describe('populateGraphEdges', () => {
  const testDir = join(tmpdir(), `pega-edges-test-${Date.now()}`);
  let writer: GraphEdgeWriter;
  let addEdgeCalls: Array<{ source: string; target: string; weight: number; relType: string }>;

  beforeEach(async () => {
    addEdgeCalls = [];
    writer = {
      addEdge: vi.fn(async (source, target, weight, relType) => {
        addEdgeCalls.push({ source, target, weight, relType });
      }),
    };
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('processes .pega.json files and inserts edges', async () => {
    const rule = {
      pxObjClass: 'Rule-Obj-Activity',
      pyClassName: 'Work-Claim',
      pyActivityName: 'Validate',
      steps: [{ pyMethod: 'Call', pyMethodParameters: 'CheckData' }],
    };
    await writeFile(join(testDir, 'validate.pega.json'), JSON.stringify(rule));

    const stats = await populateGraphEdges({ rulesDir: testDir }, writer);
    expect(stats.nodesProcessed).toBe(1);
    expect(stats.edgesCreated).toBeGreaterThan(0);
    expect(stats.errors).toBe(0);
  });

  it('skips malformed JSON files', async () => {
    await writeFile(join(testDir, 'bad.pega.json'), '{ invalid json!!!');

    const stats = await populateGraphEdges({ rulesDir: testDir }, writer);
    expect(stats.skipped).toBe(1);
    expect(stats.nodesProcessed).toBe(0);
  });

  it('dryRun mode does not call writer', async () => {
    const rule = {
      pxObjClass: 'Rule-Obj-Class',
      pyClassName: 'Work-Auto',
      pySuperClass: 'Work-',
    };
    await writeFile(join(testDir, 'class.pega.json'), JSON.stringify(rule));

    const stats = await populateGraphEdges({ rulesDir: testDir, dryRun: true }, writer);
    expect(stats.edgesCreated).toBeGreaterThan(0);
    expect(addEdgeCalls).toHaveLength(0);
  });

  it('is idempotent — duplicate edges handled gracefully', async () => {
    const rule = {
      pxObjClass: 'Rule-Obj-Activity',
      pyClassName: 'Work-Claim',
      pyActivityName: 'Process',
      steps: [{ pyMethod: 'Call', pyMethodParameters: 'Sub' }],
    };
    await writeFile(join(testDir, 'proc.pega.json'), JSON.stringify(rule));

    // First run
    await populateGraphEdges({ rulesDir: testDir }, writer);
    const firstCount = addEdgeCalls.length;

    // Second run — same edges, writer accepts without error
    addEdgeCalls = [];
    await populateGraphEdges({ rulesDir: testDir }, writer);
    expect(addEdgeCalls.length).toBe(firstCount);
  });

  it('handles nested directories', async () => {
    const subDir = join(testDir, 'sub');
    await mkdir(subDir, { recursive: true });
    const rule = {
      pxObjClass: 'Rule-Obj-Flow',
      pyClassName: 'Work-Case',
      pyFlowName: 'MainFlow',
      pyShapes: [{ pyActivityName: 'Start' }],
    };
    await writeFile(join(subDir, 'flow.pega.json'), JSON.stringify(rule));

    const stats = await populateGraphEdges({ rulesDir: testDir }, writer);
    expect(stats.nodesProcessed).toBe(1);
    expect(stats.edgesCreated).toBeGreaterThan(0);
  });
});
