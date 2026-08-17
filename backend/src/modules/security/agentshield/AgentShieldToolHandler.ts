/**
 * SA4E-128 — AgentShieldToolHandler: MCP tool handler for agentshield_scan.
 * Validates input with zod, delegates to scanner, returns ToolResult.
 * Same pattern as GateGuardToolHandler for consistency.
 */

import type { Logger } from 'pino';
import type { ToolHandler, ToolResult } from '../../../types/tool.js';
import type { IAgentShieldScanner } from './models.js';
import { ScanInputSchema } from './models.js';

/** Create text ToolResult helper */
function textResult(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data) }], isError: false };
}

/** Create error ToolResult helper */
function errorResult(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

export class AgentShieldToolHandler {
  constructor(
    private readonly scanner: IAgentShieldScanner,
    private readonly logger: Logger,
  ) {}

  /** Build Map of tool name to handler function */
  getHandlers(): Map<string, ToolHandler> {
    const handlers = new Map<string, ToolHandler>();
    handlers.set('agentshield_scan', this.handleScan.bind(this));
    return handlers;
  }

  /** agentshield_scan — scan config files for security issues */
  private async handleScan(args: Record<string, unknown>): Promise<ToolResult> {
    const parsed = ScanInputSchema.safeParse(args);
    if (!parsed.success) {
      return errorResult(`Validation error: ${parsed.error.message}`);
    }

    const { paths, rules } = parsed.data;
    this.logger.debug({ pathCount: paths.length, rules }, 'agentshield_scan');

    const result = await this.scanner.scan(paths, rules);
    return textResult(result);
  }
}
