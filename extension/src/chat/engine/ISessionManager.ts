/**
 * SA4E-85 — ISessionManager interface (v3.1).
 * Defines the contract for chat session resolution. Sessions are resolved
 * from the Backend Knowledge Service (multi-IDE hydrate) — there is no local
 * session file anymore. thread_id is the Backend KB UUID v4.
 */

import type * as vscode from 'vscode';

/** Persisted session data (thread resolved from Backend KB) */
export interface SessionData {
  thread_id: string;
  started_at: string;
  ide: string;
}

/** A hydrated chat message for webview rehydration (SYNC_CHAT_HISTORY). */
export interface HydratedMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agentId?: string;
  timestamp: string;
}

/**
 * Manages chat session lifecycle. Stateless: thread_id is resolved from the
 * Backend KB on each activate — no local disk writes (Task 4 / v3.1).
 */
export interface ISessionManager extends vscode.Disposable {
  /** Ensure a session exists (resolve active thread or create one in Backend KB) */
  ensureSession(): Promise<SessionData>;

  /** Get the cached session data (or null if none resolved yet) */
  getSession(): SessionData | null;

  /** Resolve the current thread + its message history from Backend KB (hydration). */
  getSessionMessages(): Promise<{ threadId: string; messages: HydratedMessage[] } | null>;

  /** Clean up session cache on deactivation */
  cleanup(): Promise<void>;
}
