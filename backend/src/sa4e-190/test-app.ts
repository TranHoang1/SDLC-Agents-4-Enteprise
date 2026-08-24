import { Hono } from 'hono';
import { PipelineController } from './controller/PipelineController.js';

const controller = new PipelineController();
const app = new Hono();

app.post('/pipeline/reset', async (c) => {
  const body = await c.req.json();
  // Simple validation
  if (!['L1','L2','L3'].includes(body.autonomyLevel)) {
    return c.json({ status: 'error', message: 'Autonomy level must be L1/L2/L3' }, 400);
  }
  const result = await controller.resetPipeline(body.ticket, body.autonomyLevel, body.phase);
  return c.json(result);
});

app.post('/brd/generate', async (c) => {
  const body = await c.req.json();
  const result = await controller.generateBRD(body.ticketKey);
  return c.json(result);
});

export default app;
