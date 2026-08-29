import { describe, it, expect } from 'vitest';
import { OutputBuffer, detectBinary } from '../../../src/modules/sandbox/parsers/OutputBuffer.js';

describe('OutputBuffer', () => {
  it('keeps the TAIL when over the limit (TC-07: last 1MB kept)', () => {
    const buf = new OutputBuffer(10);
    buf.append('AAAA'); // 4
    buf.append('BBBB'); // 8
    buf.append('CCCCC'); // push over limit -> drops oldest
    expect(buf.truncated).toBe(true);
    const v = buf.value;
    expect(Buffer.byteLength(v, 'utf-8')).toBeLessThanOrEqual(10);
    expect(v.endsWith('CCCCC')).toBe(true);
  });

  it('does not truncate under the limit', () => {
    const buf = new OutputBuffer(100);
    buf.append('hello');
    expect(buf.truncated).toBe(false);
    expect(buf.value).toBe('hello');
  });

  it('detectBinary true for NUL bytes (TC-17)', () => {
    expect(detectBinary('ab' + String.fromCharCode(0) + 'cd')).toBe(true);
  });

  it('detectBinary false for normal text', () => {
    expect(detectBinary('hello world\n')).toBe(false);
  });
});
