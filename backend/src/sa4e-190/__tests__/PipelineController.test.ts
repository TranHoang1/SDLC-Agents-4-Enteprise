import { describe, it, expect } from 'vitest';
import { PipelineController } from '../controller/PipelineController.js';

// STC: UT-01 — Pipeline reset happy path
describe('PipelineController', () => {
  it('should reset pipeline with valid params', async () => {
    const controller = new PipelineController();
    const result = await controller.resetPipeline('SA4E-190', 'L3', 'requirements');
    expect(result.status).toBe('success');
    expect(result.ticket).toBe('SA4E-190');
    expect(result.autonomyLevel).toBe('L3');
    expect(result.phase).toBe('requirements');
  });

  // STC: UT-02 — BRD generation
  it('should generate BRD and return path', async () => {
    const controller = new PipelineController();
    const res = await controller.generateBRD('SA4E-190');
    expect(res.status).toBe('success');
    expect(res.path).toContain('BRD.md');
  });
});
