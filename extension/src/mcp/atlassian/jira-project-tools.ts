/**
 * SA4E-110 — Jira project tools (6 tools) registered in-process.
 * projects, project, versions, components, create_version, roles.
 */
import { registerLocalTool, LocalToolDefinition } from "../../backend-local-tools";
import { AtlassianHttpClient, toResult, toErrorResult } from "./atlassian-http-client";

/** Register Jira project metadata tools */
export function registerJiraProjectTools(client: AtlassianHttpClient): void {
  registerNoArgs(client, "jira_get_all_projects", "Get all accessible Jira projects", "/rest/api/2/project");

  registerTool("jira_get_project", "Get project details by key", {
    type: "object",
    properties: { project_key: { type: "string", description: "Project key" } },
    required: ["project_key"],
  }, async (args) => {
    const { project_key } = args as any;
    return toResult(await client.request("GET", `/rest/api/2/project/${project_key}`));
  });

  registerTool("jira_get_versions", "Get project versions", {
    type: "object",
    properties: { project_key: { type: "string" } },
    required: ["project_key"],
  }, async (args) => {
    const { project_key } = args as any;
    return toResult(await client.request("GET", `/rest/api/2/project/${project_key}/versions`));
  });

  registerTool("jira_get_components", "Get project components", {
    type: "object",
    properties: { project_key: { type: "string" } },
    required: ["project_key"],
  }, async (args) => {
    const { project_key } = args as any;
    return toResult(await client.request("GET", `/rest/api/2/project/${project_key}/components`));
  });

  registerTool("jira_create_version", "Create a new project version", {
    type: "object",
    properties: {
      project_key: { type: "string" }, name: { type: "string" },
      description: { type: "string" }, released: { type: "boolean", default: false },
      start_date: { type: "string" }, release_date: { type: "string" },
    },
    required: ["project_key", "name"],
  }, async (args) => {
    const { project_key, name, description, released, start_date, release_date } = args as any;
    const body: Record<string, unknown> = { project: project_key, name };
    if (description) body.description = description;
    if (released) body.released = released;
    if (start_date) body.startDate = start_date;
    if (release_date) body.releaseDate = release_date;
    return toResult(await client.request("POST", "/rest/api/2/version", body));
  });

  registerTool("jira_get_roles", "Get project roles", {
    type: "object",
    properties: { project_key: { type: "string" } },
    required: ["project_key"],
  }, async (args) => {
    const { project_key } = args as any;
    return toResult(await client.request("GET", `/rest/api/2/project/${project_key}/role`));
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
