/**
 * SA4E-108 — Project Type API Routes.
 * Serves KB-stored type configs to extension for hybrid detection.
 */
import { Hono } from 'hono';
import type { Logger } from 'pino';

/**
 * GET /project-types — returns all PROJECT_TYPE_CONFIG KB entries.
 */
export function createProjectTypeRoutes(registry: any, logger: Logger) {
  const app = new Hono();

  app.get('/project-types', async (c) => {
    try {
      const memory = registry.getModule('memory');
      if (!memory) return c.json({ configs: [], count: 0 });
      const engine = memory.getEngine();
      const results = await engine.search('project-type-config', 50, undefined, undefined, {
        userId: 'system',
        projectId: c.req.header('x-project-id') ?? 'default',
      });
      const configs = (results as any[])
        .filter((r: any) => r.entry.type === 'ARCHITECTURE')
        .map((r: any) => r.entry.content);
      return c.json({ configs, count: configs.length });
    } catch (err) {
      logger.error({ err }, '[project-types] Failed');
      return c.json({ configs: [], error: 'KB query failed' }, 500);
    }
  });

  return app;
}
