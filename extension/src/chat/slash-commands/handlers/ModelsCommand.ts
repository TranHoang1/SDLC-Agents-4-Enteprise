/**
 * SA4E-191 — /models command handler (UC-4, BR-6).
 * Opens the model picker, sets the active model, and persists the choice.
 * Persistence failure -> EF-1 (still active for the session). Invalid
 * selection -> rejected. Load-time validation handled by ModelPreferenceStore.
 */
import type {
  CommandContext,
  CommandHandler,
  CommandResult,
  SlashCommandUI,
  ModelChoice,
} from '../types';
import type { SessionStore } from '../stores/sessionStore';
import type { ModelPreferenceStore } from '../stores/modelPreferenceStore';
import { ok, err } from '../results';

export class ModelsCommand implements CommandHandler {
  constructor(
    private readonly session: SessionStore,
    private readonly prefs: ModelPreferenceStore,
    private readonly ui: SlashCommandUI,
    private readonly modelRegistry: () => ModelChoice[]
  ) {}

  async execute(ctx: CommandContext): Promise<CommandResult> {
    const models = this.modelRegistry();
    const selected = await this.ui.pickModel(models);
    if (!selected) {
      // AF-1: user cancelled.
      return ok(ctx, { activeModelId: this.session.get().activeModelId });
    }
    if (!models.some((m) => m.id === selected)) {
      return err(ctx, 'INVALID_MODEL', 'Selected model is not available.', false);
    }

    this.session.setActiveModel(selected);
    try {
      await this.prefs.save(ctx.session.userId, selected);
    } catch {
      // EF-1: persistence failure — still active for this session.
      return err(
        ctx,
        'PREF_PERSIST_FAILED',
        'Model preference could not be saved, but is active for this session.',
        false
      );
    }
    return ok(
      ctx,
      { activeModelId: selected, persistedModelId: selected },
      { type: 'toast', message: `Model set to ${selected} (saved).` }
    );
  }
}
