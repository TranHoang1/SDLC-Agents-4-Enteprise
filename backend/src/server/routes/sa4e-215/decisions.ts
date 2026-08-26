/**
 * SA4E-215 — Decision evaluation routes.
 * Implements: FR-005 to FR-008, FR-010 (FSD.md)
 * Routes: POST /api/sa4e-215/decisions/evaluate, GET /api/sa4e-215/decisions/history
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Logger } from 'pino';
import { PrismaClient } from '@prisma/client';

export function createDecisionRoute(prisma: PrismaClient, logger: Logger) {
  const app = new Hono();

  // POST /api/sa4e-215/decisions/evaluate
  app.post('/evaluate', async (c: Context) => {
    const { rule_set_id, params } = await c.req.json();

    if (!rule_set_id) {
      return c.json(
        { success: false, error: { code: 'ERR_001', message: 'rule_set_id is required' } },
        400
      );
    }

    // In a real implementation, this would evaluate against rule engine
    // For now, return a decision based on simple logic
    let decision = 'pending';
    let confidence = 0.5;

    // Simple decision logic based on rule_set_id
    if (rule_set_id === 'default') {
      // Example: evaluate based on params
      if (params && typeof params === 'object') {
        const score = Object.values(params).reduce((sum: number, val: any) => sum + (typeof val === 'number' ? val : 0), 0);
        if (score > 50) {
          decision = 'approved';
          confidence = Math.min(0.95, 0.5 + score * 0.01);
        } else if (score > 20) {
          decision = 'pending';
          confidence = 0.5 + score * 0.01;
        } else {
          decision = 'rejected';
          confidence = Math.max(0.05, 0.5 - Math.abs(score) * 0.01);
        }
      }
    }

    // Log to audit trail
    try {
      await prisma.auditLog.create({
        data: {
          action: 'decision_evaluate',
          resource_type: 'decision',
          resource_id: rule_set_id,
          metadata: { rule_set_id, params, decision, confidence },
        },
      });
    } catch (err) {
      logger.error({ err }, 'Failed to log decision evaluation');
      // Continue even if audit logging fails
    }

    return c.json({
      success: true,
      data: {
        decision,
        confidence,
        audit_id: 0, // Would be the actual audit log ID in real implementation
        evaluated_at: new Date().toISOString(),
      },
    });
  });

  // GET /api/sa4e-215/decisions/history
  app.get('/history', async (c: Context) => {
    const userId = c.req.query('user_id') ? Number(c.req.query('user_id')) : undefined;
    const limit = c.req.query('limit') ? Number(c.req.query('limit')) : 50;
    const offset = c.req.query('offset') ? Number(c.req.query('offset')) : 0;

    const where = userId
      ? { user_id: userId }
      : {};

    const [decisions, total] = await prisma.$transaction([
      prisma.decision.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { evaluated_at: 'desc' },
        include: { user: { select: { email: true, role: true } } },
      }),
      prisma.decision.count({ where }),
    ]);

    return c.json({
      success: true,
      data: decisions.map(d => ({
        id: d.id,
        user_id: d.user_id,
        rule_set_id: d.rule_set_id,
        result: d.result,
        confidence: d.confidence,
        input_params: d.input_params,
        evaluated_at: d.evaluated_at,
        user: d.user ? { email: d.user.email, role: d.user.role } : null,
      })),
      meta: {
        total,
        limit,
        offset,
      },
    });
  });

  return app;
}

export type { createDecisionRoute };