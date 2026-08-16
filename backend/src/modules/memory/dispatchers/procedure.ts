import type { MemoryEngine } from '../engine/core.js';
import type { ScopeContext } from '../models.js';

type Args = Record<string, unknown>;

interface ProcedureStep {
  tool: string;
  args: Record<string, unknown>;
}

const PROCEDURE_TYPE = 'PROCEDURE';

function parseSteps(raw: unknown): ProcedureStep[] {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as ProcedureStep[]; } catch (err) { console.debug('[procedure] Failed to parse steps JSON:', (err as Error).message); return []; }
  }
  if (Array.isArray(raw)) return raw as ProcedureStep[];
  return [];
}

function procedureSummary(content: string): string {
  return content.length <= 120 ? content : content.slice(0, 117) + '...';
}

export async function handleProcedure(
  engine: MemoryEngine,
  scopeCtx: ScopeContext | undefined,
  args: Args,
): Promise<string> {
  const action = (args.action as string) || 'list';
  const adapter = engine.getAdapter();
  const dialect = engine.getDialect();

  switch (action) {
    case 'create': {
      const name = (args.name as string) || '';
      if (!name) return JSON.stringify({ error: 'name is required' });
      const description = (args.description as string) || name;
      const rawSteps = args.steps;
      const steps = parseSteps(rawSteps);
      if (rawSteps !== undefined && typeof rawSteps === 'string') {
        try { JSON.parse(rawSteps); } catch (err) {
          return JSON.stringify({ error: 'steps must be a valid JSON array of {tool, args} objects' });
        }
      }

      const content = `Procedure: ${name}\n\n${description}\n\nSteps:\n${
        steps.map((s, i) => `${i + 1}. ${s.tool}(${JSON.stringify(s.args)})`).join('\n')
      }`;
      const structuredMap = JSON.stringify({ steps, version: 1 });

      const id = await engine.insert({
        content,
        summary: `[Procedure] ${name}`,
        type: PROCEDURE_TYPE,
        tier: 'SEMANTIC',
        scope: 'PROJECT',
        user_id: scopeCtx?.userId ?? null,
        project_id: scopeCtx?.projectId ?? null,
        // Name-scoped source: distinct procedures must not collapse into one row
        // via the (source, project_id) upsert key in MemoryEngineCrud.insert.
        source: `/procedure/${name}`,
        tags: `procedure,${name},${steps.map(s => s.tool).join(',')}`,
        agent_name: 'system',
      });

      await adapter.runAsync(
        `UPDATE knowledge_entries SET structured_map = ?, updated_at = ${dialect.now()} WHERE id = ?`,
        [structuredMap, id],
      );

      return JSON.stringify({ status: 'created', id, name, stepCount: steps.length });
    }

    case 'list': {
      const limit = (args.limit as number) || 20;
      const rows = await adapter.allAsync<any>(
        `SELECT id, summary, content, tags, created_at FROM knowledge_entries
         WHERE type = ? AND archived = 0 ORDER BY created_at DESC, id DESC LIMIT ?`,
        [PROCEDURE_TYPE, limit],
      );
      const procedures = rows.map((r: any) => ({
        id: r.id,
        name: r.summary.replace('[Procedure] ', ''),
        description: procedureSummary(r.content),
        tags: r.tags,
        created_at: r.created_at,
      }));
      return JSON.stringify({ procedures, count: procedures.length });
    }

    case 'get': {
      const id = (args.id as number) || 0;
      const name = (args.name as string) || '';
      let entry: any;
      if (id) {
        entry = await engine.findById(id);
      } else if (name) {
        entry = await adapter.getAsync<any>(
          `SELECT * FROM knowledge_entries WHERE type = ? AND summary LIKE ? AND archived = 0 LIMIT 1`,
          [PROCEDURE_TYPE, `%${name}%`],
        );
      }
      if (!entry) return JSON.stringify({ error: 'Procedure not found' });

      let steps: ProcedureStep[] = [];
      try {
        const parsed = JSON.parse(entry.structured_map || '{}');
        steps = parsed.steps || [];
      } catch (err) { console.debug('[procedure] ignore :', (err as Error).message); }

      return JSON.stringify({
        id: entry.id,
        name: entry.summary.replace('[Procedure] ', ''),
        content: entry.content,
        steps,
        tags: entry.tags,
        created_at: entry.created_at,
      });
    }

    case 'delete': {
      const id = (args.id as number) || 0;
      if (!id) {
        const name = (args.name as string) || '';
        if (!name) return JSON.stringify({ error: 'id or name required' });
        const entry = await adapter.getAsync<any>(
          `SELECT id FROM knowledge_entries WHERE type = ? AND summary LIKE ? LIMIT 1`,
          [PROCEDURE_TYPE, `%${name}%`],
        );
        if (!entry) return JSON.stringify({ error: 'Procedure not found' });
        await engine.deleteEntry(entry.id);
        return JSON.stringify({ status: 'deleted', id: entry.id });
      }
      await engine.deleteEntry(id);
      return JSON.stringify({ status: 'deleted', id });
    }

    case 'search': {
      const query = (args.query as string) || '';
      const limit = (args.limit as number) || 20;
      const results = await engine.search(query, limit, 'SEMANTIC', PROCEDURE_TYPE, scopeCtx);
      const procedures = results.map(r => ({
        id: r.entry.id,
        name: r.entry.summary.replace('[Procedure] ', ''),
        description: procedureSummary(r.entry.content),
        score: r.score,
        matchType: r.matchType,
      }));
      return JSON.stringify({ procedures, count: procedures.length });
    }

    case 'share': {
      const id = (args.id as number) || 0;
      const name = (args.name as string) || '';
      if (!id && !name) return JSON.stringify({ error: 'id or name required' });
      let entry: any;
      if (id) {
        entry = await engine.findById(id);
      } else {
        entry = await adapter.getAsync<any>(
          `SELECT * FROM knowledge_entries WHERE type = ? AND summary LIKE ? AND archived = 0 LIMIT 1`,
          [PROCEDURE_TYPE, `%${name}%`],
        );
      }
      if (!entry) return JSON.stringify({ error: 'Procedure not found' });
      if (entry.scope === 'SHARED') return JSON.stringify({ status: 'already_shared', id: entry.id });
      await adapter.runAsync(
        `UPDATE knowledge_entries SET scope = 'SHARED', updated_at = ${dialect.now()} WHERE id = ?`,
        [entry.id],
      );
      return JSON.stringify({ status: 'shared', id: entry.id, name: entry.summary.replace('[Procedure] ', '') });
    }

    case 'list_shared': {
      const limit = (args.limit as number) || 20;
      const rows = await adapter.allAsync<any>(
        `SELECT id, summary, content, tags, created_at FROM knowledge_entries
         WHERE type = ? AND scope = 'SHARED' AND archived = 0 ORDER BY created_at DESC, id DESC LIMIT ?`,
        [PROCEDURE_TYPE, limit],
      );
      const procedures = rows.map((r: any) => ({
        id: r.id,
        name: r.summary.replace('[Procedure] ', ''),
        description: procedureSummary(r.content),
        tags: r.tags,
        created_at: r.created_at,
      }));
      return JSON.stringify({ procedures, count: procedures.length });
    }

    default:
      return JSON.stringify({ error: `Unknown action: ${action}` });
  }
}

