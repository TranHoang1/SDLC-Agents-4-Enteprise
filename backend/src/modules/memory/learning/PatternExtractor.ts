/**
 * SA4E-122: PatternExtractor — parses session transcripts and
 * identifies learnable patterns using heuristic analysis.
 * Extracts error→fix sequences, user corrections, workarounds,
 * debugging techniques, and project-specific conventions.
 */

import { PatternClassifier } from './PatternClassifier.js';
import type { ExtractedPattern, LearningConfig } from './types.js';
import { DEFAULT_LEARNING_CONFIG } from './types.js';

/** Segment boundary markers in session text. */
const SEGMENT_SEPARATORS = [
  /^---+$/m,
  /^#{1,3}\s/m,
  /^\[tool\]/mi,
  /^\[user\]/mi,
  /^\[assistant\]/mi,
];

export class PatternExtractor {
  private readonly classifier: PatternClassifier;
  private readonly config: LearningConfig;

  constructor(config?: Partial<LearningConfig>) {
    this.classifier = new PatternClassifier();
    this.config = { ...DEFAULT_LEARNING_CONFIG, ...config };
  }

  /**
   * Extract learnable patterns from a session transcript.
   * @param transcript Raw session text (tool calls + results + messages)
   * @returns Array of extracted patterns sorted by confidence desc
   */
  extract(transcript: string): ExtractedPattern[] {
    if (!transcript.trim()) return [];

    const segments = this.splitIntoSegments(transcript);
    const patterns: ExtractedPattern[] = [];

    // Pass 1: identify error→resolution pairs
    patterns.push(...this.extractErrorResolutions(segments));

    // Pass 2: identify user corrections
    patterns.push(...this.extractUserCorrections(segments));

    // Pass 3: classify remaining segments
    patterns.push(...this.extractGenericPatterns(segments));

    // Deduplicate and cap
    const deduped = this.deduplicatePatterns(patterns);
    return deduped
      .filter(p => p.confidence >= this.config.minConfidence)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxPatternsPerSession);
  }

  /** Split transcript into logical segments for analysis. */
  private splitIntoSegments(transcript: string): string[] {
    let text = transcript;
    for (const sep of SEGMENT_SEPARATORS) {
      text = text.replace(sep, '\n---SPLIT---\n');
    }
    return text
      .split('---SPLIT---')
      .map(s => s.trim())
      .filter(s => s.length > 20);
  }

  /** Detect error→fix sequences across adjacent segments. */
  private extractErrorResolutions(segments: string[]): ExtractedPattern[] {
    const results: ExtractedPattern[] = [];
    for (let i = 0; i < segments.length - 1; i++) {
      const current = segments[i];
      const next = segments[i + 1];
      const combined = `${current}\n${next}`;

      if (this.classifier.hasErrorResolutionSequence(combined)) {
        results.push({
          content: this.summarize(combined, 'error_resolution'),
          type: 'error_resolution',
          confidence: 0.7,
          tags: ['error-fix', 'auto-learned'],
          sourceContext: this.extractSourceContext(combined),
        });
      }
    }
    return results;
  }

  /** Detect user corrections (user says "no", "actually", etc.). */
  private extractUserCorrections(segments: string[]): ExtractedPattern[] {
    const results: ExtractedPattern[] = [];
    for (const segment of segments) {
      const [type, score] = this.classifier.classify(segment);
      if (type === 'user_correction' && score >= 0.3) {
        results.push({
          content: this.summarize(segment, 'user_correction'),
          type: 'user_correction',
          confidence: Math.min(0.8, score + 0.2),
          tags: ['correction', 'auto-learned'],
          sourceContext: this.extractSourceContext(segment),
        });
      }
    }
    return results;
  }

  /** Classify remaining segments that pass threshold. */
  private extractGenericPatterns(segments: string[]): ExtractedPattern[] {
    const results: ExtractedPattern[] = [];
    for (const segment of segments) {
      const [type, score] = this.classifier.classify(segment);
      if (type === 'user_correction') continue; // Already handled
      if (score < this.config.minConfidence) continue;

      results.push({
        content: this.summarize(segment, type),
        type,
        confidence: score,
        tags: [type.replace('_', '-'), 'auto-learned'],
        sourceContext: this.extractSourceContext(segment),
      });
    }
    return results;
  }

  /** Remove near-duplicate patterns by content similarity. */
  private deduplicatePatterns(patterns: ExtractedPattern[]): ExtractedPattern[] {
    const seen = new Set<string>();
    return patterns.filter(p => {
      const key = p.content.toLowerCase().slice(0, 80);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /** Create a concise summary for the pattern content. */
  private summarize(text: string, type: string): string {
    const prefix = `[${type}] `;
    const clean = text.replace(/\s+/g, ' ').trim();
    const maxLen = 300 - prefix.length;
    if (clean.length <= maxLen) return prefix + clean;
    return prefix + clean.slice(0, maxLen - 3) + '...';
  }

  /** Extract source context (first tool name or file reference). */
  private extractSourceContext(text: string): string {
    const toolMatch = text.match(/\b(mem_\w+|code_\w+|jira_\w+)\b/);
    if (toolMatch) return `tool:${toolMatch[1]}`;
    const fileMatch = text.match(/[\w/.-]+\.(ts|js|py|go|rs)\b/);
    if (fileMatch) return `file:${fileMatch[0]}`;
    return 'session';
  }
}
