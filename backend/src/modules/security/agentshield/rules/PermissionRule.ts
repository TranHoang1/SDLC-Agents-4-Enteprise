/**
 * SA4E-128 — SHIELD-004: Overly Permissive File Permissions.
 * Placeholder rule: checks for permission-related patterns in config content.
 * On Windows, actual filesystem permission checks are not reliable,
 * so we detect permission config values that are overly permissive.
 * Severity: MEDIUM — overly permissive files may expose sensitive config.
 */

import type { IScanRule, Finding } from '../models.js';

/** Detects overly permissive mode values (777, 666, world-readable/writable) */
const PERMISSION_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  { regex: /"(?:mode|permissions|chmod)":\s*"?0?777"?/, label: 'World-readable/writable (777)' },
  { regex: /"(?:mode|permissions|chmod)":\s*"?0?666"?/, label: 'World-readable/writable (666)' },
  { regex: /"(?:umask)":\s*"?0?000"?/, label: 'No permission mask (umask 000)' },
];

export class PermissionRule implements IScanRule {
  readonly id = 'SHIELD-004';
  readonly severity = 'MEDIUM' as const;

  /** Scan for overly permissive file permission patterns */
  scan(filePath: string, content: string): Finding[] {
    const findings: Finding[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      this.checkPermissionPatterns(lines[i], filePath, i + 1, findings);
    }

    return findings;
  }

  private checkPermissionPatterns(line: string, filePath: string, lineNum: number, findings: Finding[]): void {
    for (const { regex, label } of PERMISSION_PATTERNS) {
      if (regex.test(line)) {
        findings.push({
          severity: this.severity,
          rule: this.id,
          file: filePath,
          line: lineNum,
          message: `Overly permissive file permission: ${label}`,
        });
      }
    }
  }
}
