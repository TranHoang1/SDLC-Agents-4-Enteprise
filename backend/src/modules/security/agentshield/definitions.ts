/**
 * SA4E-128 — AgentShield MCP Tool Definitions.
 * Defines inputSchema for the agentshield_scan tool.
 */

import type { ToolDefinition } from '../../../types/tool.js';

export const AGENTSHIELD_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'agentshield_scan',
    description: 'Scan AI agent config files for security vulnerabilities: hardcoded secrets, non-TLS endpoints, injection vectors, permission issues, and TLS validation gaps.',
    inputSchema: {
      type: 'object',
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of relative file paths to scan (within workspace)',
        },
        rules: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional array of rule IDs to run (e.g. ["SHIELD-001", "SHIELD-003"]). Omit to run all rules.',
        },
      },
      required: ['paths'],
    },
    category: 'utility',
  },
];
