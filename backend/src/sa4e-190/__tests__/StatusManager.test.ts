import { describe, it, expect } from 'vitest';
import { StatusManager } from '../service/StatusManager.js';

// STC: UT-03 — StatusManager validation
describe('StatusManager', () => {
  it('should reject invalid autonomy level', async () => {
    const sm = new StatusManager();
    await expect(sm.resetStatus('SA4E-190', 'L4' as any, 'requirements')).rejects.toThrow('Autonomy level must be L1/L2/L3');
  });

  it('should accept valid autonomy level', async () => {
    const sm = new StatusManager();
    const status = await sm.resetStatus('SA4E-190', 'L3', 'requirements');
    expect(status.autonomyLevel).toBe('L3');
    expect(status.currentPhase).toBe('requirements');
  });
});
