/**
 * KSA-162 — Unit tests for the PatternRegistry framework/main pattern store.
 */

import { describe, it, expect } from 'vitest';
import { PatternRegistry } from '../PatternRegistry.js';

describe('PatternRegistry', () => {
  it('returns framework patterns by name', () => {
    const registry = new PatternRegistry();
    const fastapi = registry.getFramework('fastapi');
    expect(fastapi?.language).toBe('python');
    expect(fastapi?.imports).toContain('fastapi');
    expect(fastapi?.decorators?.handler).toContain('router.get');
  });

  it('returns null for unknown frameworks', () => {
    const registry = new PatternRegistry();
    expect(registry.getFramework('nonexistent')).toBeNull();
  });

  it('lists all framework names', () => {
    const registry = new PatternRegistry();
    const names = registry.getFrameworkNames();
    expect(names).toContain('fastapi');
    expect(names).toContain('express');
    expect(names).toContain('nestjs');
    expect(names).toContain('spring');
    expect(names).toContain('ktor');
    expect(names).toContain('gin');
  });

  it('filters frameworks by language', () => {
    const registry = new PatternRegistry();
    const ts = registry.getFrameworksForLanguage('typescript');
    expect(ts.map(f => f.name).sort()).toEqual(['express', 'nestjs']);
    const go = registry.getFrameworksForLanguage('go');
    expect(go.map(f => f.name)).toEqual(['gin']);
  });

  it('returns main patterns per language', () => {
    const registry = new PatternRegistry();
    expect(registry.getMainPattern('python')?.pattern).toBe('if __name__ == "__main__":');
    expect(registry.getMainPattern('go')?.pattern).toBe('func main()');
    expect(registry.getMainPattern('ruby')).toBeNull();
  });

  it('exposes all import patterns grouped by framework', () => {
    const registry = new PatternRegistry();
    const patterns = registry.getAllImportPatterns();
    const fastapi = patterns.find(p => p.framework === 'fastapi');
    expect(fastapi?.imports).toContain('from fastapi');
  });

  it('merges custom config over defaults (shallow)', () => {
    const registry = new PatternRegistry({
      frameworks: { custom: { language: 'ruby', imports: ['custom'], auth_indicators: ['Auth'] } },
      main_patterns: { ruby: { pattern: 'def main', type: 'MAIN' } },
    });
    expect(registry.getFramework('custom')?.language).toBe('ruby');
    expect(registry.getFrameworkNames()).toEqual(['custom']);
    expect(registry.getMainPattern('ruby')?.pattern).toBe('def main');
    expect(registry.getFramework('fastapi')).toBeNull();
  });
});