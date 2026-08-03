/**
 * SA4E-85 — Agent Store.
 * Tracks available agents, selected agent, and loading state.
 * Synced from Extension Host via SYNC_AVAILABLE_AGENTS messages.
 */

import { writable, derived } from 'svelte/store';
import type { AgentMeta } from '../../chat/types';

/** Internal state shape for agent management */
interface AgentState {
  agents: AgentMeta[];
  selectedAgentId: string | null;
  isLoading: boolean;
}

const initialState: AgentState = {
  agents: [],
  selectedAgentId: null,
  isLoading: true,
};

/** Core writable store for agent state */
export const agentState = writable<AgentState>(initialState);

/** Derived: list of available agents */
export const agents = derived(agentState, ($s) => $s.agents);

/** Derived: currently selected agent ID */
export const selectedAgentId = derived(agentState, ($s) => $s.selectedAgentId);

/** Derived: the full selected agent metadata */
export const selectedAgent = derived(agentState, ($s) =>
  $s.agents.find((a) => a.id === $s.selectedAgentId) ?? null
);

/** Derived: loading indicator */
export const isAgentLoading = derived(agentState, ($s) => $s.isLoading);

/** Sync agents from Extension Host broadcast */
export function syncAgents(agents: AgentMeta[]): void {
  agentState.update((s) => ({
    ...s,
    agents,
    isLoading: false,
    // Auto-select first agent if none selected
    selectedAgentId: s.selectedAgentId ?? agents[0]?.id ?? null,
  }));
}

/** Select a specific agent by ID */
export function selectAgent(agentId: string): void {
  agentState.update((s) => ({ ...s, selectedAgentId: agentId }));
}

/** Reset to initial loading state */
export function resetAgents(): void {
  agentState.set(initialState);
}
