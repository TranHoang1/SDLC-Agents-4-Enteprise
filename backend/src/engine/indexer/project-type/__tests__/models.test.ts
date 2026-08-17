/**
 * SA4E-108 — Unit tests for Zod schemas.
 * Covers: UT-11, PBT-02
 */
import { describe, it, expect } from 'vitest';
import { ProjectTypeConfigSchema, SignalSchema } from '../models.js';

describe('ProjectTypeConfigSchema', () => {
  it('UT-11: rejects missing type_id', () => {
    const r = ProjectTypeConfigSchema.safeParse({
      display_name: 'X', signals: [{ file: 'x', confidence: 0.9 }],
      source_roots: ['src/'], exclude_patterns: ['b/'], extensions: ['.ts'],
    });
    expect(r.success).toBe(false);
  });

  it('rejects empty signals', () => {
    const r = ProjectTypeConfigSchema.safeParse({
      type_id: 't', display_name: 'X', signals: [],
      source_roots: ['s/'], exclude_patterns: ['b/'], extensions: ['.t'],
    });
    expect(r.success).toBe(false);
  });

  it('rejects >20 signals', () => {
    const signals = Array.from({ length: 21 }, (_, i) => ({ file: `f${i}`, confidence: 0.5 }));
    const r = ProjectTypeConfigSchema.safeParse({
      type_id: 't', display_name: 'X', signals,
      source_roots: ['s/'], exclude_patterns: ['b/'], extensions: ['.t'],
    });
    expect(r.success).toBe(false);
  });

  it('accepts valid config with defaults', () => {
    const r = ProjectTypeConfigSchema.safeParse({
      type_id: 'elixir', display_name: 'Elixir',
      signals: [{ file: 'mix.exs', confidence: 0.9 }],
      source_roots: ['lib/'], exclude_patterns: ['_build/'], extensions: ['.ex'],
    });
    expect(r.success).toBe(true);
    expect(r.data!.priority).toBe(0);
    expect(r.data!.auto_discovered).toBe(false);
  });
});

describe('SignalSchema', () => {
  it('rejects confidence > 1', () => {
    expect(SignalSchema.safeParse({ file: 'x', confidence: 1.5 }).success).toBe(false);
  });
  it('rejects confidence < 0', () => {
    expect(SignalSchema.safeParse({ file: 'x', confidence: -0.1 }).success).toBe(false);
  });
  it('accepts valid', () => {
    expect(SignalSchema.safeParse({ file: 'pom.xml', confidence: 0.9 }).success).toBe(true);
  });
});
