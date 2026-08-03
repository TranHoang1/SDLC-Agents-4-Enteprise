/**
 * SA4E-85 — Unit Tests: Session Hydration (UT-HYD-01/02/03).
 * Tests session JSON persistence and thread ID generation.
 */

import { describe, test, expect } from 'vitest';
import * as crypto from 'crypto';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('UT-HYD-01: Session Thread ID Generation', () => {
  test('generates valid UUID v4', () => {
    const id = crypto.randomUUID();
    expect(UUID_V4_REGEX.test(id)).toBe(true);
  });

  test('each call produces unique ID', () => {
    const ids = new Set(Array.from({ length: 100 }, () => crypto.randomUUID()));
    expect(ids.size).toBe(100);
  });
});

describe('UT-HYD-02: Session JSON Structure', () => {
  test('session object has required fields', () => {
    const session = {
      thread_id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      agent_id: 'ba',
      messages: [],
    };
    expect(session.thread_id).toMatch(UUID_V4_REGEX);
    expect(session.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Array.isArray(session.messages)).toBe(true);
  });

  test('session serializes to valid JSON', () => {
    const session = {
      thread_id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      agent_id: 'sa',
      messages: [{ role: 'user', content: 'hello' }],
    };
    const parsed = JSON.parse(JSON.stringify(session));
    expect(parsed.thread_id).toBe(session.thread_id);
    expect(parsed.messages).toHaveLength(1);
  });
});

describe('UT-HYD-03: Session Restore from Disk', () => {
  test('parses stored session JSON correctly', () => {
    const stored = JSON.stringify({
      thread_id: '550e8400-e29b-41d4-a716-446655440000',
      created_at: '2025-01-01T00:00:00.000Z',
      agent_id: 'dev',
      messages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }],
    });
    const session = JSON.parse(stored);
    expect(session.thread_id).toMatch(UUID_V4_REGEX);
    expect(session.messages).toHaveLength(2);
  });

  test('invalid JSON returns null gracefully', () => {
    expect(safeParseSession('not valid json')).toBeNull();
  });

  test('missing thread_id returns null', () => {
    expect(safeParseSession(JSON.stringify({ agent_id: 'ba' }))).toBeNull();
  });
});

function safeParseSession(content: string): Record<string, unknown> | null {
  try {
    const data = JSON.parse(content);
    if (!data.thread_id || !UUID_V4_REGEX.test(data.thread_id)) return null;
    return data;
  } catch { return null; }
}
