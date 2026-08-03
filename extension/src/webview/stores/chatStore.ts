/**
 * SA4E-85 — Chat Store.
 * Manages chat message list, streaming state, and current message tracking.
 * Reactive Svelte writable store for the Chat UI conversation view.
 */

import { writable, derived } from 'svelte/store';
import type { HydratedMessagePayload, HydrationContext } from '../../chat/types';
import { updateContext } from './contextStore';

/** A single chat message in the conversation */
export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  isThinkingActive?: boolean;
  timestamp: number;
  agentId?: string;
}

/** Internal state shape for the chat store */
interface ChatState {
  messages: ChatMessageItem[];
  isStreaming: boolean;
  currentMessageId: string | null;
  error: string | null;
  isHydrated: boolean;
}

const initialState: ChatState = {
  messages: [],
  isStreaming: false,
  currentMessageId: null,
  error: null,
  isHydrated: false,
};

/** Core writable store holding all chat state */
export const chatState = writable<ChatState>(initialState);

/** Derived: only the messages array for rendering */
export const messages = derived(chatState, ($s) => $s.messages);

/** Derived: whether streaming is active */
export const isStreaming = derived(chatState, ($s) => $s.isStreaming);

/** Derived: current error if any */
export const chatError = derived(chatState, ($s) => $s.error);

/** Start a new streaming message */
export function startStream(messageId: string, agentId: string): void {
  chatState.update((s) => ({
    ...s,
    isStreaming: true,
    currentMessageId: messageId,
    error: null,
    messages: [...s.messages, {
      id: messageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      agentId,
    }],
  }));
}

/** Append token to the current streaming message */
export function appendToken(messageId: string, token: string): void {
  chatState.update((s) => ({
    ...s,
    messages: s.messages.map((m) =>
      m.id === messageId ? { ...m, content: m.content + token } : m
    ),
  }));
}

/** End the current stream */
export function endStream(messageId: string): void {
  chatState.update((s) => ({
    ...s,
    isStreaming: false,
    currentMessageId: null,
  }));
}

/** Set stream error state */
export function setStreamError(messageId: string, error: string): void {
  chatState.update((s) => ({
    ...s,
    isStreaming: false,
    currentMessageId: null,
    error,
  }));
}

/** Add a user message to the conversation */
export function addUserMessage(id: string, text: string): void {
  chatState.update((s) => ({
    ...s,
    error: null,
    messages: [...s.messages, {
      id,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }],
  }));
}

/** Clear all messages and reset state */
export function clearChat(): void {
  chatState.set(initialState);
}

/**
 * SA4E-85 v3.1: Hydrate chat from Backend KB history (SYNC_CHAT_HISTORY).
 * Replaces the current message list with persisted thread messages.
 * Also populates the contextStore from the payload context (STC UT-HYD-01 step 6).
 */
export function hydrateChat(
  messages: HydratedMessagePayload[],
  context?: HydrationContext
): void {
  // Empty history still hydrates with messages=[] (STC API-HYD-02 step 7)
  if (!Array.isArray(messages)) { return; }
  const items = messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    agentId: m.agentId,
    timestamp: new Date(m.timestamp).getTime() || Date.now(),
  }));
  chatState.update((s) => ({
    ...s,
    error: null,
    isHydrated: true,
    messages: items,
  }));
  if (context) {
    updateContext(context.tokenCount, context.maxTokens, context.files);
  }
}

/** Start thinking block for a streaming message (THINKING_START) */
export function startThinking(messageId: string): void {
  chatState.update((s) => ({
    ...s,
    messages: s.messages.map((m) =>
      m.id === messageId ? { ...m, thinking: '', isThinkingActive: true } : m
    ),
  }));
}

/** Append token to thinking block (THINKING_TOKEN) */
export function appendThinkingToken(messageId: string, token: string): void {
  chatState.update((s) => ({
    ...s,
    messages: s.messages.map((m) =>
      m.id === messageId ? { ...m, thinking: (m.thinking ?? '') + token } : m
    ),
  }));
}

/** End thinking block (THINKING_END) */
export function endThinking(messageId: string): void {
  chatState.update((s) => ({
    ...s,
    messages: s.messages.map((m) =>
      m.id === messageId ? { ...m, isThinkingActive: false } : m
    ),
  }));
}
