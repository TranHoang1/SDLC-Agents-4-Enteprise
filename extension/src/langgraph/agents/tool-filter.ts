/**
 * SA4E-186 — Tool Filter
 * Pure functions for filtering tools based on agent's allowed patterns.
 * No state, no side effects — easily testable.
 */

import type { McpToolDefinition } from "../vscode/tool-registry";

/**
 * Check if a single tool name is allowed by the given patterns.
 *
 * Algorithm:
 * - patterns === undefined → true (no restriction, all tools allowed)
 * - patterns.length === 0 → false (text-only mode, no tools)
 * - Exact match: toolName === pattern
 * - Prefix wildcard: pattern ends with '*', toolName.startsWith(prefix)
 */
export function isToolAllowed(
  toolName: string,
  patterns: string[] | undefined
): boolean {
  if (patterns === undefined) return true;
  if (patterns.length === 0) return false;

  return patterns.some((pattern) => matchPattern(toolName, pattern));
}

/**
 * Filter a list of tool definitions by allowed patterns.
 * Returns the subset where isToolAllowed(tool.name, patterns) === true.
 */
export function filterTools(
  tools: McpToolDefinition[],
  patterns: string[] | undefined
): McpToolDefinition[] {
  if (patterns === undefined) return tools;
  if (patterns.length === 0) return [];

  return tools.filter((t) => isToolAllowed(t.name, patterns));
}

/**
 * Build a user-friendly error message for a blocked tool call.
 * Used when execute_tools detects a tool call that violates the filter.
 */
export function buildToolBlockedMessage(
  toolName: string,
  agentId: string,
  patterns: string[]
): string {
  const display =
    patterns.length > 5
      ? patterns.slice(0, 5).join(", ") + ` ... (${patterns.length} total)`
      : patterns.join(", ");

  return (
    `Tool '${toolName}' is not available for agent '${agentId}'. ` +
    `Allowed tools: [${display}]`
  );
}

/**
 * Match a tool name against a single pattern.
 * Supports exact match and suffix wildcard (pattern ending with '*').
 */
function matchPattern(toolName: string, pattern: string): boolean {
  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    return toolName.startsWith(prefix);
  }
  return toolName === pattern;
}
