/**
 * SA4E-128 — AgentShield Models & Zod Schemas.
 * Defines data contracts for config file scanning: input validation,
 * finding results, scan summaries, and the IScanRule interface.
 */

import { z } from 'zod';

// --- Zod Schemas ---

/** Schema for agentshield_scan input */
export const ScanInputSchema = z.object({
  paths: z.array(z.string().min(1)).min(1, 'At least one path required'),
  rules: z.array(z.string()).optional(),
});

// --- Types ---

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type ScanInput = z.infer<typeof ScanInputSchema>;

// --- Interfaces ---

/** A single security finding from scanning a config file */
export interface Finding {
  severity: Severity;
  rule: string;
  file: string;
  line: number;
  message: string;
}

/** Summary counts by severity level */
export interface ScanSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

/** Complete scan result returned by the scanner */
export interface ScanResult {
  findings: Finding[];
  summary: ScanSummary;
}

/** Strategy interface for individual scan rules (OCP: extend without modifying scanner) */
export interface IScanRule {
  readonly id: string;
  readonly severity: Severity;
  /** Scan file content and return findings */
  scan(filePath: string, content: string): Finding[];
}

/** Scanner interface for dependency inversion */
export interface IAgentShieldScanner {
  /** Scan paths with optional rule filtering */
  scan(paths: string[], rules?: string[]): Promise<ScanResult>;
  /** Register a new scan rule (OCP: add rules without modifying scanner) */
  registerRule(rule: IScanRule): void;
}
