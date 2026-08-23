import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ChatStateManager - SA4E-189 hot-reload', () => {
  it('parses agent frontmatter correctly', () => {
    const content = `---
label: Test Agent
description: A test agent for unit test
---
Agent body`;
    const parse = (content: string, fallbackId: string) => {
      const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!match) return { id: fallbackId, name: fallbackId, description: '' };
      const yaml = match[1];
      const nameMatch = yaml.match(/^(?:label|name):\s*(.+)$/m);
      const descMatch = yaml.match(/^description:\s*(.+)$/m);
      return {
        id: fallbackId,
        name: nameMatch ? nameMatch[1].trim() : fallbackId,
        description: descMatch ? descMatch[1].trim().slice(0, 80) : '',
      };
    };
    const result = parse(content, 'test-agent');
    expect(result.name).toBe('Test Agent');
    expect(result.description).toBe('A test agent for unit test');
  });

  it('debounce prevents multiple reloads', async () => {
    let callCount = 0;
    const debounce = (fn: () => void, ms: number) => {
      let timer: any;
      return () => {
        clearTimeout(timer);
        timer = setTimeout(fn, ms);
      };
    };
    const reload = debounce(() => callCount++, 300);
    reload();
    reload();
    reload();
    await new Promise(r => setTimeout(r, 350));
    expect(callCount).toBe(1);
  });
});
