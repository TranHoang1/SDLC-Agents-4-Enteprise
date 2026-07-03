/**
 * KSA-164/165/166/167: Security Analysis — Shared type definitions.
 */

import type { SyntaxNode } from '../../parsers/types.js';

// ─── CFG Types (KSA-164) ───────────────────────────────────────────────────

export type BlockType = 'entry' | 'exit' | 'normal' | 'branch' | 'loop-header' | 'catch';

export type EdgeType =
  | 'sequential'
  | 'branch-true'
  | 'branch-false'
  | 'loop-back'
  | 'loop-exit'
  | 'exception'
  | 'return';

export interface Statement {
  node: SyntaxNode;
  line: number;
  type: string;
  text: string;
}

export interface VariableDef {
  name: string;
  line: number;
  blockId: number;
  node: SyntaxNode;
}

export interface VariableUse {
  name: string;
  line: number;
  blockId: number;
  node: SyntaxNode;
}

// ─── Data Flow Types (KSA-164) ─────────────────────────────────────────────

export interface Definition {
  variable: string;
  line: number;
  blockId: number;
  id: number;
}

export interface DefUseChain {
  definition: Definition;
  uses: Array<{ line: number; blockId: number }>;
}

export interface DataFlowResult {
  reachingDefs: Map<number, Set<Definition>>;
  defUseChains: DefUseChain[];
  definitions: Definition[];
}

// ─── Taint Types (KSA-164) ─────────────────────────────────────────────────

export type TaintSourceType =
  | 'http_param' | 'http_body' | 'http_header' | 'http_cookie'
  | 'url_param' | 'file_read' | 'env_var' | 'db_result'
  | 'user_input' | 'cli_arg' | 'websocket';

export type TaintSinkType =
  | 'sql_query' | 'shell_exec' | 'file_write' | 'file_path'
  | 'html_output' | 'eval' | 'deserialize' | 'ldap_query'
  | 'xml_parse' | 'url_fetch' | 'redirect' | 'log_output';

export interface TaintSource {
  variable: string;
  type: TaintSourceType;
  line: number;
  expression: string;
}

export interface TaintSink {
  function: string;
  type: TaintSinkType;
  line: number;
  expression: string;
  paramIndex: number;
}

export interface TaintStep {
  variable: string;
  line: number;
  action: 'assign' | 'concat' | 'template_literal' | 'format_string'
    | 'function_call' | 'collection_add' | 'destructure' | 'sanitize' | 'pass_through';
  expression: string;
}

export interface TaintPath {
  source: TaintSource;
  sink: TaintSink;
  chain: TaintStep[];
  sanitized: boolean;
  length: number;
}

export interface TaintResult {
  paths: TaintPath[];
  sources: TaintSource[];
  sinks: TaintSink[];
  sanitizers: Array<{ function: string; line: number; sinkTypes: TaintSinkType[] }>;
}

export interface TaintOptions {
  maxPathLength?: number;
  includeSanitized?: boolean;
  sinkTypes?: TaintSinkType[];
  sourceTypes?: TaintSourceType[];
}

// ─── Injection Types (KSA-165) ──────────────────────────────────────────────

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';
export type Confidence = 'High' | 'Medium' | 'Low';

export interface InjectionPattern {
  id: number;
  name: string;
  category: string;
  cwe: string;
  severity: Severity;
  sinkPatterns: string[];
  dangerousOps: string[];
  safePatterns: string[];
  description: string;
}

export interface Finding {
  id: string;
  ruleId: string;
  category: string;
  pattern: InjectionPattern;
  taintPath: TaintPath;
  severity: Severity;
  confidence: Confidence;
  cwe: string;
  message: string;
  remediation: string;
  location: {
    file: string;
    startLine: number;
    endLine: number;
  };
  suppressed: boolean;
  suppressionInfo?: SuppressionInfo;
}

export interface SuppressionInfo {
  marker: string;
  scope: 'line' | 'block' | 'file';
  line: number;
}

export interface ScanOptions {
  filePath?: string;
  includeSuppressed?: boolean;
  severityThreshold?: Severity;
  categories?: string[];
  outputFormat?: 'json' | 'sarif';
}

export interface ScanResult {
  findings: Finding[];
  suppressed: Finding[];
  summary: {
    total: number;
    bySeverity: Record<Severity, number>;
    byCategory: Record<string, number>;
    filesScanned: number;
    scanDuration: number;
  };
}

// ─── SSRF/IDOR/Auth Types (KSA-166) ────────────────────────────────────────

export type TrustTier = 'T1' | 'T2' | 'T3';

export interface SSRFFinding {
  handler: string;
  filePath: string;
  source: TaintSource;
  sink: TaintSink;
  path: number[];
  trustTier: TrustTier;
  confidence: number;
  missingControl: string;
  cwe: string;
  severity: Severity;
}

export interface IDORFinding {
  handler: string;
  filePath: string;
  idParam: string;
  dbLookup: { function: string; line: number };
  missingAuthzCheck: boolean;
  trustTier: TrustTier;
  confidence: number;
  cwe: string;
  severity: Severity;
}

export interface MissingAuthFinding {
  handler: string;
  filePath: string;
  route: string;
  httpMethod: string;
  controller: string;
  siblingAuthRatio: number;
  confidence: number;
  cwe: string;
  severity: Severity;
}

// ─── Misconfig/Secrets/SBOM Types (KSA-167) ────────────────────────────────

export interface MisconfigFinding {
  id: string;
  pattern: string;
  file: string;
  line: number;
  key: string;
  value: string;
  cwe: string;
  severity: Severity;
  remediation: string;
}

export interface SecretFinding {
  id: string;
  pattern: string;
  file: string;
  line: number;
  match: string;
  entropy: number;
  cwe: string;
  severity: Severity;
  masked: string;
}

export interface Dependency {
  name: string;
  version: string;
  scope: 'required' | 'dev' | 'optional';
  ecosystem: string;
  hashes: string[];
  license?: string;
}

export interface Vulnerability {
  id: string;
  summary: string;
  severity: Severity;
  affectedVersions: string;
  fixedVersion?: string;
  references: string[];
}

export interface SBOMComponent {
  type: 'library';
  name: string;
  version: string;
  purl: string;
  scope: string;
  hashes: Array<{ alg: string; content: string }>;
  licenses: string[];
}

// ─── SARIF Types (shared KSA-165/167) ───────────────────────────────────────

export interface SARIFLog {
  $schema: string;
  version: '2.1.0';
  runs: SARIFRun[];
}

export interface SARIFRun {
  tool: {
    driver: {
      name: string;
      version: string;
      rules: SARIFRule[];
    };
  };
  results: SARIFResult[];
}

export interface SARIFRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription?: { text: string };
  defaultConfiguration: { level: 'error' | 'warning' | 'note' };
  properties: { tags: string[] };
}

export interface SARIFResult {
  ruleId: string;
  level: 'error' | 'warning' | 'note';
  message: { text: string };
  locations: SARIFLocation[];
  codeFlows?: SARIFCodeFlow[];
}

export interface SARIFLocation {
  physicalLocation: {
    artifactLocation: { uri: string };
    region: { startLine: number; endLine?: number; startColumn?: number };
  };
}

export interface SARIFCodeFlow {
  threadFlows: Array<{
    locations: Array<{
      location: SARIFLocation;
      message?: { text: string };
    }>;
  }>;
}
