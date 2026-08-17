/**
 * Unit tests — EventBus (typed pub/sub bus).
 * Verifies on/once/off subscriptions, unsubscribe functions, async emission
 * ordering, subscriber error isolation, clear(), and event constants.
 */

import { describe, it, expect, vi } from 'vitest';
import { EventBus, Events } from '../EventBus.js';

describe('EventBus', () => {
  it('delivers payloads to on() subscribers', async () => {
    const bus = new EventBus();
    const cb = vi.fn();
    bus.on('evt', cb);
    await bus.emit('evt', { a: 1 });
    expect(cb).toHaveBeenCalledWith({ a: 1 });
  });

  it('does not call subscribers for events without listeners', async () => {
    const bus = new EventBus();
    await expect(bus.emit('nothing', 1)).resolves.toBeUndefined();
  });

  it('supports multiple subscribers on the same event', async () => {
    const bus = new EventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('evt', a);
    bus.on('evt', b);
    await bus.emit('evt', 'x');
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('off() removes a specific handler only', async () => {
    const bus = new EventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('evt', a);
    bus.on('evt', b);
    bus.off('evt', a);
    await bus.emit('evt', 1);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('off() on an unknown event or non-registered handler is safe', async () => {
    const bus = new EventBus();
    const cb = vi.fn();
    expect(() => bus.off('missing', cb)).not.toThrow();
    bus.on('evt', cb);
    expect(() => bus.off('evt', vi.fn())).not.toThrow();
  });

  it('once() fires a single time then self-removes', async () => {
    const bus = new EventBus();
    const cb = vi.fn();
    bus.once('evt', cb);
    await bus.emit('evt', 1);
    await bus.emit('evt', 2);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(1);
  });

  it('on() returns an unsubscribe function', async () => {
    const bus = new EventBus();
    const cb = vi.fn();
    const unsubscribe = bus.on('evt', cb);
    unsubscribe();
    await bus.emit('evt', 1);
    expect(cb).not.toHaveBeenCalled();
  });

  it('once() also returns a working unsubscribe function', async () => {
    const bus = new EventBus();
    const cb = vi.fn();
    const unsubscribe = bus.once('evt', cb);
    unsubscribe();
    await bus.emit('evt', 1);
    expect(cb).not.toHaveBeenCalled();
  });

  it('awaits async subscribers and preserves ordering', async () => {
    const bus = new EventBus();
    const order: string[] = [];
    bus.on('evt', async () => { await new Promise(r => setTimeout(r, 10)); order.push('slow'); });
    bus.on('evt', async () => { order.push('fast'); });
    await bus.emit('evt', null);
    expect(order).toEqual(['slow', 'fast']);
  });

  it('isolates subscriber errors so the bus never crashes', async () => {
    const bus = new EventBus();
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const bad = vi.fn(() => { throw new Error('boom'); });
    const good = vi.fn();
    bus.on('evt', bad as any);
    bus.on('evt', good);
    await expect(bus.emit('evt', 1)).resolves.toBeUndefined();
    expect(good).toHaveBeenCalledTimes(1);
    expect(debug).toHaveBeenCalled();
    debug.mockRestore();
  });

  it('clear() removes all handlers', async () => {
    const bus = new EventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('e1', a);
    bus.on('e2', b);
    bus.clear();
    await bus.emit('e1', 1);
    await bus.emit('e2', 2);
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it('exposes the Events constants map', () => {
    expect(Events.MODULE_READY).toBe('module:ready');
    expect(Events.ALL_MODULES_READY).toBe('all:modules:ready');
    expect(Events.TOOLS_INGESTED).toBe('tools:ingested');
    expect(Events.LLM_CONFIG_CHANGED).toBe('llm:config:changed');
  });
});