/**
 * SA4E-110 - Jira comment tools (5 tools).
 * add, get_all, update, delete, get_single comment.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JiraApiClient } from '../clients/jira-client.js';
import { CommentSchema, UpdateCommentSchema, DeleteCommentSchema, GetCommentsSchema, GetSingleCommentSchema } from '../models/jira-schemas.js';
import { createSuccessResult, createErrorResult } from '../models/error-schemas.js';
import { AtlassianErrorCode } from '../models/types.js';
import { AtlassianApiError } from '../clients/base-client.js';

/** Register Jira comment CRUD tools */
export function registerJiraCommentTools(server: McpServer, client: JiraApiClient): void {
  server.registerTool('jira_add_comment', { description: 'Add a comment to a Jira issue', inputSchema: CommentSchema }, async (args, _extra) => {
    const parsed = CommentSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try {
      const body: Record<string, unknown> = { body: parsed.data.body };
      if (parsed.data.visibility) body.visibility = parsed.data.visibility;
      const res = await client.addComment(parsed.data.issue_key, body);
      return createSuccessResult(res.data);
    } catch (e) { return handleError(e); }
  });

  server.registerTool('jira_get_comments', { description: 'Get all comments on a Jira issue', inputSchema: GetCommentsSchema }, async (args, _extra) => {
    const parsed = GetCommentsSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try {
      const res = await client.getComments(parsed.data.issue_key, parsed.data.startAt, parsed.data.maxResults);
      return createSuccessResult(res.data);
    } catch (e) { return handleError(e); }
  });

  server.registerTool('jira_update_comment', { description: 'Update an existing comment', inputSchema: UpdateCommentSchema }, async (args, _extra) => {
    const parsed = UpdateCommentSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try {
      const res = await client.updateComment(parsed.data.issue_key, parsed.data.comment_id, { body: parsed.data.body });
      return createSuccessResult(res.data);
    } catch (e) { return handleError(e); }
  });

  server.registerTool('jira_delete_comment', { description: 'Delete a comment from a Jira issue', inputSchema: DeleteCommentSchema }, async (args, _extra) => {
    const parsed = DeleteCommentSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try {
      await client.deleteComment(parsed.data.issue_key, parsed.data.comment_id);
      return createSuccessResult({ success: true });
    } catch (e) { return handleError(e); }
  });

  server.registerTool('jira_get_comment', { description: 'Get a single comment by ID', inputSchema: GetSingleCommentSchema }, async (args, _extra) => {
    const parsed = GetSingleCommentSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try {
      const res = await client.getComment(parsed.data.issue_key, parsed.data.comment_id);
      return createSuccessResult(res.data);
    } catch (e) { return handleError(e); }
  });
}

function handleError(e: unknown) {
  if (e instanceof AtlassianApiError) return createErrorResult(e.code, e.message);
  return createErrorResult(AtlassianErrorCode.UNKNOWN, (e as Error).message);
}