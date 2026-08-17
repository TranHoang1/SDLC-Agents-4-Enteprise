/**
 * SA4E-110 - Confluence search tools (4 tools).
 * search (CQL), content search, recent, by_label.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConfluenceApiClient } from '../clients/confluence-client.js';
import { SearchSchema, ContentSearchSchema, RecentSchema, ByLabelSchema } from '../models/confluence-schemas.js';
import { createSuccessResult, createErrorResult } from '../models/error-schemas.js';
import { AtlassianErrorCode } from '../models/types.js';
import { AtlassianApiError } from '../clients/base-client.js';

/** Register Confluence search and discovery tools */
export function registerConfluenceSearchTools(server: McpServer, client: ConfluenceApiClient): void {
  server.registerTool('confluence_search', { description: 'Search Confluence with CQL', inputSchema: SearchSchema }, async (args, _extra) => {
    const parsed = SearchSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try { return createSuccessResult((await client.search(parsed.data.cql, parsed.data.start, parsed.data.limit)).data); }
    catch (e) { return handleError(e); }
  });

  server.registerTool('confluence_search_content', { description: 'Search content by text query', inputSchema: ContentSearchSchema }, async (args, _extra) => {
    const parsed = ContentSearchSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try {
      const { query, space_key, type, start, limit } = parsed.data;
      return createSuccessResult((await client.searchContent(query, space_key, type, start, limit)).data);
    } catch (e) { return handleError(e); }
  });

  server.registerTool('confluence_get_recent', { description: 'Get recently modified content', inputSchema: RecentSchema }, async (args, _extra) => {
    const parsed = RecentSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try { return createSuccessResult((await client.getRecent(parsed.data.start, parsed.data.limit)).data); }
    catch (e) { return handleError(e); }
  });

  server.registerTool('confluence_get_by_label', { description: 'Get content by label', inputSchema: ByLabelSchema }, async (args, _extra) => {
    const parsed = ByLabelSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try {
      const { label, space_key, start, limit } = parsed.data;
      return createSuccessResult((await client.getByLabel(label, space_key, start, limit)).data);
    } catch (e) { return handleError(e); }
  });
}

function handleError(e: unknown) {
  if (e instanceof AtlassianApiError) return createErrorResult(e.code, e.message);
  return createErrorResult(AtlassianErrorCode.UNKNOWN, (e as Error).message);
}