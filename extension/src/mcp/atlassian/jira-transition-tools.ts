/**
 * SA4E-110 — Jira transition tools (3 tools) registered in-process.
 * get_transitions, transition_issue (by ID), transition_by_name (fuzzy).
 */
import { registerLocalTool, LocalToolDefinition } from "../../backend-local-tools";
import { AtlassianHttpClient, toResult, toErrorResult } from "./atlassian-http-client";

interface Transition { id: string; name: string }

/** Register Jira transition tools including fuzzy name matching */
export function registerJiraTransitionTools(client: AtlassianHttpClient): void {
  registerTool("jira_get_transitions", "Get available transitions for an issue", {
    type: "object",
    properties: { issue_key: { type: "string", description: "Issue key" } },
    required: ["issue_key"],
  }, async (args) => {
    const { issue_key } = args as any;
    return toResult(await client.request("GET", `/rest/api/2/issue/${issue_key}/transitions`));
  });

  registerTool("jira_transition_issue", "Transition an issue by transition ID", {
    type: "object",
    properties: {
      issue_key: { type: "string" }, transition_id: { type: "string" },
      comment: { type: "string" }, fields: { type: "object" },
    },
    required: ["issue_key", "transition_id"],
  }, async (args) => {
    const { issue_key, transition_id, fields, comment } = args as any;
    const body: Record<string, unknown> = { transition: { id: transition_id } };
    if (fields) body.fields = fields;
    if (comment) body.update = { comment: [{ add: { body: comment } }] };
    await client.request("POST", `/rest/api/2/issue/${issue_key}/transitions`, body);
    return toResult({ status: 204, data: { success: true, issue_key } });
  });

  registerTool("jira_transition_by_name", "Transition an issue by name (fuzzy match)", {
    type: "object",
    properties: {
      issue_key: { type: "string" }, transition_name: { type: "string" },
      comment: { type: "string" }, fields: { type: "object" },
    },
    required: ["issue_key", "transition_name"],
  }, async (args) => {
    const { issue_key, transition_name, fields, comment } = args as any;
    const resolved = await resolveTransition(client, issue_key, transition_name);
    if (resolved.error) return toErrorResult(new Error(resolved.error));
    const body: Record<string, unknown> = { transition: { id: resolved.id } };
    if (fields) body.fields = fields;
    if (comment) body.update = { comment: [{ add: { body: comment } }] };
    await client.request("POST", `/rest/api/2/issue/${issue_key}/transitions`, body);
    return toResult({ status: 204, data: { success: true, issue_key, transition: resolved.name } });
  });
}

/** Cascading fuzzy match: exact → levenshtein ≤ 2 → fail */
async function resolveTransition(
  client: AtlassianHttpClient, issueKey: string, inputName: string,
): Promise<{ id?: string; name?: string; error?: string }> {
  const res = await client.request("GET", `/rest/api/2/issue/${issueKey}/transitions`);
  const transitions = ((res.data as any).transitions as Transition[]) ?? [];
  const normalized = normalize(inputName);

  const exact = transitions.find(t => normalize(t.name) === normalized);
  if (exact) return { id: exact.id, name: exact.name };

  const fuzzy = transitions.filter(t => levenshtein(normalize(t.name), normalized) <= 2);
  if (fuzzy.length === 1) return { id: fuzzy[0].id, name: fuzzy[0].name };
  if (fuzzy.length > 1) return { error: `Multiple matches: [${fuzzy.map(t => t.name).join(", ")}]` };

  const available = transitions.map(t => t.name).join(", ");
  return { error: `No matching transition. Available: [${available}]` };
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Simple Levenshtein distance for fuzzy matching */
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prevDiag = prev[0]; prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = a[i - 1] === b[j - 1] ? prevDiag : Math.min(prevDiag, prev[j], prev[j - 1]) + 1;
      prevDiag = tmp;
    }
  }
  return prev[b.length];
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
