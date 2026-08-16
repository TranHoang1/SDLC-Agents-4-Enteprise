/**
 * SA4E-132 — GateGuard Models & Zod Schemas.
 * Defines data contracts for command evaluation, denylist patterns, and audit entries.
 */

import { z } from 'zod';

// --- Enums ---

export type GateGuardAction = 'blocked' | 'overridden' | 'allowed';

// --- Zod Schemas ---

/** Schema for gateguard_evaluate input */
export const EvaluateInputSchema = z.object({
  command: z.string().min(1).max(4096),
  agent: z.string().optional(),
  project_id: z.string().max(100).optional(),
});

/** Schema for gateguard_denylist input */
export const DenylistInputSchema = z.object({
  action: z.enum(['list', 'add', 'remove']),
  project_id: z.string().max(100).optional(),
  pattern: z.string().max(500).optional(),
  pattern_id: z.string().optional(),
  description: z.string().max(200).optional(),
});

/** Schema for gateguard_audit_log input */
export const AuditLogInputSchema = z.object({
  project_id: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  action_filter: z.enum(['blocked', 'overridden', 'allowed']).optional(),
});

/** Schema for override input */
export const OverrideInputSchema = z.object({
  override_hash: z.string().min(1),
  user: z.string().min(1),
  role: z.string().optional(),
});

// --- Interfaces ---

export interface DenyPattern {
  id: string;
  regex: string;
  description: string;
  isDefault: boolean;
  projectId?: string;
}

export interface EvalResult {
  action: GateGuardAction;
  patternMatched?: string;
  explanation?: string;
  overrideHash?: string;
  latencyMs: number;
}

export interface AuditEntry {
  id: number;
  timestamp: string;
  command: string;
  agent?: string;
  patternMatched?: string;
  action: GateGuardAction;
  overrideBy?: string;
  projectId?: string;
  contextJson?: string;
}

export interface DenylistChangeEvent {
  action: 'add' | 'remove';
  pattern: DenyPattern;
}

// --- Type exports from zod ---

export type EvaluateInput = z.infer<typeof EvaluateInputSchema>;
export type DenylistInput = z.infer<typeof DenylistInputSchema>;
export type AuditLogInput = z.infer<typeof AuditLogInputSchema>;
export type OverrideInput = z.infer<typeof OverrideInputSchema>;