export async function handleSkillCapture(
  engine: MemoryEngine,
  scopeCtx: ScopeContext | undefined,
  args: Args,
): Promise<string> {
  const name = (args.name as string) || '';
  if (!name) return JSON.stringify({ error: 'name is required' });
  const description = (args.description as string) || `Captured skill: ${name}`;
  const maxTurns = (args.max_turns as number) || 20;
  const sessionId = (args.session_id as string) || engine.getSessionId() || '';
  const filterTools = (args.filter_tools as string) || '';
  const filterList = filterTools ? filterTools.split(',').map(t => t.trim()).filter(Boolean) : [];

  if (!sessionId) return JSON.stringify({ error: 'No active session and no session_id provided' });

  const adapter = engine.getAdapter();

  const turns = await adapter.allAsync<any>(
    `SELECT role, tool_calls FROM conversation_turns
     WHERE session_id = ? AND tool_calls IS NOT NULL AND tool_calls != ''
     ORDER BY turn_number DESC LIMIT ?`,
    [sessionId, maxTurns],
  );

  if (turns.length === 0) return JSON.stringify({ error: 'No tool calls found in session' });

  const allSteps: ProcedureStep[] = [];
  const seen = new Set<string>();

  for (const turn of turns) {
    if (!turn.tool_calls) continue;
    try {
      const calls = JSON.parse(turn.tool_calls);
      const callsArr = Array.isArray(calls) ? calls : [calls];
      for (const call of callsArr) {
        const toolName = (call.name || call.toolName || call.tool_name || '') as string;
        if (!toolName) continue;
        if (filterList.length > 0 && !filterList.includes(toolName)) continue;
        const key = `${toolName}:${JSON.stringify(call.arguments || call.args || {})}`;
        if (seen.has(key)) continue;
        seen.add(key);
        allSteps.push({
          tool: toolName,
          args: (call.arguments || call.args || {}) as Record<string, unknown>,
        });
      }
    } catch (err) { console.debug('[procedure] skip unparseable :', (err as Error).message); }
  }

  if (allSteps.length === 0) return JSON.stringify({ error: 'No parseable tool calls found' });
  allSteps.reverse();

  const content = `Procedure: ${name}\n\n${description}\n\nSteps:\n${
    allSteps.map((s, i) => `${i + 1}. ${s.tool}(${JSON.stringify(s.args)})`).join('\n')
  }`;
  const structuredMap = JSON.stringify({ steps: allSteps, version: 1, captured_from: sessionId });
  const tagNames = `procedure,captured,${name},${allSteps.map(s => s.tool).join(',')}`;

  const id = await engine.insert({
    content,
    summary: `[Procedure] ${name}`,
    type: PROCEDURE_TYPE,
    tier: 'SEMANTIC',
    scope: 'PROJECT',
    user_id: scopeCtx?.userId ?? null,
    project_id: scopeCtx?.projectId ?? null,
    // Name-scoped source: distinct captured skills must not collapse into one row.
    source: `/procedure/capture/${name}`,
    tags: tagNames,
    agent_name: 'system',
  });

  const dialect = engine.getDialect();
  await adapter.runAsync(
    `UPDATE knowledge_entries SET structured_map = ?, updated_at = ${dialect.now()} WHERE id = ?`,
    [structuredMap, id],
  );

  return JSON.stringify({
    status: 'captured',
    id,
    name,
    stepCount: allSteps.length,
    steps: allSteps.map(s => s.tool),
  });
}

