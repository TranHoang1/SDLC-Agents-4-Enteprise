/**
 * SA4E-110 — Jira search and filter tools (4 tools) registered in-process.
 * search (JQL), get_filter, get_filter_results, favourite_filters.
 */
import { registerLocalTool, LocalToolDefinition } from "../../backend-local-tools";
import { AtlassianHttpClient, toResult, toErrorResult } from "./atlassian-http-client";

/** Register Jira search and filter tools */
export function registerJiraSearchTools(client: AtlassianHttpClient): void {
  registerTool("jira_search", "Search issues using JQL", {
    type: "object",
    properties: {
      jql: { type: "string", description: "JQL query string" },
      fields: { type: "string", description: "Comma-separated fields" },
      expand: { type: "string", description: "Comma-separated expansions" },
      startAt: { type: "number", default: 0 },
      maxResults: { type: "number", default: 50 },
    },
    required: ["jql"],
  }, async (args) => {
    const { jql, fields, expand, startAt = 0, maxResults = 50 } = args as any;
    const params = new URLSearchParams({ jql, startAt: String(startAt), maxResults: String(maxResults) });
    if (fields) params.set("fields", fields);
    if (expand) params.set("expand", expand);
    return toResult(await client.request("GET", `/rest/api/3/search/jql?${params}`));
  });

  registerTool("jira_get_filter", "Get a saved filter by ID", {
    type: "object",
    properties: { filter_id: { type: "string", description: "Filter ID" } },
    required: ["filter_id"],
  }, async (args) => {
    const { filter_id } = args as any;
    return toResult(await client.request("GET", `/rest/api/2/filter/${filter_id}`));
  });

  registerTool("jira_get_filter_results", "Execute a saved filter and get results", {
    type: "object",
    properties: {
      filter_id: { type: "string" },
      startAt: { type: "number", default: 0 },
      maxResults: { type: "number", default: 50 },
    },
    required: ["filter_id"],
  }, async (args) => {
    const { filter_id, startAt = 0, maxResults = 50 } = args as any;
    const filterRes = await client.request("GET", `/rest/api/2/filter/${filter_id}`);
    const jql = (filterRes.data as any).jql;
    const params = new URLSearchParams({ jql, startAt: String(startAt), maxResults: String(maxResults) });
    return toResult(await client.request("GET", `/rest/api/3/search/jql?${params}`));
  });

  registerNoArgs(client, "jira_get_favourite_filters", "Get user favourite filters", "/rest/api/2/filter/favourite");
}

/** Helper: register tool with hidden:true and error handling */
function registerTool(
  name: string, description: string,
  inputSchema: Record<string, unknown>, handler: (args: Record<string, unknown>) => Promise<any>,
): void {
  const def: LocalToolDefinition = { name, description, inputSchema, hidden: true };
  registerLocalTool(name, async (args) => {
    try { return await handler(args); }
    catch (e) { return toErrorResult(e); }
  }, def);
}

/** Helper: register no-args GET tool */
function registerNoArgs(client: AtlassianHttpClient, name: string, desc: string, path: string): void {
  const def: LocalToolDefinition = { name, description: desc, inputSchema: { type: "object", properties: {}, required: [] }, hidden: true };
  registerLocalTool(name, async () => {
    try { return toResult(await client.request("GET", path)); }
    catch (e) { return toErrorResult(e); }
  }, def);
}
