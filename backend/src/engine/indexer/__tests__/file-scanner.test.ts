/**
 * SA4E — Unit tests for the workspace file scanner (traversal, .gitignore
 * handling, language detection, metadata sidecar).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  scanWorkspace,
  scanSingleFile,
  detectLanguage,
  loadFileMetadata,
} from '../file-scanner.js';
import type { AppConfig } from '../../config.js';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-intel-scan-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function write(rel: string, content: string): string {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf-8');
  return full;
}

function baseConfig(): AppConfig {
  return {
    port: 48721,
    host: '0.0.0.0',
    onnxModelPath: 'models/model.onnx',
    logLevel: 'info',
    viewerPort: 3202,
    watchEnabled: true,
    watchDebounceMs: 500,
    ollamaUrl: null,
    ollamaModel: 'nomic-embed-text',
    maxFileSize: 1_000_000,
    projectId: 'test-project',
    workspace: dir,
    indexTempDir: path.join(os.tmpdir(), 'CodeIntel'),
    dbPath: 'index.db',
    configPath: path.join(dir, '.code-intel', 'config.json'),
    dataDir: '.code-intel',
    sqliteDbPath: 'index.db',
    orchestrationConfigPath: 'orchestration.json',
    excludePatterns: ['node_modules', '.git'],
    includeExtensions: ['.ts', '.js', '.py', '.java', '.yml', '.gradle.kts'],
  };
}

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  return { ...baseConfig(), ...overrides };
}

describe('detectLanguage', () => {
  it('maps simple extensions to languages', () => {
    expect(detectLanguage('/a/b/app.ts')).toBe('typescript');
    expect(detectLanguage('/a/b/app.js')).toBe('javascript');
    expect(detectLanguage('/a/b/app.py')).toBe('python');
    expect(detectLanguage('/a/b/app.java')).toBe('java');
    expect(detectLanguage('/a/b/flow.cls')).toBe('apex');
  });

  it('resolves compound extensions for Salesforce metadata', () => {
    expect(detectLanguage('/a/b/Lead.object-meta.xml')).toBe('salesforce-meta');
    expect(detectLanguage('/a/b/Lead.field-meta.xml')).toBe('salesforce-meta');
    expect(detectLanguage('/a/b/flow.flow-meta.xml')).toBe('salesforce-meta');
  });

  it('maps .gradle.kts to kotlin', () => {
    expect(detectLanguage('/a/b/build.gradle.kts')).toBe('kotlin');
  });

  it('returns null for unknown extensions', () => {
    expect(detectLanguage('/a/b/readme.md')).toBeNull();
    expect(detectLanguage('/a/b/noext')).toBeNull();
  });

  it('is case-insensitive on the extension', () => {
    expect(detectLanguage('/a/b/App.TS')).toBe('typescript');
  });
});

describe('scanSingleFile', () => {
  it('returns metadata for a supported file', () => {
    const file = write('src/App.ts', 'export const x = 1;\n');
    const scanned = scanSingleFile(file, dir);
    expect(scanned).not.toBeNull();
    expect(scanned).toMatchObject({
      absolutePath: file,
      relativePath: 'src/App.ts',
      language: 'typescript',
      sizeBytes: Buffer.byteLength('export const x = 1;\n', 'utf-8'),
      lineCount: 2,
    });
    expect(scanned!.contentHash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('returns null for unsupported files', () => {
    const file = write('README.md', '# hi');
    expect(scanSingleFile(file, dir)).toBeNull();
  });

  it('returns null for missing files', () => {
    expect(scanSingleFile(path.join(dir, 'nope.ts'), dir)).toBeNull();
  });
});

describe('scanWorkspace', () => {
  it('returns scanned files with hashes and normalized relative paths', () => {
    write('a.ts', 'export const a = 1;');
    write('lib/b.js', 'export default 1;');
    write('lib/deep/c.py', 'x = 1');

    const results = scanWorkspace(config());
    expect(results).toHaveLength(3);
    const rels = results.map(r => r.relativePath).sort();
    expect(rels).toEqual(['a.ts', 'lib/b.js', 'lib/deep/c.py']);
    expect(results.every(r => r.contentHash.length === 16)).toBe(true);
  });

  it('respects .gitignore patterns', () => {
    write('.gitignore', '*.min.js\n');
    write('keep.js', 'const a = 1;');
    write('app.min.js', 'const b = 2;');

    const results = scanWorkspace(config());
    expect(results.map(r => r.relativePath)).toEqual(['keep.js']);
  });

  it('respects .codeintelignore overrides', () => {
    write('.codeintelignore', 'generated/\n');
    write('src/main.ts', 'export {};');
    write('generated/g.ts', 'export {};');

    const results = scanWorkspace(config());
    expect(results.map(r => r.relativePath)).toEqual(['src/main.ts']);
  });

  it('respects excludePatterns from config', () => {
    const cfg = config({ excludePatterns: ['vendor'] });
    write('vendor/v.ts', 'export {};');
    write('main.ts', 'export {};');

    const results = scanWorkspace(cfg);
    expect(results.map(r => r.relativePath)).toEqual(['main.ts']);
  });

  it('skips dotfiles and dot-directories', () => {
    write('.hidden.ts', 'export {};');
    write('.cache/x.ts', 'export {};');
    write('visible.ts', 'export {};');

    const results = scanWorkspace(config());
    expect(results.map(r => r.relativePath)).toEqual(['visible.ts']);
  });

  it('filters by includeExtensions', () => {
    const cfg = config({ includeExtensions: ['.py'] });
    write('a.ts', 'export {};');
    write('b.py', 'x = 1');

    const results = scanWorkspace(cfg);
    expect(results.map(r => r.relativePath)).toEqual(['b.py']);
  });

  it('skips files larger than maxFileSize', () => {
    const cfg = config({ maxFileSize: 5 });
    write('big.ts', 'x'.repeat(100));
    write('small.ts', 'x');

    const results = scanWorkspace(cfg);
    expect(results.map(r => r.relativePath)).toEqual(['small.ts']);
  });

  it('skips binary files with many null bytes', () => {
    write('bin.ts', `text${'\0'.repeat(10)}more`);
    write('ok.ts', 'export {};');

    const results = scanWorkspace(config());
    expect(results.map(r => r.relativePath)).toEqual(['ok.ts']);
  });
});

describe('loadFileMetadata', () => {
  it('returns the parsed sidecar map when present', () => {
    write('.code-intel/file-meta.json', JSON.stringify({ 'src/a.ts': { fileAuthor: 'tester', fileVersion: '1.2.3' } }));
    const meta = loadFileMetadata(dir);
    expect(meta['src/a.ts']).toEqual({ fileAuthor: 'tester', fileVersion: '1.2.3' });
  });

  it('returns an empty object when missing or invalid', () => {
    expect(loadFileMetadata(dir)).toEqual({});
    write('.code-intel/file-meta.json', 'not-json');
    expect(loadFileMetadata(dir)).toEqual({});
  });
});