/**
 * SA4E-191 — NewCommand unit tests (UT-13 main, UT-14 BR-3 no-confirm, UT-15 EF-1 restore).
 */
import { describe, it, expect } from 'vitest';
import { NewCommand } from '../handlers/NewCommand';
import { SessionStore } from '../stores/sessionStore';
import { ChatExchangeStore } from '../stores/chatExchangeStore';
import { makeCtx, stubUI } from './helpers';

/** Chat store whose clear() always throws to exercise EF-1 restore. */
class ThrowingChatStore extends ChatExchangeStore {
  clear(): void {
    throw new Error('boom');
  }
}

describe('NewCommand', () => {
  it('UT-13: TC-9 confirmReset=true starts a new session', async () => {
    const session = new SessionStore(makeCtx('new').session);
    const chat = new ChatExchangeStore();
    const cmd = new NewCommand(session, chat, stubUI());
    const res = await cmd.execute(makeCtx('new', { args: { confirmReset: true } }));
    expect(res.status).toBe('ok');
    expect((res.result as any).newSessionId).toBeDefined();
    expect(res.uiAction).toEqual({ type: 'panel', panel: 'emptyChat' });
    // session context/history cleared for the new session.
    expect(session.get().contextRef).toBe('');
    expect(session.get().historyRef).toBe('');
  });

  it('UT-14: TC-10 BR-3 no confirmation -> no reset (cancelled)', async () => {
    const session = new SessionStore(
      makeCtx('new', { session: { ...makeCtx('new').session, historyRef: 'hist_old' } }).session
    );
    const cmd = new NewCommand(session, new ChatExchangeStore(), stubUI({ confirm: async () => false }));
    const res = await cmd.execute(makeCtx('new'));
    expect(res.status).toBe('ok');
    expect((res.result as any).status).toBe('cancelled');
    // previous session untouched.
    expect(session.get().historyRef).toBe('hist_old');
  });

  it('UT-15: EF-1 reset failure restores previous session state', async () => {
    const session = new SessionStore(
      makeCtx('new', {
        session: {
          ...makeCtx('new').session,
          id: 'sess_keep',
          contextRef: 'ctx_keep',
          historyRef: 'hist_keep',
        },
      }).session
    );
    const cmd = new NewCommand(session, new ThrowingChatStore(), stubUI());
    const res = await cmd.execute(makeCtx('new', { args: { confirmReset: true } }));
    expect(res.status).toBe('error');
    expect(res.error?.code).toBe('RESET_FAILED');
    expect(res.error?.userMessage).toBe('Session reset failed; previous chat restored.');
    // previous session fully restored (BR-3 EF-1).
    expect(session.get().id).toBe('sess_keep');
    expect(session.get().contextRef).toBe('ctx_keep');
    expect(session.get().historyRef).toBe('hist_keep');
  });
});
