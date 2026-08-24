/**
 * SA4E-191 — Command registration module.
 * Wires all 7 Tier-1 command descriptors + handlers into a registry. Called
 * once at chat-shell init (BR-1: register exactly once).
 */
import type { SlashCommandDescriptor, ModelChoice, SlashCommandUI } from './types';
import type { CommandRegistry } from './CommandRegistry';
import type { AgentRouterAdapter } from './adapters/sa4e186AgentRoutingAdapter';
import type { CompactionAdapter } from './adapters/sa4e182CompactionAdapter';
import type { FileChangeAdapter } from './adapters/sa4e183FileChangeAdapter';
import type { SessionStore } from './stores/sessionStore';
import type { ChatExchangeStore } from './stores/chatExchangeStore';
import type { ModelPreferenceStore } from './stores/modelPreferenceStore';
import type { VcsProvider } from './handlers/ReviewCommand';

import { AgentsCommand } from './handlers/AgentsCommand';
import { CompactCommand } from './handlers/CompactCommand';
import { DiffCommand } from './handlers/DiffCommand';
import { ModelsCommand } from './handlers/ModelsCommand';
import { NewCommand } from './handlers/NewCommand';
import { ReviewCommand } from './handlers/ReviewCommand';
import { UndoCommand } from './handlers/UndoCommand';

export const AGENTS_DESCRIPTOR: SlashCommandDescriptor = {
  id: 'agents',
  label: '/agents',
  icon: 'users',
  description: 'Switch the active agent for this session',
  shortcutHint: 'Ctrl/Cmd+Shift+A',
  category: 'agent',
  requiresOwner: false,
  timeoutMs: 5000,
};

export const COMPACT_DESCRIPTOR: SlashCommandDescriptor = {
  id: 'compact',
  label: '/compact',
  icon: 'compress',
  description: 'Compact the current session to reduce context size',
  shortcutHint: 'Ctrl/Cmd+Shift+C',
  category: 'session',
  requiresOwner: false,
  timeoutMs: 10000,
};

export const DIFF_DESCRIPTOR: SlashCommandDescriptor = {
  id: 'diff',
  label: '/diff',
  icon: 'git-compare',
  description: 'View file changes made during this session',
  shortcutHint: 'Ctrl/Cmd+Shift+D',
  category: 'session',
  requiresOwner: false,
  timeoutMs: 3000,
};

export const MODELS_DESCRIPTOR: SlashCommandDescriptor = {
  id: 'models',
  label: '/models',
  icon: 'cpu',
  description: 'Switch the active language model (choice is saved)',
  shortcutHint: 'Ctrl/Cmd+Shift+M',
  category: 'model',
  requiresOwner: false,
  timeoutMs: 1000,
};

export const NEW_DESCRIPTOR: SlashCommandDescriptor = {
  id: 'new',
  label: '/new',
  icon: 'file-plus',
  description: 'Start a new session and clear current context',
  shortcutHint: 'Ctrl/Cmd+Shift+N',
  category: 'session',
  requiresOwner: false,
  timeoutMs: 1000,
};

export const REVIEW_DESCRIPTOR: SlashCommandDescriptor = {
  id: 'review',
  label: '/review',
  icon: 'check-double',
  description: 'Run a code review on the current branch diff',
  shortcutHint: 'Ctrl/Cmd+Shift+R',
  category: 'review',
  requiresOwner: true,
  timeoutMs: 5000,
};

export const UNDO_DESCRIPTOR: SlashCommandDescriptor = {
  id: 'undo',
  label: '/undo',
  icon: 'undo',
  description: 'Undo the last exchange (optionally revert file changes)',
  shortcutHint: 'Ctrl/Cmd+Shift+U',
  category: 'review',
  requiresOwner: true,
  // Per-revert entry is 3 s (SA4E-183 adapter); FSD §3.7.7 caps the total
  // revert budget at ~30 s for <=10 entries, so the overall command timeout
  // is set to accommodate sequential reverts.
  timeoutMs: 30000,
};

export interface SlashCommandDeps {
  session: SessionStore;
  chat: ChatExchangeStore;
  agentAdapter: AgentRouterAdapter;
  compactionAdapter: CompactionAdapter;
  fileAdapter: FileChangeAdapter;
  modelPrefs: ModelPreferenceStore;
  modelRegistry: () => ModelChoice[];
  ui: SlashCommandUI;
  vcs: VcsProvider;
}

/** Register all 7 Tier-1 commands into the given registry. */
export function registerCommands(registry: CommandRegistry, deps: SlashCommandDeps): void {
  registry.register(AGENTS_DESCRIPTOR, new AgentsCommand(deps.agentAdapter, deps.session, deps.ui));
  registry.register(
    COMPACT_DESCRIPTOR,
    new CompactCommand(deps.compactionAdapter, deps.session, deps.ui)
  );
  registry.register(DIFF_DESCRIPTOR, new DiffCommand(deps.fileAdapter, deps.ui));
  registry.register(
    MODELS_DESCRIPTOR,
    new ModelsCommand(deps.session, deps.modelPrefs, deps.ui, deps.modelRegistry)
  );
  registry.register(NEW_DESCRIPTOR, new NewCommand(deps.session, deps.chat, deps.ui));
  registry.register(REVIEW_DESCRIPTOR, new ReviewCommand(deps.agentAdapter, deps.vcs, deps.ui));
  registry.register(UNDO_DESCRIPTOR, new UndoCommand(deps.fileAdapter, deps.chat, deps.ui));
}

/** All 7 descriptors (used by PBT/integration seeding and menu rendering). */
export function allDescriptors(): SlashCommandDescriptor[] {
  return [
    AGENTS_DESCRIPTOR,
    COMPACT_DESCRIPTOR,
    DIFF_DESCRIPTOR,
    MODELS_DESCRIPTOR,
    NEW_DESCRIPTOR,
    REVIEW_DESCRIPTOR,
    UNDO_DESCRIPTOR,
  ];
}
