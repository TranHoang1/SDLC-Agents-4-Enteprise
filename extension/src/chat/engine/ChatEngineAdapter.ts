/**
 * SA4E-85 — ChatEngineAdapter (Task 1).
 * Adapter pattern: bridges src/chat/ MessageRouter to LangGraphEngine.
 * Registers message handlers for all WebviewMessage types and subscribes
 * to engine stream events, translating them via StreamProtocolAdapter.
 */

import * as vscode from 'vscode';
import type { IMessageRouter } from '../router/IMessageRouter';
import type { IPostMessageBridge } from '../bridge/IPostMessageBridge';
import type { IContextManager } from '../context/types';
import type { IToolHandler, DiffBlock } from '../tools/diffTypes';
import type { WebviewMessage, ExtensionMessage } from '../types';
import type { IChatEngineAdapter } from './IChatEngineAdapter';
import type { IStreamProtocolAdapter, EngineStreamEvent } from './IStreamProtocolAdapter';
import type { ISessionManager } from './ISessionManager';
import type { LangGraphEngine } from '../../langgraph/engine/langgraph-engine';
import type { ChatExtToWebviewMessage } from '../../chat-panel/message-protocol';
import type { ToolApprovalGate } from './ToolApprovalGate';

/**
 * Dependencies injected into ChatEngineAdapter (DIP).
 * All concrete implementations hidden behind interfaces.
 */
export interface ChatEngineAdapterDeps {
  router: IMessageRouter;
  bridge: IPostMessageBridge;
  engine: LangGraphEngine;
  streamAdapter: IStreamProtocolAdapter;
  contextManager: IContextManager;
  toolHandler: IToolHandler;
  sessionManager: ISessionManager;
  approvalGate?: ToolApprovalGate;
}

/**
 * Concrete adapter: connects MessageRouter handlers to LangGraphEngine.
 * Each WebviewMessage type maps to an engine action via Strategy dispatch.
 */
export class ChatEngineAdapter implements IChatEngineAdapter {
  private readonly deps: ChatEngineAdapterDeps;
  private connected = false;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(deps: ChatEngineAdapterDeps) {
    this.deps = deps;
  }

  /** Register all message handlers and wire engine event listener */
  initialize(): void {
    this.registerMessageHandlers();
    this.connected = true;
  }

  /** @inheritdoc */
  isConnected(): boolean {
    return this.connected;
  }

  /** @inheritdoc */
  dispose(): void {
    this.connected = false;
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
  }

  /** Register a handler for each WebviewMessage type in the router */
  private registerMessageHandlers(): void {
    const { router } = this.deps;

    router.registerHandler('SEND_PROMPT', (msg) => this.handleSendPrompt(msg));
    router.registerHandler('TOOL_CALL_RESPONSE', (msg) => this.handleToolCallResponse(msg));
    router.registerHandler('COMMAND_DISPATCH', (msg) => this.handleCommandDispatch(msg));
    router.registerHandler('ACTION_ACCEPT_DIFF', (msg) => this.handleAcceptDiff(msg));
    router.registerHandler('ACTION_REJECT_DIFF', (msg) => this.handleRejectDiff(msg));
    router.registerHandler('CONTEXT_UNPIN_FILE', (msg) => this.handleUnpinFile(msg));
    router.registerHandler('CONTEXT_CLEAR', () => this.handleClearContext());
    router.registerHandler('RUN_TERMINAL_COMMAND', (msg) => this.handleRunTerminal(msg));
    router.registerHandler('REGENERATE_PATCH', (msg) => this.handleRegenerate(msg));
  }

  /** Forward translated ExtensionMessages to webview via bridge */
  private sendToWebview(messages: ExtensionMessage[]): void {
    for (const msg of messages) {
      this.deps.bridge.postToWebview(msg);
    }
  }

