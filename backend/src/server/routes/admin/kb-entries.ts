/**
 * KB entries routes — search, list, and detail for KB entries.
 * SA4E-50: All admin-db calls are awaited since they are now async.
 */

import { Hono } from 'hono';
import {
  getKbEntries, getKbEntryCount, getKbEntryById,
  searchKbEntries, recordQueryLog,
} from '../../../admin/admin-db.js';
import type { AdminContext } from './context.js';

export function createKbEntriesRoutes(ctx: AdminContext): Hono {
  const app = new Hono();

  app.post('/api/admin/search', async (c) => {
    const user = await ctx.requireAuth(c);
    if (user instanceof Response) return user;
    const permCheck = await ctx.requirePermission(c, user.userId, 'SEARCH_EXPLORE');
    if (permCheck instanceof Response) return permCheck;
    const maxResults = (permCheck.roleData as any)?.maxResults;
    const { query, debug } = await c.req.json();
    if (!query) return c.json({ results: [] });
    const startTime = Date.now();
    const realResults = await searchKbEntries(query, ctx.getRequestProjectId(c));
    if (realResults.items.length > 0) {
      const responseTimeMs = Date.now() - startTime;
      await recordQueryLog(query, responseTimeMs, realResults.items.length, user.userId);
      const resultLimit = (typeof maxResults === 'number' && maxResults > 0) ? Math.min(maxResults, 20) : 20;
      const results = realResults.items.slice(0, resultLimit).map((item: any) => ({
        id: item.id || item.entry_id || 'unknown',
        source: item.source || item.summary || 'unknown',
        content: (item.content || '').substring(0, 300),
        tier: item.tier || 'SHARED',
        score: item.score || 0.5,
        scores: item.scores || { similarity: +(item.score || 0.5).toFixed(3), keyword: 0, recency: 0, quality: 0 },
      }));
      return c.json({ results, debug: debug ? { queryTokens: query.split(/\s+/), totalCandidates: realResults.total, searchTimeMs: responseTimeMs } : undefined });
    }
    const mockResults = [
      { id: 'e1', source: 'project-structure', content: 'Code Intelligence indexes the project for semantic search and navigation...', tier: 'SHARED', score: 0.92, scores: { similarity: 0.85, keyword: 0.95, recency: 0.90, quality: 0.98 } },
      { id: 'e2', source: 'admin-portal', content: 'Admin portal provides web-based management of KB entries, users, and MCP servers...', tier: 'PROJECT', score: 0.87, scores: { similarity: 0.82, keyword: 0.88, recency: 0.85, quality: 0.93 } },
      { id: 'e3', source: 'mcp-integration', content: 'MCP servers are orchestrated through orchestration.json configuration...', tier: 'SHARED', score: 0.79, scores: { similarity: 0.75, keyword: 0.72, recency: 0.95, quality: 0.74 } },
    ];
    const filtered = mockResults.filter(r => r.source.toLowerCase().includes(query.toLowerCase()) || r.content.toLowerCase().includes(query.toLowerCase()));
    const responseTimeMs = Date.now() - startTime;
    let finalResults = filtered.length > 0 ? filtered : mockResults.slice(0, 2);
    if (typeof maxResults === 'number' && maxResults > 0) finalResults = finalResults.slice(0, maxResults);
    await recordQueryLog(query, responseTimeMs, finalResults.length, user.userId);
    return c.json({ results: finalResults, debug: debug ? { queryTokens: query.split(/\s+/), totalCandidates: 42, searchTimeMs: responseTimeMs } : undefined });
  });

  app.get('/api/admin/kb/entries', async (c) => {
    const user = await ctx.requireAuth(c);
    if (user instanceof Response) return user;
    const permCheck = await ctx.requirePermission(c, user.userId, 'KB_READ');
    if (permCheck instanceof Response) return permCheck;
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const sortBy = c.req.query('sortBy') || 'created_at';
    const sortDir = (c.req.query('sortDir') || 'desc') as 'asc' | 'desc';
    const result = await getKbEntries(page, pageSize, sortBy, sortDir, ctx.getRequestProjectId(c));
    const allowedTiers = (permCheck.roleData as any)?.allowedTiers;
    let entries = result.items;
    if (Array.isArray(allowedTiers)) entries = entries.filter((e: any) => { const t = e.tier || e.scope || 'SHARED'; return allowedTiers.includes(t); });
    return c.json({ entries, total: Array.isArray(allowedTiers) ? entries.length : result.total, page, pageSize, totalPages: Math.ceil((Array.isArray(allowedTiers) ? entries.length : result.total) / pageSize) });
  });

  app.get('/api/admin/kb/entries/:id', async (c) => {
    const user = await ctx.requireAuth(c);
    if (user instanceof Response) return user;
    const permCheck = await ctx.requirePermission(c, user.userId, 'KB_READ');
    if (permCheck instanceof Response) return permCheck;
    const entryId = c.req.param('id');

    if (entryId.startsWith('code:') || entryId.startsWith('sym-')) {
      const symbolId = entryId.startsWith('code:') ? entryId.replace('code:', '') : entryId.replace('sym-', '');
      const detail = await getCodeSymbolDetail(symbolId, ctx);
      if (detail) return c.json(detail);
      return c.json({ error: 'Code symbol not found' }, 404);
    }

    // Pega graph nodes: entry_id = "pega:FQN" → lookup KB entry by source = FQN
    if (entryId.startsWith('pega:')) {
      const fqn = entryId.replace('pega:', '');
      const { getIndexAdapter } = await import('../../../admin/db/core.js');
      const adapter = getIndexAdapter();
      // Get the main rule entry
      const entry = await adapter.getAsync<any>(
        "SELECT * FROM knowledge_entries WHERE source = ? AND (type = 'PEGA_RULE' OR type = 'PEGA_DATA') LIMIT 1",
        [fqn],
      );
      if (!entry) return c.json({ error: 'Pega rule not found' }, 404);
      // Parse rule JSON to extract meaningful info
      let ruleInfo = '';
      try {
        const ruleJson = JSON.parse(entry.content);
        const label = ruleJson.pyLabel || ruleJson.pyDescription || '';
        const memo = ruleJson.pyDeleteMemo || ruleJson.pyMemo || '';
        const description = ruleJson.pyDescription || ruleJson.pyDeleteMemo || ruleJson.pyMemo || '';
        const className = ruleJson.pyClassName || '';
        const ruleType = ruleJson.pxObjClass || '';
        const parts: string[] = [];
        if (label) parts.push(`**${label}**`);
        if (description) parts.push(`> ${description}`);
        parts.push(`| Field | Value |\n|---|---|\n| Class | ${className} |\n| Rule Type | ${ruleType} |`);
        // Extract Steps for Activity rules
        const steps = ruleJson.steps || ruleJson.pySteps || [];
        if (Array.isArray(steps) && steps.length > 0) {
          parts.push('\n**Steps:**');
          steps.forEach((step: any, i: number) => {
            // Real Pega Activity step: Embed-ActivitySteps format
            const method = step.pyStepsActivityName || step.pyMethod || step.pyStepType || '';
            const desc = step.pyStepsDescription || step.pxStepDefaultDescription || step.pyLabel || step.pyStepDescription || '';
            const params = step.pyMethodParameters || '';
            const when = step.pyWhenCondition || step.pyWhenRule || '';
            const num = step.pyStepNum || step.pyStepNumber || String(i + 1);
            // Format: "1. **Method** — description [WHEN: condition]"
            const methodStr = method ? `**${method}**` : '';
            const paramStr = params ? ` → \`${params}\`` : '';
            const descStr = desc ? ` — ${desc}` : '';
            const whenStr = when ? ` [WHEN: ${when}]` : '';
            // Show call params if available
            let callParams = '';
            if (step.pyStepsCallParams && typeof step.pyStepsCallParams === 'object') {
              const cp = Object.entries(step.pyStepsCallParams).filter(([k]) => k !== 'pyTempPlaceHolder');
              if (cp.length > 0) callParams = ` (${cp.map(([k, v]) => `${k}=${v}`).join(', ')})`;
            }
            if (method || desc) parts.push(`${num}. ${methodStr}${paramStr}${callParams}${descStr}${whenStr}`);
          });
        }
        // Extract When conditions for Decision rules
        const whens = ruleJson.pyConditions || ruleJson.pyDecisionExpressions || [];
        if (Array.isArray(whens) && whens.length > 0) {
          parts.push('\n**Conditions:**');
          whens.forEach((w: any) => {
            const expr = w.pyExpression || w.pyCondition || JSON.stringify(w);
            parts.push(`- ${expr}`);
          });
        }
        // Extract properties for Data/Class rules
        const props = ruleJson.pyPropertyModes || ruleJson.pyProperties || [];
        if (Array.isArray(props) && props.length > 0) {
          parts.push(`\n**Properties:** ${props.length} defined`);
          props.slice(0, 10).forEach((p: any) => {
            const name = p.pyPropertyName || p.pyName || p.pyPropertyMode || '';
            const type = p.pyPropertyType || p.pyType || '';
            if (name) parts.push(`- \`${name}\` (${type || 'Text'})`);
          });
          if (props.length > 10) parts.push(`- ... and ${props.length - 10} more`);
        }
        ruleInfo = parts.join('\n');
      } catch (err) { ruleInfo = entry.summary || fqn; }
      return c.json({
        id: entryId,
        title: fqn.split(':').pop() || fqn,
        content: ruleInfo,
        tier: entry.tier || 'SEMANTIC',
        type: entry.type || 'PEGA_RULE',
        source: fqn,
        tags: entry.tags ? entry.tags.split(',').map((t: string) => t.trim()) : [],
        links: [],
        createdAt: entry.created_at,
        updatedAt: entry.updated_at,
      });
    }

    const lookupId = entryId.startsWith('doc-') ? entryId.replace('doc-', '') : entryId;
    const entry = await getKbEntryById(lookupId);
    if (!entry) return c.json({ error: 'Entry not found' }, 404);
    const allowedTiers = (permCheck.roleData as any)?.allowedTiers;
    if (Array.isArray(allowedTiers)) {
      const entryTier = entry.tier || entry.scope || 'SHARED';
      if (!allowedTiers.includes(entryTier)) return c.json({ error: 'Forbidden: entry tier not in allowedTiers' }, 403);
    }
    const tags = ctx.kbTags[entryId] || [];
    const links = ctx.kbLinks[entryId] || [];
    return c.json({
      id: entry.id || entry.entry_id || entryId,
      title: entry.title || entry.source || 'Untitled',
      content: entry.content || '',
      tier: entry.tier || entry.scope || 'SHARED',
      type: entry.content_type || entry.type || 'document',
      source: entry.source || '',
      tags, links,
      qualityScore: entry.quality_score || entry.score || null,
      createdAt: entry.created_at || null,
      updatedAt: entry.updated_at || null,
    });
  });

  return app;
}

