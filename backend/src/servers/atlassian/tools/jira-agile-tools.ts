/**
 * SA4E-110 - Jira agile tools (5 tools).
 * boards, sprints, sprint_issues, backlog, epic_issues.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JiraApiClient } from '../clients/jira-client.js';
import { BoardIdSchema, SprintIdSchema, EpicIssuesSchema, PaginationSchema } from '../models/jira-schemas.js';
import { createSuccessResult, createErrorResult } from '../models/error-schemas.js';
import { AtlassianErrorCode } from '../models/types.js';
import { AtlassianApiError } from '../clients/base-client.js';

/** Register Jira Agile/Scrum board tools */
export function registerJiraAgileTools(server: McpServer, client: JiraApiClient): void {
  server.registerTool('jira_get_boards', { description: 'Get all agile boards', inputSchema: PaginationSchema }, async (args, _extra) => {
    const parsed = PaginationSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try { return createSuccessResult((await client.getBoards(parsed.data.startAt, parsed.data.maxResults)).data); }
    catch (e) { return handleError(e); }
  });

  server.registerTool('jira_get_sprints', { description: 'Get sprints for a board', inputSchema: BoardIdSchema }, async (args, _extra) => {
    const parsed = BoardIdSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try { return createSuccessResult((await client.getSprints(parsed.data.board_id)).data); }
    catch (e) { return handleError(e); }
  });

  server.registerTool('jira_get_sprint_issues', { description: 'Get issues in a sprint', inputSchema: SprintIdSchema }, async (args, _extra) => {
    const parsed = SprintIdSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try {
      const { board_id, sprint_id, startAt, maxResults } = parsed.data;
      return createSuccessResult((await client.getSprintIssues(board_id, sprint_id, startAt, maxResults)).data);
    } catch (e) { return handleError(e); }
  });

  server.registerTool('jira_get_backlog', { description: 'Get backlog issues for a board', inputSchema: BoardIdSchema }, async (args, _extra) => {
    const parsed = BoardIdSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try { return createSuccessResult((await client.getBacklog(parsed.data.board_id)).data); }
    catch (e) { return handleError(e); }
  });

  server.registerTool('jira_get_epic_issues', { description: 'Get issues in an epic', inputSchema: EpicIssuesSchema }, async (args, _extra) => {
    const parsed = EpicIssuesSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try {
      const { board_id, epic_id, startAt, maxResults } = parsed.data;
      return createSuccessResult((await client.getEpicIssues(board_id, epic_id, startAt, maxResults)).data);
    } catch (e) { return handleError(e); }
  });
}

function handleError(e: unknown) {
  if (e instanceof AtlassianApiError) return createErrorResult(e.code, e.message);
  return createErrorResult(AtlassianErrorCode.UNKNOWN, (e as Error).message);
}