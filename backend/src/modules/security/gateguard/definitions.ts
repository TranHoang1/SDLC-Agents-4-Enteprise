/**
 * SA4E-132 — GateGuard MCP Tool Definitions.
 * Defines inputSchema for gateguard_evaluate, gateguard_denylist, gateguard_audit_log.
 */

import type { ToolDefinition } from '../../../types/tool.js';

export const GATEGUARD_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'gateguard_evaluate',
    description: 'Evaluate a shell command against the GateGuard denylist. Returns allow/block decision with < 50ms latency.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to evaluate (max 4096 chars)' },
        agent: { type: 'string', description: 'Name of the requesting agent (optional)' },
        project_id: { type: 'string', description: 'Project ID for custom denylist patterns (optional)' },
      },
      required: ['command'],
    },
    category: 'utility',
  },
  {
    name: 'gateguard_denylist',
    description: 'Manage GateGuard denylist patterns: list, add, or remove custom patterns per project.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'add', 'remove'], description: 'CRUD action' },
        project_id: { type: 'string', description: 'Project ID scope (optional)' },
        pattern: { type: 'string', description: 'Regex pattern to add (required for add)' },
        pattern_id: { type: 'string', description: 'Pattern ID to remove (required for remove)' },
        description: { type: 'string', description: 'Human-readable description (for add)' },
      },
      required: ['action'],
    },
    category: 'utility',
  },
  {
    name: 'gateguard_audit_log',
    description: 'Query the GateGuard audit log. Returns recent blocked/allowed/overridden entries.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Filter by project ID (optional)' },
        limit: { type: 'number', description: 'Max entries to return (1-100, default 50)' },
        action_filter: { type: 'string', enum: ['blocked', 'overridden', 'allowed'], description: 'Filter by action type' },
      },
      required: [],
    },
    category: 'utility',
  },
];
