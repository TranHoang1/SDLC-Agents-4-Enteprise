/**
 * SA4E-215 — Decision evaluation route (aligned to real sa4e_db).
 *
 * Writes to the NEW `decisions` table and to the EXISTING `audit_log`.
 * Uses getDbAdapter() (async, multi-engine) + recordAudit.
 * Mounted at /api/sa4e-215/decisions (via sa4e-215/index.ts).
 */
import { Hono } from 'hono';
import * as crypto from 'crypto';
import pino from 'pino';
import { getDbAdapter, recordAudit } from '../../../admin/admin-db.js';
import { requireSa4eUser } from './guard.js';

const logger = pino({ name: 'sa4e-215-decisions' });

export function createSa4e215DecisionsRoutes(): Hono {
  const app = new Hono();

  // GET /api/sa4e-215/decisions?projectId=&ruleSetId=&limit=
  app.get('/', async (c) => {
    const auth = await requireSa4eUser(c);
    if (auth instanceof Response) return auth;

    try {
      const adapter = getDbAdapter();
      const projectId = c.req.query('projectId');
      const ruleSetId = c.req.query('ruleSetId');
      const limit = Math.min(parseInt(c.req.query('limit') || '50', 10) || 50, 200);

      let sql = 'SELECT * FROM decisions WHERE 1=1';
      const params: unknown[] = [];
      if (projectId) { sql += ' AND project_id = ?'; params.push(projectId); }
      if (ruleSetId) { sql += ' AND rule_set_id = ?'; params.push(ruleSetId); }
      sql += ' ORDER BY evaluated_at DESC LIMIT ?';
      params.push(limit);

      const rows = await adapter.allAsync<Record<string, unknown>>(sql, params);
      return c.json({
        success: true,
        data: rows.map((r) => ({
          decisionId: r.decision_id,
          userId: r.user_id,
          projectId: r.project_id,
          ruleSetId: r.rule_set_id,
          inputParams: r.input_params ? JSON.parse(r.input_params as string) : null,
          result: r.result,
          confidence: r.confidence,
          evaluatedAt: r.evaluated_at,
        })),
      });
    } catch (err: any) {
      logger.error({ err }, 'list decisions error');
      return c.json({ success: false, error: { code: 'ERR_009', message: 'Failed to list decisions' } }, 500);
    }
  });

  // POST /api/sa4e-215/decisions
  app.post('/', async (c) => {
    const auth = await requireSa4eUser(c);
    if (auth instanceof Response) return auth;

    try {
      const body = await c.req.json();
      const { ruleSetId, inputParams, result, confidence, projectId } = body;

      if (!ruleSetId || !result) {
        return c.json(
          { success: false, error: { code: 'ERR_001', message: 'ruleSetId and result are required' } },
          400,
        );
      }
      const conf = typeof confidence === 'number' ? confidence : 0;

      const adapter = getDbAdapter();
      const decisionId = 'dec-' + crypto.randomUUID().slice(0, 8);
      const now = new Date().toISOString();

      await adapter.runAsync(
        `INSERT INTO decisions (decision_id, user_id, project_id, rule_set_id, input_params, result, confidence, evaluated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          decisionId,
          auth.userId,
          projectId || null,
          ruleSetId,
          inputParams ? JSON.stringify(inputParams) : null,
          result,
          conf,
          now,
        ],
      );

      await recordAudit(
        auth.userId,
        auth.username,
        'DECISION_CREATE',
        'decision',
        decisionId,
        JSON.stringify({ ruleSetId, result, confidence: conf }),
      );

      return c.json({
        success: true,
        data: { decisionId, userId: auth.userId, projectId, ruleSetId, result, confidence: conf, evaluatedAt: now },
      });
    } catch (err: any) {
      logger.error({ err }, 'create decision error');
      return c.json({ success: false, error: { code: 'ERR_009', message: 'Failed to create decision' } }, 500);
    }
  });

  // GET /api/sa4e-215/decisions/:id
  app.get('/:id', async (c) => {
    const auth = await requireSa4eUser(c);
    if (auth instanceof Response) return auth;

    try {
      const id = c.req.param('id');
      const adapter = getDbAdapter();
      const r = await adapter.getAsync<Record<string, unknown>>(
        'SELECT * FROM decisions WHERE decision_id = ?', [id],
      );
      if (!r) {
        return c.json({ success: false, error: { code: 'ERR_006', message: 'Decision not found' } }, 404);
      }
      return c.json({
        success: true,
        data: {
          decisionId: r.decision_id,
          userId: r.user_id,
          projectId: r.project_id,
          ruleSetId: r.rule_set_id,
          inputParams: r.input_params ? JSON.parse(r.input_params as string) : null,
          result: r.result,
          confidence: r.confidence,
          evaluatedAt: r.evaluated_at,
        },
      });
    } catch (err: any) {
      logger.error({ err }, 'get decision error');
      return c.json({ success: false, error: { code: 'ERR_009', message: 'Failed to get decision' } }, 500);
    }
  });

  return app;
}
