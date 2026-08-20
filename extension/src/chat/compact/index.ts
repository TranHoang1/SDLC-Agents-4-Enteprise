/**
 * SA4E-182 — Compact module factory + barrel exports.
 * Creates and wires all compact components. Called during extension activation.
 */

import type { CompactTrigger } from './types';
import { CompactConfig } from './CompactConfig';
import type { WorkspaceConfig } from './CompactConfig';
import { CompactService } from './CompactService';
import type { LlmProvider, StreamHandler, StateGraph, ContextManagerReader, KnowledgeClient } from './CompactService';
import { CompactMonitor } from './CompactMonitor';
import type { ContextManagerSubscription } from './CompactMonitor';
import { CompactCommand } from './CompactCommand';
import type { PipelineStateProvider } from './CompactCommand';

// --- Re-exports (barrel) ---
export type {
  CompactTrigger,
  CompactMethod,
  CompactRequest,
  CompactResult,
  CompactEvent,
  CompactStartEvent,
  CompactCompleteEvent,
  CompactErrorEvent,
  CompactStreamEvent,
  CompactMonitorState,
  ChatMessage as CompactChatMessage,
} from './types';
export { CompactConfig } from './CompactConfig';
export type { CompactSettings, WorkspaceConfig } from './CompactConfig';
export { CompactService } from './CompactService';
export type { LlmProvider, StreamHandler, StateGraph, ContextManagerReader, KnowledgeClient } from './CompactService';
export { CompactMonitor } from './CompactMonitor';
export type { ContextManagerSubscription, CompactTriggerFn } from './CompactMonitor';
export { CompactCommand } from './CompactCommand';
export type { PipelineStateProvider } from './CompactCommand';
export { CompactAlreadyRunningError, InsufficientMessagesError } from './errors';
export { filterSecrets, containsSecrets } from './secretFilter';

/** Assembled compact module returned from factory */
export interface CompactModule {
  service: CompactService;
  monitor: CompactMonitor;
  command: CompactCommand;
  dispose: () => void;
}

/** Dependencies required to create the compact module */
export interface CompactModuleDeps {
  llmProvider: LlmProvider;
  contextManager: ContextManagerSubscription & ContextManagerReader;
  streamHandler: StreamHandler;
  graph: StateGraph;
  knowledgeClient: KnowledgeClient | null;
  workspace: WorkspaceConfig;
  stateProvider: PipelineStateProvider;
}

/**
 * Create and wire the compact module. Called once during activation.
 * @param deps - Injected dependencies (DIP: all abstractions)
 * @returns Assembled module with dispose function for cleanup
 */
export function createCompactModule(deps: CompactModuleDeps): CompactModule {
  const config = new CompactConfig(deps.workspace);

  const monitorState = {
    isCompacting: false,
    debounceActive: false,
    lastThresholdCrossing: null,
  };

  const service = new CompactService(
    deps.llmProvider,
    deps.contextManager,
    deps.streamHandler,
    deps.graph,
    deps.knowledgeClient,
    monitorState
  );

  const triggerFn = async (trigger: CompactTrigger) => {
    const state = deps.stateProvider();
    await service.executeCompact(trigger, state.threadId, state.chatHistory);
  };

  const monitor = new CompactMonitor(deps.contextManager, config, triggerFn);
  const command = new CompactCommand(service, deps.stateProvider);

  monitor.start();

  return {
    service,
    monitor,
    command,
    dispose: () => {
      monitor.stop();
      config.dispose();
    },
  };
}
