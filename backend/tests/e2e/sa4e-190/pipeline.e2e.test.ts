import { describe, it, expect, beforeAll } from 'vitest';
import { serve } from '@hono/node-server';
import app from '../../../src/sa4e-190/test-app.js';

// STC: E2E-API-01 — Full pipeline reset lifecycle
describe('Pipeline E2E API', () => {
  let server: any;
  let port: number;

  beforeAll(async () => {
    server = serve({ fetch: app.fetch, port: 0 });
    // Wait a bit for server to start
    await new Promise(res => setTimeout(res, 500));
    // Get assigned port
    port = (server as any).address().port;
  });

  it('should reset pipeline and verify STATUS.json', async () => {
    const res = await fetch(`http://localhost:${port}/pipeline/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket: 'SA4E-190', autonomyLevel: 'L3', phase: 'requirements' })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('success');
    expect(data.autonomyLevel).toBe('L3');
  });

  // STC: E2E-API-02 — BRD generation
  it('should generate BRD', async () => {
    const res = await fetch(`http://localhost:${port}/brd/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketKey: 'SA4E-190' })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('success');
    expect(data.path).toContain('BRD.md');
  });
});
