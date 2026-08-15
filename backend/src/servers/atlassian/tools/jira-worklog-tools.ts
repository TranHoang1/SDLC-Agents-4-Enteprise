/**
 * SA4E-110 - Jira worklog tools (3 tools).
 * get_worklogs, add_worklog, delete_worklog.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JiraApiClient } from '../clients/jira-client.js';
import { GetWorklogsSchema, WorklogSchema, DeleteWorklogSchema } from '../models/jira-schemas.js';
import { createSuccessResult, createErrorResult } from '../models/error-schemas.js';
import { AtlassianErrorCode } from '../models/types.js';
import { AtlassianApiError } from '../clients/base-client.js';

/** Register Jira worklog/time tracking tools */
export function registerJiraWorklogTools(server: McpServer, client: JiraApiClient): void {
  server.registerTool('jira_get_worklogs', { description: 'Get worklogs for an issue', inputSchema: GetWorklogsSchema }, async (args, _extra) => {
    const parsed = GetWorklogsSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try { return createSuccessResult((await client.getWorklogs(parsed.data.issue_key)).data); }
    catch (e) { return handleError(e); }
  });

  server.registerTool('jira_add_worklog', { description: 'Add a worklog entry to an issue', inputSchema: WorklogSchema }, async (args, _extra) => {
    const parsed = WorklogSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try {
      const body: Record<string, unknown> = { timeSpent: parsed.data.time_spent };
      if (parsed.data.started) body.started = parsed.data.started;
      if (parsed.data.comment) body.comment = parsed.data.comment;
      const res = await client.addWorklog(parsed.data.issue_key, body);
      return createSuccessResult(res.data);
    } catch (e) { return handleError(e); }
  });

  server.registerTool('jira_delete_worklog', { description: 'Delete a worklog entry', inputSchema: DeleteWorklogSchema }, async (args, _extra) => {
    const parsed = DeleteWorklogSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try {
      await client.deleteWorklog(parsed.data.issue_key, parsed.data.worklog_id);
      return createSuccessResult({ success: true });
    } catch (e) { return handleError(e); }
  });
}

function handleError(e: unknown) {
  if (e instanceof AtlassianApiError) return createErrorResult(e.code, e.message);
  return createErrorResult(AtlassianErrorCode.UNKNOWN, (e as Error).message);
}