/**
 * SA4E-85 — Components barrel export.
 * All Phase 2 + Phase 3 + Phase 5 chat UI components + utility modules.
 */

export { default as ChatPanel } from './ChatPanel.svelte';
export { default as ChatHeader } from './ChatHeader.svelte';
export { default as ChatInput } from './ChatInput.svelte';
export { default as ChatMessageList } from './ChatMessageList.svelte';
export { default as ChatMessage } from './ChatMessage.svelte';
export { default as ThinkingBlock } from './ThinkingBlock.svelte';
export { default as AgentSelector } from './AgentSelector.svelte';
export { default as SlashCommandAutocomplete } from './SlashCommandAutocomplete.svelte';

// Phase 5: Tool Execution components
export { default as ToolSpinner } from './ToolSpinner.svelte';
export { default as TerminalLogBlock } from './TerminalLogBlock.svelte';
export { default as ArtifactLinkButton } from './ArtifactLinkButton.svelte';
export { default as PermissionGuard } from './PermissionGuard.svelte';
export { default as ActionableDiff } from './ActionableDiff.svelte';

// Phase 6: Context Management components
export { default as ContextBadge } from './ContextBadge.svelte';

// Phase 7: IPC Bridge components
export { default as ServiceOfflineWarning } from './ServiceOfflineWarning.svelte';
export { default as DeepLinkButton } from './DeepLinkButton.svelte';

// Phase 8: Diagram rendering
export { default as DiagramBlock } from './DiagramBlock.svelte';

export { createStreamBatcher } from './streamBatcher';
export type { StreamBatcher } from './streamBatcher';

export { computeVisibleRange } from './virtualScroll';
export type { VirtualScrollConfig, VirtualScrollRange } from './virtualScroll';
