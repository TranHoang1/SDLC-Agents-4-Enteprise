import { describe, it, expect } from 'vitest';
import { parseTestResult } from '../../../src/modules/sandbox/parsers/TestResultParser.js';
import type { ExecutionResult } from '../../../src/modules/sandbox/models.js';

function res(stdout: string, exitCode = 0): ExecutionResult {
  return {
    exitCode,
    stdout,
    stderr: '',
    duration: 100,
    truncated: false,
    sessionId: 'sess_abc1234567',
    timedOut: false,
  };
}

describe('TestResultParser', () => {
  it('parses vitest output', () => {
    const out = `Test Files  1 failed | 2 passed | 3 total\nTests  1 failed | 4 passed | 5 total\n× should validate\nFAIL src/x.test.ts`;
    const r = parseTestResult('vitest', res(out, 1));
    expect(r.total).toBe(5);
    expect(r.passed).toBe(4);
    expect(r.failed).toBe(1);
    expect(r.status).toBe('failure');
    expect(r.failures.length).toBeGreaterThan(0);
  });

  it('parses jest output (success)', () => {
    const out = `Tests: 3 passed, 3 total`;
    const r = parseTestResult('jest', res(out, 0));
    expect(r.status).toBe('success');
    expect(r.passed).toBe(3);
    expect(r.total).toBe(3);
  });

  it('parses pytest output', () => {
    const out = `2 failed, 8 passed in 1.2s\nFAILED tests/a.py::test_x - boom`;
    const r = parseTestResult('pytest', res(out, 1));
    expect(r.failed).toBe(2);
    expect(r.passed).toBe(8);
    expect(r.status).toBe('failure');
    expect(r.failures[0].test).toContain('test_x');
  });

  it('parses mocha output', () => {
    const out = `2 passing\n1 failing\nfailing test`;
    const r = parseTestResult('mocha', res(out, 1));
    expect(r.passed).toBe(2);
    expect(r.failed).toBe(1);
  });

  it('parses gradle output', () => {
    const out = `Tests run: 15, Failures: 2, Errors: 0, Skipped: 1`;
    const r = parseTestResult('gradle', res(out, 1));
    expect(r.total).toBe(15);
    expect(r.failed).toBe(2);
    expect(r.skipped).toBe(1);
  });

  it('falls back to success when output is unparseable but exit code is 0', () => {
    const r = parseTestResult('vitest', res('no structured output here', 0));
    expect(r.status).toBe('success');
  });
});
