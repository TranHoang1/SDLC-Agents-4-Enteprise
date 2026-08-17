/**
 * SA4E-110 - Confluence space tools (5 tools).
 * spaces, space, space_content, add_label, get_labels.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConfluenceApiClient } from '../clients/confluence-client.js';
import { SpacesSchema, SpaceKeySchema, SpaceContentSchema, LabelSchema, GetLabelsSchema } from '../models/confluence-schemas.js';
import { createSuccessResult, createErrorResult } from '../models/error-schemas.js';
import { AtlassianErrorCode } from '../models/types.js';
import { AtlassianApiError } from '../clients/base-client.js';

/** Register Confluence space and label tools */
export function registerConfluenceSpaceTools(server: McpServer, client: ConfluenceApiClient): void {
  server.registerTool('confluence_get_spaces', { description: 'List all Confluence spaces', inputSchema: SpacesSchema }, async (args, _extra) => {
    const parsed = SpacesSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try { return createSuccessResult((await client.getSpaces(parsed.data.type, parsed.data.start, parsed.data.limit)).data); }
    catch (e) { return handleError(e); }
  });

  server.registerTool('confluence_get_space', { description: 'Get space details by key', inputSchema: SpaceKeySchema }, async (args, _extra) => {
    const parsed = SpaceKeySchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try { return createSuccessResult((await client.getSpace(parsed.data.space_key)).data); }
    catch (e) { return handleError(e); }
  });

  server.registerTool('confluence_get_space_content', { description: 'Get content in a space', inputSchema: SpaceContentSchema }, async (args, _extra) => {
    const parsed = SpaceContentSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try {
      const { space_key, type, start, limit } = parsed.data;
      return createSuccessResult((await client.getSpaceContent(space_key, type, start, limit)).data);
    } catch (e) { return handleError(e); }
  });

  server.registerTool('confluence_add_label', { description: 'Add a label to a page', inputSchema: LabelSchema }, async (args, _extra) => {
    const parsed = LabelSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try { return createSuccessResult((await client.addLabel(parsed.data.page_id, parsed.data.label)).data); }
    catch (e) { return handleError(e); }
  });

  server.registerTool('confluence_get_labels', { description: 'Get labels on a page', inputSchema: GetLabelsSchema }, async (args, _extra) => {
    const parsed = GetLabelsSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try { return createSuccessResult((await client.getLabels(parsed.data.page_id)).data); }
    catch (e) { return handleError(e); }
  });
}

function handleError(e: unknown) {
  if (e instanceof AtlassianApiError) return createErrorResult(e.code, e.message);
  return createErrorResult(AtlassianErrorCode.UNKNOWN, (e as Error).message);
}