/**
 * DataTableKeyComputer — Pure functions for DataTable/Database pzInsKey computation (SA4E-172).
 * Stateless, no I/O, no dependencies — easy to unit test.
 */

import type { ClassRuleInput } from "../models/DataTableModels";

/**
 * BR-01: Compute DataTable pzInsKey from class rule metadata.
 * Returns null for abstract classes (BR-03) or unknown indicators.
 * @param classRule - Parsed class rule fields
 * @returns Computed insKey string or null if not applicable
 */
export function computeDataTableKey(classRule: ClassRuleInput): string | null {
  // BR-03: Skip abstract classes
  if (classRule.pyClassType === "Abstract") { return null; }

  switch (classRule.pyClassGroupIndicator) {
    case "ISCLASSGROUP":
    case "NOCLASSGROUP":
      return `DATA-ADMIN-DB-TABLE ${classRule.pyClassName.toUpperCase()}`;
    case "HASCLASSGROUP":
      if (!classRule.pyClassGroup) { return null; }
      return `DATA-ADMIN-DB-TABLE ${classRule.pyClassGroup.toUpperCase()}`;
    default:
      return null; // Unknown indicator — skip
  }
}

/**
 * BR-02: Compute Database pzInsKey from pyDatabaseName.
 * Returns null if name is empty or blank.
 * @param pyDatabaseName - Database name from fetched DataTable rule
 * @returns Computed insKey string or null
 */
export function computeDatabaseKey(pyDatabaseName: string): string | null {
  if (!pyDatabaseName || pyDatabaseName.trim() === "") { return null; }
  return `DATA-ADMIN-DB-NAME ${pyDatabaseName.toUpperCase()}`;
}

/**
 * Check if an error indicates a critical (abort-worthy) HTTP failure.
 * Critical errors: 401, 403, 500, 502, 503, 504.
 * @param err - Caught error object
 * @returns true if the error should abort the entire resolution
 */
export function isCriticalError(err: any): boolean {
  const msg = err?.message || "";
  return msg.includes("HTTP 401") || msg.includes("HTTP 403") ||
    msg.includes("HTTP 500") || msg.includes("HTTP 502") ||
    msg.includes("HTTP 503") || msg.includes("HTTP 504");
}
