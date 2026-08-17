/**
 * SA4E-110 - Jira field tools (5 tools).
 * fields, create_meta, edit_meta, field_options, custom_field.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JiraApiClient } from '../clients/jira-client.js';
import { FieldsSchema, ProjectKeySchema } from '../models/jira-schemas.js';
import { createSuccessResult, createErrorResult } from '../models/error-schemas.js';
import { AtlassianErrorCode } from '../models/types.js';
import { AtlassianApiError } from '../clients/base-client.js';
import { z } from 'zod';

const FieldIdSchema = z.object({ field_id: z.string().min(1) });

/** Register Jira field metadata tools */
export function registerJiraFieldTools(server: McpServer, client: JiraApiClient): void {
  server.tool('jira_get_fields', 'Get all available fields', async () => {
    try { return createSuccessResult((await client.getFields()).data); }
    catch (e) { return handleError(e); }
  });

  server.registerTool('jira_get_create_meta', { description: 'Get issue creation metadata for a project', inputSchema: ProjectKeySchema }, async (args, _extra) => {
    const parsed = ProjectKeySchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try {
      const res = await client.getCreateMeta(parsed.data.project_key);
      return createSuccessResult(res.data);
    } catch (e) { return handleError(e); }
  });

  server.registerTool('jira_get_edit_meta', { description: 'Get editable fields for an issue', inputSchema: FieldsSchema }, async (args, _extra) => {
    const parsed = FieldsSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try {
      const res = await client.getEditMeta(parsed.data.issue_key);
      return createSuccessResult(res.data);
    } catch (e) { return handleError(e); }
  });

  server.registerTool('jira_get_field_options', { description: 'Get allowed values for a custom field', inputSchema: FieldIdSchema }, async (args, _extra) => {
    const parsed = FieldIdSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try {
      const res = await client.getFieldOptions(parsed.data.field_id);
      return createSuccessResult(res.data);
    } catch (e) { return handleError(e); }
  });

  server.registerTool('jira_get_custom_field', { description: 'Get custom field configuration', inputSchema: FieldIdSchema }, async (args, _extra) => {
    const parsed = FieldIdSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try {
      const allFields = (await client.getFields()).data as Array<{ id: string }>;
      const field = (allFields).find(f => f.id === parsed.data.field_id);
      if (!field) return createErrorResult(AtlassianErrorCode.NOT_FOUND, `Field ${parsed.data.field_id} not found`);
      return createSuccessResult(field);
    } catch (e) { return handleError(e); }
  });
}

function handleError(e: unknown) {
  if (e instanceof AtlassianApiError) return createErrorResult(e.code, e.message);
  return createErrorResult(AtlassianErrorCode.UNKNOWN, (e as Error).message);
}