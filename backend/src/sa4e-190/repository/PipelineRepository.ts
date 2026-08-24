import * as fs from 'fs';
import { PipelineStatus } from '../model/PipelineStatus.js';
import { defaultConfig } from '../config/AppConfig.js';

export class PipelineRepository {
  private statusPath = defaultConfig.statusFilePath;

  async getStatus(ticket: string): Promise<PipelineStatus | null> {
    if (!fs.existsSync(this.statusPath)) return null;
    const raw = fs.readFileSync(this.statusPath, 'utf-8');
    const data = JSON.parse(raw);
    if (data.ticket === ticket) {
      return data as PipelineStatus;
    }
    return null;
  }

  async saveStatus(status: PipelineStatus): Promise<void> {
    const raw = JSON.stringify(status, null, 2);
    fs.writeFileSync(this.statusPath, raw, 'utf-8');
  }

  async updateStatus(ticket: string, autonomyLevel: string, phase: string): Promise<PipelineStatus> {
    let status: PipelineStatus;
    if (fs.existsSync(this.statusPath)) {
      const raw = fs.readFileSync(this.statusPath, 'utf-8');
      status = JSON.parse(raw) as PipelineStatus;
    } else {
      status = {
        ticket,
        autonomyLevel: autonomyLevel as 'L1'|'L2'|'L3',
        currentPhase: phase,
        lastUpdated: new Date().toISOString()
      };
    }
    status.ticket = ticket;
    status.autonomyLevel = autonomyLevel as 'L1'|'L2'|'L3';
    status.currentPhase = phase;
    status.lastUpdated = new Date().toISOString();
    await this.saveStatus(status);
    return status;
  }
}
