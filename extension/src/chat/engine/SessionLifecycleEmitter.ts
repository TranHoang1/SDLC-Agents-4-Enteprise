/**
 * SA4E-183 — SessionLifecycleEmitter.
 * Observer pattern EventEmitter for session lifecycle events.
 * Decouples SessionManager from consumers (DiffTracker, future services).
 */

import { EventEmitter } from 'events';

/** Supported session lifecycle event names */
export type SessionEvent = 'session:created' | 'session:hydrated';

/**
 * Interface for session lifecycle emission (ISP).
 * Consumers subscribe; SessionManager emits.
 */
export interface ISessionLifecycleEmitter {
  on(event: 'session:created', listener: (threadId: string) => void): this;
  on(event: 'session:hydrated', listener: (threadId: string) => void): this;
  emitSessionCreated(threadId: string): void;
  emitSessionHydrated(threadId: string): void;
  dispose(): void;
}

/**
 * Concrete emitter wrapping Node.js EventEmitter.
 * Singleton per extension activation lifecycle.
 */
export class SessionLifecycleEmitter implements ISessionLifecycleEmitter {
  private readonly emitter = new EventEmitter();

  /** Subscribe to session:created events */
  on(event: 'session:created', listener: (threadId: string) => void): this;
  on(event: 'session:hydrated', listener: (threadId: string) => void): this;
  on(event: SessionEvent, listener: (threadId: string) => void): this {
    this.emitter.on(event, listener);
    return this;
  }

  /** Emit when a new session thread is created (triggers DiffTracker reset) */
  emitSessionCreated(threadId: string): void {
    this.emitter.emit('session:created', threadId);
  }

  /** Emit when an existing session thread is hydrated (no DiffTracker reset) */
  emitSessionHydrated(threadId: string): void {
    this.emitter.emit('session:hydrated', threadId);
  }

  /** Remove all listeners on deactivation */
  dispose(): void {
    this.emitter.removeAllListeners();
  }
}
