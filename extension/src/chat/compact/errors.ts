/**
 * SA4E-182 — Compact Error Classes.
 * Typed errors for compact operation failure modes.
 */

/** Thrown when compact is already in progress (mutex held) */
export class CompactAlreadyRunningError extends Error {
  constructor() {
    super('Compact already in progress');
    this.name = 'CompactAlreadyRunningError';
  }
}

/** Thrown when chat history has fewer than 3 messages */
export class InsufficientMessagesError extends Error {
  constructor() {
    super('Not enough context to compact (minimum 3 messages)');
    this.name = 'InsufficientMessagesError';
  }
}
