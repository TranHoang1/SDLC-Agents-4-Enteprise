/**
 * SA4E-110 - Jira search tools (4 tools).
 * JQL search, get filter, filter results, favourite filters.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JiraApiClient } from '../clients/jira-client.js';
import { SearchJqlSchema, GetFilterSchema, FilterResultsSchema } from '../models/jira-schemas.js';
import { createSuccessResult, createErrorResult } from '../models/error-schemas.js';
import { AtlassianErrorCode } from '../models/types.js';
import { AtlassianApiError } from '../clients/base-client.js';

/** Register Jira search and filter tools */
export function registerJiraSearchTools(server: McpServer, client: JiraApiClient): void {
  server.registerTool('jira_search', { description: 'Search issues using JQL', inputSchema: SearchJqlSchema }, async (args, _extra) => {
    const parsed = SearchJqlSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try {
      const { jql, fields, expand, startAt, maxResults } = parsed.data;
      const res = await client.searchJql(jql, fields, expand, startAt, maxResults);
      return createSuccessResult(res.data);
    } catch (e) { return handleError(e); }
  });

  server.registerTool('jira_get_filter', { description: 'Get a saved filter by ID', inputSchema: GetFilterSchema }, async (args, _extra) => {
    const parsed = GetFilterSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try {
      const res = await client.getFilter(parsed.data.filter_id);
      return createSuccessResult(res.data);
    } catch (e) { return handleError(e); }
  });

  server.registerTool('jira_get_filter_results', { description: 'Execute a saved filter and get results', inputSchema: FilterResultsSchema }, async (args, _extra) => {
    const parsed = FilterResultsSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try {
      const filter = await client.getFilter(parsed.data.filter_id);
      const jql = (filter.data as Record<string, string>).jql;
      const res = await client.searchJql(jql, undefined, undefined, parsed.data.startAt, parsed.data.maxResults);
      return createSuccessResult(res.data);
    } catch (e) { return handleError(e); }
  });

  server.tool('jira_get_favourite_filters', 'Get user favourite filters', async () => {
    try { return createSuccessResult((await client.getFavouriteFilters()).data); }
    catch (e) { return handleError(e); }
  });
}

function handleError(e: unknown) {
  if (e instanceof AtlassianApiError) return createErrorResult(e.code, e.message);
  return createErrorResult(AtlassianErrorCode.UNKNOWN, (e as Error).message);
}