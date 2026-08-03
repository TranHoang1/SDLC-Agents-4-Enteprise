/**
 * SA4E-85 — Agent Registry Interface (Task 3.1).
 * Defines the contract for discovering and watching agent configuration files.
 * Observer Pattern: consumers subscribe to onAgentsChanged for reactive updates.
 */

import type { Event } from 'vscode';
import type { AgentMeta } from '../types';

/**
 * Registry for discovering agents from .code-intel/agents/*.md files.
 * Watches filesystem for hot-reload (BR-11: <2s latency).
 */
export interface IAgentRegistry {
  /** Get all currently registered agents */
  getAgents(): AgentMeta[];

  /** Get a specific agent by ID, or undefined if not found */
  getAgent(agentId: string): AgentMeta | undefined;

  /** Start watching the filesystem for agent file changes */
  startWatching(): void;

  /** Stop watching and release all resources */
  dispose(): void;

  /** Event fired when the agent list changes (add/remove/update) */
  onAgentsChanged: Event<AgentMeta[]>;
}