export async function handleSkillExecute(
  engine: MemoryEngine,
  scopeCtx: ScopeContext | undefined,
  args: Args,
  dispatch?: (toolName: string, args: Args) => Promise<string | null>,
): Promise<string> {
  const procedureId = (args.procedure_id as number) || 0;
  const name = (args.name as string) || '';
  const variablesRaw = (args.variables as string) || '{}';
  let variables: Record<string, unknown> = {};
  try { variables = JSON.parse(typeof variablesRaw === 'string' ? variablesRaw : '{}'); } catch (err) { console.debug('[procedure] ignore :', (err as Error).message); }

  const adapter = engine.getAdapter();
  let entry: any;

  if (procedureId) {
    entry = await engine.findById(procedureId);
  } else if (name) {
    entry = await adapter.getAsync<any>(
      `SELECT * FROM knowledge_entries WHERE type = ? AND summary LIKE ? AND archived = 0 LIMIT 1`,
      [PROCEDURE_TYPE, `%${name}%`],
    );
  }

  if (!entry) return JSON.stringify({ error: 'Procedure not found' });

  let steps: ProcedureStep[] = [];
  try {
    const parsed = JSON.parse(entry.structured_map || '{}');
    steps = parsed.steps || [];
  } catch (err) { console.debug('[procedure] ignore :', (err as Error).message); }

  if (steps.length === 0) return JSON.stringify({ error: 'Procedure has no steps' });

  const substituted = steps.map(step => {
    const argsStr = JSON.stringify(step.args);
    const substituted = argsStr.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const val = variables[key];
      return val !== undefined ? String(val) : `{{${key}}}`;
    });
    return { tool: step.tool, args: JSON.parse(substituted) as Record<string, unknown> };
  });

  if (!dispatch) {
    return JSON.stringify({
      status: 'dry-run',
      procedureId: entry.id,
      name: entry.summary.replace('[Procedure] ', ''),
      totalSteps: substituted.length,
      steps: substituted,
    });
  }

  const results: { step: number; tool: string; status: string; output?: string; error?: string }[] = [];

  for (let i = 0; i < substituted.length; i++) {
    const step = substituted[i];
    try {
      const output = await dispatch(step.tool, step.args);
      results.push({
        step: i + 1,
        tool: step.tool,
        status: output !== null ? 'ok' : 'no_handler',
        output: output ?? undefined,
      });
    } catch (e: any) {
      results.push({
        step: i + 1,
        tool: step.tool,
        status: 'error',
        error: String(e?.message ?? e),
      });
    }
  }

  const succeeded = results.filter(r => r.status === 'ok').length;
  const failed = results.filter(r => r.status === 'error').length;

  return JSON.stringify({
    status: 'completed',
    procedureId: entry.id,
    name: entry.summary.replace('[Procedure] ', ''),
    totalSteps: substituted.length,
    succeeded,
    failed,
    results,
  });
}
