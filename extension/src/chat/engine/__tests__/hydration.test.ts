/**
 * SA4E-85 — Chat state hydration flow tests (IT-HYD-01, host side).
 * REQUEST_SYNC_STATE (webview mount) → SessionManager resolves Backend KB
 * thread → SYNC_CHAT_HISTORY pushed to webview via bridge.
 * Also covers the backend-unreachable → STREAM_ERROR(retryable) path.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ExtensionMessage, WebviewMessage } from '../../../chat/types';
import type { IMessageRouter, MessageHandler } from '../../../chat/router';
import type { IPostMessageBridge } from '../../../chat/bridge';
import type { ISessionManager, HydratedMessage } from '../ISessionManager';
import type { IChatEngineAdapter } from '../IChatEngineAdapter';
import { ChatEngineAdapter, type ChatEngineAdapterDeps } from '../ChatEngineAdapter';

describe('IT-HYD-01 — REQUEST_SYNC_STATE → SYNC_CHAT_HISTORY', () => {
  const handlers = new Map<string, MessageHandler>();
  let posted: ExtensionMessage[];
  let adapter: IChatEngineAdapter;

  const router: IMessageRouter = {
    registerHandler: (type, handler) => { handlers.set(type, handler); },
    unregisterHandler: (type) => { handlers.delete(type); },
    dispatch: async () => {},
    postToWebview: () => {},
    hasHandler: (type) => handlers.has(type),
    dispose: () => {},
  };

  const bridge: IPostMessageBridge = {
    postToWebview: (msg) => { posted.push(msg); },
    onMessage: () => {},
    flush: () => {},
    dispose: () => {},
  };

  const sessionManager: ISessionManager = {
    ensureSession: vi.fn(async () => ({ thread_id: 'tid-001', started_at: '2026-01-01T00:00:00.000Z', ide: 'vscode' })),
    getSession: () => null,
    getSessionMessages: vi.fn(),
    cleanup: async () => {},
    dispose: () => {},
  };

  function buildDeps(overrides: Partial<ChatEngineAdapterDeps> = {}): ChatEngineAdapterDeps {
    return {
      router,
      bridge,
      engine: {} as ChatEngineAdapterDeps['engine'],
      streamAdapter: {
        handleEngineEvent: () => [],
        getMessageIdForStream: () => undefined,
        reset: () => {},
      },
      contextManager: { getState: () => ({ tokenCount: 0, maxTokens: 200000, files: [], usagePercent: 0, pruneSuggestions: [] }), pinFile: () => {}, unpinFile: () => {}, clearAll: () => {}, suggestPrune: () => [], onContextChanged: undefined },
      toolHandler: { applyDiff: async () => {}, rejectDiff: () => {}, runTerminalCommand: () => {}, regeneratePatch: async () => {} },
      sessionManager,
      ...overrides,
    };
  }

  beforeEach(() => {
    handlers.clear();
    posted = [];
    vi.clearAllMocks();
    adapter = new ChatEngineAdapter(buildDeps());
    adapter.initialize();
  });

  it('registers a REQUEST_SYNC_STATE handler on initialize', () => {
    expect(handlers.has('REQUEST_SYNC_STATE')).toBe(true);
  });

  it('pushes SYNC_CHAT_HISTORY with the hydrated messages when the backend has history', async () => {
    const messages: HydratedMessage[] = [
      { id: 'm-1', role: 'user', content: 'Implement COLLEX-64', timestamp: '2026-01-01T00:00:00.000Z' },
      { id: 'm-2', role: 'assistant', content: 'Plan ready', timestamp: '2026-01-01T00:00:05.000Z' },
      { id: 'm-3', role: 'user', content: 'Continue', timestamp: '2026-01-01T00:00:10.000Z' },
    ];
    vi.mocked(sessionManager.getSessionMessages).mockResolvedValue({ threadId: 'tid-001', messages });

    await handlers.get('REQUEST_SYNC_STATE')!({});

    expect(posted).toHaveLength(1);
    const msg = posted[0];
    expect(msg.type).toBe('SYNC_CHAT_HISTORY');
    if (msg.type === 'SYNC_CHAT_HISTORY') {
      expect(msg.threadId).toBe('tid-001');
      expect(msg.messages).toHaveLength(3);
      expect(msg.messages[0].content).toBe('Implement COLLEX-64');
      // TDD §4.1 / STC API-HYD-02: payload must carry context snapshot
      expect(msg.context).toBeDefined();
      expect(msg.context.maxTokens).toBe(200000);
      expect(msg.context.tokenCount).toBe(0);
    }
  });

  it('hydrates empty history with messages=[] and context (STC API-HYD-02 step 7)', async () => {
    vi.mocked(sessionManager.getSessionMessages).mockResolvedValue({ threadId: 'tid-001', messages: [] });
    await handlers.get('REQUEST_SYNC_STATE')!({});
    expect(posted).toHaveLength(1);
    const msg = posted[0];
    expect(msg.type).toBe('SYNC_CHAT_HISTORY');
    if (msg.type === 'SYNC_CHAT_HISTORY') {
      expect(msg.messages).toEqual([]);
      expect(msg.context).toBeDefined();
    }
  });

  it('does NOT post when there is no history to hydrate', async () => {
    vi.mocked(sessionManager.getSessionMessages).mockResolvedValue(null);
    await handlers.get('REQUEST_SYNC_STATE')!({});
    expect(posted).toHaveLength(0);
  });

  it('surfaces a recoverable STREAM_ERROR when backend hydration fails', async () => {
    vi.mocked(sessionManager.getSessionMessages).mockRejectedValue(new Error('ECONNREFUSED'));
    await handlers.get('REQUEST_SYNC_STATE')!({});
    expect(posted).toHaveLength(1);
    const msg = posted[0];
    expect(msg.type).toBe('STREAM_ERROR');
    if (msg.type === 'STREAM_ERROR') {
      expect(msg.error.retryable).toBe(true);
      expect(msg.error.code).toBe('SYNC_STATE_FAILED');
    }
  });

  it('SEND_PROMPT resolves the session before invoking the engine', async () => {
    const engineSpy = { invokeChat: vi.fn(async () => {}) };
    const adapter2 = new ChatEngineAdapter(buildDeps({ engine: engineSpy as unknown as ChatEngineAdapterDeps['engine'] }));
    adapter2.initialize();
    const send = handlers.get('SEND_PROMPT')!;
    await send({ type: 'SEND_PROMPT', text: 'hello', agentId: 'default' });
    expect(sessionManager.ensureSession).toHaveBeenCalled();
    expect(engineSpy.invokeChat).toHaveBeenCalledWith('hello');
  });
});
