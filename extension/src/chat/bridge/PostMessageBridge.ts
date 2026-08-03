/**
 * SA4E-85 — PostMessageBridge implementation.
 * Bidirectional communication layer between Extension Host and Webview.
 * Integrates TokenBuffer for STREAM_TOKEN batching (TDD-Review-01).
 * MUST be pushed into ExtensionContext.subscriptions for cleanup.
 */

import type * as vscode from 'vscode';
import type { ExtensionMessage, WebviewMessage } from '../types';
import type { IPostMessageBridge, WebviewMessageListener } from './IPostMessageBridge';
import { TokenBuffer } from './TokenBuffer';

/**
 * Concrete bridge managing postMessage with token buffering.
 * Lifecycle: dispose() cleans up timers and listeners.
 */
export class PostMessageBridge implements IPostMessageBridge {
  private readonly listeners: WebviewMessageListener[] = [];
  private readonly tokenBuffer: TokenBuffer;
  private readonly disposables: vscode.Disposable[] = [];
  private panel: vscode.WebviewPanel | undefined;

  constructor(panel: vscode.WebviewPanel | undefined) {
    this.panel = panel;
    this.tokenBuffer = new TokenBuffer((msgId, batch) => {
      this.sendRaw({ type: 'STREAM_TOKEN', messageId: msgId, token: batch });
    });

    if (panel) {
      this.attachPanel(panel);
    }
  }

  /** Send message to Webview, with token buffering for STREAM_TOKEN */
  postToWebview(message: ExtensionMessage): void {
    if (message.type === 'STREAM_TOKEN') {
      // Buffer tokens to reduce postMessage frequency
      this.tokenBuffer.push(message.messageId, message.token);
      return;
    }

    // STREAM_END triggers flush of remaining buffered tokens
    if (message.type === 'STREAM_END') {
      this.tokenBuffer.reset();
    }

    this.sendRaw(message);
  }

  /** Register a listener for messages arriving from the Webview */
  onMessage(listener: WebviewMessageListener): void {
    this.listeners.push(listener);
  }

  /** Force flush buffered tokens immediately */
  flush(): void {
    this.tokenBuffer.flush();
  }

  /** Attach or re-attach to a webview panel */
  attachPanel(panel: vscode.WebviewPanel): void {
    this.panel = panel;
    const sub = panel.webview.onDidReceiveMessage((msg: unknown) => {
      this.handleIncoming(msg as WebviewMessage);
    });
    this.disposables.push(sub);
  }

  /** Dispose bridge — cleans up buffer timers and listeners */
  dispose(): void {
    this.tokenBuffer.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables.length = 0;
    this.listeners.length = 0;
    this.panel = undefined;
  }

  /** Direct send bypassing buffer (for non-STREAM_TOKEN messages) */
  private sendRaw(message: ExtensionMessage): void {
    if (!this.panel?.webview) return;
    this.panel.webview.postMessage(message);
  }

  /** Route incoming message to all registered listeners */
  private handleIncoming(message: WebviewMessage): void {
    for (const listener of this.listeners) {
      try {
        listener(message);
      } catch (err) {
        console.error('[PostMessageBridge] Listener error:', err);
      }
    }
  }
}
