/**
 * SA4E-110 — Jira user tools (4 tools) registered in-process.
 * myself, search_users, watchers, add_watcher.
 */
import { registerLocalTool, LocalToolDefinition } from "../../backend-local-tools";
import { AtlassianHttpClient, toResult, toErrorResult } from "./atlassian-http-client";

/** Register Jira user and watcher tools */
export function registerJiraUserTools(client: AtlassianHttpClient): void {
  registerNoArgs(client, "jira_get_myself", "Get current authenticated user info", "/rest/api/2/myself");

  registerTool("jira_search_users", "Search for Jira users", {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      startAt: { type: "number", default: 0 },
      maxResults: { type: "number", default: 50 },
    },
    required: ["query"],
  }, async (args) => {
    const { query, startAt = 0, maxResults = 50 } = args as any;
    const q = encodeURIComponent(query);
    return toResult(await client.request("GET", `/rest/api/2/user/search?query=${q}&startAt=${startAt}&maxResults=${maxResults}`));
  });

  registerTool("jira_get_watchers", "Get watchers on a Jira issue", {
    type: "object",
    properties: { issue_key: { type: "string" } },
    required: ["issue_key"],
  }, async (args) => {
    const { issue_key } = args as any;
    return toResult(await client.request("GET", `/rest/api/2/issue/${issue_key}/watchers`));
  });

  registerTool("jira_add_watcher", "Add a watcher to a Jira issue", {
    type: "object",
    properties: { issue_key: { type: "string" }, account_id: { type: "string" } },
    required: ["issue_key", "account_id"],
  }, async (args) => {
    const { issue_key, account_id } = args as any;
    await client.request("POST", `/rest/api/2/issue/${issue_key}/watchers`, JSON.stringify(account_id));
    return toResult({ status: 204, data: { success: true } });
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
