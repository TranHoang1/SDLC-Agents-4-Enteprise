// @vitest-environment jsdom
/**
 * SA4E-85 — chatStore hydration tests (UT-HYD-01).
 * Verifies chatStore rehydrates from SYNC_CHAT_HISTORY payload and that
 * empty/invalid payloads are ignored (non-destructive).
 */
import { describe, it, expect, beforeEach } from 'vitest';
// Simple get implementation for Vitest environment
function get<T>(store: { subscribe: (run: (value: T) => void) => () => void }): T {
  let value: T;
  const unsubscribe = store.subscribe(v => (value = v));
  unsubscribe();
  return value!;
}
import { chatState, hydrateChat, clearChat, messages } from '../stores/chatStore';
import { contextState } from '../stores/contextStore';

const PAYLOAD = [
  { id: 'm-1', role: 'user' as const, content: 'First', agentId: 'ba-agent', timestamp: '2026-01-01T00:00:00.000Z' },
  { id: 'm-2', role: 'assistant' as const, content: 'Second', timestamp: '2026-01-01T00:00:05.000Z' },
  { id: 'm-3', role: 'user' as const, content: 'Third', timestamp: '2026-01-01T00:00:10.000Z' },
  { id: 'm-4', role: 'assistant' as const, content: 'Fourth', timestamp: '2026-01-01T00:00:15.000Z' },
  { id: 'm-5', role: 'system' as const, content: 'Fifth', timestamp: '2026-01-01T00:00:20.000Z' },
];

const CONTEXT = {
  tokenCount: 1234,
  maxTokens: 200000,
  files: [{ path: 'src/foo.ts', tokenCount: 900, pinned: true }],
};

describe('UT-HYD-01 — chatStore hydration from SYNC_CHAT_HISTORY', () => {
  beforeEach(() => {
    clearChat();
    contextState.set({ tokenCount: 0, maxTokens: 128000, files: [], pruneSuggestions: [] });
  });

  it('populates exactly the hydrated messages', () => {
    expect(get(messages)).toHaveLength(0);
    hydrateChat(PAYLOAD);
    expect(get(messages)).toHaveLength(5);
    expect(get(chatState).isHydrated).toBe(true);
  });

  it('preserves all message fields (id, role, content, agentId, timestamp)', () => {
    hydrateChat(PAYLOAD);
    const items = get(messages);
    expect(items[0]).toMatchObject({ id: 'm-1', role: 'user', content: 'First', agentId: 'ba-agent' });
    expect(items[1]).toMatchObject({ id: 'm-2', role: 'assistant', content: 'Second' });
    expect(items[4]).toMatchObject({ id: 'm-5', role: 'system', content: 'Fifth' });
    expect(items[0].timestamp).toBe(new Date('2026-01-01T00:00:00.000Z').getTime());
    // Clears any prior error state
    expect(get(chatState).error).toBeNull();
  });

  it('hydrates the contextStore from payload.context (STC UT-HYD-01 step 6)', () => {
    hydrateChat(PAYLOAD, CONTEXT);
    const ctx = get(contextState);
    expect(ctx.tokenCount).toBe(CONTEXT.tokenCount);
    expect(ctx.maxTokens).toBe(CONTEXT.maxTokens);
    expect(ctx.files).toEqual(CONTEXT.files);
  });

  it('sets isHydrated with empty history as messages=[] (STC API-HYD-02 step 7)', () => {
    hydrateChat([]);
    expect(get(messages)).toHaveLength(0);
    expect(get(chatState).isHydrated).toBe(true);
  });

  it('ignores invalid payloads without throwing', () => {
    hydrateChat(undefined as never);
    hydrateChat(null as never);
    expect(get(messages)).toHaveLength(0);
  });
});
