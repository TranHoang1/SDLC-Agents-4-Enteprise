/**
 * SA4E-110 — Jira comment tools (5 tools) registered in-process.
 * add, get_all, get_single, update, delete comment.
 */
import { registerLocalTool, LocalToolDefinition } from "../../backend-local-tools";
import { AtlassianHttpClient, toResult, toErrorResult } from "./atlassian-http-client";

/** Register Jira comment CRUD tools */
export function registerJiraCommentTools(client: AtlassianHttpClient): void {
  registerTool("jira_add_comment", "Add a comment to a Jira issue", {
    type: "object",
    properties: {
      issue_key: { type: "string" }, body: { type: "string" },
      visibility: { type: "object", properties: { type: { type: "string" }, value: { type: "string" } } },
    },
    required: ["issue_key", "body"],
  }, async (args) => {
    const { issue_key, body, visibility } = args as any;
    const payload: Record<string, unknown> = { body };
    if (visibility) payload.visibility = visibility;
    return toResult(await client.request("POST", `/rest/api/2/issue/${issue_key}/comment`, payload));
  });

  registerTool("jira_get_comments", "Get all comments on a Jira issue", {
    type: "object",
    properties: {
      issue_key: { type: "string" },
      startAt: { type: "number", default: 0 },
      maxResults: { type: "number", default: 50 },
    },
    required: ["issue_key"],
  }, async (args) => {
    const { issue_key, startAt = 0, maxResults = 50 } = args as any;
    const path = `/rest/api/2/issue/${issue_key}/comment?startAt=${startAt}&maxResults=${maxResults}`;
    return toResult(await client.request("GET", path));
  });

  registerTool("jira_get_comment", "Get a single comment by ID", {
    type: "object",
    properties: { issue_key: { type: "string" }, comment_id: { type: "string" } },
    required: ["issue_key", "comment_id"],
  }, async (args) => {
    const { issue_key, comment_id } = args as any;
    return toResult(await client.request("GET", `/rest/api/2/issue/${issue_key}/comment/${comment_id}`));
  });

  registerTool("jira_update_comment", "Update an existing comment", {
    type: "object",
    properties: { issue_key: { type: "string" }, comment_id: { type: "string" }, body: { type: "string" } },
    required: ["issue_key", "comment_id", "body"],
  }, async (args) => {
    const { issue_key, comment_id, body } = args as any;
    return toResult(await client.request("PUT", `/rest/api/2/issue/${issue_key}/comment/${comment_id}`, { body }));
  });

  registerTool("jira_delete_comment", "Delete a comment from a Jira issue", {
    type: "object",
    properties: { issue_key: { type: "string" }, comment_id: { type: "string" } },
    required: ["issue_key", "comment_id"],
  }, async (args) => {
    const { issue_key, comment_id } = args as any;
    await client.request("DELETE", `/rest/api/2/issue/${issue_key}/comment/${comment_id}`);
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
