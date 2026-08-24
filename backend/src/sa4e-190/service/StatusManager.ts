import { PipelineRepository } from '../repository/PipelineRepository.js';
import { PipelineStatus } from '../model/PipelineStatus.js';

export class StatusManager {
  private repo = new PipelineRepository();

  async resetStatus(ticket: string, autonomyLevel: 'L1'|'L2'|'L3', phase: string): Promise<PipelineStatus> {
    if (!['L1','L2','L3'].includes(autonomyLevel)) {
      throw new Error('Autonomy level must be L1/L2/L3');
    }
    const validPhases = ['requirements','specification','design','implementation','testing','deployment'];
    if (!validPhases.includes(phase)) {
      throw new Error('Invalid phase');
    }
    return this.repo.updateStatus(ticket, autonomyLevel, phase);
  }

  async markRequirementsDone(ticket: string): Promise<PipelineStatus> {
    const status = await this.repo.getStatus(ticket);
    if (!status) throw new Error('Ticket not found');
    status.completedAt = new Date().toISOString();
    // Update phases structure if needed
    status.currentPhase = 'requirements';
    await this.repo.saveStatus(status);
    return status;
  }
}
