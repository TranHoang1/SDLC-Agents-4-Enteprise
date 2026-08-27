/**
 * SA4E-88 — Unit tests for PegaIndexerTool and PegaHashCache.
 * Verifies full/incremental indexing, hash detection, and graph writes.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PegaIndexerTool, type GraphWriter } from '../PegaIndexerTool.js';
import { computeHash, compareFileHash, pruneStaleEntries, type HashCacheData } from '../PegaHashCache.js';

/** Fake GraphWriter tracking all operations (Spy pattern). */
class FakeGraphWriter implements GraphWriter {
  public nodes: Array<{ id: string; label: string; type: string }> = [];
  public edges: Array<{ source: string; target: string; rel: string }> = [];
  public removedPrefixes: string[] = [];

  async addNode(entryId: string, label: string, type: string): Promise<void> {
    this.nodes.push({ id: entryId, label, type });
  }

  async addEdge(source: string, target: string, _w: number, relType: string): Promise<void> {
    this.edges.push({ source, target, rel: relType });
  }

  async removeNodesByPrefix(prefix: string): Promise<void> {
    this.removedPrefixes.push(prefix);
    this.nodes = this.nodes.filter(n => !n.id.startsWith(prefix));
    this.edges = [];
  }
}

/** Minimal Pega Activity rule fixture. */
const ACTIVITY_RULE = {
  pxObjClass: 'Rule-Obj-Activity',
  pyClassName: 'Work-Cover-Jira',
  pyRuleName: 'ResolveTicket',
  pyActivityName: 'ResolveTicket',
  steps: [{ pyMethod: 'Call', pyMethodParameters: 'ValidateData' }],
};

/** Minimal Flow rule fixture. */
const FLOW_RULE = {
  pxObjClass: 'Rule-Obj-Flow',
  pyClassName: 'Work-Cover-Jira',
  pyFlowName: 'ProcessClaim',
  pyRuleName: 'ProcessClaim',
  pyShapes: [{ pyActivityName: 'ResolveTicket' }],
};

function createFakeLogger(): any {
  return { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() };
}

/** Helper: create a temp workspace with rules/ subdirectory. */
function createTempWorkspace(): { root: string; rulesDir: string } {
  const root = mkdtempSync(join(tmpdir(), 'pega-idx-'));
  const rulesDir = join(root, 'rules');
  mkdirSync(rulesDir, { recursive: true });
  return { root, rulesDir };
}

