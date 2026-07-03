/**
 * Health endpoint — GET /health
 * Returns backend status, version, uptime, and module health.
 * Implements: UC-1, UC-3, UC-4, BR-13, BR-27, BR-30
 */

import { Hono } from 'hono';
import type { ModuleRegistry } from '../../modules/ModuleRegistry.js';

const startTime = Date.now();

export function createHealthRoute(registry: ModuleRegistry, version: string): Hono {
  const app = new Hono();

  app.get('/health', (c) => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const modules = registry.getHealth();
    const allReady = registry.isAllReady();
    const toolCount = registry.getAllToolDefinitions().length;

    const response = {
      status: allReady ? 'healthy' : 'starting',
      version,
      uptime,
      tools_loaded: toolCount,
      modules,
    };

    return c.json(response, allReady ? 200 : 503);
  });

  return app;
}
