/**
 * SA4E-182 — Compact Session Types.
 * Interfaces, DTOs, and enums for the context compaction module.
 * Defines trigger sources, results, events, and monitor state.
 */

/** Trigger source for compact operation */
export type CompactTrigger = 'manual' | 'auto';

/** Method used for context reduction */
export type CompactMethod = 'summary' | 'truncation';

/** Input to CompactService.executeCompact() */
export interface CompactRequest {
  trigger: CompactTrigger;
  threadId: string;
  chatHistory: ChatMessage[];
  maxTokens: number;
  currentTokens: number;
}

/** Minimal chat message shape consumed by compact (DIP: no coupling to full type) */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

/** Result of compact operation */
export interface CompactResult {
  success: boolean;
  method: CompactMethod;
  summary: string;
  beforeUsagePercent: number;
  afterUsagePercent: number;
  beforeTokens: number;
  afterTokens: number;
  messagesRemoved: number;
  timestamp: string;
}

/** Compact event persisted to KB thread */
export interface CompactEvent {
  id: string;
  threadId: string;
  trigger: CompactTrigger;
  method: CompactMethod;
  beforeTokens: number;
  afterTokens: number;
  beforeMessageCount: number;
  summary: string;
  createdAt: string;
}

/** Stream event: compact operation started */
export interface CompactStartEvent {
  type: 'COMPACT_START';
  trigger: CompactTrigger;
  currentUsagePercent: number;
}

/** Stream event: compact operation completed successfully */
export interface CompactCompleteEvent {
  type: 'COMPACT_COMPLETE';
  method: CompactMethod;
  beforeUsagePercent: number;
  afterUsagePercent: number;
  summary: string;
}

/** Stream event: compact operation failed */
export interface CompactErrorEvent {
  type: 'COMPACT_ERROR';
  error: string;
  fallbackApplied: boolean;
}

/** Union of all compact stream events */
export type CompactStreamEvent =
  | CompactStartEvent
  | CompactCompleteEvent
  | CompactErrorEvent;

/** In-memory monitor state (shared between monitor and service for mutex) */
export interface CompactMonitorState {
  isCompacting: boolean;
  debounceActive: boolean;
  lastThresholdCrossing: number | null;
}
