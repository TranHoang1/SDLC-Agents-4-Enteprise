/**
 * SA4E-110 - Confluence comment tools (2 tools).
 * get_comments, add_comment.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConfluenceApiClient } from '../clients/confluence-client.js';
import { GetCommentsSchema, AddCommentSchema } from '../models/confluence-schemas.js';
import { createSuccessResult, createErrorResult } from '../models/error-schemas.js';
import { AtlassianErrorCode } from '../models/types.js';
import { AtlassianApiError } from '../clients/base-client.js';

/** Register Confluence page comment tools */
export function registerConfluenceCommentTools(server: McpServer, client: ConfluenceApiClient): void {
  server.registerTool('confluence_get_comments', { description: 'Get comments on a page', inputSchema: GetCommentsSchema }, async (args, _extra) => {
    const parsed = GetCommentsSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try {
      const { page_id, start, limit } = parsed.data;
      return createSuccessResult((await client.getComments(page_id, start, limit)).data);
    } catch (e) { return handleError(e); }
  });

  server.registerTool('confluence_add_comment', { description: 'Add a comment to a page', inputSchema: AddCommentSchema }, async (args, _extra) => {
    const parsed = AddCommentSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try {
      const { page_id, body, representation } = parsed.data;
      const payload = {
        type: 'comment',
        container: { id: page_id, type: 'page' },
        body: { [representation]: { value: body, representation } },
      };
      return createSuccessResult((await client.addComment(page_id, payload)).data);
    } catch (e) { return handleError(e); }
  });
}

function handleError(e: unknown) {
  if (e instanceof AtlassianApiError) return createErrorResult(e.code, e.message);
  return createErrorResult(AtlassianErrorCode.UNKNOWN, (e as Error).message);
}