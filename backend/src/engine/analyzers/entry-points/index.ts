/**
 * KSA-162: Entry Point Detection Module — HTTP handlers, main, CLI, events.
 */

export { EntryPointDetector } from './EntryPointDetector.js';
export { FrameworkDetector } from './FrameworkDetector.js';
export { PatternRegistry } from './PatternRegistry.js';
export { RouteResolver } from './RouteResolver.js';
export { EntryPointStore } from './EntryPointStore.js';
export { HTTPHandlerDetector } from './detectors/HTTPHandlerDetector.js';
export { MainDetector } from './detectors/MainDetector.js';
export { CLIDetector } from './detectors/CLIDetector.js';
export { EventDetector } from './detectors/EventDetector.js';
export { ENTRY_POINT_TOOL_DEFINITION, handleEntryPointTool } from './EntryPointTool.js';

export type {
  EntryPoint,
  HTTPEntryPoint,
  EntryPointFilters,
  EntryPointQueryResult,
  RouteInfo,
  FrameworkInfo,
} from './types.js';
