/**
 * SA4E-225 — Unit tests for new language symbol-extraction patterns.
 * Covers STC TC-001..TC-015: per-language extraction, .ps1 indexing,
 * regression, ReDoS (C1), size guard (C2), Swift spacing (C4), and the
 * <=200 line maintainability rule (AC-5).
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { extractSymbols, type ExtractedSymbol } from '../signature-extractor.js';
import { LANGUAGE_PATTERNS } from '../languages/index.js';
import { DEFAULT_EXTENSIONS } from '../../../config/index.js';
import { FALLBACK_EXTENSIONS } from '../../indexer/project-type/resolver.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function kindsOf(syms: ExtractedSymbol[]): Set<string> {
  return new Set(syms.map((s) => s.kind));
}

function has(syms: ExtractedSymbol[], name: string, kind: string): boolean {
  return syms.some((s) => s.name === name && s.kind === kind);
}

// ---------------------------------------------------------------------------
// TC-001 — Scala
// ---------------------------------------------------------------------------
describe('TC-001 Scala symbol extraction', () => {
  const src = [
    'package com.ex',
    'object MyObj {',
    '  trait Animal',
    '  case class Cat(name: String)',
    '  sealed class Base',
    '  def greet(): Unit = {}',
    '  val answer = 42',
    '  var counter = 0',
    '}',
  ].join('\n');

  it('extracts all Scala constructs (>=5 distinct kinds)', () => {
    const syms = extractSymbols(src, 'scala');
    const kinds = kindsOf(syms);
    for (const k of ['module', 'trait', 'class', 'function', 'constant', 'variable']) {
      expect(kinds.has(k)).toBe(true);
    }
    expect(has(syms, 'MyObj', 'module')).toBe(true);
    expect(has(syms, 'Animal', 'trait')).toBe(true);
    expect(has(syms, 'Cat', 'class')).toBe(true);
    expect(has(syms, 'Base', 'class')).toBe(true);
    expect(has(syms, 'greet', 'function')).toBe(true);
    expect(has(syms, 'answer', 'constant')).toBe(true);
    expect(has(syms, 'counter', 'variable')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TC-002 — C
// ---------------------------------------------------------------------------
describe('TC-002 C symbol extraction', () => {
  const src = [
    'struct Point { int x; int y; };',
    'enum Color { RED, GREEN };',
    'typedef unsigned long size_t;',
    '#define MAX(a,b) ((a)>(b)?(a):(b))',
    '#define VERSION 3',
    'int globalVar = 5;',
  ].join('\n');

  it('extracts C symbols (>=5 distinct kinds)', () => {
    const syms = extractSymbols(src, 'c');
    const kinds = kindsOf(syms);
    for (const k of ['struct', 'enum', 'type', 'function', 'constant', 'variable']) {
      expect(kinds.has(k)).toBe(true);
    }
    expect(has(syms, 'Point', 'struct')).toBe(true);
    expect(has(syms, 'Color', 'enum')).toBe(true);
    expect(has(syms, 'size_t', 'type')).toBe(true);
    expect(has(syms, 'MAX', 'function')).toBe(true);
    expect(has(syms, 'VERSION', 'constant')).toBe(true);
    expect(has(syms, 'globalVar', 'variable')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TC-003 — C++
// ---------------------------------------------------------------------------
describe('TC-003 C++ symbol extraction', () => {
  const src = [
    'namespace myns {',
    'class Widget { };',
    'struct Point { };',
    'int add(int a, int b);',
    'enum Status { OK, ERR };',
    'using IntVec = std::vector<int>;',
    '}',
    'template<typename T> class Container { };',
  ].join('\n');

  it('extracts C++ symbols (>=5 distinct kinds)', () => {
    const syms = extractSymbols(src, 'cpp');
    const kinds = kindsOf(syms);
    for (const k of ['namespace', 'class', 'struct', 'function', 'enum', 'type']) {
      expect(kinds.has(k)).toBe(true);
    }
    expect(has(syms, 'myns', 'namespace')).toBe(true);
    expect(has(syms, 'Widget', 'class')).toBe(true);
    expect(has(syms, 'Point', 'struct')).toBe(true);
    expect(has(syms, 'add', 'function')).toBe(true);
    expect(has(syms, 'Status', 'enum')).toBe(true);
    expect(has(syms, 'IntVec', 'type')).toBe(true);
    expect(has(syms, 'Container', 'class')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TC-004 — C#
// ---------------------------------------------------------------------------
describe('TC-004 C# symbol extraction', () => {
  const src = [
    'public class Calculator { }',
    'public interface IShape { }',
    'public struct Point { }',
    'public enum Color { Red, Green }',
    'public delegate void Handler();',
    'public void Compute() { }',
    'public int Value { get; set; }',
    'public event EventHandler Clicked;',
  ].join('\n');

  it('extracts C# symbols (>=5 distinct kinds, actually 7)', () => {
    const syms = extractSymbols(src, 'csharp');
    const kinds = kindsOf(syms);
    for (const k of ['class', 'interface', 'struct', 'enum', 'type', 'method', 'variable']) {
      expect(kinds.has(k)).toBe(true);
    }
    expect(has(syms, 'Calculator', 'class')).toBe(true);
    expect(has(syms, 'IShape', 'interface')).toBe(true);
    expect(has(syms, 'Point', 'struct')).toBe(true);
    expect(has(syms, 'Color', 'enum')).toBe(true);
    expect(has(syms, 'Handler', 'type')).toBe(true);
    expect(has(syms, 'Compute', 'method')).toBe(true);
    expect(has(syms, 'Value', 'variable')).toBe(true);
    expect(has(syms, 'Clicked', 'variable')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TC-005 — Ruby
// ---------------------------------------------------------------------------
describe('TC-005 Ruby symbol extraction', () => {
  const src = [
    'class User',
    '  module Helper',
    '    def greet',
    '    end',
    '    CONSTANT = 10',
    '    @name = "x"',
    '    $global = 1',
    '    attr_accessor :age',
    '  end',
    'end',
  ].join('\n');

  it('extracts Ruby symbols (>=5 distinct kinds)', () => {
    const syms = extractSymbols(src, 'ruby');
    const kinds = kindsOf(syms);
    for (const k of ['class', 'module', 'function', 'constant', 'variable']) {
      expect(kinds.has(k)).toBe(true);
    }
    expect(has(syms, 'User', 'class')).toBe(true);
    expect(has(syms, 'Helper', 'module')).toBe(true);
    expect(has(syms, 'greet', 'function')).toBe(true);
    expect(has(syms, 'CONSTANT', 'constant')).toBe(true);
    expect(has(syms, '@name', 'variable')).toBe(true);
    expect(has(syms, '$global', 'variable')).toBe(true);
    expect(has(syms, 'age', 'variable')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TC-006 — PHP
// ---------------------------------------------------------------------------
describe('TC-006 PHP symbol extraction', () => {
  const src = [
    '<?php',
    'namespace App\\Model;',
    'class User { }',
    'interface Repository { }',
    'trait Timestamps { }',
    'public function make() { }',
    'function helper() { }',
    'abstract class Base { }',
  ].join('\n');

  it('extracts PHP symbols (>=5 distinct kinds)', () => {
    const syms = extractSymbols(src, 'php');
    const kinds = kindsOf(syms);
    for (const k of ['namespace', 'class', 'interface', 'trait', 'method', 'function']) {
      expect(kinds.has(k)).toBe(true);
    }
    expect(has(syms, 'App\\Model', 'namespace')).toBe(true);
    expect(has(syms, 'User', 'class')).toBe(true);
    expect(has(syms, 'Repository', 'interface')).toBe(true);
    expect(has(syms, 'Timestamps', 'trait')).toBe(true);
    expect(has(syms, 'make', 'method')).toBe(true);
    expect(has(syms, 'helper', 'function')).toBe(true);
    expect(has(syms, 'Base', 'class')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TC-007 — Swift
// ---------------------------------------------------------------------------
describe('TC-007 Swift symbol extraction', () => {
  const src = [
    'public class Foo { }',
    'struct Bar { }',
    'protocol Baz { }',
    'enum Dir { case up }',
    'func run() { }',
    'extension Qux { }',
    'actor ActorX { }',
    'var count = 0',
  ].join('\n');

  it('extracts Swift symbols (>=5 distinct kinds)', () => {
    const syms = extractSymbols(src, 'swift');
    const kinds = kindsOf(syms);
    for (const k of ['class', 'struct', 'interface', 'enum', 'function', 'variable']) {
      expect(kinds.has(k)).toBe(true);
    }
    expect(has(syms, 'Foo', 'class')).toBe(true);
    expect(has(syms, 'Bar', 'struct')).toBe(true);
    expect(has(syms, 'Baz', 'interface')).toBe(true);
    expect(has(syms, 'Dir', 'enum')).toBe(true);
    expect(has(syms, 'run', 'function')).toBe(true);
    expect(has(syms, 'Qux', 'class')).toBe(true);
    expect(has(syms, 'ActorX', 'class')).toBe(true);
    expect(has(syms, 'count', 'variable')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TC-008 — Bash (deviated: >=3 distinct kinds)
// ---------------------------------------------------------------------------
describe('TC-008 Bash symbol extraction', () => {
  const src = [
    'function deploy() { echo hi; }',
    'start() { echo go; }',
    'export NAME="x"',
    'readonly MAX=10',
    'local tmp=1',
  ].join('\n');

  it('extracts Bash symbols (>=3 distinct kinds — approved deviation)', () => {
    const syms = extractSymbols(src, 'bash');
    const kinds = kindsOf(syms);
    for (const k of ['function', 'variable', 'constant']) {
      expect(kinds.has(k)).toBe(true);
    }
    expect(has(syms, 'deploy', 'function')).toBe(true);
    expect(has(syms, 'start', 'function')).toBe(true);
    expect(has(syms, 'NAME', 'variable')).toBe(true);
    expect(has(syms, 'tmp', 'variable')).toBe(true);
    expect(has(syms, 'MAX', 'constant')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TC-009 — PowerShell (deviated: >=4 distinct kinds)
// ---------------------------------------------------------------------------
describe('TC-009 PowerShell symbol extraction', () => {
  const src = [
    'function Get-Data { param($Path) }',
    'class Person { [string]$Name }',
    '$config = @{}',
    'Set-Variable -Name Max -Option Constant',
  ].join('\n');

  it('extracts PowerShell symbols (>=4 distinct kinds — approved deviation)', () => {
    const syms = extractSymbols(src, 'powershell');
    const kinds = kindsOf(syms);
    for (const k of ['function', 'class', 'variable', 'constant']) {
      expect(kinds.has(k)).toBe(true);
    }
    expect(has(syms, 'Get-Data', 'function')).toBe(true);
    expect(has(syms, 'Person', 'class')).toBe(true);
    expect(has(syms, 'config', 'variable')).toBe(true);
    expect(has(syms, 'Path', 'variable')).toBe(true);
    expect(has(syms, 'Max', 'constant')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TC-010 — .ps1 no longer skipped (DEFAULT_EXTENSIONS + FALLBACK_EXTENSIONS)
// ---------------------------------------------------------------------------
describe('TC-010 PowerShell .ps1 indexing gate', () => {
  it('DEFAULT_EXTENSIONS contains .ps1', () => {
    expect(DEFAULT_EXTENSIONS).toContain('.ps1');
  });

  it('FALLBACK_EXTENSIONS contains .ps1', () => {
    expect(FALLBACK_EXTENSIONS).toContain('.ps1');
  });

  it('a .ps1 file path passes the extension gate', () => {
    expect(DEFAULT_EXTENSIONS.includes('.ps1')).toBe(true);
    const sample = 'function Get-Data { param($Path) }\nclass Person { }\n$config = @{}\nSet-Variable -Name Max -Option Constant';
    const syms = extractSymbols(sample, 'powershell');
    const kinds = kindsOf(syms);
    expect(kinds.has('function')).toBe(true);
    expect(kinds.has('class')).toBe(true);
    expect(kinds.has('variable')).toBe(true);
    expect(kinds.has('constant')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TC-011 — No regression for existing tree-sitter languages
// ---------------------------------------------------------------------------
describe('TC-011 Regression — existing languages unaffected', () => {
  it('LANGUAGE_PATTERNS routes all 16 languages (no silent fallback)', () => {
    for (const id of [
      'typescript', 'javascript', 'kotlin', 'python', 'java', 'go', 'rust', 'apex',
      'scala', 'c', 'cpp', 'csharp', 'ruby', 'php', 'swift', 'bash', 'powershell',
    ]) {
      expect(LANGUAGE_PATTERNS[id]).toBeDefined();
      expect(LANGUAGE_PATTERNS[id].length).toBeGreaterThan(0);
    }
  });

  it('existing languages still extract expected kinds', () => {
    expect(has(extractSymbols('export function foo() {}\nexport class Bar {}', 'typescript'), 'foo', 'function')).toBe(true);
    expect(has(extractSymbols("def run():\n    pass\nclass Model:\n    pass", 'python'), 'Model', 'class')).toBe(true);
    expect(has(extractSymbols('func (s *Server) Handle() {}\ntype Config struct{}', 'go'), 'Config', 'struct')).toBe(true);
    expect(has(extractSymbols('pub fn main() {}\npub struct Point{}', 'rust'), 'main', 'function')).toBe(true);
    expect(has(extractSymbols('private fun surface() {}\ninternal class Repo {}', 'kotlin'), 'Repo', 'class')).toBe(true);
    expect(has(extractSymbols('public class Main {\n  public static void run(String[] args) {}\n}', 'java'), 'run', 'function')).toBe(true);
    expect(has(extractSymbols('public class Acc {}\npublic interface IH {}', 'apex'), 'Acc', 'class')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TC-012 — ReDoS regression (C1): degenerate long line per new language
// ---------------------------------------------------------------------------
describe('TC-012 ReDoS regression (C1)', () => {
  const langs = ['scala', 'c', 'cpp', 'csharp', 'ruby', 'php', 'swift', 'bash', 'powershell'];
  for (const lang of langs) {
    it(`extractSymbols completes in bounded time for ${lang} on a 100k-char line`, () => {
      const degenerate = 'a'.repeat(100_000) + '(';
      const start = performance.now();
      let result: ExtractedSymbol[] = [];
      expect(() => {
        result = extractSymbols(degenerate, lang);
      }).not.toThrow();
      const elapsed = performance.now() - start;
      expect(Array.isArray(result)).toBe(true);
      // Bounded — must not hang / catastrophically backtrack (< 1500ms).
      expect(elapsed).toBeLessThan(1500);
    });
  }
});

// ---------------------------------------------------------------------------
// TC-013 — Per-line / file size guard before matchAll (C2)
// ---------------------------------------------------------------------------
describe('TC-013 Size guard (C2)', () => {
  it('a 5MB single line is processed in bounded time and drops oversized content', () => {
    const huge = 'x'.repeat(5_000_000);
    const start = performance.now();
    const syms = extractSymbols(huge, 'csharp');
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(2000);
    // The giant line is blanked by the guard, so no symbols are produced from it.
    expect(syms).toHaveLength(0);
  });

  it('a symbol on an oversized line is dropped by the guard', () => {
    const oversized = 'class ' + 'A'.repeat(9000); // single line > 8192 chars
    const syms = extractSymbols(oversized, 'scala');
    expect(syms).toHaveLength(0);
  });

  it('normal-sized content is unaffected by the guard', () => {
    const syms = extractSymbols('public class Foo { }', 'csharp');
    expect(has(syms, 'Foo', 'class')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TC-014 — Swift modifier spacing (C4)
// ---------------------------------------------------------------------------
describe('TC-014 Swift modifier spacing (C4)', () => {
  it('public class Foo matches (modifier + space required)', () => {
    const syms = extractSymbols('public class Foo { }', 'swift');
    expect(has(syms, 'Foo', 'class')).toBe(true);
  });

  it('private struct Bar matches', () => {
    const syms = extractSymbols('private struct Bar { }', 'swift');
    expect(has(syms, 'Bar', 'struct')).toBe(true);
  });

  it('open func baz matches', () => {
    const syms = extractSymbols('open func baz() { }', 'swift');
    expect(has(syms, 'baz', 'function')).toBe(true);
  });

  it('publicclass Foo (no space) does NOT falsely match', () => {
    const syms = extractSymbols('publicclass Foo { }', 'swift');
    expect(has(syms, 'Foo', 'class')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TC-015 — Source file <= 200 lines (AC-5)
// ---------------------------------------------------------------------------
describe('TC-015 Maintainability — files <= 200 lines', () => {
  const files = [
    '../signature-extractor.ts',
    '../languages/index.ts',
    '../languages/builtin.ts',
    '../languages/scala.ts',
    '../languages/c.ts',
    '../languages/cpp.ts',
    '../languages/csharp.ts',
    '../languages/ruby.ts',
    '../languages/php.ts',
    '../languages/swift.ts',
    '../languages/bash.ts',
    '../languages/powershell.ts',
    '../tree-sitter-indexer.ts',
    '../../indexer/project-type/resolver.ts',
    // NOTE: config/index.ts is a pre-existing 210-line file (out of SA4E-225 scope to
    // refactor/split); it is excluded from the strict <=200 check by design (TDD §5.5).
  ];

  for (const f of files) {
    it(`${f} is <= 200 lines`, () => {
      const p = path.resolve(__dirname, f);
      const lines = fs.readFileSync(p, 'utf-8').split('\n').length;
      expect(lines).toBeLessThanOrEqual(200);
    });
  }
});
