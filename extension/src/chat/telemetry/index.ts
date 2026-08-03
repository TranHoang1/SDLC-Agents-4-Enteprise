/**
 * SA4E-85 — Telemetry module barrel export.
 * Local-only JSONL telemetry service and hook functions.
 */

export { TelemetryService } from './TelemetryService';
export {
  logDiffAction,
  logToolExec,
  logContextPrune,
  logStreamError,
  logPermissionDecision,
} from './telemetryHooks';
export type {
  ITelemetryService,
  TelemetryEntry,
  DiffActionEntry,
  ToolExecEntry,
  ContextPruneEntry,
  StreamErrorEntry,
  PermissionDecisionEntry,
} from './types';
