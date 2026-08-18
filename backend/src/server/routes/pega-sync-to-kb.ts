/**
 * SA4E-158 — POST /api/v1/pega/sync-to-kb
 * Triggers Phase 2: re-project Pega code graph nodes for a project.
 * SA4E-171: rules already live in symbols (indexed by Phase 1) — no KB writes.
 */
import { Hono } from 'hono';
import type { Logger } from 'pino';
import type { ModuleRegistry } from '../../modules/ModuleRegistry.js';
import { PegaService } from '../../modules/pega/PegaService.js';

/**
 * Create route for Pega KB sync endpoint.
 * @param registry - Module registry for accessing memory/PegaService
 * @param logger - Pino logger instance
 */
export function createPegaSyncToKbRoutes(registry: ModuleRegistry, logger: Logger): Hono {
  const app = new Hono();

  /** Lazily resolve PegaService from memory module */
  const resolvePegaService = (): PegaService | null => {
    const memModule = registry.getModule('memory') as any;
    if (!memModule || memModule.status !== 'ready') return null;
    return new PegaService(memModule.getEngine());
  };

  /** Check if LLM TagAnalyzer is available (TaskWorker has it set). */
  const isLlmAvailable = (): boolean => {
    const memModule = registry.getModule('memory') as any;
    if (!memModule) return false;
    const worker = memModule.taskWorker;
    return !!(worker as any)?.tagAnalyzer;
  };

  /**
   * POST /pega/sync-to-kb — Sync indexed rules to KB for a project.
   * Body: { projectId: string }
   * Returns: { synced, skipped, errors, llmStatus, details[] }
   */
  app.post('/pega/sync-to-kb', async (c) => {
    const service = resolvePegaService();
    if (!service) {
      return c.json({
        data: null,
        error: { code: 'NOT_READY', message: 'Memory module not ready' },
      }, 503);
    }

    try {
      const body = await c.req.json<{ projectId: string }>();
      if (!body.projectId) {
        return c.json({
          data: null,
          error: { code: 'INVALID_INPUT', message: 'projectId is required' },
        }, 400);
      }

      // Duplicate prevention: check if there are already pending enrichment tasks for this project
      const pendingCount = await checkPendingTaskCount(registry, body.projectId);
      if (pendingCount > 100) {
        logger.info({ projectId: body.projectId, pendingCount },
          '[pega-sync-to-kb] Skipped — enrichment already in progress');
        return c.json({
          data: { synced: 0, skipped: 0, errors: 0, details: [],
            llmStatus: `⚠️ Enrichment already in progress (${pendingCount} tasks pending). Wait for completion.`,
            llmReady: isLlmAvailable(), alreadyRunning: true, pendingCount },
          error: null,
        });
      }

      logger.info({ projectId: body.projectId }, '[pega-sync-to-kb] Starting graph sync');
      const result = await service.syncIndexedRulesToKb(body.projectId);

      logger.info({ projectId: body.projectId, synced: result.synced, errors: result.errors },
        '[pega-sync-to-kb] Graph sync complete');

      return c.json({ data: { ...result }, error: null });
    } catch (err: any) {
      logger.error({ err }, '[pega-sync-to-kb] Sync failed');
      return c.json({
        data: null,
        error: { code: 'INTERNAL_ERROR', message: err.message },
      }, 500);
    }
  });

  return app;
}

/** Check how many pending/processing tasks exist for TAG_ENRICHMENT. */
async function checkPendingTaskCount(registry: ModuleRegistry, _projectId: string): Promise<number> {
  try {
    const memModule = registry.getModule('memory') as any;
    if (!memModule?.taskWorker) return 0;
    const stats = await memModule.taskWorker.getStats();
    return (stats.pending || 0) + (stats.processing || 0);
  } catch { return 0; }
}
