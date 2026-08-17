/**
 * SA4E-128 — SHIELD-002: HTTP (non-TLS) Endpoint Detector.
 * Detects non-HTTPS MCP server endpoints in config files.
 * Exception: localhost/127.0.0.1 URLs are allowed (local development).
 * Severity: HIGH — unencrypted transport exposes credentials in transit.
 */

import type { IScanRule, Finding } from '../models.js';

/** Localhost patterns that are safe exceptions */
const LOCALHOST_PREFIXES = [
  'http://127.0.0.1',
  'http://localhost',
];

export class HttpEndpointRule implements IScanRule {
  readonly id = 'SHIELD-002';
  readonly severity = 'HIGH' as const;

  /** Scan for non-TLS HTTP endpoints, excluding localhost */
  scan(filePath: string, content: string): Finding[] {
    const findings: Finding[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      this.checkLine(lines[i], filePath, i + 1, findings);
    }

    return findings;
  }

  private checkLine(line: string, filePath: string, lineNum: number, findings: Finding[]): void {
    const regex = /"url":\s*"(http:\/\/[^"]+)"/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(line)) !== null) {
      const url = match[1];
      if (!this.isLocalhostUrl(url)) {
        findings.push({
          severity: this.severity,
          rule: this.id,
          file: filePath,
          line: lineNum,
          message: `Non-TLS HTTP endpoint detected: ${url}`,
        });
      }
    }
  }

  private isLocalhostUrl(url: string): boolean {
    return LOCALHOST_PREFIXES.some((prefix) => url.startsWith(prefix));
  }
}
