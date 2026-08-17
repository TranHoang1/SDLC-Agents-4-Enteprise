/**
 * SA4E-166 — OnboardingToolHandler: MCP tool handler for onboarding_generate.
 * Validates input with zod, delegates to OnboardingService, returns ToolResult.
 * Same pattern as AgentShieldToolHandler for consistency.
 */

import type { Logger } from 'pino';
import type { ToolHandler, ToolResult } from '../../../types/tool.js';
import type { IOnboardingService } from './models.js';
import { OnboardingInputSchema } from './models.js';

/** Create text ToolResult helper */
function textResult(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data) }], isError: false };
}

/** Create error ToolResult helper */
function errorResult(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

export class OnboardingToolHandler {
  constructor(
    private readonly service: IOnboardingService,
    private readonly logger: Logger,
  ) {}

  /** Build Map of tool name to handler function */
  getHandlers(): Map<string, ToolHandler> {
    const handlers = new Map<string, ToolHandler>();
    handlers.set('onboarding_generate', this.handleGenerate.bind(this));
    return handlers;
  }

  /** onboarding_generate — analyze codebase and generate ONBOARDING.md */
  private async handleGenerate(args: Record<string, unknown>): Promise<ToolResult> {
    const parsed = OnboardingInputSchema.safeParse(args);
    if (!parsed.success) {
      return errorResult(`Validation error: ${parsed.error.message}`);
    }

    const { force } = parsed.data;
    this.logger.debug({ force }, 'onboarding_generate');

    const result = await this.service.generate(force);
    return textResult(result);
  }
}
