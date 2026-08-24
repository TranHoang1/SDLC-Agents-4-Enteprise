/**
 * SA4E-191 — CompactCommand unit tests (UT-06 main, UT-07 EF-2).
 */
import { describe, it, expect } from 'vitest';
import { CompactCommand } from '../handlers/CompactCommand';
import { SessionStore } from '../stores/sessionStore';
import { CompactionAdapter } from '../adapters/sa4e182CompactionAdapter';
import type { CompactionBackend } from '../adapters/sa4e182CompactionAdapter';
import { makeCtx, stubUI } from './helpers';

class FakeCompactionBackend implements CompactionBackend {
  constructor(private summary = 'ctx_sum_77', private throws = false) {}
  async compact(): Promise<{ compactedSummaryRef: string }> {
    if (this.throws) throw new Error('fail');
    return { compactedSummaryRef: this.summary };
  }
}

describe('CompactCommand', () => {
  it('UT-06: main flow (above threshold) compacts and updates contextRef', async () => {
    const session = new SessionStore(
      makeCtx('compact', { session: { ...makeCtx('compact').session, historyRef: 'hist1', contextRef: 'x'.repeat(5000) } }).session
    );
    const cmd = new CompactCommand(
      new CompactionAdapter(new FakeCompactionBackend()),
      session,
      stubUI({ confirm: async () => true })
    );
    const res = await cmd.execute(makeCtx('compact'));
    expect(res.status).toBe('ok');
    expect((res.result as any).compactedSummaryRef).toBe('ctx_sum_77');
    expect(session.get().contextRef).toBe('ctx_sum_77');
  });

  it('UT-07: EF-2 empty session -> NOTHING_TO_COMPACT', async () => {
    const session = new SessionStore(makeCtx('compact', { session: { ...makeCtx('compact').session, historyRef: '' } }).session);
    const cmd = new CompactCommand(new CompactionAdapter(new FakeCompactionBackend()), session, stubUI());
    const res = await cmd.execute(makeCtx('compact'));
    expect(res.status).toBe('error');
    expect(res.error?.code).toBe('NOTHING_TO_COMPACT');
    expect(res.error?.userMessage).toBe('Nothing to compact.');
  });

  it('EF-1: compaction failure -> COMPACTION_FAILED', async () => {
    const session = new SessionStore(
      makeCtx('compact', { session: { ...makeCtx('compact').session, historyRef: 'hist1', contextRef: 'x'.repeat(5000) } }).session
    );
    const cmd = new CompactCommand(
      new CompactionAdapter(new FakeCompactionBackend('ctx_sum_77', true)),
      session,
      stubUI({ confirm: async () => true })
    );
    const res = await cmd.execute(makeCtx('compact'));
    expect(res.status).toBe('error');
    expect(res.error?.code).toBe('COMPACTION_FAILED');
  });
});
