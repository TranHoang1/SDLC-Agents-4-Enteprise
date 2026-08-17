/**
 * SA4E-110 — Jira field metadata tools (5 tools) registered in-process.
 * fields, create_meta, edit_meta, field_options, custom_field.
 */
import { registerLocalTool, LocalToolDefinition } from "../../backend-local-tools";
import { AtlassianHttpClient, toResult, toErrorResult } from "./atlassian-http-client";

/** Register Jira field metadata tools */
export function registerJiraFieldTools(client: AtlassianHttpClient): void {
  registerNoArgs(client, "jira_get_fields", "Get all available fields", "/rest/api/2/field");

  registerTool("jira_get_create_meta", "Get issue creation metadata for a project", {
    type: "object",
    properties: { project_key: { type: "string" } },
    required: ["project_key"],
  }, async (args) => {
    const { project_key } = args as any;
    const path = `/rest/api/2/issue/createmeta?projectKeys=${project_key}&expand=projects.issuetypes.fields`;
    return toResult(await client.request("GET", path));
  });

  registerTool("jira_get_edit_meta", "Get editable fields for an issue", {
    type: "object",
    properties: { issue_key: { type: "string" } },
    required: ["issue_key"],
  }, async (args) => {
    const { issue_key } = args as any;
    return toResult(await client.request("GET", `/rest/api/2/issue/${issue_key}/editmeta`));
  });

  registerTool("jira_get_field_options", "Get allowed values for a custom field", {
    type: "object",
    properties: { field_id: { type: "string" } },
    required: ["field_id"],
  }, async (args) => {
    const { field_id } = args as any;
    return toResult(await client.request("GET", `/rest/api/2/customFieldOption/${field_id}`));
  });

  registerTool("jira_get_custom_field", "Get custom field configuration", {
    type: "object",
    properties: { field_id: { type: "string" } },
    required: ["field_id"],
  }, async (args) => {
    const { field_id } = args as any;
    const res = await client.request("GET", "/rest/api/2/field");
    const allFields = res.data as Array<{ id: string }>;
    const field = allFields.find(f => f.id === field_id);
    if (!field) throw new Error(`Field ${field_id} not found`);
    return toResult({ status: 200, data: field });
  });
}

function registerTool(
  name: string, description: string, inputSchema: Record<string, unknown>,
  handler: (args: Record<string, unknown>) => Promise<any>,
): void {
  const def: LocalToolDefinition = { name, description, inputSchema, hidden: true };
  registerLocalTool(name, async (args) => {
    try { return await handler(args); } catch (e) { return toErrorResult(e); }
  }, def);
}

function registerNoArgs(client: AtlassianHttpClient, name: string, desc: string, path: string): void {
  const def: LocalToolDefinition = { name, description: desc, inputSchema: { type: "object", properties: {}, required: [] }, hidden: true };
  registerLocalTool(name, async () => {
    try { return toResult(await client.request("GET", path)); }
    catch (e) { return toErrorResult(e); }
  }, def);
}
