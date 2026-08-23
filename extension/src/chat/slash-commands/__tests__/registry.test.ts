/**
 * SA4E-191 — CommandRegistry unit tests (UT-01, UT-02, BR-1, BR-2, BR-5, NFR-07-T, NFR-08-T).
 */
import { describe, it, expect, vi } from 'vitest';
import { CommandRegistry } from '../CommandRegistry';
import { InMemoryAuditSink } from '../audit';
import type { SlashCommandDescriptor, CommandContext, CommandHandler } from '../types';
import { makeCtx } from './helpers';

function desc(id: string, over: Partial<SlashCommandDescriptor> = {}): SlashCommandDescriptor {
  return {
    id,
    label: `/${id}`,
    icon: 'x',
    description: id,
    shortcutHint: `SC_${id}`,
    category: 'c',
    requiresOwner: false,
    timeoutMs: 1000,
    ...over,
  };
}

function dummy(result = { ok: true }): CommandHandler {
  return {
    execute: (ctx: CommandContext) => ({ status: 'ok', commandId: ctx.commandId, result }),
  };
}

describe('CommandRegistry — BR-1 register once', () => {
  it('UT-01: duplicate register throws', () => {
    const r = new CommandRegistry();
    r.register(desc('agents'), dummy());
    expect(() => r.register(desc('agents'), dummy())).toThrow(/already registered/);
  });

  it('PBT-01: 7 distinct descriptors register without collision', () => {
    const r = new CommandRegistry();
    for (const id of ['agents', 'compact', 'diff', 'models', 'new', 'review', 'undo']) {
      r.register(desc(id), dummy());
      expect(r.resolve(id)).not.toBeNull();
    }
    expect(r.resolve('ghost')).toBeNull();
  });
});

describe('CommandRegistry — BR-2 shortcut uniqueness', () => {
  it('duplicate shortcutHint throws', () => {
    const r = new CommandRegistry();
    r.register(desc('a', { shortcutHint: 'SC_X' }), dummy());
    expect(() => r.register(desc('b', { shortcutHint: 'SC_X' }), dummy())).toThrow(/Shortcut hint/);
  });
});

describe('CommandRegistry — BR-5 owner-only + dispatch', () => {
  it('UT-02: non-owner /review denied before handler runs', async () => {
    const r = new CommandRegistry();
    const handler = { execute: vi.fn(async () => ({ status: 'ok', commandId: 'review' })) };
    r.register(desc('review', { requiresOwner: true }), handler);
    const ctx = makeCtx('review', { session: { ...makeCtx('review').session, userId: 'usr_b', ownerId: 'usr_12' } });
    const res = await r.dispatch(ctx);
    expect(res.status).toBe('error');
    expect(res.error?.code).toBe('PERMISSION_DENIED');
    expect(handler.execute).not.toHaveBeenCalled();
  });

  it('UT-02: owner /review executes handler', async () => {
    const r = new CommandRegistry();
    const handler = { execute: vi.fn(async () => ({ status: 'ok', commandId: 'review' })) };
    r.register(desc('review', { requiresOwner: true }), handler);
    const res = await r.dispatch(makeCtx('review'));
    expect(res.status).toBe('ok');
    expect(handler.execute).toHaveBeenCalledOnce();
  });
});

describe('CommandRegistry — NFR-07-T rate limit', () => {
  it('exceeding 20 req/min for same session+command returns RATE_LIMITED', async () => {
    const r = new CommandRegistry();
    r.register(desc('agents'), dummy());
    let okCount = 0;
    let limited = false;
    for (let i = 0; i < 25; i++) {
      const res = await r.dispatch(makeCtx('agents'));
      if (res.status === 'ok') okCount++;
      else if (res.error?.code === 'RATE_LIMITED') limited = true;
    }
    expect(okCount).toBeGreaterThanOrEqual(20);
    expect(limited).toBe(true);
  });
});

describe('CommandRegistry — unknown + audit', () => {
  it('unknown command returns UNKNOWN_COMMAND', async () => {
    const r = new CommandRegistry();
    const res = await r.dispatch(makeCtx('ghost'));
    expect(res.status).toBe('error');
    expect(res.error?.code).toBe('UNKNOWN_COMMAND');
  });

  it('NFR-08-T: one audit event emitted per invocation', async () => {
    const sink = new InMemoryAuditSink();
    const r = new CommandRegistry({ auditSink: sink });
    r.register(desc('agents'), dummy());
    await r.dispatch(makeCtx('agents'));
    const events = sink.getAll();
    expect(events.length).toBe(1);
    expect(events[0].command).toBe('agents');
    expect(events[0].userId).toBe('usr_1');
    expect(events[0].target).toBe('sess_test');
    expect(events[0].status).toBe('ok');
  });
});