  /**
   * Handle engine event from LangGraphEngine onEvent callback.
   * Called externally when engine emits a ChatExtToWebviewMessage.
   * @param event - Raw engine event to translate
   */
  handleEngineEvent(event: ChatExtToWebviewMessage): void {
    const streamEvent = this.toStreamEvent(event);
    if (!streamEvent) return;

    const messages = this.deps.streamAdapter.handleEngineEvent(streamEvent);
    this.sendToWebview(messages);
  }

  // --- Handler implementations ---

  private async handleSendPrompt(payload: unknown): Promise<void> {
    const msg = payload as Extract<WebviewMessage, { type: 'SEND_PROMPT' }>;
    await this.deps.sessionManager.ensureSession();
    await this.deps.engine.invokeChat(msg.text);
  }

  private async handleToolCallResponse(payload: unknown): Promise<void> {
    const msg = payload as Extract<WebviewMessage, { type: 'TOOL_CALL_RESPONSE' }>;
    const decision = msg.decision === 'APPROVE' ? 'approve' : 'reject';

    // SA4E-85: Resolve pending approval gate if available (unblocks executeSingleTool)
    if (this.deps.approvalGate) {
      this.deps.approvalGate.resolveApproval(msg.toolId, decision);
    }

    await this.deps.engine.handleApproval(decision as any);
  }

  private async handleCommandDispatch(payload: unknown): Promise<void> {
    const msg = payload as Extract<WebviewMessage, { type: 'COMMAND_DISPATCH' }>;
    await vscode.commands.executeCommand(msg.command, msg.args);
  }

  private async handleAcceptDiff(payload: unknown): Promise<void> {
    const msg = payload as Extract<WebviewMessage, { type: 'ACTION_ACCEPT_DIFF' }>;
    const diff: DiffBlock = {
      diffId: msg.diffId,
      filePath: msg.filePath,
      patch: msg.patch,
      fileHashAtGeneration: '',
      generatedAt: Date.now(),
      status: 'pending',
    };
    await this.deps.toolHandler.applyDiff(diff);
  }

  private async handleRejectDiff(payload: unknown): Promise<void> {
    const msg = payload as Extract<WebviewMessage, { type: 'ACTION_REJECT_DIFF' }>;
    this.deps.toolHandler.rejectDiff(msg.diffId);
  }

  private async handleUnpinFile(payload: unknown): Promise<void> {
    const msg = payload as Extract<WebviewMessage, { type: 'CONTEXT_UNPIN_FILE' }>;
    this.deps.contextManager.unpinFile(msg.filePath);
  }

  private async handleClearContext(): Promise<void> {
    this.deps.contextManager.clearAll();
  }

  private async handleRunTerminal(payload: unknown): Promise<void> {
    const msg = payload as Extract<WebviewMessage, { type: 'RUN_TERMINAL_COMMAND' }>;
    this.deps.toolHandler.runTerminalCommand(msg.command, msg.terminalName);
  }

  private async handleRegenerate(payload: unknown): Promise<void> {
    const msg = payload as Extract<WebviewMessage, { type: 'REGENERATE_PATCH' }>;
    await this.deps.toolHandler.regeneratePatch(msg.diffId, msg.filePath);
  }

  /** Convert ChatExtToWebviewMessage to EngineStreamEvent (or null) */
  private toStreamEvent(event: ChatExtToWebviewMessage): EngineStreamEvent | null {
    if (event.type === 'chat:streamChunk') {
      const e = event as any;
      if (e.eventType === 'token' || e.eventType === 'status' || e.eventType === 'error') {
        return { type: 'chat:streamChunk', streamId: e.streamId, nodeId: e.nodeId, eventType: e.eventType, content: e.content, timestamp: e.timestamp };
      }
    }
    if (event.type === 'chat:streamComplete') {
      const e = event as any;
      return { type: 'chat:streamComplete', streamId: e.streamId, nodeId: e.nodeId, finalContent: e.finalContent };
    }
    if (event.type === 'chat:toolCall') {
      return { type: 'chat:toolCall', toolCall: (event as any).toolCall };
    }
    return null;
  }
}
