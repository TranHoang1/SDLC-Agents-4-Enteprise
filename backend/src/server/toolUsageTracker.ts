/**
 * toolUsageTracker — non-blocking per-tool usage increment (SA4E-18).
 * Shared by mcpServer CallTool and OrchestrationModule.execute_dynamic_tool.
 */

import type { Logger } from 'pino';
import type { ModuleRegistry } from '../modules/ModuleRegistry.js';
import type { MemoryModule } from '../modules/memory/MemoryModule.js';

/** Non-blocking per-tool usage increment (BR-07/BR-09/BR-10). Never throws. */
export function trackToolUsage(
  registry: ModuleRegistry, logger: Logger, toolName: string,
): void {
  try {
    if (!toolName || typeof toolName !== 'string') return;
    const mem = registry.getModule('memory') as MemoryModule | undefined;
    if (mem?.status === 'ready') mem.getEngine().incrementToolUsage(toolName);
  } catch (err) {
    logger.warn({ err, toolName }, 'tool_usage increment failed — non-blocking (BR-09)');
  }
}
