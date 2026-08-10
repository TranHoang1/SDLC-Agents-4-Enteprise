/**
 * SA4E-95 - GenerationReport summarizes a schema generation run.
 * Produced by HarnessSchemaGenerator after pipeline completion.
 */

/** Per-rule-type detail in the generation report */
export interface SchemaDetail {
  ruleType: string;
  status: 'generated' | 'skipped' | 'failed';
  coverage?: number;
  fieldCount?: number;
  templateSections?: string[];
  error?: string;
  duration: number;
}

/** Complete generation run report */
export interface GenerationReport {
  totalRuleTypes: number;
  generated: number;
  skipped: number;
  failed: number;
  averageCoverage: number;
  duration: number;
  details: SchemaDetail[];
}

/** Single rule type generation result */
export interface GeneratedSchema {
  ruleType: string;
  schema: Record<string, unknown>;
  coverage: number;
  templateSections: string[];
  version: string;
}
