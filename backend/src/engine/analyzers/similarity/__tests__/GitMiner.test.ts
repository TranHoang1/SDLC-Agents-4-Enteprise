/**
 * KSA-168 — Unit tests for GitMiner commit indexing, search, and tenant guards.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { GitMiner } from '../GitMiner.js';
import { makeFakeAdapter } from './fake-adapter.js';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

import * as cp from 'child_process';

type ExecMock = ReturnType<typeof vi.fn>;
const execMock = cp.execSync as unknown as ExecMock;

const H1 = 'c'.repeat(40);
const H2 = 'd'.repeat(40);

const FAKE_LOG = [
  `${H1}|Alice|2026-08-01T10:00:00Z|fix bug`,
  '5\t2\tsrc/a.ts',
  '',
  `${H2}|Bob|2026-08-02T09:30:00Z|add feature`,
  '3\t1\tsrc/b.ts',
  '',
].join('\n');

describe('GitMiner', () => {
  afterEach(() => execMock.mockReset());

  it('indexes history and returns a summary', async () => {
    const adapter = makeFakeAdapter();
    adapter.routeGet('SELECT COUNT(*) as count FROM git_commits', { count: 2 });
    adapter.routeGet('FROM git_index_meta', { value: 'meta-val' });
    execMock.mockReturnValue(FAKE_LOG);

    const miner = new GitMiner(adapter, '/repo', 50, 'p1');
    const summary = await miner.indexHistory(true);

    expect(summary).toEqual({ totalCommits: 2, indexed: 2, lastHash: 'meta-val', lastIndexedAt: 'meta-val' });
    const cmd = execMock.mock.calls[0][0] as string;
    expect(cmd).toContain('-n 50');
    expect(adapter.writes.some(w => w.sql.includes('INSERT OR IGNORE INTO git_commits'))).toBe(true);
    expect(adapter.writes.some(w => w.sql.includes('git_index_meta'))).toBe(true);
  });

  it('uses an incremental hash range when a checkpoint exists', async () => {
    const adapter = makeFakeAdapter();
    adapter.routeGet('FROM git_index_meta', { value: 'oldhash' });
    let captured = '';
    execMock.mockImplementation((cmd: string) => {
      captured = String(cmd);
      return FAKE_LOG;
    });

    const miner = new GitMiner(adapter, '/repo', 50, 'p1');
    await miner.indexHistory(false);
    expect(captured).toContain('oldhash..HEAD');
  });

  it('returns a summary with zero commits when index has nothing new', async () => {
    const adapter = makeFakeAdapter();
    adapter.routeGet('FROM git_index_meta', { value: 'oldhash' });
    execMock.mockReturnValue('');

    const miner = new GitMiner(adapter, '/repo', 50, 'p1');
    const summary = await miner.indexHistory(false);
    expect(summary.totalCommits).toBe(0);
    expect(summary.lastHash).toBe('oldhash');
  });

  it('searches commits with filters and scores results', async () => {
    const adapter = makeFakeAdapter();
    adapter.routeAll('FROM git_commits', [
      { hash: H1, author: 'Alice', date: '2026-08-01T10:00:00Z', message: 'fix bug', files_changed: '["src/a.ts"]', insertions: 5, deletions: 2 },
      { hash: H2, author: 'Bob', date: '2026-08-02T09:30:00Z', message: 'add feature', files_changed: '["src/b.ts"]', insertions: 3, deletions: 1 },
    ]);

    const miner = new GitMiner(adapter, '/repo', 50, 'p1');
    const results = await miner.search('fix', { author: 'Alice', file: 'src', since: '2026-01-01', limit: 5 });

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ hash: H1, filesChanged: ['src/a.ts'], insertions: 5, score: 1.0 });
    expect(results[1].score).toBe(0.95);

    const sql = adapter.calls.join('\n');
    expect(sql).toContain('message LIKE');
    expect(sql).toContain('author LIKE');
    expect(sql).toContain('date >=');
  });

  it('returns a zeroed summary when project id is missing', async () => {
    const miner = new GitMiner(makeFakeAdapter(), '/repo', 50);
    expect(await miner.getSummary()).toEqual({ totalCommits: 0, indexed: 0, lastHash: null, lastIndexedAt: null });
  });

  it('rejects indexing without a project id', async () => {
    const miner = new GitMiner(makeFakeAdapter(), '/repo', 50);
    await expect(miner.indexHistory(true)).rejects.toThrow('PROJECT_REQUIRED');
  });
});