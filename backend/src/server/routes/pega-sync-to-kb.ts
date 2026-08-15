/**
 * SA4E-158 — POST /api/v1/pega/sync-to-kb
 * Triggers Phase 2: sync all indexed-but-not-synced Pega rules to KB + graph + enrichment.
 * Accepts projectId in body, returns batch sync result.
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

  /**
   * POST /pega/sync-to-kb — Sync indexed rules to KB for a project.
   * Body: { projectId: string }
   * Returns: { synced, skipped, errors, details[] }
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

      logger.info({ projectId: body.projectId }, '[pega-sync-to-kb] Starting KB sync');
      const result = await service.syncIndexedRulesToKb(body.projectId);
      logger.info({ projectId: body.projectId, synced: result.synced, errors: result.errors },
        '[pega-sync-to-kb] KB sync complete');

      return c.json({ data: result, error: null });
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
