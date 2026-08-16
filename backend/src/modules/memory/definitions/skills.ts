/**
 * SA4E-123: Tool definition for find_skill.
 * Discovers reusable skill packs from .code-intel/skills/.
 */

export const SKILL_TOOLS = [
  {
    name: 'find_skill',
    description: 'Find reusable skill packs by keyword query. Scans .code-intel/skills/*/SKILL.md frontmatter and returns matching skill names, descriptions, and file paths.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Keywords to search for (e.g. "hono routes", "sqlite database", "vitest testing")',
        },
      },
      required: ['query'],
    },
  },
];
