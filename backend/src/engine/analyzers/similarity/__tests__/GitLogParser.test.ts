/**
 * KSA-168 — Unit tests for git log parsing and incremental checkpoint reads.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseLogOutput, parseGitLog, getLastIndexedHash } from '../GitLogParser.js';
import { makeFakeAdapter } from './fake-adapter.js';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

import * as cp from 'child_process';

type ExecMock = ReturnType<typeof vi.fn>;
const execMock = cp.execSync as unknown as ExecMock;

const HASH_ONE = 'a'.repeat(40);
const HASH_TWO = 'b'.repeat(40);

const FAKE_OUTPUT = [
  `${HASH_ONE}|Alice|2026-08-01T10:00:00Z|fix bug`,
  '5\t2\tsrc/a.ts',
  '0\t1\tsrc/b.ts',
  '',
  `${HASH_TWO}|Bob|2026-08-02T09:30:00Z|add feature`,
  '3\t-\tsrc/c.ts',
  '-\t-\timg.png',
  '',
].join('\n');

describe('parseLogOutput', () => {
  it('parses commits with headers and numstat lines', () => {
    const commits = parseLogOutput(FAKE_OUTPUT);
    expect(commits).toHaveLength(2);

    expect(commits[0]).toMatchObject({
      hash: HASH_ONE,
      author: 'Alice',
      date: '2026-08-01T10:00:00Z',
      message: 'fix bug',
      filesChanged: ['src/a.ts', 'src/b.ts'],
      insertions: 5,
      deletions: 3,
    });
    expect(commits[1].filesChanged).toEqual(['src/c.ts', 'img.png']);
    expect(commits[1].insertions).toBe(3);
    expect(commits[1].deletions).toBe(0);
  });

  it('handles binary stats marked with dashes', () => {
    const commits = parseLogOutput(`a${'a'.repeat(39)}|Alice|2026-01-01T00:00:00Z|msg\n-\t-\tbinary.bin\n`);
    expect(commits[0].filesChanged).toEqual(['binary.bin']);
    expect(commits[0].insertions).toBe(0);
    expect(commits[0].deletions).toBe(0);
  });

  it('returns empty for blank input', () => {
    expect(parseLogOutput('')).toEqual([]);
    expect(parseLogOutput('\n\n')).toEqual([]);
  });

  it('captures a trailing commit without a terminating blank line', () => {
    const output = `${HASH_ONE}|Alice|2026-01-01T00:00:00Z|msg\n1\t1\tsrc/x.ts`;
    expect(parseLogOutput(output)).toHaveLength(1);
  });
});

describe('parseGitLog', () => {
  afterEach(() => execMock.mockReset());

  it('uses a bounded history when no since hash is given', () => {
    execMock.mockReturnValue(FAKE_OUTPUT);
    const commits = parseGitLog(null, '/repo', 50);

    expect(commits).toHaveLength(2);
    expect(execMock).toHaveBeenCalledTimes(1);
    const cmd = execMock.mock.calls[0][0] as string;
    expect(cmd).toContain('--numstat');
    expect(cmd).toContain('-n 50');
  });

  it('uses incremental hash range when a since hash is given', () => {
    execMock.mockReturnValue(FAKE_OUTPUT);
    parseGitLog(HASH_ONE, '/repo', 50);
    const cmd = execMock.mock.calls[0][0] as string;
    expect(cmd).toContain(`${HASH_ONE}..HEAD`);
  });

  it('returns empty when git log fails', () => {
    execMock.mockImplementation(() => {
      throw new Error('fatal: not a git repository');
    });
    expect(parseGitLog(null, '/repo', 50)).toEqual([]);
  });
});

describe('getLastIndexedHash', () => {
  it('reads the persisted checkpoint for a project', async () => {
    const adapter = makeFakeAdapter();
    adapter.routeGet('FROM git_index_meta', { value: 'abc123' });
    expect(await getLastIndexedHash(adapter, 'p1')).toBe('abc123');
  });

  it('returns null when no checkpoint exists', async () => {
    const adapter = makeFakeAdapter();
    expect(await getLastIndexedHash(adapter, 'p1')).toBeNull();
  });

  it('returns null when the query fails', async () => {
    const throwingAdapter = {
      ...makeFakeAdapter(),
      getAsync: async () => { throw new Error('no such table'); },
    } as unknown as import('../../../database/adapters/DatabaseAdapter.js').DatabaseAdapter;
    expect(await getLastIndexedHash(throwingAdapter, 'p1')).toBeNull();
  });
});