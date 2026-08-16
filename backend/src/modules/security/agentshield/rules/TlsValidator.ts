/**
 * SA4E-128 — SHIELD-005: Missing TLS Certificate Validation.
 * Detects patterns that disable TLS certificate verification,
 * which enables MITM attacks on encrypted connections.
 * Severity: LOW — disabling TLS validation weakens transport security.
 */

import type { IScanRule, Finding } from '../models.js';

/** Patterns that disable TLS certificate validation */
const TLS_BYPASS_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  {
    regex: /"rejectUnauthorized":\s*false/,
    label: 'TLS certificate validation disabled (rejectUnauthorized: false)',
  },
  {
    regex: /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*0/,
    label: 'TLS validation disabled via NODE_TLS_REJECT_UNAUTHORIZED=0',
  },
  {
    regex: /"verify_ssl":\s*false/,
    label: 'SSL verification disabled (verify_ssl: false)',
  },
  {
    regex: /"insecure":\s*true/,
    label: 'Insecure mode enabled (insecure: true)',
  },
];

export class TlsValidator implements IScanRule {
  readonly id = 'SHIELD-005';
  readonly severity = 'LOW' as const;

  /** Scan for patterns that disable TLS certificate validation */
  scan(filePath: string, content: string): Finding[] {
    const findings: Finding[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      this.checkTlsBypassPatterns(lines[i], filePath, i + 1, findings);
    }

    return findings;
  }

  private checkTlsBypassPatterns(line: string, filePath: string, lineNum: number, findings: Finding[]): void {
    for (const { regex, label } of TLS_BYPASS_PATTERNS) {
      if (regex.test(line)) {
        findings.push({
          severity: this.severity,
          rule: this.id,
          file: filePath,
          line: lineNum,
          message: label,
        });
      }
    }
  }
}
