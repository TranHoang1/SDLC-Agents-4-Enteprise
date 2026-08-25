/**
 * SA4E-191 — Adapter for SA4E-186 (Agent Runtime Routing).
 * Thin wrapper for agent listing, role resolution, and review dispatch with
 * timeout/fallback. When SA4E-186 is not yet present, the default backend
 * degrades gracefully.
 */
import { DependencyUnavailableError, withTimeout } from './timeout';

export interface AgentRouterBackend {
  listAgents(): Promise<string[]>;
  resolve(role: string): Promise<string | null>;
  runReview(branchDiff: string): Promise<{ findings: string[] }>;
}

/** Default backend used when SA4E-186 engine is absent. */
export class UnavailableAgentRouterBackend implements AgentRouterBackend {
  async listAgents(): Promise<string[]> {
    throw new DependencyUnavailableError('SA4E-186');
  }
  async resolve(): Promise<string | null> {
    throw new DependencyUnavailableError('SA4E-186');
  }
  async runReview(): Promise<{ findings: string[] }> {
    throw new DependencyUnavailableError('SA4E-186');
  }
}

export class AgentRouterAdapter {
  constructor(
    private readonly backend: AgentRouterBackend = new UnavailableAgentRouterBackend(),
    private readonly timeoutMs = 5000
  ) {}

  async listAgents(): Promise<string[]> {
    try {
      return await withTimeout(this.backend.listAgents(), this.timeoutMs);
    } catch (e) {
      if (e instanceof DependencyUnavailableError) throw e;
      throw new DependencyUnavailableError('SA4E-186', (e as Error).message);
    }
  }

  async resolve(role: string): Promise<string | null> {
    try {
      return await withTimeout(this.backend.resolve(role), this.timeoutMs);
    } catch (e) {
      if (e instanceof DependencyUnavailableError) throw e;
      throw new DependencyUnavailableError('SA4E-186', (e as Error).message);
    }
  }

  async runReview(branchDiff: string): Promise<{ findings: string[] }> {
    try {
      return await withTimeout(this.backend.runReview(branchDiff), this.timeoutMs);
    } catch (e) {
      if (e instanceof DependencyUnavailableError) throw e;
      throw new DependencyUnavailableError('SA4E-186', (e as Error).message);
    }
  }
}
