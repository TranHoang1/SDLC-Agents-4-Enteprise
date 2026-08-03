/**
 * SA4E-85 — MessageRouter implementation.
 * Central dispatcher using Strategy pattern. Each message type maps to
 * exactly one handler. Error boundary per handler prevents cascade failures.
 */

import type * as vscode from 'vscode';
import type { ExtensionMessage, WebviewMessage, MessageType } from '../types';
import type { IMessageRouter, MessageHandler } from './IMessageRouter';
import { isValidMessageType } from './messageValidator';

/**
 * Concrete MessageRouter that dispatches messages by type discriminant.
 * Implements error isolation — one handler crash does not kill the router.
 */
export class MessageRouter implements IMessageRouter {
  private readonly handlers = new Map<MessageType, MessageHandler>();
  private panel: vscode.WebviewPanel | undefined;
  private readonly errorLogger: (error: unknown, type: string) => void;

  constructor(
    panel: vscode.WebviewPanel | undefined,
    errorLogger?: (error: unknown, type: string) => void
  ) {
    this.panel = panel;
    // Default error logger uses console; injectable for testing (DIP)
    this.errorLogger = errorLogger ?? this.defaultErrorLog;
  }

  /** @inheritdoc */
  registerHandler(type: MessageType, handler: MessageHandler): void {
    if (this.handlers.has(type)) {
      throw new Error(`Handler already registered for type: ${type}`);
    }
    this.handlers.set(type, handler);
  }

  /** @inheritdoc */
  unregisterHandler(type: MessageType): void {
    this.handlers.delete(type);
  }

  /**
   * Dispatch message to registered handler with error boundary.
   * Validates message structure before dispatch.
   */
  async dispatch(message: WebviewMessage): Promise<void> {
    if (!message || typeof message.type !== 'string') {
      this.errorLogger(new Error('Invalid message: missing type'), 'UNKNOWN');
      return;
    }

    if (!isValidMessageType(message.type)) {
      this.errorLogger(new Error(`Unknown message type: ${message.type}`), message.type);
      return;
    }

    const handler = this.handlers.get(message.type);
    if (!handler) {
      // No handler registered — silently skip (not all types need handlers)
      return;
    }

    try {
      await handler(message);
    } catch (error) {
      // Error boundary: isolate handler failures
      this.errorLogger(error, message.type);
    }
  }

  /** @inheritdoc */
  postToWebview(message: ExtensionMessage): void {
    if (!this.panel?.webview) {
      return;
    }
    this.panel.webview.postMessage(message);
  }

  /** @inheritdoc */
  hasHandler(type: MessageType): boolean {
    return this.handlers.has(type);
  }

  /** Update the panel reference (e.g., after panel recreation) */
  setPanel(panel: vscode.WebviewPanel | undefined): void {
    this.panel = panel;
  }

  /** @inheritdoc */
  dispose(): void {
    this.handlers.clear();
    this.panel = undefined;
  }

  private defaultErrorLog(error: unknown, type: string): void {
    console.error(`[MessageRouter] Handler error for "${type}":`, error);
  }
}
