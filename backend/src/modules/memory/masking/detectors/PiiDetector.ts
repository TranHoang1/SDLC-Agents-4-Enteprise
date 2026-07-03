import { DetectorStrategy } from './DetectorStrategy.js';
import { DetectionResult, MaskingConfig, PatternType } from '../models/MaskingTypes.js';

const DEFAULT_PATTERNS: Record<string, string> = {
  email: '[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}',
  phone: '(\\+?\\d{1,3}[\\-.\\s]?)?\\(?\\d{3}\\)?[\\-.\\s]?\\d{3}[\\-.\\s]?\\d{4}',
  ip: '\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\b',
  credit_card: '\\b\\d{4}[\\-\\s]?\\d{4}[\\-\\s]?\\d{4}[\\-\\s]?\\d{4}\\b',
  ssn: '\\b\\d{3}[\\-\\s]?\\d{2}[\\-\\s]?\\d{4}\\b',
};

/**
 * Detects PII patterns: email, phone, IP, credit card, SSN.
 * Uses pre-compiled regex for performance.
 */
export class PiiDetector implements DetectorStrategy {
  readonly category = 'pii' as const;
  private patterns: Map<PatternType, RegExp>;

  constructor(configs?: MaskingConfig[]) {
    this.patterns = this.compilePatterns(configs);
  }

  detect(content: string): DetectionResult[] {
    const results: DetectionResult[] = [];
    for (const [type, regex] of this.patterns) {
      const matches = content.matchAll(new RegExp(regex.source, 'g'));
      for (const m of matches) {
        if (m.index === undefined) continue;
        results.push({
          type,
          category: 'pii',
          match: m[0],
          start: m.index,
          end: m.index + m[0].length,
        });
      }
    }
    return results;
  }

  private compilePatterns(configs?: MaskingConfig[]): Map<PatternType, RegExp> {
    const map = new Map<PatternType, RegExp>();
    const piiTypes: PatternType[] = ['email', 'phone', 'ip', 'credit_card', 'ssn'];

    for (const t of piiTypes) {
      const cfg = configs?.find(c => c.pattern_type === t && c.enabled);
      if (configs && !cfg) continue;
      const pattern = cfg?.regex_pattern ?? DEFAULT_PATTERNS[t];
      if (pattern) map.set(t, new RegExp(pattern, 'g'));
    }
    return map;
  }
}
