/**
 * SA4E-169 — Unit tests for the gitignore-style ignore parser.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { IgnoreParser, createIgnoreParser, DEFAULT_IGNORE_PATTERNS } from '../ignore-parser.js';

let dir: string;

describe('IgnoreParser', () => {
  let parser: IgnoreParser;

  it('loads default patterns on construction', () => {
    parser = new IgnoreParser();
    const patterns = parser.getPatterns();
    expect(patterns.length).toBeGreaterThanOrEqual(DEFAULT_IGNORE_PATTERNS.length);
    expect(parser.shouldIgnore('node_modules/lodash/index.js')).toBe(true);
    expect(parser.shouldIgnore('dist/bundle.js')).toBe(true);
    expect(parser.shouldIgnore('src/app.ts')).toBe(false);
  });

  it('ignores git directory and dot-prefixed paths from defaults', () => {
    parser = new IgnoreParser();
    expect(parser.shouldIgnore('.git/config')).toBe(true);
    expect(parser.shouldIgnore('.git/HEAD')).toBe(true);
  });

  it('respects directory patterns anywhere in the path', () => {
    parser = new IgnoreParser();
    expect(parser.shouldIgnore('a/b/node_modules/x/y.js')).toBe(true);
  });

  it('adds custom patterns via addPatterns', () => {
    parser = new IgnoreParser();
    parser.addPatterns(['*.min.js'], 'custom');
    expect(parser.shouldIgnore('vendor/lib.min.js')).toBe(true);
    expect(parser.shouldIgnore('vendor/lib.js')).toBe(false);
  });

  it('supports negation to re-include ignored files', () => {
    const ignore = new IgnoreParser();
    ignore.addPatterns(['*.log', '!keep.log', 'vendor/'], 'custom');
    expect(ignore.shouldIgnore('temp.log')).toBe(true);
    expect(ignore.shouldIgnore('keep.log')).toBe(false);
    expect(ignore.shouldIgnore('vendor/files.js')).toBe(true);
  });

  it('ignores comment lines and empty patterns', () => {
    parser = new IgnoreParser();
    parser.addPatterns(['# a comment', '', '   ', 'build/'], 'custom');
    expect(parser.getPatterns().filter(p => p.sourceFile === 'custom')).toHaveLength(1);
  });

  it('handles ** globstar patterns across nested segments', () => {
    parser = new IgnoreParser();
    parser.addPatterns(['src/**/generated.ts'], 'custom');
    expect(parser.shouldIgnore('src/a/b/generated.ts')).toBe(true);
    expect(parser.shouldIgnore('src/nested/generated.ts')).toBe(true);
    expect(parser.shouldIgnore('other/generated.ts')).toBe(false);
  });

  it('normalizes Windows-style separators', () => {
    parser = new IgnoreParser();
    parser.addPatterns(['dist/'], 'custom');
    expect(parser.shouldIgnore('dist\\bundle.js')).toBe(true);
  });

  it('parseFile tolerates missing files', () => {
    parser = new IgnoreParser();
    expect(() => parser.parseFile(path.join(os.tmpdir(), 'missing-ignore-file-' + Date.now()))).not.toThrow();
  });
});

describe('createIgnoreParser', () => {
  let ws: string;

  beforeAll(() => {
    ws = fs.mkdtempSync(path.join(os.tmpdir(), 'code-intel-ignore-'));
  });

  afterAll(() => {
    fs.rmSync(ws, { recursive: true, force: true });
  });

  it('reads patterns from .gitignore', () => {
    fs.writeFileSync(path.join(ws, '.gitignore'), '*.tmp\n');
    const parser = createIgnoreParser(ws);
    expect(parser.shouldIgnore('scratch.tmp')).toBe(true);
    expect(parser.shouldIgnore('scratch.ts')).toBe(false);
  });

  it('reads patterns from .codeintelignore', () => {
    fs.writeFileSync(path.join(ws, '.codeintelignore'), 'generated/\n');
    const parser = createIgnoreParser(ws);
    expect(parser.shouldIgnore('generated/x.ts')).toBe(true);
  });

  it('returns a parser with only defaults when no files exist', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'code-intel-ignore-empty-'));
    try {
      const parser = createIgnoreParser(empty);
      expect(parser.getPatterns().length).toBeGreaterThanOrEqual(DEFAULT_IGNORE_PATTERNS.length);
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });
});