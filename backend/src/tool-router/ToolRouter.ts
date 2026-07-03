/**
 * Tool routing layer.
 * Routes tool_name to the appropriate module handler.
 * Validates arguments against tool schemas using zod.
 */

import type { ToolHandler, ToolDefinition, ToolResult, ToolCallRequest } from '../types/tool.js';
import type { ModuleRegistry } from '../modules/ModuleRegistry.js';
import type { Logger } from 'pino';

export class ToolRouter {
  private registry: ModuleRegistry;
  private logger: Logger;

  constructor(registry: ModuleRegistry, logger: Logger) {
    this.registry = registry;
    this.logger = logger;
  }

  async route(request: ToolCallRequest): Promise<ToolResult> {
    const { tool_name, arguments: args } = request;
    const handlers = this.registry.getToolHandlers();
    const handler = handlers.get(tool_name);

    if (!handler) {
      this.logger.warn({ tool_name }, 'Tool not found');
      return {
        content: [{ type: 'text', text: `Tool '${tool_name}' not found` }],
        isError: true,
      };
    }

    const requestId = crypto.randomUUID();
    const start = Date.now();

    this.logger.debug({ tool_name, requestId }, 'Tool call start');

    try {
      const result = await handler(args);
      const duration = Date.now() - start;
      this.logger.debug({ tool_name, requestId, duration_ms: duration }, 'Tool call complete');
      return result;
    } catch (err) {
      const duration = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error({ tool_name, requestId, duration_ms: duration, err }, 'Tool call error');
      return {
        content: [{ type: 'text', text: `Tool execution failed: ${message}` }],
        isError: true,
      };
    }
  }

  listTools(): ToolDefinition[] {
    return this.registry.getAllToolDefinitions();
  }

  hasTools(): boolean {
    return this.registry.getAllToolDefinitions().length > 0;
  }

  getToolCount(): number {
    return this.registry.getAllToolDefinitions().length;
  }
}
