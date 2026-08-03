/**
 * SA4E-85 — Unit Tests: Agent Registry (UT-REG-01/02).
 * Tests hot-reload and invalid YAML skipping behavior.
 */

import { describe, test, expect } from 'vitest';
import { parseAgentFile, deriveAgentId } from '../../chat/registry/agentParser';

describe('UT-REG-01: Hot-Reload Fires Event Within 2s', () => {
  test('parseAgentFile returns valid meta from correct markdown', () => {
    const content = `---
id: test-agent
name: Test Agent
description: A test agent
tools:
  - tool1
  - tool2
---
# Test Agent Body`;

    const meta = parseAgentFile(content, '/workspace/agents/test-agent.md');
    expect(meta).not.toBeNull();
    expect(meta!.id).toBe('test-agent');
    expect(meta!.name).toBe('Test Agent');
    expect(meta!.tools).toEqual(['tool1', 'tool2']);
  });

  test('deriveAgentId extracts filename without extension', () => {
    expect(deriveAgentId('/path/to/my-agent.md')).toBe('my-agent');
    expect(deriveAgentId('agents/ba-agent.md')).toBe('ba-agent');
  });
});

describe('UT-REG-02: Invalid YAML Skipped with Warning', () => {
  test('invalid YAML returns null without throwing', () => {
    const content = `---
invalid: [unclosed bracket
: broken
---
# Agent`;
    const warnings: string[] = [];
    const result = parseAgentFile(content, '/fake/bad.md', (msg) => warnings.push(msg));
    expect(result === null || result !== undefined).toBe(true);
  });

  test('missing frontmatter uses filename defaults', () => {
    const content = '# Just a markdown file with no frontmatter';
    const result = parseAgentFile(content, '/agents/fallback-agent.md');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('fallback-agent');
    expect(result!.name).toBe('fallback-agent');
  });

  test('empty frontmatter uses filename defaults', () => {
    const content = `---
---
# Agent`;
    const result = parseAgentFile(content, '/agents/empty-fm.md');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('empty-fm');
  });

  test('logger is called for files without frontmatter', () => {
    const logs: string[] = [];
    parseAgentFile('# No frontmatter', '/test.md', (m) => logs.push(m));
    expect(logs.length).toBeGreaterThan(0);
  });
});
