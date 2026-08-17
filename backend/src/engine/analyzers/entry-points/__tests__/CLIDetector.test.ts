/**
 * KSA-162 — Unit tests for CLIDetector CLI command entry point detection.
 */

import { describe, it, expect } from 'vitest';
import { CLIDetector } from '../detectors/CLIDetector.js';

const SYMBOLS = [
  { id: 1, name: 'runCommand', decorators: ['@command'], filePath: 'cli.ts', startLine: 2 },
  { id: 2, name: 'helper', filePath: 'cli.ts', startLine: 9 },
];

describe('CLIDetector', () => {
  const detector = new CLIDetector();

  it('detects decorated command symbols when a CLI framework is present', () => {
    const source = "import commander from 'commander';\nprogram.command('run');";
    const result = detector.detect(SYMBOLS, source);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      symbol_id: 1,
      symbol_name: 'runCommand',
      entry_type: 'CLI_COMMAND',
      framework: 'commander',
      confidence: 'Medium',
      event_name: 'runCommand',
    });
  });

  it('detects symbols named with command/cmd/cli_ prefixes', () => {
    const source = 'cobra.Command{Use: "serve"}';
    const symbols = [
      { id: 3, name: 'serve_cmd', filePath: 'cmd/serve.go', startLine: 1 },
      { id: 4, name: 'cli_parse', filePath: 'cmd/cli.py', startLine: 3 },
      { id: 5, name: 'ordinary', filePath: 'cmd/a.go', startLine: 2 },
    ];
    const result = detector.detect(symbols, source);
    expect(result.map(r => r.symbol_id).sort()).toEqual([3, 4]);
    expect(result.every(r => r.entry_type === 'CLI_COMMAND')).toBe(true);
  });

  it('returns empty when no CLI framework is detected in source', () => {
    expect(detector.detect(SYMBOLS, 'console.log("hi")')).toEqual([]);
  });

  it('returns empty when the framework exists but no symbols look like CLI commands', () => {
    const source = "const yargs = require('yargs');";
    const symbols = [{ id: 5, name: 'plain', filePath: 'a.js', startLine: 0 }];
    expect(detector.detect(symbols, source)).toEqual([]);
  });
});