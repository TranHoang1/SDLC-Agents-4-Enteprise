/**
 * PegaSchemaModels — Types for Pega Rule Schema Generator (SA4E-93).
 * Defines interfaces for the schema generation pipeline.
 */

/** Pipeline generation state (FSD Section 5) */
export type SchemaGenerationState =
  | "IDLE"
  | "CRAWLING"
  | "GROUPING"
  | "FETCHING_DETAIL"
  | "PARSING"
  | "GENERATING"
  | "COMPLETED"
  | "ERROR";

/** Result from schema generation pipeline */
export interface SchemaGenerationResult {
  totalHarnesses: number;
  uniqueRuleTypes: number;
  schemasGenerated: number;
  schemasFailed: number;
  errors: SchemaError[];
  outputDirectory: string;
}

/** Detailed error for failed schema generation */
export interface SchemaError {
  ruleType: string;
  phase: "crawl" | "fetch" | "parse" | "generate" | "write";
  message: string;
}

/** Summary of a harness rule from listRulesByFilter */
export interface HarnessSummary {
  pzInsKey: string;
  pxObjClass: string;
  pyClassName: string;
  pyRuleName: string;
  pyStreamName: string;
  pyLabel?: string;
}

/** Response from listRulesByFilter (Service 10) */
export interface ListRulesResponse {
  pxResults: HarnessSummary[];
  pxMore: boolean;
  totalCount?: number;
}

/** Pega UI control types (FSD Section 7.2) */
export type PegaControlType =
  | "TextInput"
  | "TextArea"
  | "NumberInput"
  | "Checkbox"
  | "Dropdown"
  | "RadioButtons"
  | "DatePicker"
  | "Autocomplete"
  | "Link"
  | "Integer"
  | "Hidden"
  | "PageList"
  | "PageGroup"
  | "Unknown";

/** Extracted control definition from harness section */
export interface ControlDefinition {
  fieldName: string;
  controlType: PegaControlType;
  required: boolean;
  label?: string;
  tooltip?: string;
  defaultValue?: string;
  validValues?: string[];
  maxLength?: number;
  minimum?: number;
  maximum?: number;
}

/** JSON Schema property definition */
export interface JsonSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
  format?: string;
  const?: string;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  items?: { type: string };
  additionalProperties?: boolean;
}

/** Complete JSON Schema document (draft-07) */
export interface JsonSchema {
  $schema: string;
  title: string;
  description: string;
  type: "object";
  properties: Record<string, JsonSchemaProperty>;
  required: string[];
  additionalProperties: true;
}

/** JSON Schema type info for control type mapping lookup */
export interface JsonSchemaTypeInfo {
  type: string;
  format?: string;
  additionalProps?: Record<string, unknown>;
}
