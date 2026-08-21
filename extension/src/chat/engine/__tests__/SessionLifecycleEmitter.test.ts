/**
 * SA4E-183 — SessionLifecycleEmitter unit tests.
 * Tests: emit, subscribe, multiple listeners, dispose.
 */

import { describe, it, expect, vi } from 'vitest';
import { SessionLifecycleEmitter } from '../SessionLifecycleEmitter';

describe('SessionLifecycleEmitter', () => {
  it('emits session:created event with threadId', () => {
    const emitter = new SessionLifecycleEmitter();
    const listener = vi.fn();
    emitter.on('session:created', listener);

    emitter.emitSessionCreated('thread-123');
    expect(listener).toHaveBeenCalledWith('thread-123');
    emitter.dispose();
  });

  it('emits session:hydrated event with threadId', () => {
    const emitter = new SessionLifecycleEmitter();
    const listener = vi.fn();
    emitter.on('session:hydrated', listener);

    emitter.emitSessionHydrated('thread-456');
    expect(listener).toHaveBeenCalledWith('thread-456');
    emitter.dispose();
  });

  it('supports multiple listeners for same event', () => {
    const emitter = new SessionLifecycleEmitter();
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    emitter.on('session:created', listener1);
    emitter.on('session:created', listener2);

    emitter.emitSessionCreated('thread-789');
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
    emitter.dispose();
  });

  it('dispose removes all listeners', () => {
    const emitter = new SessionLifecycleEmitter();
    const listener = vi.fn();
    emitter.on('session:created', listener);
    emitter.dispose();

    emitter.emitSessionCreated('thread-xyz');
    expect(listener).not.toHaveBeenCalled();
  });

  it('supports chaining on()', () => {
    const emitter = new SessionLifecycleEmitter();
    const l1 = vi.fn();
    const l2 = vi.fn();
    const result = emitter.on('session:created', l1).on('session:hydrated', l2);
    expect(result).toBe(emitter);
    emitter.dispose();
  });
});