/** Fetch code symbol detail via SymbolRepository for KB Graph node click. */
async function getCodeSymbolDetail(symbolId: string, ctx: AdminContext): Promise<Record<string, unknown> | null> {
  try {
    const detail = await ctx.db.symbol.getSymbolDetail(symbolId);
    if (!detail) return null;
    const lines = detail.startLine && detail.endLine ? `Lines ${detail.startLine}\u2013${detail.endLine}` : '';
    // SA4E-104: Fetch body/pseudo code from body_embeddings if available
    let bodyCode = '';
    try {
      const numId = parseInt(symbolId, 10);
      if (!isNaN(numId)) {
        const { getIndexAdapter } = await import('../../../admin/db/core.js');
        const indexAdapter = getIndexAdapter();
        const bodyRow = await indexAdapter.getAsync<{ embedding: Buffer | Uint8Array }>(
          'SELECT embedding FROM body_embeddings WHERE symbol_id = ? AND chunk_index = 0', [numId],
        );
        if (bodyRow && bodyRow.embedding) {
          bodyCode = Buffer.from(bodyRow.embedding).toString('utf-8');
        }
      }
    } catch (err) { /* body_embeddings table may not exist */ }
    const contentParts = [
      detail.signature ? `**Signature:** \`${detail.signature}\`` : '',
      detail.docComment ? `**Doc:** ${detail.docComment}` : '',
      `**Kind:** ${detail.kind}`, `**File:** ${detail.relativePath}`,
      lines ? `**Location:** ${lines}` : '',
      detail.module ? `**Module:** ${detail.module}` : '',
      detail.visibility ? `**Visibility:** ${detail.visibility}` : '',
      detail.parentSymbol ? `**Parent:** ${detail.parentSymbol}` : '',
      bodyCode ? `\n**Code:**\n\`\`\`typescript\n${bodyCode.substring(0, 2000)}\n\`\`\`` : '',
    ].filter(Boolean).join('\n');
    return {
      id: `code:${detail.id}`,
      title: `${detail.name} (${detail.kind})`,
      content: contentParts, tier: 'CODE', type: 'CODE_ENTITY',
      source: detail.relativePath || '',
      tags: [detail.kind, detail.language, detail.module].filter(Boolean),
      links: [], qualityScore: null, createdAt: null, updatedAt: null,
    };
  } catch (err) {
    ctx.logger.warn({ symbolId }, 'Failed to fetch code symbol detail');
    return null;
  }
}
