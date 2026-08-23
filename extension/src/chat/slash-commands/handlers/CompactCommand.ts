/**
 * SA4E-191 — /compact command handler (UC-2).
 * Compacts the session via SA4E-182. Empty session -> EF-2. Large context ->
 * confirm (AF-2 cancel supported). Failure -> EF-1.
 */
import type { CommandContext, CommandHandler, CommandResult, SlashCommandUI } from '../types';
import type { CompactionAdapter } from '../adapters/sa4e182CompactionAdapter';
import type { SessionStore } from '../stores/sessionStore';
import { ok, err } from '../results';

/** Token threshold above which a confirmation is requested (NFR/configurable). */
const COMPACTION_THRESHOLD = 1000;

function isEmptyHistory(historyRef: string): boolean {
  return !historyRef || historyRef.trim().length === 0;
}

function estimateTokens(contextRef: string): number {
  return Math.ceil((contextRef?.length ?? 0) / 4);
}

export class CompactCommand implements CommandHandler {
  constructor(
    private readonly adapter: CompactionAdapter,
    private readonly session: SessionStore,
    private readonly ui: SlashCommandUI
  ) {}

  async execute(ctx: CommandContext): Promise<CommandResult> {
    const snapshot = this.session.get();

    // EF-2: nothing to compact.
    if (isEmptyHistory(snapshot.historyRef)) {
      return err(ctx, 'NOTHING_TO_COMPACT', 'Nothing to compact.', false);
    }

    const tokenCount = estimateTokens(snapshot.contextRef);
    if (tokenCount > COMPACTION_THRESHOLD) {
      const confirmed = await this.ui.confirm('Compact session? Large context detected.');
      if (!confirmed) {
        // AF-2: user cancelled.
        return ok(ctx, { status: 'cancelled' });
      }
    }

    try {
      const summary = await this.adapter.compact(snapshot.id, snapshot.contextRef, snapshot.historyRef);
      this.session.update({ contextRef: summary.compactedSummaryRef });
      return ok(
        ctx,
        { compactedSummaryRef: summary.compactedSummaryRef, status: 'success' },
        { type: 'badge', label: 'Compacted' }
      );
    } catch {
      // EF-1: compaction failed.
      return err(ctx, 'COMPACTION_FAILED', 'Session compaction failed. Please try again.', true);
    }
  }
}
