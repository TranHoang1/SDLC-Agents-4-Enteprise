/**
 * SA4E-122: Learning dispatcher handler — routes mem_learn tool calls
 * to SessionAnalyzer for pattern extraction + ingestion,
 * and ClusteringService for periodic clustering.
 */

import type { MemoryEngine } from '../engine/core.js';
import type { ScopeContext } from '../models.js';
import { SessionAnalyzer } from '../learning/SessionAnalyzer.js';
import { ClusteringService } from '../learning/ClusteringService.js';

type Args = Record<string, unknown>;

/**
 * Handle mem_learn tool call.
 * Actions: 'analyze' (default) — extract patterns from transcript.
 *          'cluster' — run clustering on existing instincts.
 * @param engine MemoryEngine instance
 * @param scopeCtx Scope context for isolation
 * @param args Tool arguments (transcript, action)
 * @returns JSON string with learning results
 */
export async function handleLearn(
  engine: MemoryEngine,
  scopeCtx: ScopeContext | undefined,
  args: Args,
): Promise<string> {
  const action = (args.action as string) || 'analyze';

  switch (action) {
    case 'analyze':
      return analyzeSession(engine, scopeCtx, args);
    case 'cluster':
      return runClustering(engine, scopeCtx);
    default:
      return JSON.stringify({ error: `Unknown action: ${action}. Use 'analyze' or 'cluster'.` });
  }
}

/** Extract patterns from session transcript and ingest as instincts. */
async function analyzeSession(
  engine: MemoryEngine,
  scopeCtx: ScopeContext | undefined,
  args: Args,
): Promise<string> {
  const transcript = (args.transcript as string) || '';
  if (!transcript.trim()) {
    return JSON.stringify({ error: 'transcript is required (non-empty session text)' });
  }

  const analyzer = new SessionAnalyzer(engine);
  const result = await analyzer.analyze(transcript, scopeCtx);

  return JSON.stringify({
    status: 'ok',
    action: 'analyze',
    extractedCount: result.extractedCount,
    ingestedCount: result.ingested.length,
    skippedCount: result.skippedCount,
    ingested: result.ingested.map(p => ({
      entryId: p.entryId,
      type: p.type,
      confidence: p.confidence,
      content: p.content.slice(0, 100),
    })),
  });
}

/** Run clustering on existing auto-learned instincts. */
async function runClustering(
  engine: MemoryEngine,
  scopeCtx: ScopeContext | undefined,
): Promise<string> {
  const service = new ClusteringService(engine);
  const result = await service.cluster(scopeCtx);

  return JSON.stringify({
    status: 'ok',
    action: 'cluster',
    clustersFound: result.clustersFound,
    proceduresCreated: result.proceduresCreated,
    clusters: result.clusters,
  });
}
