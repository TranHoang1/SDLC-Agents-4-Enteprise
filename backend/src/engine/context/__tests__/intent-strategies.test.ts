/**
 * Intent strategies unit tests — intent-to-section mapping and fallback.
 */

import { describe, it, expect } from 'vitest';
import { getStrategy, getSupportedIntents } from '../intent-strategies.js';

describe('intent-strategies', () => {
  it('supports the four canonical intents', () => {
    expect(getSupportedIntents()).toEqual(['explain', 'modify', 'debug', 'test']);
  });

  it('explain starts with source and includes doc_comment', () => {
    const s = getStrategy('explain');
    expect(s.intent).toBe('explain');
    expect(s.sections[0].name).toBe('source');
    expect(s.sections.map(x => x.name)).toContain('doc_comment');
  });

  it('modify favors callers/callees/tests', () => {
    const s = getStrategy('modify');
    expect(s.sections.map(x => x.name)).toEqual([
      'source', 'callers', 'callees', 'tests', 'imports', 'type_definitions', 'siblings',
    ]);
  });

  it('debug includes error_patterns and recent_changes', () => {
    const s = getStrategy('debug');
    expect(s.sections.map(x => x.name).sort()).toContain('error_patterns');
    expect(s.sections.map(x => x.name).sort()).toContain('recent_changes');
  });

  it('test includes test_patterns and mocks_needed', () => {
    const s = getStrategy('test');
    expect(s.sections.map(x => x.name).sort()).toContain('test_patterns');
    expect(s.sections.map(x => x.name).sort()).toContain('mocks_needed');
  });

  it('each strategy has strictly increasing unique priorities', () => {
    for (const intent of getSupportedIntents()) {
      const priorities = getStrategy(intent).sections.map(x => x.priority);
      expect([...priorities].sort((a, b) => a - b)).toEqual(priorities);
      expect(new Set(priorities).size).toBe(priorities.length);
    }
  });

  it('falls back to explain for unknown intents', () => {
    expect(getStrategy('no-such-intent')).toEqual(getStrategy('explain'));
  });
});