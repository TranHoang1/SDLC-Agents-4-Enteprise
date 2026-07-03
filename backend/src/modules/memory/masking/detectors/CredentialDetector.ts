import { DetectorStrategy } from './DetectorStrategy.js';
import { DetectionResult, MaskingConfig, PatternType } from '../models/MaskingTypes.js';

const DEFAULT_PATTERNS: Record<string, string> = {
  api_key: '\\b(sk-[a-zA-Z0-9]{20,}|pk_[a-zA-Z0-9]{20,}|AKIA[A-Z0-9]{16}|ghp_[a-zA-Z0-9]{36}|glpat-[a-zA-Z0-9\\-]{20,})\\b',
  jwt: 'eyJ[a-zA-Z0-9_\\-]{10,}\\.[a-zA-Z0-9_\\-]{10,}\\.[a-zA-Z0-9_\\-]{10,}',
  password: '(password|passwd|secret|token|api_key)\\s*[=:]\\s*[^\\s,;]{3,}',
  connection_string: '(mongodb|postgres|mysql|redis|amqp):\\/\\/[^\\s]+',
  private_key: '-----BEGIN\\s+(RSA\\s+|EC\\s+)?PRIVATE\\s+KEY-----',
};

/**
 * Detects credential patterns: API keys, JWTs, passwords, connection strings, private keys.
 * Credentials are ALWAYS masked regardless of user role (BR-01).
 */
export class CredentialDetector implements DetectorStrategy {
  readonly category = 'credential' as const;
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
          category: 'credential',
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
    const credTypes: PatternType[] = ['api_key', 'jwt', 'password', 'connection_string', 'private_key'];

    for (const t of credTypes) {
      const cfg = configs?.find(c => c.pattern_type === t && c.enabled);
      if (configs && !cfg) continue;
      const pattern = cfg?.regex_pattern ?? DEFAULT_PATTERNS[t];
      if (pattern) map.set(t, new RegExp(pattern, 'g'));
    }
    return map;
  }
}
