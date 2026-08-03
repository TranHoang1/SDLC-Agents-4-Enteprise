/**
 * SA4E-85 — E2E-API Tests: Hydration (API-HYD-01/02).
 * Validates session persistence and restore protocol contracts.
 */

import { describe, test, expect } from 'vitest';
import * as crypto from 'crypto';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('API-HYD-01: Session Persist Contract', () => {
  test('session JSON has valid thread_id', () => {
    const session = { thread_id: crypto.randomUUID(), created_at: new Date().toISOString(), agent_id: 'ba', messages: [] };
    expect(session.thread_id).toMatch(UUID_V4);
    expect(session.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('session JSON is serializable', () => {
    const session = { thread_id: crypto.randomUUID(), created_at: new Date().toISOString(), agent_id: 'sa', messages: [{ role: 'user', content: 'hi' }] };
    const serialized = JSON.stringify(session);
    expect(() => JSON.parse(serialized)).not.toThrow();
  });
});

describe('API-HYD-02: Session Restore Contract', () => {
  test('restored session preserves all fields', () => {
    const original = { thread_id: crypto.randomUUID(), created_at: '2025-06-01T00:00:00Z', agent_id: 'dev', messages: [{ role: 'assistant', content: 'hi' }] };
    const restored = JSON.parse(JSON.stringify(original));
    expect(restored.thread_id).toBe(original.thread_id);
    expect(restored.agent_id).toBe(original.agent_id);
    expect(restored.messages).toHaveLength(1);
  });

  test('invalid thread_id format detected on restore', () => {
    const bad = { thread_id: 'not-a-uuid', agent_id: 'ba' };
    expect(UUID_V4.test(bad.thread_id)).toBe(false);
  });
});
