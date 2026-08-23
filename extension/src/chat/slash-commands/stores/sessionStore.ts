/**
 * SA4E-191 — Real in-process session store.
 * Holds the ChatSessionSnapshot shared by handlers. No Svelte dependency so
 * it is fully unit-testable in node. State is mutated in place by handlers.
 */
import type { ChatSessionSnapshot } from '../types';

export class SessionStore {
  private snapshot: ChatSessionSnapshot;

  constructor(initial: ChatSessionSnapshot) {
    this.snapshot = initial;
  }

  get(): ChatSessionSnapshot {
    return this.snapshot;
  }

  update(patch: Partial<ChatSessionSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
  }

  setActiveAgent(id: string): void {
    this.update({ activeAgentId: id });
  }

  setActiveModel(id: string): void {
    this.update({ activeModelId: id });
  }

  /** /new — issue a fresh session id and clear accumulated context/history. */
  newSession(): ChatSessionSnapshot {
    const next: ChatSessionSnapshot = {
      ...this.snapshot,
      id: `sess_${Math.random().toString(36).slice(2, 10)}`,
      contextRef: '',
      historyRef: '',
    };
    this.snapshot = next;
    return next;
  }

  /**
   * /new — restore a previously captured snapshot (BR-3 EF-1: reset failed
   * mid-operation, restore previous session state so no data is lost).
   */
  restore(snapshot: ChatSessionSnapshot): void {
    this.snapshot = snapshot;
  }
}
