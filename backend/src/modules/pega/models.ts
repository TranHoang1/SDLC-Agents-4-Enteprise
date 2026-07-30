/**
 * Models and interfaces for Pega Rule & Data Indexing.
 */

export interface RulesetVersion {
  name: string;
  version: string;
}

export interface PegaCheckRuleRequest {
  projectId: string;
  ruleType: string;
  className: string;
  ruleName: string;
  rulesetStack?: RulesetVersion[];
  ruleset?: string;
  version?: string;
}

export interface PegaCheckRuleResponse {
  cached: boolean;
  ruleId?: number;
  updatedAt?: string;
  ruleset?: string;
  version?: string;
  content?: Record<string, unknown>;
}

export interface UnresolvedDependency {
  insKey?: string;
  ruleType: string;
  className: string;
  ruleName: string;
}

export interface PegaIngestRuleRequest {
  projectId: string;
  ruleJson: Record<string, unknown>;
  rulesetStack?: RulesetVersion[];
  checksum?: string;
  version?: string;
}

export interface PegaIngestRuleResponse {
  status: 'success' | 'error';
  ruleId?: number;
  unresolvedDependencies?: UnresolvedDependency[];
  reason?: string;
}

export interface PegaCrawlKey {
  insKey: string;
  pxObjClass: string;
  pyClassName: string;
  pyRuleName: string;
}

export interface PegaCrawlPlanRequest {
  projectId: string;
  ruleKeys: string[];
  visitedKeys?: string[];
  ruleChecksums?: Record<string, string>;
}

export interface PegaCrawlPlanResponse {
  missing: PegaCrawlKey[];
  cached: string[];
}

export interface PegaCrawlBatchRequest {
  projectId: string;
  rules: Record<string, unknown>[];
  visitedKeys: string[];
  rulesChecksums?: Record<string, string>;
  rulesVersions?: Record<string, string>;
}

export interface PegaCrawlBatchResponse {
  stored: number;
  nextBatch: PegaCrawlKey[];
}

export interface PegaDetectProjectRequest {
  workspaceRoot: string;
}

export interface PegaDetectProjectResponse {
  isPegaProject: boolean;
  applicationName?: string;
  rulesetName?: string;
  rulesetVersion?: string;
  sourceDir?: string;
  confidence: number;
  indicators: string[];
}
