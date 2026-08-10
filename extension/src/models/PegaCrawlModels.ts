/**
 * PegaCrawlModels — Interfaces for RuleSet-scoped enumeration (SA4E-94).
 * Minimal rule metadata returned by Service 10 enumeration.
 */

/** Rule summary returned by listRulesByRuleSet enumeration */
export interface RuleSetRuleSummary {
  /** Unique instance key — dedup key */
  pzInsKey: string;
  /** Rule type (Rule-Obj-Class, Rule-Obj-Activity, etc.) */
  pxObjClass: string;
  /** Class this rule applies to */
  pyClassName: string;
  /** Rule name */
  pyRuleName: string;
  /** RuleSet name (matches query) */
  pyRuleSet: string;
  /** RuleSet version */
  pyRuleSetVersion: string;
  /** Optional display label */
  pyLabel?: string;
}

/** Item shape compatible with fetchRulesInParallel */
export interface CrawlPlanItem {
  insKey: string;
  pxObjClass: string;
  pyClassName: string;
  pyRuleName: string;
}

/**
 * Map a RuleSetRuleSummary to a CrawlPlanItem for fetchRulesInParallel().
 * @param summary - Enumerated rule summary from Service 10
 */
export function summaryToCrawlItem(summary: RuleSetRuleSummary): CrawlPlanItem {
  return {
    insKey: summary.pzInsKey,
    pxObjClass: summary.pxObjClass,
    pyClassName: summary.pyClassName,
    pyRuleName: summary.pyRuleName,
  };
}

/**
 * Parse "HRAppsV2:01-02" → ["HRAppsV2", "01-02"].
 * Splits at LAST colon to support names containing colons.
 * @param entry - RuleSet entry string from HierarchyResult
 */
export function parseRuleSetEntry(entry: string): [string, string] {
  const colonIdx = entry.lastIndexOf(':');
  if (colonIdx < 0) { return [entry, '']; }
  return [entry.substring(0, colonIdx), entry.substring(colonIdx + 1)];
}
