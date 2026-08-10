/**
 * PegaRuleSetEnumerator — RuleSet-scoped enumeration (SA4E-94).
 * Discovers ALL rules upfront via paginated RuleSet queries,
 * replacing the blind dependency crawl with deterministic coverage.
 */
import type { PegaHttpClient } from "./PegaHttpClient";
import type { RuleSetRuleSummary } from "../models";
import { parseRuleSetEntry } from "../models";

type LogFn = (msg: string) => void;

/**
 * Enumerate ALL rules in a single RuleSet by paginating until pxMore=false.
 * Each page returns up to 200 rules (BR-02).
 * @param ruleSetName - RuleSet name from HierarchyResult
 * @param ruleSetVersion - RuleSet version from HierarchyResult
 * @param pegaClient - HTTP client for Pega API calls
 * @param log - Logging function for progress reporting
 * @returns Complete array of rule summaries for this RuleSet
 */
export async function enumerateRuleSet(
  ruleSetName: string,
  ruleSetVersion: string,
  pegaClient: PegaHttpClient,
  log: LogFn,
): Promise<RuleSetRuleSummary[]> {
  const allRules: RuleSetRuleSummary[] = [];
  let pageIndex = 1;

  // Paginate until server signals no more pages
  while (true) {
    const response = await pegaClient.listRulesByRuleSet(
      ruleSetName, ruleSetVersion, 200, pageIndex,
    );
    allRules.push(...response.pxResults);
    log(`[Pega Enumerator] RuleSet "${ruleSetName}": page ${pageIndex}, found ${response.pxResults.length} rules (total: ${allRules.length})`);

    if (!response.pxMore) { break; }
    pageIndex++;
  }

  return allRules;
}

/**
 * Enumerate ALL rules across multiple RuleSets in parallel.
 * Each RuleSet is enumerated independently. Results are deduplicated by pzInsKey.
 * @param ruleSets - Array of RuleSet entries from HierarchyResult (format: "Name:Version")
 * @param pegaClient - HTTP client
 * @param log - Logger
 * @returns Deduplicated Map<insKey, RuleSetRuleSummary>
 */
export async function enumerateAllRuleSets(
  ruleSets: string[],
  pegaClient: PegaHttpClient,
  log: LogFn,
): Promise<Map<string, RuleSetRuleSummary>> {
  const deduped = new Map<string, RuleSetRuleSummary>();

  log(`[Pega Enumerator] Enumerating ${ruleSets.length} RuleSets in parallel...`);

  // Run all enumerations in parallel — RuleSets are independent queries
  const results = await Promise.all(
    ruleSets.map(async (entry) => {
      const [name, version] = parseRuleSetEntry(entry);
      if (!name) { return { entry, rules: [] as RuleSetRuleSummary[] }; }
      try {
        const rules = await enumerateRuleSet(name, version, pegaClient, log);
        return { entry, rules };
      } catch (err: any) {
        // Single RuleSet failure is non-fatal — log and continue (AF-01)
        log(`[Pega Enumerator] ⚠️ RuleSet "${name}" enumeration failed: ${err.message}`);
        return { entry, rules: [] as RuleSetRuleSummary[] };
      }
    }),
  );

  // Aggregate and deduplicate by pzInsKey (BR-09)
  for (const { entry, rules } of results) {
    if (rules.length === 0) {
      log(`[Pega Enumerator] ⚠️ RuleSet "${entry}" returned 0 rules`);
    }
    for (const rule of rules) {
      if (rule.pzInsKey && !deduped.has(rule.pzInsKey)) {
        deduped.set(rule.pzInsKey, rule);
      }
    }
  }

  log(`[Pega Enumerator] ✅ Enumeration complete: ${deduped.size} unique rules from ${ruleSets.length} RuleSets`);
  return deduped;
}
