/**
 * Module interface definitions for Backend service modules.
 * Each module implements IModule for consistent lifecycle management.
 */

import type { ToolHandler, ToolDefinition } from './tool.js';

export type ModuleStatus = 'initializing' | 'ready' | 'error' | 'stopped';

export interface IModule {
  readonly name: string;
  readonly status: ModuleStatus;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  getToolHandlers(): Map<string, ToolHandler>;
  getToolDefinitions(): ToolDefinition[];
}

export interface ModuleHealth {
  name: string;
  status: ModuleStatus;
  error?: string;
}
