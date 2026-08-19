/**
 * SA4E-182 — CompactCommand.
 * Handles /compact slash command registration and execution dispatch.
 * Delegates entirely to CompactService — no logic here (SRP).
 */

import type { CompactResult, ChatMessage } from './types';
import type { CompactService } from './CompactService';

/** Pipeline state provider (DIP — injected function) */
export type PipelineStateProvider = () => {
  threadId: string;
  chatHistory: ChatMessage[];
};

/**
 * Slash command handler for /compact.
 * Reads current pipeline state and delegates to CompactService.
 */
export class CompactCommand {
  constructor(
    private readonly compactService: CompactService,
    private readonly stateProvider: PipelineStateProvider
  ) {}

  /**
   * Execute /compact command (called from SlashMenu selection).
   * @returns CompactResult on success
   * @throws CompactAlreadyRunningError or InsufficientMessagesError
   */
  async execute(): Promise<CompactResult> {
    const state = this.stateProvider();
    return this.compactService.executeCompact(
      'manual',
      state.threadId,
      state.chatHistory
    );
  }
}
