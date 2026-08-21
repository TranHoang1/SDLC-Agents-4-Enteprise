/**
 * SA4E-85 — Chat Types barrel export.
 * Central re-export for all chat message protocol types.
 */

export type {
  ExtensionMessage,
  WebviewMessage,
  StreamError,
  ToolType,
  ToolResult,
  AgentMeta,
  ContextFile,
  ServiceStatus,
  MessageType,
  ExtensionMessageType,
  WebviewMessageType,
} from './messages';

export type { DiffSummaryPayload, ChangeEntryPayload } from '../diff/IDiffTracker';
