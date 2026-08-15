/**
 * SA4E-110 - Confluence page tools (7 tools).
 * get, create, update, delete, by_title, children, ancestors.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConfluenceApiClient } from '../clients/confluence-client.js';
import { GetPageSchema, CreatePageSchema, UpdatePageSchema, DeletePageSchema, PageByTitleSchema, ChildrenSchema, AncestorsSchema } from '../models/confluence-schemas.js';
import { createSuccessResult, createErrorResult } from '../models/error-schemas.js';
import { AtlassianErrorCode } from '../models/types.js';
import { AtlassianApiError } from '../clients/base-client.js';

/** Register Confluence page CRUD tools */
export function registerConfluencePageTools(server: McpServer, client: ConfluenceApiClient): void {
  server.registerTool('confluence_get_page', { description: 'Get a Confluence page by ID', inputSchema: GetPageSchema }, async (args, _extra) => {
    const parsed = GetPageSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try { return createSuccessResult((await client.getPage(parsed.data.page_id, parsed.data.expand)).data); }
    catch (e) { return handleError(e); }
  });

  server.registerTool('confluence_create_page', { description: 'Create a new Confluence page', inputSchema: CreatePageSchema }, async (args, _extra) => {
    const parsed = CreatePageSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try {
      const { space_key, title, body, parent_id, representation } = parsed.data;
      const payload: Record<string, unknown> = {
        type: 'page', title,
        space: { key: space_key },
        body: { [representation]: { value: body, representation } },
      };
      if (parent_id) payload.ancestors = [{ id: parent_id }];
      return createSuccessResult((await client.createPage(payload)).data);
    } catch (e) { return handleError(e); }
  });

  server.registerTool('confluence_update_page', { description: 'Update an existing Confluence page', inputSchema: UpdatePageSchema }, async (args, _extra) => {
    const parsed = UpdatePageSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try {
      const { page_id, title, body, version_number, representation } = parsed.data;
      const payload = {
        type: 'page', title,
        body: { [representation]: { value: body, representation } },
        version: { number: version_number },
      };
      return createSuccessResult((await client.updatePage(page_id, payload)).data);
    } catch (e) { return handleError(e); }
  });

  server.registerTool('confluence_delete_page', { description: 'Delete a Confluence page', inputSchema: DeletePageSchema }, async (args, _extra) => {
    const parsed = DeletePageSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try {
      await client.deletePage(parsed.data.page_id);
      return createSuccessResult({ success: true });
    } catch (e) { return handleError(e); }
  });

  server.registerTool('confluence_get_page_by_title', { description: 'Find a page by title in a space', inputSchema: PageByTitleSchema }, async (args, _extra) => {
    const parsed = PageByTitleSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try { return createSuccessResult((await client.getPageByTitle(parsed.data.space_key, parsed.data.title)).data); }
    catch (e) { return handleError(e); }
  });

  server.registerTool('confluence_get_children', { description: 'Get child pages', inputSchema: ChildrenSchema }, async (args, _extra) => {
    const parsed = ChildrenSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try { return createSuccessResult((await client.getChildren(parsed.data.page_id, parsed.data.start, parsed.data.limit)).data); }
    catch (e) { return handleError(e); }
  });

  server.registerTool('confluence_get_ancestors', { description: 'Get ancestor pages', inputSchema: AncestorsSchema }, async (args, _extra) => {
    const parsed = AncestorsSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try { return createSuccessResult((await client.getAncestors(parsed.data.page_id)).data); }
    catch (e) { return handleError(e); }
  });
}

function handleError(e: unknown) {
  if (e instanceof AtlassianApiError) return createErrorResult(e.code, e.message);
  return createErrorResult(AtlassianErrorCode.UNKNOWN, (e as Error).message);
}