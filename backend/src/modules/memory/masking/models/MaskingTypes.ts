/**
 * Core types for the KB Sensitive Data Masking system.
 */

export type PatternType =
  | 'email' | 'phone' | 'ip' | 'credit_card' | 'ssn'
  | 'api_key' | 'jwt' | 'password' | 'connection_string' | 'private_key';

export type PatternCategory = 'pii' | 'credential' | 'business';

export type SensitivityLevel = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

export type ClassificationSource = 'auto' | 'manual';

export type AuditAction =
  | 'mask_pii' | 'mask_credential' | 'summary_only'
  | 'hide' | 'reveal' | 'skip_allowlist';

export type AllowlistRuleType = 'entry_id' | 'tag' | 'source' | 'pattern';

export interface MaskingConfig {
  id: number;
  pattern_type: PatternType;
  enabled: boolean;
  regex_pattern: string | null;
  mask_format: string;
  category: PatternCategory;
  created_at: string;
  updated_at: string;
}

export interface SensitivityClassification {
  id: number;
  entry_id: number;
  level: SensitivityLevel;
  source: ClassificationSource;
  confidence: number;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AllowlistRule {
  id: number;
  rule_type: AllowlistRuleType;
  rule_value: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

export interface MaskingAuditEntry {
  id?: number;
  entry_id: number;
  requester_id: string;
  requester_role: string;
  action: AuditAction;
  patterns_matched: string;
  sensitivity_level: string;
  timestamp?: string;
}

export interface DetectionResult {
  type: PatternType;
  category: PatternCategory;
  match: string;
  start: number;
  end: number;
}

export interface MaskingOptions {
  reveal?: boolean;
}

export interface MaskedEntry {
  id: number;
  content: string;
  summary: string;
  masking_applied: boolean;
  sensitivity_level: SensitivityLevel;
  masked_patterns: string[];
  hidden: boolean;
}

export interface CodeBlock {
  placeholder: string;
  original: string;
  start: number;
  end: number;
}
