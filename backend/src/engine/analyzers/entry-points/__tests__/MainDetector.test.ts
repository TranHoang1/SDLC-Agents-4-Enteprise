/**
 * KSA-162 — Unit tests for MainDetector main() entry point detection.
 */

import { describe, it, expect } from 'vitest';
import { PatternRegistry } from '../PatternRegistry.js';
import { MainDetector } from '../detectors/MainDetector.js';

const SYMBOLS = [
  { id: 1, name: 'main', filePath: 'src/main.ts', startLine: 0 },
  { id: 2, name: 'helper', filePath: 'src/main.ts', startLine: 5 },
];

describe('MainDetector', () => {
  const detector = new MainDetector(new PatternRegistry());

  it('detects a symbol named main', () => {
    const result = detector.detect(SYMBOLS, '', 'typescript');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      symbol_id: 1, symbol_name: 'main',
      file_path: 'src/main.ts', start_line: 0,
      entry_type: 'MAIN', framework: null,
      http_method: null, route_path: null, full_route: null,
      middleware: [], has_auth: false, controller: null,
      event_name: null, confidence: 'High',
    });
  });

  it('detects __main__ as a main symbol', () => {
    const result = detector.detect(
      [{ id: 9, name: '__main__', filePath: 'src/x.py', startLine: 2 }],
      '',
      'python',
    );
    expect(result).toHaveLength(1);
    expect(result[0].entry_type).toBe('MAIN');
  });

  it('falls back to the nearest symbol when the language pattern appears in source', () => {
    const source = ['a', 'b', 'func main() {}', 'c'].join('\n');
    const symbols = [
      { id: 1, name: 'setup', filePath: 'main.go', startLine: 1 },
      { id: 2, name: 'run', filePath: 'main.go', startLine: 8 },
    ];
    const result = detector.detect(symbols, source, 'go');
    expect(result).toHaveLength(1);
    expect(result[0].symbol_id).toBe(1);
  });

  it('returns empty for languages without a main pattern', () => {
    expect(detector.detect(SYMBOLS, '', 'ruby')).toEqual([]);
  });

  it('returns empty when no main symbol and no pattern in source', () => {
    const source = 'const x = 1;';
    const symbols = [{ id: 5, name: 'compute', filePath: 'src/a.ts', startLine: 0 }];
    expect(detector.detect(symbols, source, 'typescript')).toEqual([]);
  });
});