/**
 * SA4E-110 - Jira user tools (4 tools).
 * myself, search_users, watchers, add_watcher.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JiraApiClient } from '../clients/jira-client.js';
import { UserSearchSchema, WatcherSchema } from '../models/jira-schemas.js';
import { createSuccessResult, createErrorResult } from '../models/error-schemas.js';
import { AtlassianErrorCode } from '../models/types.js';
import { AtlassianApiError } from '../clients/base-client.js';
import { z } from 'zod';

const IssueKeyOnly = z.object({ issue_key: z.string().min(1) });

/** Register Jira user and watcher tools */
export function registerJiraUserTools(server: McpServer, client: JiraApiClient): void {
  server.tool('jira_get_myself', 'Get current authenticated user info', async () => {
    try { return createSuccessResult((await client.getMyself()).data); }
    catch (e) { return handleError(e); }
  });

  server.registerTool('jira_search_users', { description: 'Search for Jira users', inputSchema: UserSearchSchema }, async (args, _extra) => {
    const parsed = UserSearchSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try { return createSuccessResult((await client.searchUsers(parsed.data.query, parsed.data.startAt, parsed.data.maxResults)).data); }
    catch (e) { return handleError(e); }
  });

  server.registerTool('jira_get_watchers', { description: 'Get watchers on a Jira issue', inputSchema: IssueKeyOnly }, async (args, _extra) => {
    const parsed = IssueKeyOnly.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try { return createSuccessResult((await client.getWatchers(parsed.data.issue_key)).data); }
    catch (e) { return handleError(e); }
  });

  server.registerTool('jira_add_watcher', { description: 'Add a watcher to a Jira issue', inputSchema: WatcherSchema }, async (args, _extra) => {
    const parsed = WatcherSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try {
      await client.addWatcher(parsed.data.issue_key, parsed.data.account_id);
      return createSuccessResult({ success: true });
    } catch (e) { return handleError(e); }
  });
}

function handleError(e: unknown) {
  if (e instanceof AtlassianApiError) return createErrorResult(e.code, e.message);
  return createErrorResult(AtlassianErrorCode.UNKNOWN, (e as Error).message);
}