describe('PegaHashCache', () => {
  it('computeHash returns consistent SHA-256 hex', () => {
    const hash1 = computeHash('hello world');
    const hash2 = computeHash('hello world');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('computeHash detects content changes', () => {
    const hash1 = computeHash('version-1');
    const hash2 = computeHash('version-2');
    expect(hash1).not.toBe(hash2);
  });

  it('compareFileHash marks new file as changed', () => {
    const cache: HashCacheData = { version: 1, entries: {} };
    const result = compareFileHash('rule.pega.json', '{}', cache);
    expect(result.changed).toBe(true);
  });

  it('compareFileHash marks unchanged file correctly', () => {
    const content = '{"pxObjClass":"Rule-Obj-Activity"}';
    const hash = computeHash(content);
    const cache: HashCacheData = { version: 1, entries: { 'rule.pega.json': hash } };
    const result = compareFileHash('rule.pega.json', content, cache);
    expect(result.changed).toBe(false);
  });

  it('compareFileHash marks modified file as changed', () => {
    const cache: HashCacheData = { version: 1, entries: { 'rule.pega.json': 'oldhash' } };
    const result = compareFileHash('rule.pega.json', '{"modified":true}', cache);
    expect(result.changed).toBe(true);
  });

  it('pruneStaleEntries removes entries not seen in the current run', () => {
    const cache: HashCacheData = {
      version: 1,
      entries: { 'a.json': 'h1', 'b.json': 'h2', 'gone.json': 'h3' },
    };
    const removed = pruneStaleEntries(cache, new Set(['a.json', 'b.json']));
    expect(removed).toBe(1);
    expect(Object.keys(cache.entries).sort()).toEqual(['a.json', 'b.json']);
    expect(cache.entries['gone.json']).toBeUndefined();
  });
});

describe('PegaIndexerTool — Full Mode', () => {
  let writer: FakeGraphWriter;
  let logger: any;
  let tool: PegaIndexerTool;
  let workspace: { root: string; rulesDir: string };

  beforeEach(() => {
    writer = new FakeGraphWriter();
    logger = createFakeLogger();
    tool = new PegaIndexerTool(writer, logger);
    workspace = createTempWorkspace();
  });

  afterEach(() => {
    rmSync(workspace.root, { recursive: true, force: true });
  });

  it('indexes a single activity rule — node + edges', async () => {
    writeFileSync(join(workspace.rulesDir, 'act.pega.json'), JSON.stringify(ACTIVITY_RULE));

    const result = await tool.execute(
      { mode: 'full', rules_dir: workspace.rulesDir }, workspace.root,
    );

    expect(result.status).toBe('completed');
    expect(result.mode).toBe('full');
    expect(result.stats.filesScanned).toBe(1);
    expect(result.stats.nodesCreated).toBe(1);
    expect(result.stats.edgesCreated).toBeGreaterThan(0);
    expect(writer.nodes[0].id).toContain('pega::Activity::Work-Cover-Jira::ResolveTicket');
    expect(writer.nodes[0].type).toBe('FUNCTION');
  });

  it('full mode clears existing nodes before re-index', async () => {
    writer.nodes.push({ id: 'pega::old::node', label: 'Old', type: 'FUNCTION' });
    writeFileSync(join(workspace.rulesDir, 'flow.pega.json'), JSON.stringify(FLOW_RULE));

    const result = await tool.execute(
      { mode: 'full', rules_dir: workspace.rulesDir }, workspace.root,
    );

    expect(result.status).toBe('completed');
    expect(writer.removedPrefixes).toContain('pega::');
    expect(writer.nodes.every(n => n.id !== 'pega::old::node')).toBe(true);
  });

  it('handles malformed JSON gracefully as error count', async () => {
    writeFileSync(join(workspace.rulesDir, 'bad.pega.json'), 'not valid json {{{');

    const result = await tool.execute(
      { mode: 'full', rules_dir: workspace.rulesDir }, workspace.root,
    );

    expect(result.status).toBe('completed');
    expect(result.stats.errors).toBe(1);
    expect(result.stats.nodesCreated).toBe(0);
  });

  it('persists hash cache after full index', async () => {
    writeFileSync(join(workspace.rulesDir, 'act.pega.json'), JSON.stringify(ACTIVITY_RULE));

    await tool.execute({ mode: 'full', rules_dir: workspace.rulesDir }, workspace.root);

    const cacheRaw = readFileSync(join(workspace.root, '.pega-hash-cache.json'), 'utf-8');
    const cache = JSON.parse(cacheRaw) as HashCacheData;
    expect(cache.version).toBe(1);
    expect(Object.keys(cache.entries)).toHaveLength(1);
  });

  it('discovers nested .pega.json files recursively', async () => {
    mkdirSync(join(workspace.rulesDir, 'sub', 'deep'), { recursive: true });
    writeFileSync(join(workspace.rulesDir, 'sub', 'deep', 'a.pega.json'), JSON.stringify(ACTIVITY_RULE));
    writeFileSync(join(workspace.rulesDir, 'b.pega.json'), JSON.stringify(FLOW_RULE));
    writeFileSync(join(workspace.rulesDir, 'readme.md'), '# not a rule');

    const result = await tool.execute(
      { mode: 'full', rules_dir: workspace.rulesDir }, workspace.root,
    );

    expect(result.stats.filesScanned).toBe(2);
    expect(result.stats.nodesCreated).toBe(2);
  });
});

describe('PegaIndexerTool — Incremental Mode', () => {
  let writer: FakeGraphWriter;
  let logger: any;
  let tool: PegaIndexerTool;
  let workspace: { root: string; rulesDir: string };

  beforeEach(() => {
    writer = new FakeGraphWriter();
    logger = createFakeLogger();
    tool = new PegaIndexerTool(writer, logger);
    workspace = createTempWorkspace();
  });

  afterEach(() => {
    rmSync(workspace.root, { recursive: true, force: true });
  });

  it('skips unchanged files based on hash cache', async () => {
    const content = JSON.stringify(ACTIVITY_RULE);
    const hash = computeHash(content);
    const cacheData: HashCacheData = { version: 1, entries: { 'act.pega.json': hash } };

    writeFileSync(join(workspace.rulesDir, 'act.pega.json'), content);
    writeFileSync(join(workspace.root, '.pega-hash-cache.json'), JSON.stringify(cacheData));

    const result = await tool.execute(
      { mode: 'incremental', rules_dir: workspace.rulesDir }, workspace.root,
    );

    expect(result.status).toBe('completed');
    expect(result.stats.filesScanned).toBe(1);
    expect(result.stats.filesChanged).toBe(0);
    expect(result.stats.nodesCreated).toBe(0);
  });

  it('processes new files not in cache', async () => {
    const cacheData: HashCacheData = { version: 1, entries: {} };
    writeFileSync(join(workspace.rulesDir, 'new.pega.json'), JSON.stringify(ACTIVITY_RULE));
    writeFileSync(join(workspace.root, '.pega-hash-cache.json'), JSON.stringify(cacheData));

    const result = await tool.execute(
      { mode: 'incremental', rules_dir: workspace.rulesDir }, workspace.root,
    );

    expect(result.stats.filesChanged).toBe(1);
    expect(result.stats.nodesCreated).toBe(1);
  });

  it('processes modified files with stale hash', async () => {
    const cacheData: HashCacheData = { version: 1, entries: { 'rule.pega.json': 'stale' } };
    writeFileSync(join(workspace.rulesDir, 'rule.pega.json'), JSON.stringify(FLOW_RULE));
    writeFileSync(join(workspace.root, '.pega-hash-cache.json'), JSON.stringify(cacheData));

    const result = await tool.execute(
      { mode: 'incremental', rules_dir: workspace.rulesDir }, workspace.root,
    );

    expect(result.stats.filesChanged).toBe(1);
    expect(result.stats.nodesCreated).toBe(1);
    expect(result.stats.edgesCreated).toBeGreaterThan(0);
  });

  it('defaults to incremental mode when mode is omitted', async () => {
    writeFileSync(join(workspace.rulesDir, 'r.pega.json'), JSON.stringify(ACTIVITY_RULE));

    const result = await tool.execute({ rules_dir: workspace.rulesDir }, workspace.root);
    expect(result.mode).toBe('incremental');
  });
});

describe('PegaIndexerTool — Error Handling', () => {
  it('returns error status when rules_dir does not exist', async () => {
    const writer = new FakeGraphWriter();
    const logger = createFakeLogger();
    const tool = new PegaIndexerTool(writer, logger);
    const workspace = createTempWorkspace();

    try {
      const result = await tool.execute(
        { mode: 'full', rules_dir: '/nonexistent/path/xyz' }, workspace.root,
      );
      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
      expect(logger.error).toHaveBeenCalled();
    } finally {
      rmSync(workspace.root, { recursive: true, force: true });
    }
  });
});
