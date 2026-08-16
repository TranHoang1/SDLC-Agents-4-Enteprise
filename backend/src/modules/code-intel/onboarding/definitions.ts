/**
 * SA4E-166 — Onboarding tool definitions for MCP registration.
 * Exports ONBOARDING_TOOL_DEFINITIONS array consumed by CodeIntelModule.
 */

import type { ToolDefinition } from '../../../types/tool.js';

export const ONBOARDING_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'onboarding_generate',
    description:
      'Analyze codebase structure and generate an ONBOARDING.md file with project overview, ' +
      'architecture, entry points, dependencies, development setup, and module reference. ' +
      'Uses cache by default — pass force=true to regenerate.',
    inputSchema: {
      type: 'object',
      properties: {
        force: {
          type: 'boolean',
          description: 'Force regeneration bypassing cache (default: false)',
        },
      },
      required: [],
    },
    category: 'code',
  },
];
