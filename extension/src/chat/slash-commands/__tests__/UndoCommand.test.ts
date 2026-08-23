/**
 * SA4E-191 — UndoCommand unit tests (UT-16 main, UT-17 EF-1, UT-18 BR-4 revert,
 * UT-19 EF-3 non-owner, partial revert warning).
 */
import { describe, it, expect, vi } from 'vitest';
import { UndoCommand } from '../handlers/UndoCommand';
import { FileChangeAdapter } from '../adapters/sa4e183FileChangeAdapter';
import type { FileChangeBackend } from '../adapters/sa4e183FileChangeAdapter';
import type { DiffEntry } from '../types';
import { ChatExchangeStore } from '../stores/chatExchangeStore';
import { makeCtx, stubUI, sampleDiff } from './helpers';

class FakeFileChangeBackend implements FileChangeBackend {
  constructor(
    private diffs: DiffEntry[] = [],
    private revertResults: boolean[] = [],
    private throws = false
  ) {}
  async queryDiffs(): Promise<DiffEntry[]> {
    if (this.throws) throw new Error('down');
    return this.diffs;
  }
  async revert(_entry: DiffEntry): Promise<boolean> {
    const r = this.revertResults.shift();
    return r ?? true;
  }
}

function ownerCtx(over = {}) {
  return makeCtx('undo', { ...over });
}

function seededChat(exchangeId = 'exch_55'): ChatExchangeStore {
  const chat = new ChatExchangeStore();
  chat.addExchange({ exchangeId, userMessageId: 'u1', agentMessageId: 'a1' });
  return chat;
}

describe('UndoCommand', () => {
  it('UT-16: TC-13 main flow removes last exchange (no revert)', async () => {
    const chat = seededChat();
    const ui = stubUI();
    const removeSpy = vi.spyOn(chat, 'removeLastExchange');
    const cmd = new UndoCommand(new FileChangeAdapter(new FakeFileChangeBackend([])), chat, ui);
    const res = await cmd.execute(ownerCtx());
    expect(res.status).toBe('ok');
    expect((res.result as any).removedExchangeId).toBe('exch_55');
    expect((res.result as any).revertedFiles).toEqual([]);
    expect(removeSpy).toHaveBeenCalledOnce();
  });

  it('UT-17: TC-14 EF-1 no exchange -> NOTHING_TO_UNDO', async () => {
    const chat = new ChatExchangeStore();
    const cmd = new UndoCommand(new FileChangeAdapter(new FakeFileChangeBackend([])), chat, stubUI());
    const res = await cmd.execute(ownerCtx());
    expect(res.status).toBe('error');
    expect(res.error?.code).toBe('NOTHING_TO_UNDO');
    expect(res.error?.userMessage).toBe('Nothing to undo.');
  });

  it('UT-18: TC-15 BR-4 revert file changes', async () => {
    const chat = seededChat();
    const diffs = [sampleDiff('src/app.ts'), sampleDiff('src/util.ts')];
    const cmd = new UndoCommand(
      new FileChangeAdapter(new FakeFileChangeBackend(diffs, [true, true])),
      chat,
      stubUI({ confirm: async () => true })
    );
    const res = await cmd.execute(ownerCtx({ args: { revertFileChanges: true } }));
    expect(res.status).toBe('ok');
    expect((res.result as any).revertedFiles).toEqual(['src/app.ts', 'src/util.ts']);
    expect(chat.size).toBe(0);
  });

  it('UT-19: EF-3 non-owner denied', async () => {
    const chat = seededChat();
    const cmd = new UndoCommand(
      new FileChangeAdapter(new FakeFileChangeBackend([])),
      chat,
      stubUI()
    );
    const res = await cmd.execute(
      ownerCtx({ session: { ...makeCtx('undo').session, userId: 'usr_b', ownerId: 'usr_12' } })
    );
    expect(res.status).toBe('error');
    expect(res.error?.code).toBe('PERMISSION_DENIED');
  });

  it('partial revert reports a warning and lists only reverted files', async () => {
    const chat = seededChat();
    const diffs = [sampleDiff('src/app.ts'), sampleDiff('src/util.ts')];
    const cmd = new UndoCommand(
      new FileChangeAdapter(new FakeFileChangeBackend(diffs, [true, false])),
      chat,
      stubUI({ confirm: async () => true })
    );
    const res = await cmd.execute(ownerCtx({ args: { revertFileChanges: true } }));
    expect(res.status).toBe('ok');
    expect((res.result as any).revertedFiles).toEqual(['src/app.ts']);
    expect((res.result as any).warning).toBe(
      'Exchange removed, but some file changes could not be reverted.'
    );
  });

  it('declines revert when user cancels the prompt (AF-2)', async () => {
    const chat = seededChat();
    const diffs = [sampleDiff('src/app.ts')];
    const cmd = new UndoCommand(
      new FileChangeAdapter(new FakeFileChangeBackend(diffs, [true])),
      chat,
      stubUI({ confirm: async () => false })
    );
    const res = await cmd.execute(ownerCtx({ args: { revertFileChanges: true } }));
    expect(res.status).toBe('ok');
    expect((res.result as any).revertedFiles).toEqual([]);
  });
});
