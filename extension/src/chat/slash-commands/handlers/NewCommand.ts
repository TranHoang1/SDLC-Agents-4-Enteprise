/**
 * SA4E-191 — /new command handler (UC-5, BR-3).
 * Starts a fresh session. Explicit confirmation is mandatory (BR-3): either
 * via args.confirmReset or a UI confirm dialog. On confirm, resets chat and
 * clears context. Cancellation -> AF-1 (no change).
 */
import type { CommandContext, CommandHandler, CommandResult, SlashCommandUI } from '../types';
import type { SessionStore } from '../stores/sessionStore';
import type { ChatExchangeStore } from '../stores/chatExchangeStore';
import { ok, err } from '../results';

export class NewCommand implements CommandHandler {
  constructor(
    private readonly session: SessionStore,
    private readonly chat: ChatExchangeStore,
    private readonly ui: SlashCommandUI
  ) {}

  async execute(ctx: CommandContext): Promise<CommandResult> {
    const confirmReset =
      ctx.args.confirmReset !== undefined
        ? Boolean(ctx.args.confirmReset)
        : await this.ui.confirm('Start a new session? Current chat will be cleared.');

    // BR-3 / AF-1: no confirmation -> no reset.
    if (!confirmReset) {
      return ok(ctx, { status: 'cancelled' });
    }

    // Capture before mutating so we can restore on a mid-operation failure
    // (BR-3 EF-1: "restore previous session state").
    const snapshotBefore = { ...this.session.get() };
    try {
      const newSession = this.session.newSession();
      this.chat.clear();
      return ok(ctx, { newSessionId: newSession.id }, { type: 'panel', panel: 'emptyChat' });
    } catch {
      // EF-1: reset failed mid-operation — restore the previous session state.
      this.session.restore(snapshotBefore);
      return err(ctx, 'RESET_FAILED', 'Session reset failed; previous chat restored.', false);
    }
  }
}
