import { Hono } from 'hono';
import { PipelineController } from '../../sa4e-190/controller/PipelineController.js';

const controller = new PipelineController();

export function createSa4e190Routes(): Hono {
  const app = new Hono();

  app.post('/pipeline/reset', async (c) => {
    const body = await c.req.json();
    // Basic validation
    if (!body.ticket || !body.autonomyLevel || !body.phase) {
      return c.json({ status: 'error', message: 'Invalid request' }, 400);
    }
    try {
      const result = await controller.resetPipeline(body.ticket, body.autonomyLevel, body.phase);
      return c.json(result);
    } catch (e: any) {
      return c.json({ status: 'error', message: e.message }, 400);
    }
  });

  app.post('/brd/generate', async (c) => {
    const body = await c.req.json();
    if (!body.ticketKey) {
      return c.json({ status: 'error', message: 'Invalid request' }, 400);
    }
    try {
      const result = await controller.generateBRD(body.ticketKey);
      return c.json(result);
    } catch (e: any) {
      return c.json({ status: 'error', message: e.message }, 500);
    }
  });

  return app;
}
