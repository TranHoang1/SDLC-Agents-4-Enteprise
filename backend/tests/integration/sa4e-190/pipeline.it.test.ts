import { describe, it, expect } from 'vitest';
import app from '../../../src/sa4e-190/test-app.js';

// STC: IT-01 — Real Hono app reset pipeline
describe('Pipeline API Integration', () => {
  it('POST /pipeline/reset returns success', async () => {
    const res = await app.request('/pipeline/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket: 'SA4E-190', autonomyLevel: 'L3', phase: 'requirements' })
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('success');
    expect(json.ticket).toBe('SA4E-190');
  });

  // STC: IT-02 — Invalid autonomy
  it('POST /pipeline/reset with invalid autonomy returns 400', async () => {
    const res = await app.request('/pipeline/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket: 'SA4E-190', autonomyLevel: 'L4', phase: 'requirements' })
    });
    expect(res.status).toBe(400);
  });
});
