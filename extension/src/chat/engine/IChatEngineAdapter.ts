/**
 * SA4E-85 — IChatEngineAdapter interface.
 * Defines the contract for bridging the SA4E-85 chat module
 * (MessageRouter + PostMessageBridge) to the LangGraph engine.
 */

import type * as vscode from 'vscode';

/**
 * Adapter interface bridging new message protocol to LangGraph engine.
 * Registers handlers in MessageRouter and subscribes to engine events.
 */
export interface IChatEngineAdapter extends vscode.Disposable {
  /** Initialize: register all message handlers and engine listeners */
  initialize(): void;

  /** Check if the adapter is connected and operational */
  isConnected(): boolean;
}
