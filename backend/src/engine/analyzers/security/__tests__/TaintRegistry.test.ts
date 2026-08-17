/**
 * KSA-164 — Unit tests for TaintRegistry.
 * Covers default source/sink/sanitizer matching, language filtering, and custom registration.
 */

import { describe, it, expect } from 'vitest';
import { TaintRegistry } from '../taint/TaintRegistry.js';

describe('TaintRegistry', () => {
  describe('matchSource', () => {
    it('matches HTTP request query sources', () => {
      const registry = new TaintRegistry();
      expect(registry.matchSource('req.query.foo')).toEqual({ type: 'http_param' });
    });

    it('matches request body sources', () => {
      const registry = new TaintRegistry();
      expect(registry.matchSource('req.body')).toEqual({ type: 'http_body' });
    });

    it('matches environment variable sources', () => {
      const registry = new TaintRegistry();
      expect(registry.matchSource('process.env.SECRET')).toEqual({ type: 'env_var' });
    });

    it('returns null for unrecognized expressions', () => {
      const registry = new TaintRegistry();
      expect(registry.matchSource('foo.bar()')).toBeNull();
    });

    it('respects language-specific source patterns', () => {
      const registry = new TaintRegistry();
      registry.addSource({ type: 'cli_arg', patterns: ['getopt'], language: 'python' });
      expect(registry.matchSource('getopt()', 'js')).toBeNull();
      expect(registry.matchSource('getopt()', 'python')).toEqual({ type: 'cli_arg' });
    });
  });

  describe('matchSink', () => {
    it('matches SQL query sinks', () => {
      const registry = new TaintRegistry();
      const sink = registry.matchSink('db.query(', 'js');
      expect(sink).not.toBeNull();
      expect(sink!.type).toBe('sql_query');
      expect(sink!.paramIndex).toBe(0);
    });

    it('matches shell execution sinks', () => {
      const registry = new TaintRegistry();
      const sink = registry.matchSink('execSync(', 'js');
      expect(sink!.type).toBe('shell_exec');
    });

    it('matches url_fetch sinks', () => {
      const registry = new TaintRegistry();
      expect(registry.matchSink('fetch(')!.type).toBe('url_fetch');
      expect(registry.matchSink('requests.get(')!.type).toBe('url_fetch');
    });

    it('returns null for unknown functions', () => {
      const registry = new TaintRegistry();
      expect(registry.matchSink('console.log')).toBeNull();
    });

    it('respects language-specific sink patterns', () => {
      const registry = new TaintRegistry();
      registry.addSink({ type: 'log_output', functions: ['plog'], paramIndex: 0, language: 'apex' });
      expect(registry.matchSink('plog(', 'js')).toBeNull();
      expect(registry.matchSink('plog(', 'apex')).not.toBeNull();
    });
  });

  describe('isSanitizer', () => {
    it('recognizes escape as sanitizer for html_output', () => {
      const registry = new TaintRegistry();
      expect(registry.isSanitizer('escape(', 'html_output')).toBe(true);
    });

    it('recognizes DOMPurify for html_output but not sql_query', () => {
      const registry = new TaintRegistry();
      expect(registry.isSanitizer('DOMPurify', 'html_output')).toBe(true);
      // The generic `sanitize` entry does cover sql_query, so a standalone
      // DOMPurify reference should not sanitize sql_query.
      expect(registry.isSanitizer('DOMPurify', 'sql_query')).toBe(false);
    });

    it('recognizes parameterize for sql_query', () => {
      const registry = new TaintRegistry();
      expect(registry.isSanitizer('parameterize(' , 'sql_query')).toBe(true);
    });
  });

  describe('custom registration and accessors', () => {
    it('tracks added sources, sinks, and sanitizers', () => {
      const registry = new TaintRegistry();
      const before = {
        sources: registry.getSources().length,
        sinks: registry.getSinks().length,
        sanitizers: registry.getSanitizers().length,
      };
      registry.addSource({ type: 'db_result', patterns: ['nap('] });
      registry.addSink({ type: 'eval', functions: ['napeval('], paramIndex: 0 });
      registry.addSanitizer({ function: 'napevalsafe', sanitizes: ['eval'] });

      expect(registry.getSources().length).toBe(before.sources + 1);
      expect(registry.getSinks().length).toBe(before.sinks + 1);
      expect(registry.getSanitizers().length).toBe(before.sanitizers + 1);
      expect(registry.matchSink('napeval(')!.type).toBe('eval');
    });
  });
});