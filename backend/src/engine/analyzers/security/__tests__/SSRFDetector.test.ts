/**
 * KSA-166 — Unit tests for SSRFDetector.
 * Uses an injected fake taint analyzer to control returned taint paths.
 */

import { describe, it, expect, vi } from 'vitest';
import { SSRFDetector } from '../ssrf/SSRFDetector.js';
import type { SyntaxNode } from '../../../parsers/types.js';
import type { TaintResult, TaintPath } from '../types/index.js';

function makePath(overrides: Partial<TaintPath>): TaintPath {
  return {
    source: { variable: 'url', type: 'http_param', line: 1, expression: 'url' },
    sink: { function: 'fetch(', type: 'url_fetch', line: 5, expression: 'fetch(url)', paramIndex: 0 },
    chain: [{ variable: 'url', line: 1, action: 'pass_through', expression: 'url' }],
    sanitized: false,
    length: 1,
    ...overrides,
  };
}

const FAKE_NODE = { text: 'function x() {}' } as unknown as SyntaxNode;

describe('SSRFDetector', () => {
  it('reports a finding for a direct param -> HTTP sink path', () => {
    const fakeAnalyzer = { analyze: vi.fn().mockReturnValue({ paths: [makePath({ length: 1 })] } satisfies TaintResult) };
    const detector = new SSRFDetector(fakeAnalyzer as never);
    const findings = detector.detect(FAKE_NODE, 'route.ts', 'ts', 'handler');

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      handler: 'handler',
      filePath: 'route.ts',
      cwe: 'CWE-918',
      trustTier: 'T1',
      confidence: 95,
      severity: 'Critical',
      missingControl: 'URL validation/allowlist',
    });
  });

  it('does not report when the sink is not an HTTP sink', () => {
    const path = makePath({ sink: { function: 'db.query(', type: 'sql_query', line: 5, expression: 'db.query(url)', paramIndex: 0 } });
    const fakeAnalyzer = { analyze: vi.fn().mockReturnValue({ paths: [path] } satisfies TaintResult) };
    const detector = new SSRFDetector(fakeAnalyzer as never);
    expect(detector.detect(FAKE_NODE, 'route.ts', 'ts', 'h')).toHaveLength(0);
  });

  it('skips paths that contain URL validation', () => {
    const path = makePath({
      sink: { function: 'fetch(', type: 'url_fetch', line: 6, expression: 'fetch(new URL(url))', paramIndex: 0 },
      chain: [{ variable: 'u', line: 2, action: 'pass_through', expression: 'validateUrl(u)' }],
    });
    const fakeAnalyzer = { analyze: vi.fn().mockReturnValue({ paths: [path] } satisfies TaintResult) };
    const detector = new SSRFDetector(fakeAnalyzer as never);
    expect(detector.detect(FAKE_NODE, 'route.ts', 'ts', 'h')).toHaveLength(0);
  });

  it('classifies trust tiers and confidence by path length', () => {
    const t1 = makePath({ length: 1 });
    const t2 = makePath({ length: 4 });
    const t3 = makePath({ length: 7 });
    const fakeAnalyzer = { analyze: vi.fn().mockReturnValue({ paths: [t1, t2, t3] } satisfies TaintResult) };
    const detector = new SSRFDetector(fakeAnalyzer as never);
    const findings = detector.detect(FAKE_NODE, 'route.ts', 'ts', 'h');

    expect(findings).toHaveLength(3);
    expect(findings[0].trustTier).toBe('T1');
    expect(findings[0].confidence).toBe(95);
    expect(findings[0].severity).toBe('Critical');
    expect(findings[1].trustTier).toBe('T2');
    expect(findings[1].confidence).toBe(75);
    expect(findings[1].severity).toBe('High');
    expect(findings[2].trustTier).toBe('T3');
    expect(findings[2].confidence).toBe(50);
    expect(findings[2].severity).toBe('Medium');
  });

  it('passes sinkTypes url_fetch to the analyzer', () => {
    const fakeAnalyzer = { analyze: vi.fn().mockReturnValue({ paths: [] } satisfies TaintResult) };
    const detector = new SSRFDetector(fakeAnalyzer as never);
    detector.detect(FAKE_NODE, 'route.ts', 'ts', 'h');
    expect(fakeAnalyzer.analyze).toHaveBeenCalledWith(FAKE_NODE, 'ts', { sinkTypes: ['url_fetch'] });
  });

  it('records the line chain in the finding', () => {
    const path = makePath({
      chain: [
        { variable: 'url', line: 1, action: 'pass_through', expression: 'url' },
        { variable: 'url2', line: 3, action: 'concat', expression: 'url2' },
      ],
    });
    const fakeAnalyzer = { analyze: vi.fn().mockReturnValue({ paths: [path] } satisfies TaintResult) };
    const detector = new SSRFDetector(fakeAnalyzer as never);
    const [finding] = detector.detect(FAKE_NODE, 'route.ts', 'ts', 'h');
    expect(finding.path).toEqual([1, 3]);
  });
});