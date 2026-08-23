/**
 * SA4E-191 — AgentsCommand unit tests (UT-03 main, UT-04 EF-1, UT-05 EF-2).
 */
import { describe, it, expect } from 'vitest';
import { AgentsCommand } from '../handlers/AgentsCommand';
import { SessionStore } from '../stores/sessionStore';
import { AgentRouterAdapter } from '../adapters/sa4e186AgentRoutingAdapter';
import type { AgentRouterBackend } from '../adapters/sa4e186AgentRoutingAdapter';
import { makeCtx, stubUI } from './helpers';

class FakeRouterBackend implements AgentRouterBackend {
  constructor(private agents: string[], private throws = false) {}
  async listAgents(): Promise<string[]> {
    if (this.throws) throw new Error('down');
    return this.agents;
  }
  async resolve(): Promise<string | null> {
    return 'review_agent';
  }
  async runReview(): Promise<{ findings: string[] }> {
    return { findings: [] };
  }
}

describe('AgentsCommand', () => {
  it('UT-03: main flow updates active agent', async () => {
    const agents = ['agent_default', 'agent_coder', 'agent_reviewer'];
    const session = new SessionStore(makeCtx('agents').session);
    const cmd = new AgentsCommand(
      new AgentRouterAdapter(new FakeRouterBackend(agents)),
      session,
      stubUI({ pickAgent: async () => 'agent_coder' })
    );
    const res = await cmd.execute(makeCtx('agents'));
    expect(res.status).toBe('ok');
    expect(session.get().activeAgentId).toBe('agent_coder');
    expect((res.result as any).activeAgentId).toBe('agent_coder');
  });

  it('UT-04: EF-1 routing unavailable -> no change', async () => {
    const session = new SessionStore(makeCtx('agents').session);
    const cmd = new AgentsCommand(
      new AgentRouterAdapter(new FakeRouterBackend([], true)),
      session,
      stubUI({ pickAgent: async () => 'agent_coder' })
    );
    const res = await cmd.execute(makeCtx('agents'));
    expect(res.status).toBe('error');
    expect(res.error?.code).toBe('AGENT_ROUTING_UNAVAILABLE');
    expect(session.get().activeAgentId).toBe('agent_default');
  });

  it('UT-05: EF-2 invalid agent id -> rejected', async () => {
    const agents = ['agent_default', 'agent_coder'];
    const session = new SessionStore(makeCtx('agents').session);
    const cmd = new AgentsCommand(
      new AgentRouterAdapter(new FakeRouterBackend(agents)),
      session,
      stubUI({ pickAgent: async () => 'agent_ghost' })
    );
    const res = await cmd.execute(makeCtx('agents'));
    expect(res.status).toBe('error');
    expect(res.error?.code).toBe('INVALID_AGENT');
    expect(res.error?.userMessage).toBe('Selected agent is not available.');
  });
});
