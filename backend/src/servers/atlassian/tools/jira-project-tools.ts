/**
 * SA4E-110 - Jira project tools (6 tools).
 * projects, project, versions, components, create_version, roles.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JiraApiClient } from '../clients/jira-client.js';
import { ProjectKeySchema, CreateVersionSchema } from '../models/jira-schemas.js';
import { createSuccessResult, createErrorResult } from '../models/error-schemas.js';
import { AtlassianErrorCode } from '../models/types.js';
import { AtlassianApiError } from '../clients/base-client.js';

/** Register Jira project metadata tools */
export function registerJiraProjectTools(server: McpServer, client: JiraApiClient): void {
  server.tool('jira_get_all_projects', 'Get all accessible Jira projects', async () => {
    try { return createSuccessResult((await client.getProjects()).data); }
    catch (e) { return handleError(e); }
  });

  server.registerTool('jira_get_project', { description: 'Get project details by key', inputSchema: ProjectKeySchema }, async (args, _extra) => {
    const parsed = ProjectKeySchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try { return createSuccessResult((await client.getProject(parsed.data.project_key)).data); }
    catch (e) { return handleError(e); }
  });

  server.registerTool('jira_get_versions', { description: 'Get project versions', inputSchema: ProjectKeySchema }, async (args, _extra) => {
    const parsed = ProjectKeySchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try { return createSuccessResult((await client.getVersions(parsed.data.project_key)).data); }
    catch (e) { return handleError(e); }
  });

  server.registerTool('jira_get_components', { description: 'Get project components', inputSchema: ProjectKeySchema }, async (args, _extra) => {
    const parsed = ProjectKeySchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try { return createSuccessResult((await client.getComponents(parsed.data.project_key)).data); }
    catch (e) { return handleError(e); }
  });

  server.registerTool('jira_create_version', { description: 'Create a new project version', inputSchema: CreateVersionSchema }, async (args, _extra) => {
    const parsed = CreateVersionSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try {
      const body: Record<string, unknown> = { project: parsed.data.project_key, name: parsed.data.name };
      if (parsed.data.description) body.description = parsed.data.description;
      if (parsed.data.released) body.released = parsed.data.released;
      if (parsed.data.start_date) body.startDate = parsed.data.start_date;
      if (parsed.data.release_date) body.releaseDate = parsed.data.release_date;
      const res = await client.createVersion(body);
      return createSuccessResult(res.data);
    } catch (e) { return handleError(e); }
  });

  server.registerTool('jira_get_roles', { description: 'Get project roles', inputSchema: ProjectKeySchema }, async (args, _extra) => {
    const parsed = ProjectKeySchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try { return createSuccessResult((await client.getRoles(parsed.data.project_key)).data); }
    catch (e) { return handleError(e); }
  });
}

function handleError(e: unknown) {
  if (e instanceof AtlassianApiError) return createErrorResult(e.code, e.message);
  return createErrorResult(AtlassianErrorCode.UNKNOWN, (e as Error).message);
}