/**
 * SA4E-191 — Shared test helpers (not a test file itself).
 */
import type { ChatSessionSnapshot, CommandContext, SlashCommandUI, DiffEntry, ModelChoice } from '../types';

export function makeSession(over: Partial<ChatSessionSnapshot> = {}): ChatSessionSnapshot {
  return {
    id: 'sess_test',
    userId: 'usr_1',
    ownerId: 'usr_1',
    activeAgentId: 'agent_default',
    activeModelId: 'model_gpt4o',
    contextRef: 'ctx',
    historyRef: 'hist',
    ...over,
  };
}

export function makeCtx(commandId: string, over: Partial<CommandContext> = {}): CommandContext {
  return {
    commandId,
    session: makeSession(),
    args: {},
    source: 'menu',
    ...over,
  };
}

/** Build a full SlashCommandUI stub with selective overrides. */
export function stubUI(over: Partial<SlashCommandUI> = {}): SlashCommandUI {
  return {
    confirm: async () => true,
    pickAgent: async () => null,
    pickModel: async () => null,
    showDiffViewer: () => {},
    showToast: () => {},
    showBadge: () => {},
    showEmptyChat: () => {},
    showChatBlock: () => {},
    ...over,
  };
}

export const SAMPLE_MODELS: ModelChoice[] = [
  { id: 'model_gpt4o', label: 'GPT-4o', provider: 'openai', isDefault: true },
  { id: 'model_claude', label: 'Claude 3.5', provider: 'anthropic', isDefault: false },
  { id: 'model_llama', label: 'Llama 3', provider: 'meta', isDefault: false },
];

export function sampleDiff(filePath: string, status: DiffEntry['status'] = 'modified'): DiffEntry {
  return {
    id: `d_${filePath}`,
    sessionId: 'sess_test',
    filePath,
    beforeHash: null,
    afterHash: 'b',
    status,
  };
}
