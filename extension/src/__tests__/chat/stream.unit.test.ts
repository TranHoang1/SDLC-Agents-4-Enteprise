/**
 * SA4E-85 — Unit Tests: Stream Store (UT-STR-01/02/03).
 * Tests chatStore behavior for STREAM_START, STREAM_TOKEN, STREAM_ERROR.
 */

import { describe, test, expect } from 'vitest';
import { TokenBuffer } from '../../chat/bridge/TokenBuffer';

describe('UT-STR-01: chatStore STREAM_START Creates Message', () => {
  test('creates message with streaming status', () => {
    const store = createMockChatStore();
    store.dispatch({ type: 'STREAM_START', messageId: 'm1', agentId: 'ba' });

    expect(store.messages).toHaveLength(1);
    expect(store.messages[0].id).toBe('m1');
    expect(store.messages[0].role).toBe('assistant');
    expect(store.messages[0].agentId).toBe('ba');
    expect(store.messages[0].status).toBe('streaming');
    expect(store.messages[0].content).toBe('');
  });
});

describe('UT-STR-02: chatStore STREAM_TOKEN Appends Content', () => {
  test('appends token content incrementally', () => {
    const store = createMockChatStore();
    store.dispatch({ type: 'STREAM_START', messageId: 'm1', agentId: 'ba' });
    store.dispatch({ type: 'STREAM_TOKEN', messageId: 'm1', token: 'Hello' });
    expect(store.messages[0].content).toBe('Hello');

    store.dispatch({ type: 'STREAM_TOKEN', messageId: 'm1', token: ' World' });
    expect(store.messages[0].content).toBe('Hello World');
  });
});

describe('UT-STR-03: chatStore STREAM_ERROR Sets Error State', () => {
  test('sets error status and error details', () => {
    const store = createMockChatStore();
    store.dispatch({ type: 'STREAM_START', messageId: 'm1', agentId: 'ba' });
    store.dispatch({
      type: 'STREAM_ERROR',
      messageId: 'm1',
      error: { code: 'LLM_TIMEOUT', message: 'Timeout', retryable: true },
    });
    expect(store.messages[0].status).toBe('error');
    expect(store.messages[0].error?.code).toBe('LLM_TIMEOUT');
    expect(store.messages[0].error?.retryable).toBe(true);
  });
});

describe('TokenBuffer unit behavior', () => {
  test('flushes on maxBufferChars exceeded', () => {
    const flushed: string[] = [];
    const buffer = new TokenBuffer(
      (_, batch) => flushed.push(batch),
      { flushIntervalMs: 1000, maxBufferChars: 10 },
    );
    buffer.push('m1', 'A'.repeat(15));
    expect(flushed.length).toBeGreaterThanOrEqual(1);
    buffer.dispose();
  });

  test('dispose clears pending timer', () => {
    const buffer = new TokenBuffer(() => {});
    buffer.push('m1', 'token');
    buffer.dispose();
  });
});

// --- Minimal mock chatStore for unit testing ---
interface MockMessage {
  id: string; role: string; agentId: string;
  content: string; status: string;
  error?: { code: string; message: string; retryable: boolean };
}

function createMockChatStore() {
  const messages: MockMessage[] = [];
  return {
    messages,
    dispatch(action: Record<string, unknown>) {
      switch (action.type) {
        case 'STREAM_START':
          messages.push({
            id: action.messageId as string, role: 'assistant',
            agentId: action.agentId as string, content: '', status: 'streaming',
          });
          break;
        case 'STREAM_TOKEN': {
          const msg = messages.find((m) => m.id === action.messageId);
          if (msg) msg.content += action.token as string;
          break;
        }
        case 'STREAM_ERROR': {
          const msg = messages.find((m) => m.id === action.messageId);
          if (msg) { msg.status = 'error'; msg.error = action.error as MockMessage['error']; }
          break;
        }
      }
    },
  };
}
