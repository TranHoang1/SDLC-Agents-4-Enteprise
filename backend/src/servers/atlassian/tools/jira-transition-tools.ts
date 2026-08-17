/**
 * SA4E-110 - Jira transition tools (3 tools).
 * get_transitions, transition_issue, transition_by_name with fuzzy match.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JiraApiClient } from '../clients/jira-client.js';
import { GetTransitionsSchema, TransitionSchema, TransitionByNameSchema } from '../models/jira-schemas.js';
import { createSuccessResult, createErrorResult } from '../models/error-schemas.js';
import { AtlassianErrorCode } from '../models/types.js';
import { AtlassianApiError } from '../clients/base-client.js';
import { levenshtein } from '../utils/levenshtein.js';
import { normalizeForComparison } from '../utils/normalize.js';

interface Transition { id: string; name: string }

/** Register Jira transition tools including fuzzy name matching */
export function registerJiraTransitionTools(server: McpServer, client: JiraApiClient): void {
  server.registerTool('jira_get_transitions', { description: 'Get available transitions for an issue', inputSchema: GetTransitionsSchema }, async (args, _extra) => {
    const parsed = GetTransitionsSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try {
      const res = await client.getTransitions(parsed.data.issue_key);
      return createSuccessResult(res.data);
    } catch (e) { return handleError(e); }
  });

  server.registerTool('jira_transition_issue', { description: 'Transition an issue by transition ID', inputSchema: TransitionSchema }, async (args, _extra) => {
    const parsed = TransitionSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try {
      await client.transitionIssue(parsed.data.issue_key, parsed.data.transition_id, parsed.data.fields, parsed.data.comment);
      return createSuccessResult({ success: true, issue_key: parsed.data.issue_key });
    } catch (e) { return handleError(e); }
  });

  server.registerTool('jira_transition_by_name', { description: 'Transition an issue by name (fuzzy match)', inputSchema: TransitionByNameSchema }, async (args, _extra) => {
    const parsed = TransitionByNameSchema.safeParse(args);
    if (!parsed.success) return createErrorResult(AtlassianErrorCode.VALIDATION_ERROR, parsed.error.message);
    try {
      const { issue_key, transition_name, fields, comment } = parsed.data;
      const resolved = await resolveTransition(client, issue_key, transition_name);
      if (resolved.error) return createErrorResult(AtlassianErrorCode.NOT_FOUND, resolved.error);
      await client.transitionIssue(issue_key, resolved.id!, fields, comment);
      return createSuccessResult({ success: true, issue_key, transition: resolved.name });
    } catch (e) { return handleError(e); }
  });
}

/** Cascading fuzzy match algorithm for transition name resolution */
async function resolveTransition(
  client: JiraApiClient, issueKey: string, inputName: string
): Promise<{ id?: string; name?: string; error?: string }> {
  const res = await client.getTransitions(issueKey);
  const transitions = ((res.data as Record<string, unknown>).transitions as Transition[]) ?? [];
  const normalized = normalizeForComparison(inputName);

  // Step 1: Exact match (case-insensitive)
  const exact = transitions.find(t => normalizeForComparison(t.name) === normalized);
  if (exact) return { id: exact.id, name: exact.name };

  // Step 2: Fuzzy match (levenshtein <= 2)
  const fuzzy = transitions.filter(t => levenshtein(normalizeForComparison(t.name), normalized) <= 2);

  if (fuzzy.length === 1) return { id: fuzzy[0].id, name: fuzzy[0].name };
  if (fuzzy.length > 1) {
    const names = fuzzy.map(t => t.name).join(', ');
    return { error: `Multiple fuzzy matches: [${names}]. Please be more specific.` };
  }

  // Step 3: No matches
  const available = transitions.map(t => t.name).join(', ');
  return { error: `No matching transition. Available: [${available}]` };
}

function handleError(e: unknown) {
  if (e instanceof AtlassianApiError) return createErrorResult(e.code, e.message);
  return createErrorResult(AtlassianErrorCode.UNKNOWN, (e as Error).message);
}