/**
 * SA4E-85 — IMessageRouter interface.
 * Defines the contract for message routing between Webview and Extension Host.
 * Strategy pattern: each message type maps to a handler function.
 */

import type { ExtensionMessage, WebviewMessage, MessageType } from '../types';

/** Async handler invoked when a matching message type arrives */
export type MessageHandler = (payload: unknown) => Promise<void>;

/**
 * Routes postMessage between Webview and Extension Host handlers.
 * Validates message structure via discriminated union on `type` field.
 */
export interface IMessageRouter {
  /** Register a handler for a specific message type (Strategy) */
  registerHandler(type: MessageType, handler: MessageHandler): void;

  /** Remove a previously registered handler */
  unregisterHandler(type: MessageType): void;

  /** Dispatch incoming Webview message to registered handler */
  dispatch(message: WebviewMessage): Promise<void>;

  /** Send typed message to Webview panel */
  postToWebview(message: ExtensionMessage): void;

  /** Check if a handler exists for the given type */
  hasHandler(type: MessageType): boolean;

  /** Dispose router and clear all handlers */
  dispose(): void;
}
