/**
 * SA4E-110 — Jira worklog tools (3 tools) registered in-process.
 * get_worklogs, add_worklog, delete_worklog.
 */
import { registerLocalTool, LocalToolDefinition } from "../../backend-local-tools";
import { AtlassianHttpClient, toResult, toErrorResult } from "./atlassian-http-client";

/** Register Jira worklog/time tracking tools */
export function registerJiraWorklogTools(client: AtlassianHttpClient): void {
  registerTool("jira_get_worklogs", "Get worklogs for an issue", {
    type: "object",
    properties: { issue_key: { type: "string" } },
    required: ["issue_key"],
  }, async (args) => {
    const { issue_key } = args as any;
    return toResult(await client.request("GET", `/rest/api/2/issue/${issue_key}/worklog`));
  });

  registerTool("jira_add_worklog", "Add a worklog entry to an issue", {
    type: "object",
    properties: {
      issue_key: { type: "string" }, time_spent: { type: "string", description: "e.g. 2h 30m" },
      started: { type: "string", description: "ISO datetime" }, comment: { type: "string" },
    },
    required: ["issue_key", "time_spent"],
  }, async (args) => {
    const { issue_key, time_spent, started, comment } = args as any;
    const body: Record<string, unknown> = { timeSpent: time_spent };
    if (started) body.started = started;
    if (comment) body.comment = comment;
    return toResult(await client.request("POST", `/rest/api/2/issue/${issue_key}/worklog`, body));
  });

  registerTool("jira_delete_worklog", "Delete a worklog entry", {
    type: "object",
    properties: { issue_key: { type: "string" }, worklog_id: { type: "string" } },
    required: ["issue_key", "worklog_id"],
  }, async (args) => {
    const { issue_key, worklog_id } = args as any;
    await client.request("DELETE", `/rest/api/2/issue/${issue_key}/worklog/${worklog_id}`);
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
