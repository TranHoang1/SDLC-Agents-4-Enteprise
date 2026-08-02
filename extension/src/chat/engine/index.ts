/**
 * SA4E-85 — Engine module barrel export.
 * Public API for the chat-to-LangGraph adapter layer.
 */

export { ChatEngineAdapter } from './ChatEngineAdapter';
export type { ChatEngineAdapterDeps } from './ChatEngineAdapter';
export type { IChatEngineAdapter } from './IChatEngineAdapter';

export { StreamProtocolAdapter } from './StreamProtocolAdapter';
export type { IStreamProtocolAdapter, EngineStreamEvent, StreamChunkEvent, StreamCompleteEvent, ToolCallEvent } from './IStreamProtocolAdapter';

export { SessionManager } from './SessionManager';
export type { ISessionManager, SessionData } from './ISessionManager';

export { requiresApproval, getDangerousTools, getSafeTools } from './ToolApprovalClassifier';

export { ToolApprovalGate } from './ToolApprovalGate';
export type { ApprovalResult, RejectionReason, ApprovalMetrics, PendingSnapshot, ToolApprovalGateOptions } from './ToolApprovalGate';

export { ApprovalEventLog } from './ApprovalEventLog';
export type { ApprovalEvent, ApprovalEventLogOptions } from './ApprovalEventLog';
