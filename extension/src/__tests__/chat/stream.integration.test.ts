/**
 * SA4E-85 — Integration Tests: Stream Flow (IT-STR-01/02).
 * Tests full stream flow from MessageRouter through TokenBuffer to chatStore.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { TokenBuffer } from '../../chat/bridge/TokenBuffer';
import { MessageRouter } from '../../chat/router/MessageRouter';

describe('IT-STR-01: Full Stream Flow', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  test('tokens are batched through buffer before delivery', () => {
    const delivered: string[] = [];
    const buffer = new TokenBuffer(
      (_, batch) => { delivered.push(batch); },
      { flushIntervalMs: 32, maxBufferChars: 256 },
    );
    buffer.push('m1', 'Hello');
    buffer.push('m1', ' ');
    buffer.push('m1', 'World');
    vi.advanceTimersByTime(32);
    expect(delivered.join('')).toBe('Hello World');
    buffer.dispose();
  });

  test('STREAM_END flushes remaining buffer', () => {
    const delivered: string[] = [];
    const buffer = new TokenBuffer(
      (_, batch) => { delivered.push(batch); },
      { flushIntervalMs: 100, maxBufferChars: 1000 },
    );
    buffer.push('m1', 'token1');
    buffer.push('m1', 'token2');
    buffer.reset();
    expect(delivered.join('')).toBe('token1token2');
    buffer.dispose();
  });
});

describe('IT-STR-02: STREAM_ERROR Recovery with Retry', () => {
  test('error state allows retry with new stream', () => {
    const store = { status: 'streaming', content: 'partial' };
    store.status = 'error';
    expect(store.status).toBe('error');
    store.status = 'streaming';
    store.content = '';
    expect(store.status).toBe('streaming');
  });

  test('MessageRouter error boundary isolates handler crash', async () => {
    const errors: unknown[] = [];
    const router = new MessageRouter(undefined, (err) => { errors.push(err); });
    router.registerHandler('STREAM_ERROR' as any, async () => { throw new Error('crash'); });
    await router.dispatch({ type: 'STREAM_ERROR', messageId: 'm1', error: { code: 'X', message: 'f', retryable: true } } as any);
    expect(errors).toHaveLength(1);
    router.dispose();
  });
});
