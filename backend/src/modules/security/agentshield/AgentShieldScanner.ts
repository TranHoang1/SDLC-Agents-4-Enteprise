/**
 * SA4E-128 — AgentShieldScanner: Config file security scanner.
 * Strategy pattern: iterates registered IScanRule instances over file content.
 * Path safety: validates paths via resolveWithinWorkspace to prevent traversal.
 */

import * as fs from 'fs';
import type { Logger } from 'pino';
import type { IAgentShieldScanner, IScanRule, ScanResult, Finding, ScanSummary } from './models.js';
import { resolveWithinWorkspace } from '../../../shared/path-safety.js';

export class AgentShieldScanner implements IAgentShieldScanner {
  private readonly rules: IScanRule[] = [];

  constructor(
    private readonly workspace: string,
    private readonly logger: Logger,
  ) {}

  /** Register a scan rule (OCP: add new rules without modifying this class) */
  registerRule(rule: IScanRule): void {
    this.rules.push(rule);
    this.logger.debug({ ruleId: rule.id }, 'Registered scan rule');
  }

  /** Scan paths with optional rule filtering */
  async scan(paths: string[], rules?: string[]): Promise<ScanResult> {
    const findings: Finding[] = [];
    const activeRules = this.getActiveRules(rules);

    for (const filePath of paths) {
      const resolved = this.resolvePath(filePath);
      if (!resolved) {
        this.logger.warn({ path: filePath }, 'Path rejected by safety guard');
        continue;
      }
      const fileFindings = this.scanFile(resolved, filePath, activeRules);
      findings.push(...fileFindings);
    }

    return { findings, summary: this.buildSummary(findings) };
  }

  private getActiveRules(ruleFilter?: string[]): IScanRule[] {
    if (!ruleFilter || ruleFilter.length === 0) return this.rules;
    return this.rules.filter((r) => ruleFilter.includes(r.id));
  }

  private resolvePath(filePath: string): string | null {
    return resolveWithinWorkspace(this.workspace, filePath);
  }

  private scanFile(resolvedPath: string, originalPath: string, activeRules: IScanRule[]): Finding[] {
    if (!fs.existsSync(resolvedPath)) {
      this.logger.debug({ path: originalPath }, 'File not found, skipping');
      return [];
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const findings: Finding[] = [];

    for (const rule of activeRules) {
      const ruleFindings = rule.scan(originalPath, content);
      findings.push(...ruleFindings);
    }

    return findings;
  }

  private buildSummary(findings: Finding[]): ScanSummary {
    return {
      critical: findings.filter((f) => f.severity === 'CRITICAL').length,
      high: findings.filter((f) => f.severity === 'HIGH').length,
      medium: findings.filter((f) => f.severity === 'MEDIUM').length,
      low: findings.filter((f) => f.severity === 'LOW').length,
    };
  }
}
