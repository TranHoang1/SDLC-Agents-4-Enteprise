/**
 * PegaHierarchyHelpers — Extractors and disk-save utilities for Pega hierarchy.
 * Used by PegaHierarchyResolver to parse application JSON and persist rules.
 */
import * as path from "path";
import * as fs from "fs";

export type LogFn = (msg: string) => void;

/** A single ruleset entry from an application rule */
export interface RuleSetEntry {
  name: string;
  version: string;
}

/** A depended application reference */
export interface DependedAppRef {
  appName: string;
  appVersion: string;
}

/** An access group entry discovered for the application */
export interface AccessGroupEntry {
  name: string;
  pzInsKey: string;
}

/** Result of the full hierarchy resolution */
export interface HierarchyResult {
  seeds: string[];
  operatorId: string;
  accessGroup: string;
  appName: string;
  appVersion: string;
  ruleSets: string[];
  dependedApps: string[];
  accessGroups: AccessGroupEntry[];
}

/** Max recursion depth to prevent circular dependency loops */
export const MAX_RECURSION_DEPTH = 5;

/**
 * Save a fetched Pega rule object to disk as .pega.json.
 * Reuses the same naming pattern as PegaCrawlHelper.saveRuleFile.
 */
export function saveHierarchyRule(
  rObj: Record<string, unknown>,
  root: string,
  log: LogFn,
  fallbackClass?: string,
  fallbackName?: string,
): void {
  try {
    const objClass = (rObj.pxObjClass as string) || fallbackClass || "Rule";
    const ruleName = (rObj.pyRuleName as string)
      || (rObj.pyPropertyName as string)
      || (rObj.pyActivityName as string)
      || fallbackName || "Rule";
    const safeClass = objClass.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeName = ruleName.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const targetDir = path.join(root, "rules", safeClass);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const filePath = path.join(targetDir, `${safeName}.pega.json`);
    fs.writeFileSync(filePath, JSON.stringify(rObj, null, 2), "utf-8");
    log(`[PegaHierarchy] 💾 Saved ${safeClass}/${safeName}.pega.json`);
  } catch (err: any) {
    log(`[PegaHierarchy] ⚠️ File save error: ${err.message}`);
  }
}

/** Extract pyRuleSetList from an application rule object */
export function extractRuleSetList(appObj: Record<string, unknown>): RuleSetEntry[] {
  const raw = (appObj.pyRuleSetList || appObj.pyRuleSets) as any[];
  if (!Array.isArray(raw)) { return []; }
  return raw
    .map((rs) => {
      const name = typeof rs === "string" ? rs : (rs.pyRuleSetName || rs.pyRuleSet || rs.pxSubRuleSet);
      const version = typeof rs === "object" ? (rs.pyRuleSetVersion || rs.pyVersion || "") : "";
      return name ? { name, version } : null;
    })
    .filter((x): x is RuleSetEntry => x !== null);
}

/** Extract pyProdRuleSetList from an application rule object */
export function extractProdRuleSetList(appObj: Record<string, unknown>): RuleSetEntry[] {
  const raw = appObj.pyProdRuleSetList as any[];
  if (!Array.isArray(raw)) { return []; }
  return raw
    .map((rs) => {
      const name = typeof rs === "string" ? rs : (rs.pyRuleSetName || rs.pyRuleSet);
      const version = typeof rs === "object" ? (rs.pyRuleSetVersion || rs.pyVersion || "LATEST") : "LATEST";
      return name ? { name, version } : null;
    })
    .filter((x): x is RuleSetEntry => x !== null);
}

/** Extract pyDependsOnApplication from an application rule object */
export function extractDependedApps(appObj: Record<string, unknown>): DependedAppRef[] {
  const raw = appObj.pyDependsOnApplication as any[];
  if (!Array.isArray(raw)) { return []; }
  return raw
    .map((dep) => {
      const appName = dep.pyAppName || dep.pyApplicationName || dep.pyDependentAppName || "";
      const appVersion = dep.pyAppVersion || dep.pyApplicationVersion || dep.pyDependentAppVersion || "";
      return appName ? { appName, appVersion } : null;
    })
    .filter((x): x is DependedAppRef => x !== null);
}

/**
 * Merge ruleset layers: higher-priority entries first.
 * Deduplicates by name — first occurrence (higher app) wins.
 */
export function mergeRuleSetLayers(layers: RuleSetEntry[][]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const layer of layers) {
    for (const rs of layer) {
      const key = rs.name.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(rs.version ? `${rs.name}:${rs.version}` : rs.name);
      }
    }
  }
  return merged;
}

/** Build candidate PzInsKey values for an application rule */
export function buildAppInsKeys(appName: string, version: string | null): string[] {
  const upper = appName.toUpperCase();
  const keys: string[] = [];
  if (version) {
    keys.push(`RULE-APPLICATION ${upper} ${version}`);
  } else {
    keys.push(`RULE-APPLICATION ${upper} 01.01`);
    keys.push(`RULE-APPLICATION ${upper} 01-01-01`);
  }
  keys.push(`RULE-APPLICATION ${upper}`);
  keys.push(`RULE-APPLICATION ${appName}`);
  return keys;
}
