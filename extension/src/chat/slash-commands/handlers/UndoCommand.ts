/**
 * SA4E-191 — /undo command handler (UC-7, BR-4, BR-5).
 * Owner-only (BR-5/EF-3). Removes the last user+agent exchange pair and
 * optionally reverts associated file changes via SA4E-183. No exchange ->
 * EF-1 (no-op). Partial revert failure -> EF-2 warning.
 */
import type {
  CommandContext,
  CommandHandler,
  CommandResult,
  SlashCommandUI,
  DiffEntry,
} from '../types';
import type { FileChangeAdapter } from '../adapters/sa4e183FileChangeAdapter';
import type { ChatExchangeStore } from '../stores/chatExchangeStore';
import { ok, err } from '../results';

/**
 * FSD §3.7.7 — cap the number of file-change reverts so the total revert
 * budget stays bounded (~30 s at 3 s/entry). Entries beyond the cap are
 * skipped and surfaced as a warning.
 */
const MAX_UNDO_REVERTS = 10;

export class UndoCommand implements CommandHandler {
  constructor(
    private readonly adapter: FileChangeAdapter,
    private readonly chat: ChatExchangeStore,
    private readonly ui: SlashCommandUI
  ) {}

  async execute(ctx: CommandContext): Promise<CommandResult> {
    // BR-5 / EF-3 — non-owner denied.
    if (ctx.session.userId !== ctx.session.ownerId) {
      return err(ctx, 'PERMISSION_DENIED', 'Permission denied.', false);
    }

    const pair = this.chat.findLastExchange();
    // EF-1: nothing to undo.
    if (!pair) {
      return err(ctx, 'NOTHING_TO_UNDO', 'Nothing to undo.', false);
    }

    let diffs: DiffEntry[] = [];
    try {
      diffs = await this.adapter.queryDiffs(ctx.session.id, pair.exchangeId);
    } catch {
      diffs = [];
    }

    const revert = Boolean(ctx.args.revertFileChanges);
    const reverted: string[] = [];
    let warning: string | undefined;

    // Bound the work to the first MAX_UNDO_REVERTS entries (FSD §3.7.7 cap).
    const revertScope = diffs.slice(0, MAX_UNDO_REVERTS);

    if (revertScope.length > 0 && revert) {
      const confirmed = await this.ui.confirm(`Revert ${revertScope.length} file change(s)?`);
      if (confirmed) {
        for (const entry of revertScope) {
          let okRevert = false;
          try {
            okRevert = await this.adapter.revert(entry);
          } catch {
            okRevert = false;
          }
          if (okRevert) reverted.push(entry.filePath);
        }
        // EF-2: some file changes could not be reverted.
        let notReverted = revertScope.length - reverted.length;
        if (diffs.length > revertScope.length) {
          notReverted += diffs.length - revertScope.length;
        }
        if (notReverted > 0) {
          warning = 'Exchange removed, but some file changes could not be reverted.';
        }
      }
    }

    this.chat.removeLastExchange();
    const result: Record<string, unknown> = {
      removedExchangeId: pair.exchangeId,
      revertedFiles: reverted,
    };
    if (warning) result.warning = warning;
    return ok(ctx, result, { type: 'toast', message: 'Last exchange undone.' });
  }
}
