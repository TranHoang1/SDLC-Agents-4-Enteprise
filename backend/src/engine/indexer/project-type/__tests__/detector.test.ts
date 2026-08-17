/**
 * SA4E-108 — Unit tests for ProjectTypeDetector.
 * Covers: UT-01, UT-02, UT-09, UT-12
 */
import { describe, it, expect, vi } from 'vitest';
import { ProjectTypeDetector, type KBSearchFn } from '../detector.js';
import type { ProjectTypeConfig } from '../models.js';
import pino from 'pino';

const logger = pino({ level: 'silent' });

const JAVA_CONFIG: ProjectTypeConfig = {
  type_id: 'java-maven', display_name: 'Java (Maven)',
  signals: [{ file: 'pom.xml', confidence: 0.9 }],
  source_roots: ['src/main/java/'], test_roots: ['src/test/java/'],
  exclude_patterns: ['target/'], extensions: ['.java'],
  mono_repo_signals: [],
  priority: 10, auto_discovered: false,
};

function mockCache() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn().mockResolvedValue(undefined),
    canDiscover: vi.fn().mockResolvedValue(true),
    markDiscovered: vi.fn().mockResolvedValue(undefined),
  } as any;
}

function mockKB(configs: ProjectTypeConfig[]): KBSearchFn {
  return vi.fn().mockResolvedValue(configs.map(c => ({ content: JSON.stringify(c) })));
}

describe('ProjectTypeDetector', () => {
  it('UT-12: returns built-in defaults when KB empty', async () => {
    const detector = new ProjectTypeDetector(mockKB([]), mockCache(), logger, [JAVA_CONFIG]);
    const configs = await detector.loadTypeDefinitions();
    expect(configs).toHaveLength(1);
    expect(configs[0].type_id).toBe('java-maven');
  });

  it('UT-09: invalidateConfigCache forces reload', async () => {
    const kb = mockKB([JAVA_CONFIG]);
    const detector = new ProjectTypeDetector(kb, mockCache(), logger);
    await detector.loadTypeDefinitions();
    detector.invalidateConfigCache();
    await detector.loadTypeDefinitions();
    expect(kb).toHaveBeenCalledTimes(2);
  });

  it('UT-02: returns fallback for non-existent path', async () => {
    const detector = new ProjectTypeDetector(mockKB([JAVA_CONFIG]), mockCache(), logger);
    const result = await detector.detect('/nonexistent/xyz');
    expect(result.project_type).toBe('fallback');
    expect(result.confidence).toBe(0);
  });

  it('loads configs sorted by priority', async () => {
    const low = { ...JAVA_CONFIG, type_id: 'low', priority: 1 };
    const high = { ...JAVA_CONFIG, type_id: 'high', priority: 99 };
    const detector = new ProjectTypeDetector(mockKB([low, high]), mockCache(), logger);
    const configs = await detector.loadTypeDefinitions();
    expect(configs[0].type_id).toBe('high');
  });
});
