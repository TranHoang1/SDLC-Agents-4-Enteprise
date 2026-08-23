/**
 * SA4E-191 — Command result helpers.
 * Small constructors to keep handler code terse and consistent.
 */
import type { CommandContext, CommandResult, UiAction } from './types';

export function ok(ctx: CommandContext, result?: unknown, uiAction?: UiAction): CommandResult {
  return { status: 'ok', commandId: ctx.commandId, result, uiAction };
}

export function err(
  ctx: CommandContext,
  code: string,
  userMessage: string,
  retryable = false
): CommandResult {
  return {
    status: 'error',
    commandId: ctx.commandId,
    error: { code, userMessage, retryable },
  };
}
