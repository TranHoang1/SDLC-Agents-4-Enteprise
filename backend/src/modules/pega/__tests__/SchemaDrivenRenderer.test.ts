/**
 * SA4E-222 Scope B — Unit tests for SchemaDrivenRenderer.
 * Covers FR-B-3 / FR-B-7 / AC-B-3: path resolution (dotted / [] / [].), delegation
 * to the shared path-walker, and tolerant fallback when paths miss.
 */

import { describe, it, expect } from 'vitest';
import { resolvePath, renderSchemaDrivenLogic } from '../extraction/SchemaDrivenRenderer.js';

const RULE = {
  pyModelProcess: {
    pyShapes: [
      { name: 'Step1', when: 'a', result: 'b' },
      { name: 'Step2', when: 'c', result: 'd' },
    ],
  },
  pyStages: [
    { pyProcesses: [{ name: 'P1', from: 'A', to: 'B' }] },
    { pyProcesses: [{ name: 'P2', from: 'C', to: 'D' }] },
  ],
  pyRows: [{ label: 'r1', value: '1', result: 'x' }],
};

describe('SchemaDrivenRenderer', () => {
  it('resolves a dotted nested path', () => {
    const nodes = resolvePath(RULE, 'pyModelProcess.pyShapes');
    expect(nodes).toHaveLength(2);
    expect((nodes[0] as any).name).toBe('Step1');
  });

  it('resolves a []. wildcard path across arrays', () => {
    const nodes = resolvePath(RULE, 'pyStages[].pyProcesses[]');
    expect(nodes).toHaveLength(2);
    expect((nodes[0] as any).name).toBe('P1');
    expect((nodes[1] as any).name).toBe('P2');
  });

  it('resolves an explicit index path pyRows[0]', () => {
    const nodes = resolvePath(RULE, 'pyRows[0]');
    expect(nodes).toHaveLength(1);
    expect((nodes[0] as any).label).toBe('r1');
  });

  it('renders a structured block when a path resolves', () => {
    const out = renderSchemaDrivenLogic(RULE, ['pyStages[].pyProcesses[]']);
    expect(out).toContain('LOGIC (generic: pyStages[].pyProcesses[]):');
    expect(out).toContain('P1');
    expect(out).toContain('A -> B');
  });

  it('returns null and is tolerant when no path resolves (falls back)', () => {
    const out = renderSchemaDrivenLogic(RULE, ['pyMissing[].nope']);
    expect(out).toBeNull();
  });

  it('skips a missing path but still renders a present one', () => {
    const out = renderSchemaDrivenLogic(RULE, ['pyMissing', 'pyModelProcess.pyShapes']);
    expect(out).toContain('Step1');
    expect(out).not.toContain('pyMissing');
  });
});
