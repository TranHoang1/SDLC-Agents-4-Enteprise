/**
 * SA4E-85 — Unit Tests: MessageRouter (UT-ROU-01).
 * Tests handler registration, dispatch routing, and error isolation.
 */

import { describe, it, expect, vi } from 'vitest';
import type * as vscode from 'vscode';
import { MessageRouter } from '../MessageRouter';
import type { MessageHandler } from '../IMessageRouter';
import type { MessageType, WebviewMessage } from '../../types';

function makeFakePanel() {
  return {
    webview: { postMessage: vi.fn(() => Promise.resolve(true)) },
  } as unknown as vscode.WebviewPanel;
}

describe('UT-ROU-01: MessageRouter Handler Registration', () => {
  it('registers a handler and reports it via hasHandler', () => {
    const router = new MessageRouter(undefined, vi.fn());
    const handler: MessageHandler = vi.fn(async () => undefined);
    router.registerHandler('SEND_PROMPT', handler);
    expect(router.hasHandler('SEND_PROMPT')).toBe(true);
    expect(router.hasHandler('CONTEXT_CLEAR')).toBe(false);
  });

  it('throws when registering a duplicate handler', () => {
    const router = new MessageRouter(undefined, vi.fn());
    router.registerHandler('SEND_PROMPT', vi.fn(async () => undefined));
    expect(() =>
      router.registerHandler('SEND_PROMPT', vi.fn(async () => undefined)),
    ).toThrow(/already registered/);
  });

  it('unregisters a handler', () => {
    const router = new MessageRouter(undefined, vi.fn());
    router.registerHandler('CONTEXT_CLEAR', vi.fn(async () => undefined));
    router.unregisterHandler('CONTEXT_CLEAR');
    expect(router.hasHandler('CONTEXT_CLEAR')).toBe(false);
  });
});

describe('UT-ROU-02: MessageRouter Dispatch', () => {
  it('dispatches a valid message to its registered handler', async () => {
    const router = new MessageRouter(undefined, vi.fn());
    const handler = vi.fn(async () => undefined);
    router.registerHandler('SEND_PROMPT', handler);
    const message = { type: 'SEND_PROMPT', text: 'hi', agentId: 'ba' } as WebviewMessage;
    await router.dispatch(message);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(message);
  });

  it('does not invoke handlers for unregistered message types', async () => {
    const router = new MessageRouter(undefined, vi.fn());
    const handler = vi.fn(async () => undefined);
    router.registerHandler('SEND_PROMPT', handler);
    await router.dispatch({ type: 'CONTEXT_CLEAR' } as WebviewMessage);
    expect(handler).not.toHaveBeenCalled();
  });

  it('logs an error for a message missing its type discriminant', async () => {
    const errorLogger = vi.fn();
    const router = new MessageRouter(undefined, errorLogger);
    await router.dispatch({} as unknown as WebviewMessage);
    expect(errorLogger).toHaveBeenCalledTimes(1);
    expect(errorLogger).toHaveBeenCalledWith(
      expect.any(Error),
      'UNKNOWN',
    );
  });

  it('logs an error for an unknown message type', async () => {
    const errorLogger = vi.fn();
    const router = new MessageRouter(undefined, errorLogger);
    await router.dispatch({ type: 'BOGUS_TYPE' } as unknown as WebviewMessage);
    expect(errorLogger).toHaveBeenCalledTimes(1);
    expect(errorLogger).toHaveBeenCalledWith(
      expect.any(Error),
      'BOGUS_TYPE',
    );
  });
});

describe('UT-ROU-03: Error Boundary Isolates Handler Failures', () => {
  it('logs a handler error without rejecting dispatch', async () => {
    const errorLogger = vi.fn();
    const router = new MessageRouter(undefined, errorLogger);
    const boom = new Error('handler crashed');
    router.registerHandler('COMMAND_DISPATCH', vi.fn(async () => { throw boom; }));
    await expect(
      router.dispatch({ type: 'COMMAND_DISPATCH', command: 'ls' } as WebviewMessage),
    ).resolves.toBeUndefined();
    expect(errorLogger).toHaveBeenCalledTimes(1);
    expect(errorLogger).toHaveBeenCalledWith(boom, 'COMMAND_DISPATCH');
  });
});

describe('UT-ROU-04: Webview Posting', () => {
  it('posts a message to the panel webview', () => {
    const panel = makeFakePanel();
    const router = new MessageRouter(panel, vi.fn());
    const message = { type: 'STREAM_TOKEN', messageId: 'm1', token: 'x' };
    router.postToWebview(message);
    expect(panel.webview.postMessage).toHaveBeenCalledTimes(1);
    expect(panel.webview.postMessage).toHaveBeenCalledWith(message);
  });

  it('silently skips posting when no panel exists', () => {
    const router = new MessageRouter(undefined, vi.fn());
    expect(() =>
      router.postToWebview({ type: 'STREAM_START', messageId: 'm1', agentId: 'ba' }),
    ).not.toThrow();
  });

  it('uses the panel set via setPanel', () => {
    const router = new MessageRouter(undefined, vi.fn());
    const panel = makeFakePanel();
    router.setPanel(panel);
    router.postToWebview({ type: 'STREAM_END', messageId: 'm1' });
    expect(panel.webview.postMessage).toHaveBeenCalledTimes(1);
  });
});

describe('UT-ROU-05: Disposal', () => {
  it('clears handlers and panel on dispose', () => {
    const panel = makeFakePanel();
    const router = new MessageRouter(panel, vi.fn());
    router.registerHandler('SEND_PROMPT', vi.fn(async () => undefined));
    router.dispose();
    expect(router.hasHandler('SEND_PROMPT')).toBe(false);
    router.postToWebview({ type: 'STREAM_END', messageId: 'm1' });
    expect(panel.webview.postMessage).not.toHaveBeenCalled();
  });
});
