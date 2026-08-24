export interface PipelineStatus {
  ticket: string;
  autonomyLevel: 'L1' | 'L2' | 'L3';
  currentPhase: string;
  completedAt?: string;
  lastUpdated: string;
}
