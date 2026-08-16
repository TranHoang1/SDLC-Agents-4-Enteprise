/**
 * SA4E-128 — SHIELD-001: Hardcoded Secrets Detector.
 * Detects API keys, tokens, and passwords in plaintext within config files.
 * Severity: CRITICAL — secrets in config files are a direct security risk.
 */

import type { IScanRule, Finding } from '../models.js';

/** Patterns for detecting hardcoded secrets */
const SECRET_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  { regex: /AKIA[0-9A-Z]{16}/, label: 'AWS Access Key ID' },
  { regex: /sk-[a-zA-Z0-9]{20,}/, label: 'OpenAI API Key' },
  { regex: /ghp_[a-zA-Z0-9]{36}/, label: 'GitHub Personal Access Token' },
  { regex: /xox[bporas]-[a-zA-Z0-9-]+/, label: 'Slack Token' },
  { regex: /glpat-[a-zA-Z0-9_-]{20,}/, label: 'GitLab Personal Access Token' },
];

/** Pattern for password fields with non-variable plaintext values */
const PASSWORD_PATTERN = /"(?:password|passwd|secret|api_key|apikey|token)":\s*"([^"${}]+)"/i;

export class SecretDetector implements IScanRule {
  readonly id = 'SHIELD-001';
  readonly severity = 'CRITICAL' as const;

  /** Scan each line for hardcoded secret patterns */
  scan(filePath: string, content: string): Finding[] {
    const findings: Finding[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      this.checkSecretPatterns(lines[i], filePath, i + 1, findings);
      this.checkPasswordFields(lines[i], filePath, i + 1, findings);
    }

    return findings;
  }

  private checkSecretPatterns(line: string, filePath: string, lineNum: number, findings: Finding[]): void {
    for (const { regex, label } of SECRET_PATTERNS) {
      if (regex.test(line)) {
        findings.push({
          severity: this.severity,
          rule: this.id,
          file: filePath,
          line: lineNum,
          message: `Hardcoded ${label} detected`,
        });
      }
    }
  }

  private checkPasswordFields(line: string, filePath: string, lineNum: number, findings: Finding[]): void {
    const match = PASSWORD_PATTERN.exec(line);
    if (match && match[1] && match[1].length > 0) {
      findings.push({
        severity: this.severity,
        rule: this.id,
        file: filePath,
        line: lineNum,
        message: 'Hardcoded password/secret value in config field',
      });
    }
  }
}
