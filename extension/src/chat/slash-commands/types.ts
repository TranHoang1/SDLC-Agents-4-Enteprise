/**
 * SA4E-191 — Slash Command core types.
 * Mirrors TDD §2.1 exactly. The uniform handler contract every Tier-1
 * command implements. UI boundary is abstracted via SlashCommandUI so
 * handlers stay testable without a DOM.
 */

export type UiActionType = 'toast' | 'badge' | 'dialog' | 'panel' | 'chatBlock';

export interface SlashCommandDescriptor {
  /** 'agents' | 'compact' | 'diff' | 'models' | 'new' | 'review' | 'undo' */
  id: string;
  label: string;
  icon: string;
  description: string;
  shortcutHint: string;
  category: string;
  requiresOwner: boolean;
  timeoutMs: number;
}

export interface ChatSessionSnapshot {
  id: string;
  userId: string;
  ownerId: string;
  activeAgentId: string;
  activeModelId: string;
  contextRef: string;
  historyRef: string;
}

export interface CommandContext {
  commandId: string;
  session: ChatSessionSnapshot;
  args: Record<string, unknown>;
  source: 'menu' | 'shortcut' | 'typed';
}

export interface CommandError {
  code: string;
  userMessage: string;
  retryable?: boolean;
}

export interface UiAction {
  type: UiActionType;
  [k: string]: unknown;
}

export interface CommandResult {
  status: 'ok' | 'error';
  commandId: string;
  result?: unknown;
  error?: CommandError;
  uiAction?: UiAction;
}

export interface CommandHandler {
  execute(ctx: CommandContext): CommandResult | Promise<CommandResult>;
}

export interface DiffEntry {
  id: string;
  sessionId: string;
  filePath: string;
  beforeHash: string | null;
  afterHash: string | null;
  status: 'added' | 'modified' | 'deleted';
}

export interface ModelChoice {
  id: string;
  label: string;
  provider: string;
  isDefault: boolean;
}

export interface ModelPreference {
  userId: string;
  modelId: string;
  updatedAt: string;
}

/**
 * UI boundary abstraction. Handlers depend on this interface rather than the
 * DOM so they can be unit-tested with a stub. Production wiring supplies a
 * real implementation that drives dialogs/panels/toasts.
 */
export interface SlashCommandUI {
  confirm(message: string): Promise<boolean>;
  pickAgent(agents: string[]): Promise<string | null>;
  pickModel(models: ModelChoice[]): Promise<string | null>;
  showDiffViewer(changedFiles: DiffEntry[], emptyState?: string): void;
  showToast(message: string): void;
  showBadge(label: string): void;
  showEmptyChat(): void;
  showChatBlock(findings: string[]): void;
}
