/**
 * SA4E-107: MCP tool — code enrichment progress statistics.
 * Shows total symbols, completed/pending/failed counts, and worker status.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { DatabaseAdapter } from '../../database/adapters/DatabaseAdapter.js';

/** Tool definition for register-tools.ts registry. */
export const CODE_ENRICHMENT_STATS_DEFINITION = {
  name: 'code_enrichment_stats',
  description: 'Get code enrichment progress: total symbols, completed/pending/failed counts, and percentage.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

interface EnrichmentStatsRow {
  total: number;
  completed: number;
  pending: number;
  failed: number;
}

/**
 * Register the code_enrichment_stats MCP tool.
 * @param server - MCP server instance
 * @param adapter - Database adapter for direct queries
 */
export function registerCodeEnrichmentStats(server: McpServer, adapter: DatabaseAdapter): void {
  server.tool(
    'code_enrichment_stats',
    CODE_ENRICHMENT_STATS_DEFINITION.description,
    {
      __projectId: z.string().optional().describe('SA4E-41 tenant scope'),
    },
    async ({ __projectId }) => {
      const text = await handleCodeEnrichmentStats(adapter, __projectId);
      return { content: [{ type: 'text', text }] };
    },
  );
}

/**
 * Handler for code_enrichment_stats tool.
 * @param adapter - Database adapter
 * @param projectId - Optional tenant scope
 */
export async function handleCodeEnrichmentStats(
  adapter: DatabaseAdapter, projectId?: string,
): Promise<string> {
  const sql = projectId
    ? `SELECT COUNT(*) as total,
         SUM(CASE WHEN enrichment_status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
         SUM(CASE WHEN enrichment_status = 'PENDING' THEN 1 ELSE 0 END) as pending,
         SUM(CASE WHEN enrichment_status = 'FAILED' THEN 1 ELSE 0 END) as failed
       FROM symbols WHERE project_id = ?`
    : `SELECT COUNT(*) as total,
         SUM(CASE WHEN enrichment_status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
         SUM(CASE WHEN enrichment_status = 'PENDING' THEN 1 ELSE 0 END) as pending,
         SUM(CASE WHEN enrichment_status = 'FAILED' THEN 1 ELSE 0 END) as failed
       FROM symbols`;

  const params = projectId ? [projectId] : [];
  const row = await adapter.getAsync<EnrichmentStatsRow>(sql, params);

  if (!row || row.total === 0) {
    return 'No symbols found. Run code indexing first.';
  }

  const pct = row.total > 0
    ? Math.round(((row.completed ?? 0) / row.total) * 100)
    : 0;
  const notStarted = row.total - (row.completed ?? 0) - (row.pending ?? 0) - (row.failed ?? 0);

  const lines = [
    '📊 Code Enrichment Stats',
    `  Total symbols: ${row.total}`,
    `  Completed: ${row.completed ?? 0} (${pct}%)`,
    `  Pending: ${row.pending ?? 0}`,
    `  Failed: ${row.failed ?? 0}`,
    `  Not started: ${notStarted}`,
  ];

  return lines.join('\n');
}
