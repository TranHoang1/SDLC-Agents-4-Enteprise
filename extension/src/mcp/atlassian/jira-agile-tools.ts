/**
 * SA4E-110 — Jira agile tools (5 tools) registered in-process.
 * boards, sprints, sprint_issues, backlog, epic_issues.
 */
import { registerLocalTool, LocalToolDefinition } from "../../backend-local-tools";
import { AtlassianHttpClient, toResult, toErrorResult } from "./atlassian-http-client";

/** Register Jira Agile/Scrum board tools */
export function registerJiraAgileTools(client: AtlassianHttpClient): void {
  registerTool("jira_get_boards", "Get all agile boards", {
    type: "object",
    properties: {
      startAt: { type: "number", default: 0 },
      maxResults: { type: "number", default: 50 },
    },
    required: [],
  }, async (args) => {
    const { startAt = 0, maxResults = 50 } = args as any;
    return toResult(await client.request("GET", `/rest/agile/1.0/board?startAt=${startAt}&maxResults=${maxResults}`));
  });

  registerTool("jira_get_sprints", "Get sprints for a board", {
    type: "object",
    properties: { board_id: { type: "number", description: "Board ID" } },
    required: ["board_id"],
  }, async (args) => {
    const { board_id } = args as any;
    return toResult(await client.request("GET", `/rest/agile/1.0/board/${board_id}/sprint`));
  });

  registerTool("jira_get_sprint_issues", "Get issues in a sprint", {
    type: "object",
    properties: {
      board_id: { type: "number" }, sprint_id: { type: "number" },
      startAt: { type: "number", default: 0 }, maxResults: { type: "number", default: 50 },
    },
    required: ["board_id", "sprint_id"],
  }, async (args) => {
    const { board_id, sprint_id, startAt = 0, maxResults = 50 } = args as any;
    const path = `/rest/agile/1.0/board/${board_id}/sprint/${sprint_id}/issue?startAt=${startAt}&maxResults=${maxResults}`;
    return toResult(await client.request("GET", path));
  });

  registerTool("jira_get_backlog", "Get backlog issues for a board", {
    type: "object",
    properties: {
      board_id: { type: "number" },
      startAt: { type: "number", default: 0 }, maxResults: { type: "number", default: 50 },
    },
    required: ["board_id"],
  }, async (args) => {
    const { board_id, startAt = 0, maxResults = 50 } = args as any;
    return toResult(await client.request("GET", `/rest/agile/1.0/board/${board_id}/backlog?startAt=${startAt}&maxResults=${maxResults}`));
  });

  registerTool("jira_get_epic_issues", "Get issues in an epic", {
    type: "object",
    properties: {
      board_id: { type: "number" }, epic_id: { type: "number" },
      startAt: { type: "number", default: 0 }, maxResults: { type: "number", default: 50 },
    },
    required: ["board_id", "epic_id"],
  }, async (args) => {
    const { board_id, epic_id, startAt = 0, maxResults = 50 } = args as any;
    const path = `/rest/agile/1.0/board/${board_id}/epic/${epic_id}/issue?startAt=${startAt}&maxResults=${maxResults}`;
    return toResult(await client.request("GET", path));
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
