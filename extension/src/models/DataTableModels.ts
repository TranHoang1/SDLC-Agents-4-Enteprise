/**
 * DataTableModels — DTOs for DataTable + Database resolution (SA4E-172).
 * Pure type definitions — no logic, no dependencies.
 */

/** Input: parsed Rule-Obj-Class JSON fields needed for key computation */
export interface ClassRuleInput {
  pzInsKey: string;
  pyClassName: string;
  pyClassType: string;
  pyClassGroupIndicator: string;
  pyClassGroup?: string;
  pyDerivesFrom?: string;
}

/** Output: resolution summary returned by DataTableResolver.resolve() */
export interface DataTableResolveResult {
  dataTablesResolved: number;
  databasesResolved: number;
  skippedAbstract: number;
  skippedNotFound: number;
  errors: number;
}

/** Fetched DataTable rule with database reference and provenance */
export interface DataTableRuleInfo {
  pzInsKey: string;
  pyDatabaseName?: string;
  ruleJson: Record<string, unknown>;
  sourceClasses: string[];
}
