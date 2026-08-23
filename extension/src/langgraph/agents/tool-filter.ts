/**
 * SA4E-186 — Tool Filter
 * Pure functions for filtering tools based on agent's allowed patterns.
 * No state, no side effects — easily testable.
 */

import type { McpToolDefinition } from "../vscode/tool-registry";

/**
 * Category shortcuts that expand to multiple tool patterns.
 * Agents declare categories in frontmatter (e.g. tools: ["read", "write", "shell"])
 * and this map resolves them to actual tool names.
 */
const TOOL_CATEGORIES: Record<string, string[]> = {
  read: ["read_file", "list_directory", "search_text", "get_diagnostics", "get_open_files"],
  write: ["write_file"],
  shell: ["execute_shell"],
  web: ["web_search", "fetch_url"],
};

/**
 * Check if a single tool name is allowed by the given patterns.
 *
 * Algorithm:
 * - patterns === undefined → true (no restriction, all tools allowed)
 * - patterns.length === 0 → false (text-only mode, no tools)
 * - "@" prefix: pattern starts with "@" → tool name starts with pattern
 * - Prefix wildcard: pattern ends with '*', toolName.startsWith(prefix)
 * - Exact match: toolName === pattern
 * - Category match: pattern appears as a segment in toolName (split by _ or -)
 *   e.g. "shell" matches "execute_shell", "read" matches "read_file"
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
 *
 * Matching strategies (checked in order):
 * 1. Category shortcut: pattern is a key in TOOL_CATEGORIES → check tool in category
 * 2. "@" prefix: pattern starts with "@" → tool name starts with pattern
 * 3. Suffix wildcard: pattern ends with "*" → tool name starts with prefix
 * 4. Exact match: tool name === pattern
 * 5. Segment match: pattern appears as a word segment in toolName (split by _ or -)
 *    e.g. "diagnostics" matches "get_diagnostics"
 */
function matchPattern(toolName: string, pattern: string): boolean {
  // Category shortcut: "read" → expands to read_file, list_directory, etc.
  if (pattern in TOOL_CATEGORIES) {
    return TOOL_CATEGORIES[pattern].includes(toolName);
  }
  // MCP server prefix match: "@mcp" matches "@mcp/server/tool"
  if (pattern.startsWith("@")) {
    return toolName.startsWith(pattern);
  }
  // Suffix wildcard: "read*" matches "read_file", "read_code", etc.
  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    return toolName.startsWith(prefix);
  }
  // Exact match (fastest path)
  if (toolName === pattern) return true;
  // Segment match: "shell" matches "execute_shell"
  const segments = toolName.split(/[-_]/);
  return segments.includes(pattern);
}
