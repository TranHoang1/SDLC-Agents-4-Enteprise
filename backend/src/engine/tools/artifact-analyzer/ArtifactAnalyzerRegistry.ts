import type { ArtifactAnalyzer, ArtifactAnalysis, ArtifactType } from './types.js';
import { ArtifactDetector } from './detector.js';
import { PegaRuleAnalyzer } from './analyzers/PegaRuleAnalyzer.js';
import { GenericCodeAnalyzer } from './analyzers/GenericCodeAnalyzer.js';
import { StructureAnalyzer } from './analyzers/StructureAnalyzer.js';
import { FallbackAnalyzer } from './analyzers/FallbackAnalyzer.js';

export class ArtifactAnalyzerRegistry {
  private analyzers: ArtifactAnalyzer[] = [];
  private detector: ArtifactDetector;

  constructor() {
    this.detector = new ArtifactDetector();
    this.registerDefaults();
  }

  private registerDefaults(): void {
    // Order matters: most specific first, fallback last
    this.register(new PegaRuleAnalyzer());
    this.register(new GenericCodeAnalyzer());
    this.register(new StructureAnalyzer());
    this.register(new FallbackAnalyzer());
  }

  register(analyzer: ArtifactAnalyzer): void {
    // Remove existing analyzer of the same type, then add the new one
    this.analyzers = this.analyzers.filter(a => a.type !== analyzer.type);
    this.analyzers.push(analyzer);
  }

  async analyze(content: string, options?: Record<string, unknown>): Promise<ArtifactAnalysis> {
    const hint = options?.type as string | undefined;
    const detectedType = this.detector.detect(content, hint);

    // Find an analyzer whose canAnalyze matches AND type matches the detected type
    // (or for fallback, just use the one matching 'unknown')
    let analyzer = this.analyzers.find(a => a.type === detectedType && a.canAnalyze(content, options));
    if (!analyzer) {
      // Fallback: try the unknown analyzer regardless
      analyzer = this.analyzers.find(a => a.type === 'unknown');
    }

    if (analyzer) {
      const result = analyzer.analyze(content, options);
      if (result instanceof Promise) {
        return result;
      }
      return result;
    }

    // Ultimate fallback — return basic unknown analysis
    const lines = content.split('\n');
    return {
      type: 'unknown',
      summary: `Unknown artifact (${lines.length} lines)`,
      promptContext: `Unknown Artifact (${content.length} chars)\n\n${content}`,
      details: { lines: lines.length, chars: content.length, detectedType },
      detectedBy: hint ? 'hint' : 'content-heuristic',
    };
  }

  getSupportedTypes(): ArtifactType[] {
    return this.analyzers.map(a => a.type);
  }
}
