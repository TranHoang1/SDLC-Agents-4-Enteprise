/**
 * SA4E-85 — Tool Store.
 * Tracks active tool executions and session-level approval decisions.
 * Uses Map for O(1) tool lookup and Set for approval deduplication.
 */

import { writable, derived } from 'svelte/store';
import type { ToolType } from '../../chat/types';

/** Active tool execution state displayed in UI */
export interface ActiveTool {
  toolId: string;
  name: string;
  args: Record<string, unknown>;
  toolType: ToolType;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output: string;
  requiresApproval: boolean;
}

/** Internal state for tool management */
interface ToolState {
  activeTools: Map<string, ActiveTool>;
  /** Session-level approvals by individual tool name */
  sessionApprovals: Set<string>;
  /** Session-level approvals by tool type (BR-04) */
  sessionTypeApprovals: Set<string>;
  /** Session-level command pattern approvals (e.g., "npm *", "git status") */
  sessionCommandPatterns: Set<string>;
}

const initialState: ToolState = {
  activeTools: new Map(),
  sessionApprovals: new Set(),
  sessionTypeApprovals: new Set(),
  sessionCommandPatterns: new Set(),
};

/** Core writable store for tool state */
export const toolState = writable<ToolState>(initialState);

/** Derived: active tools as array for iteration */
export const activeToolsList = derived(toolState, ($s) =>
  Array.from($s.activeTools.values())
);

/** Derived: count of pending approval tools */
export const pendingApprovalCount = derived(toolState, ($s) => {
  let count = 0;
  for (const tool of $s.activeTools.values()) {
    if (tool.status === 'pending' && tool.requiresApproval) count++;
  }
  return count;
});

/** Register a new tool call request */
export function addToolCall(tool: Omit<ActiveTool, 'status' | 'output'>): void {
  toolState.update((s) => {
    const next = new Map(s.activeTools);
    // Auto-approve if tool name or type is session-approved
    const autoApproved =
      s.sessionApprovals.has(tool.name) ||
      s.sessionTypeApprovals.has(tool.toolType);
    next.set(tool.toolId, {
      ...tool,
      status: autoApproved ? 'running' : 'pending',
      output: '',
    });
    return { ...s, activeTools: next };
  });
}

/** Append streaming output to a tool */
export function appendToolOutput(toolId: string, chunk: string): void {
  toolState.update((s) => {
    const tool = s.activeTools.get(toolId);
    if (!tool) return s;
    const next = new Map(s.activeTools);
    next.set(toolId, { ...tool, output: tool.output + chunk, status: 'running' });
    return { ...s, activeTools: next };
  });
}

/** Mark tool as completed with result */
export function completeToolCall(toolId: string, output: string): void {
  toolState.update((s) => {
    const tool = s.activeTools.get(toolId);
    if (!tool) return s;
    const next = new Map(s.activeTools);
    next.set(toolId, { ...tool, status: 'completed', output });
    return { ...s, activeTools: next };
  });
}

/** Mark tool as failed */
export function failToolCall(toolId: string, error: string): void {
  toolState.update((s) => {
    const tool = s.activeTools.get(toolId);
    if (!tool) return s;
    const next = new Map(s.activeTools);
    next.set(toolId, { ...tool, status: 'failed', output: error });
    return { ...s, activeTools: next };
  });
}

/** Add tool name to session-level auto-approve set */
export function addSessionApproval(toolName: string): void {
  toolState.update((s) => {
    const next = new Set(s.sessionApprovals);
    next.add(toolName);
    return { ...s, sessionApprovals: next };
  });
}

/** Check if a tool name is session-approved */
export function isSessionApproved(toolName: string): boolean {
  let approved = false;
  toolState.subscribe((s) => { approved = s.sessionApprovals.has(toolName); })();
  return approved;
}

/** Add tool type to session-level auto-approve set (BR-04) */
export function addSessionTypeApproval(toolType: string): void {
  toolState.update((s) => {
    const next = new Set(s.sessionTypeApprovals);
    next.add(toolType);
    return { ...s, sessionTypeApprovals: next };
  });
}

/** Check if a tool type is session-approved */
export function isSessionTypeApproved(toolType: string): boolean {
  let approved = false;
  toolState.subscribe((s) => { approved = s.sessionTypeApprovals.has(toolType); })();
  return approved;
}

/** Reset tool store */
export function resetTools(): void {
  toolState.set(initialState);
}

/** Add a command pattern to session-level auto-approve set */
export function addSessionCommandPattern(pattern: string): void {
  toolState.update((s) => {
    const next = new Set(s.sessionCommandPatterns);
    next.add(pattern);
    return { ...s, sessionCommandPatterns: next };
  });
}

/** Check if a command matches any session-approved pattern */
export function matchesSessionPattern(command: string): boolean {
  let matched = false;
  toolState.subscribe((s) => {
    for (const pattern of s.sessionCommandPatterns) {
      const regex = new RegExp("^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$", "i");
      if (regex.test(command.trim())) { matched = true; break; }
    }
  })();
  return matched;
}

/** Get all session command patterns */
export function getSessionCommandPatterns(): string[] {
  let patterns: string[] = [];
  toolState.subscribe((s) => { patterns = Array.from(s.sessionCommandPatterns); })();
  return patterns;
}

/**
 * Suggest a pattern from a concrete command.
 * Keeps first token (binary), wildcards the rest.
 * @example "npm run test" → "npm *"
 */
export function suggestCommandPattern(command: string): string {
  const parts = command.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] || command;
  return `${parts[0]} *`;
}
