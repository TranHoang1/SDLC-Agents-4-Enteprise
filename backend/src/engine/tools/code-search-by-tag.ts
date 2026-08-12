/**
 * SA4E-107: MCP tool — search symbols by LLM-generated tags.
 * Supports full tag match (design-pattern:factory) or category prefix search.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { DatabaseAdapter } from '../../database/adapters/DatabaseAdapter.js';

/** Tool definition for register-tools.ts registry. */
export const CODE_SEARCH_BY_TAG_DEFINITION = {
  name: 'code_search_by_tag',
  description: 'Search code symbols by LLM-enriched semantic tags. Supports full tag (design-pattern:factory) or category prefix (design-pattern).',
  inputSchema: {
    type: 'object',
    properties: {
      tag: { type: 'string', description: 'Full tag (design-pattern:factory) or category prefix' },
      limit: { type: 'number', description: 'Max results (default 20)' },
    },
    required: ['tag'],
  },
};

/**
 * Register the code_search_by_tag MCP tool.
 * @param server - MCP server instance
 * @param adapter - Database adapter for direct queries
 */
export function registerCodeSearchByTag(server: McpServer, adapter: DatabaseAdapter): void {
  server.tool(
    'code_search_by_tag',
    CODE_SEARCH_BY_TAG_DEFINITION.description,
    {
      tag: z.string().describe('Full tag or category prefix'),
      limit: z.number().optional().default(20).describe('Max results'),
      __projectId: z.string().optional().describe('SA4E-41 tenant scope'),
    },
    async ({ tag, limit, __projectId }) => {
      const text = await handleCodeSearchByTag(adapter, tag, limit, __projectId);
      return { content: [{ type: 'text', text }] };
    },
  );
}

/**
 * Handler for code_search_by_tag tool.
 * @param adapter - Database adapter
 * @param tag - Search tag (full or prefix)
 * @param limit - Max results
 * @param projectId - Optional tenant scope
 */
export async function handleCodeSearchByTag(
  adapter: DatabaseAdapter, tag: string, limit: number, projectId?: string,
): Promise<string> {
  // Build LIKE pattern: full tag uses exact, prefix uses category:%
  const likePattern = tag.includes(':') ? `%"${tag}"%` : `%"${tag}:%`;

  const sql = projectId
    ? `SELECT s.name, s.kind, s.signature, s.summary, s.llm_tags, f.relative_path as filePath, s.start_line as startLine
       FROM symbols s JOIN files f ON s.file_id = f.id
       WHERE s.project_id = ? AND s.llm_tags LIKE ? ORDER BY s.name LIMIT ?`
    : `SELECT s.name, s.kind, s.signature, s.summary, s.llm_tags, f.relative_path as filePath, s.start_line as startLine
       FROM symbols s JOIN files f ON s.file_id = f.id
       WHERE s.llm_tags LIKE ? ORDER BY s.name LIMIT ?`;

  const params = projectId ? [projectId, likePattern, limit] : [likePattern, limit];
  const results = await adapter.allAsync<any>(sql, params);

  if (results.length === 0) {
    return `No symbols found with tag "${tag}"`;
  }

  const lines = [`Found ${results.length} symbols with tag "${tag}":\n`];
  for (const r of results) {
    lines.push(`[${r.kind}] ${r.name}`);
    lines.push(`  File: ${r.filePath}:${r.startLine}`);
    if (r.summary) lines.push(`  Summary: ${r.summary.slice(0, 100)}`);
    if (r.llm_tags) lines.push(`  Tags: ${r.llm_tags}`);
    lines.push('');
  }
  return lines.join('\n');
}
