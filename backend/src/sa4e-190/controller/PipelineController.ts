import { StatusManager } from '../service/StatusManager.js';
import { BAAgentService } from '../service/BAAgentService.js';
import { DrawioExporter } from '../service/DrawioExporter.js';

export interface ResetResult {
  status: 'success' | 'error';
  ticket: string;
  phase: string;
  autonomyLevel: string;
  completedAt?: string;
}

export class PipelineController {
  private statusManager = new StatusManager();
  private baAgent = new BAAgentService();
  private drawio = new DrawioExporter();

  async resetPipeline(ticket: string, autonomyLevel: 'L1'|'L2'|'L3', phase: string): Promise<ResetResult> {
    const status = await this.statusManager.resetStatus(ticket, autonomyLevel, phase);
    return {
      status: 'success',
      ticket: status.ticket,
      phase: status.currentPhase,
      autonomyLevel: status.autonomyLevel,
      completedAt: status.completedAt
    };
  }

  async generateBRD(ticketKey: string): Promise<{ path: string; status: 'success'|'error' }> {
    const path = await this.baAgent.generateBRD(ticketKey);
    // Also generate diagrams for completeness
    await this.drawio.exportDiagram('business-flow');
    await this.drawio.exportDiagram('use-case');
    return { path, status: 'success' };
  }
}
