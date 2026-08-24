/**
 * SA4E-191 — /diff command handler (UC-3).
 * Queries SA4E-183 for file changes and opens the diff viewer. Empty list ->
 * AF-1 empty-state. Unavailable backend -> EF-1.
 */
import type {
  CommandContext,
  CommandHandler,
  CommandResult,
  SlashCommandUI,
  DiffEntry,
} from '../types';
import type { FileChangeAdapter } from '../adapters/sa4e183FileChangeAdapter';
import { ok, err } from '../results';

export class DiffCommand implements CommandHandler {
  constructor(private readonly adapter: FileChangeAdapter, private readonly ui: SlashCommandUI) {}

  async execute(ctx: CommandContext): Promise<CommandResult> {
    let diffs: DiffEntry[];
    try {
      diffs = await this.adapter.queryDiffs(ctx.session.id, '');
    } catch {
      // EF-1: tracking data unavailable.
      return err(ctx, 'TRACKING_UNAVAILABLE', 'No change tracking data available for this session.', false);
    }

    if (!diffs || diffs.length === 0) {
      // AF-1: empty-state message.
      const emptyState = 'No file changes in this session.';
      this.ui.showDiffViewer([], emptyState);
      return ok(ctx, { changedFiles: [] }, { type: 'panel', panel: 'diffViewer', emptyState });
    }

    this.ui.showDiffViewer(diffs);
    return ok(ctx, { changedFiles: diffs }, { type: 'panel', panel: 'diffViewer' });
  }
}
