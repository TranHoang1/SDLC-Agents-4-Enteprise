/**
 * SA4E-215 — Route aggregator (aligned to real sa4e_db).
 *
 * Aggregates the three SA4E-215 sub-routers under a single Hono app.
 * Mounted at /api/sa4e-215 by backend/src/server/routes/admin/index.ts.
 *
 * Each sub-router uses platform primitives (getDbAdapter, recordAudit,
 * validateSession) — no Prisma, no argon2, no fabricated schema.
 */
import { Hono } from 'hono';
import { createSa4e215AuthRoutes } from './auth.js';
import { createSa4e215DecisionsRoutes } from './decisions.js';
import { createSa4e215McpServersRoutes } from '../mcp/servers.js';

export function createSa4e215Route(): Hono {
  const app = new Hono();

  app.route('/auth', createSa4e215AuthRoutes());
  app.route('/decisions', createSa4e215DecisionsRoutes());
  app.route('/mcp/servers', createSa4e215McpServersRoutes());

  return app;
}
