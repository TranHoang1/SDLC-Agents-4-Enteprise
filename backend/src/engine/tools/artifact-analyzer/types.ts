export type ArtifactType = 'pega_rule' | 'code' | 'structured_data' | 'unknown';

export interface ArtifactAnalysis {
  type: ArtifactType;
  summary: string;
  promptContext: string;
  details: Record<string, unknown>;
  detectedBy: string;
}

export interface ArtifactAnalyzer {
  type: ArtifactType;
  canAnalyze(content: string, options?: Record<string, unknown>): boolean;
  analyze(content: string, options?: Record<string, unknown>): Promise<ArtifactAnalysis> | ArtifactAnalysis;
}
