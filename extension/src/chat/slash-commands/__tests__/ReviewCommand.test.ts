/**
 * SA4E-191 — ReviewCommand unit tests (UT-15 main, UT-16 EF-3, EF-1).
 */
import { describe, it, expect, vi } from 'vitest';
import { ReviewCommand, UnavailableVcsProvider } from '../handlers/ReviewCommand';
import { AgentRouterAdapter } from '../adapters/sa4e186AgentRoutingAdapter';
import type { AgentRouterBackend } from '../adapters/sa4e186AgentRoutingAdapter';
import { makeCtx, stubUI } from './helpers';

class FakeRouterBackend implements AgentRouterBackend {
  constructor(private findings: string[] = ['finding1'], private agent: string | null = 'review_agent', private throwsResolve = false, private throwsRun = false) {}
  async listAgents(): Promise<string[]> {
    return ['agent_default'];
  }
  async resolve(): Promise<string | null> {
    if (this.throwsResolve) throw new Error('down');
    return this.agent;
  }
  async runReview(): Promise<{ findings: string[] }> {
    if (this.throwsRun) throw new Error('down');
    return { findings: this.findings };
  }
}

function ownerCtx(over = {}) {
  return makeCtx('review', {
    session: { ...makeCtx('review').session, userId: 'usr_12', ownerId: 'usr_12' },
    args: { branchName: 'feature/x', branchDiff: 'diff --git' },
    ...over,
  });
}

describe('ReviewCommand', () => {
  it('UT-15: owner success streams findings', async () => {
    const ui = stubUI();
    const blockSpy = vi.spyOn(ui, 'showChatBlock');
    const cmd = new ReviewCommand(new AgentRouterAdapter(new FakeRouterBackend(['issue A', 'issue B'])), new UnavailableVcsProvider(), ui);
    const res = await cmd.execute(ownerCtx());
    expect(res.status).toBe('ok');
    expect((res.result as any).reviewFindings).toEqual(['issue A', 'issue B']);
    expect(blockSpy).toHaveBeenCalled();
  });

  it('UT-16: EF-3 non-owner denied', async () => {
    const cmd = new ReviewCommand(new AgentRouterAdapter(new FakeRouterBackend()), new UnavailableVcsProvider(), stubUI());
    const ctx = makeCtx('review', { session: { ...makeCtx('review').session, userId: 'usr_b', ownerId: 'usr_12' } });
    const res = await cmd.execute(ctx);
    expect(res.status).toBe('error');
    expect(res.error?.code).toBe('PERMISSION_DENIED');
  });

  it('EF-1: branch diff unavailable', async () => {
    const cmd = new ReviewCommand(new AgentRouterAdapter(new FakeRouterBackend()), new UnavailableVcsProvider(), stubUI());
    const res = await cmd.execute(ownerCtx({ args: {} }));
    expect(res.status).toBe('error');
    expect(res.error?.code).toBe('BRANCH_DIFF_UNAVAILABLE');
  });

  it('EF-2: review agent unavailable', async () => {
    const cmd = new ReviewCommand(new AgentRouterAdapter(new FakeRouterBackend([], null)), new UnavailableVcsProvider(), stubUI());
    const res = await cmd.execute(ownerCtx());
    expect(res.status).toBe('error');
    expect(res.error?.code).toBe('REVIEW_AGENT_UNAVAILABLE');
  });
});
