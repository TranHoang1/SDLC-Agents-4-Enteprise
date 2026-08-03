/**
 * SA4E-85 — IPostMessageBridge interface.
 * Abstraction for bidirectional postMessage communication.
 * Decouples Extension Host from concrete Webview panel reference.
 */

import type { ExtensionMessage, WebviewMessage } from '../types';

/** Listener callback for incoming Webview messages */
export type WebviewMessageListener = (message: WebviewMessage) => void;

/**
 * Bridge between Extension Host and Webview for typed messaging.
 * Handles token buffering per TDD-Review-01 requirements.
 */
export interface IPostMessageBridge {
  /** Send a typed message to the Webview */
  postToWebview(message: ExtensionMessage): void;

  /** Register listener for messages from Webview */
  onMessage(listener: WebviewMessageListener): void;

  /** Flush any buffered tokens immediately */
  flush(): void;

  /** Dispose bridge, cleanup timers, push into context.subscriptions */
  dispose(): void;
}
