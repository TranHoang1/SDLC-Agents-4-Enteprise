/**
 * SA4E-128 — SHIELD-003: Prompt Injection Vector Detector.
 * Detects template literals, eval/exec patterns, and dynamic code execution
 * in config values that could enable prompt injection attacks.
 * Severity: HIGH — injection vectors allow arbitrary code execution.
 */

import type { IScanRule, Finding } from '../models.js';

/** Detects ${...} template literal interpolation in config values */
const TEMPLATE_LITERAL_PATTERN = /"\$\{[^}]+\}"/;

/** Detects backtick strings in command fields */
const BACKTICK_COMMAND_PATTERN = /"(?:command|cmd|exec|run)":\s*`[^`]+`/;

/** Detects dangerous eval/Function/exec calls in config values */
const EVAL_PATTERN = /\b(eval|Function|exec)\s*\(/;

export class InjectionDetector implements IScanRule {
  readonly id = 'SHIELD-003';
  readonly severity = 'HIGH' as const;

  /** Scan for prompt injection vectors in config values */
  scan(filePath: string, content: string): Finding[] {
    const findings: Finding[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      this.checkTemplateLiterals(lines[i], filePath, i + 1, findings);
      this.checkBacktickCommands(lines[i], filePath, i + 1, findings);
      this.checkEvalPatterns(lines[i], filePath, i + 1, findings);
    }

    return findings;
  }

  private checkTemplateLiterals(line: string, filePath: string, lineNum: number, findings: Finding[]): void {
    if (TEMPLATE_LITERAL_PATTERN.test(line)) {
      findings.push({
        severity: this.severity,
        rule: this.id,
        file: filePath,
        line: lineNum,
        message: 'Template literal interpolation ${} detected in config value',
      });
    }
  }

  private checkBacktickCommands(line: string, filePath: string, lineNum: number, findings: Finding[]): void {
    if (BACKTICK_COMMAND_PATTERN.test(line)) {
      findings.push({
        severity: this.severity,
        rule: this.id,
        file: filePath,
        line: lineNum,
        message: 'Backtick command string detected in config field',
      });
    }
  }

  private checkEvalPatterns(line: string, filePath: string, lineNum: number, findings: Finding[]): void {
    if (EVAL_PATTERN.test(line)) {
      findings.push({
        severity: this.severity,
        rule: this.id,
        file: filePath,
        line: lineNum,
        message: 'Dynamic code execution (eval/Function/exec) detected in config',
      });
    }
  }
}
