/**
 * SA4E-173 — App class discovery + category-based rule traversal.
 * Discovers work classes (pyWorkMetaData) and data classes (D_pyDataTypesOfApp),
 * then traverses directChildren API to find all rules for each class.
 */
import * as path from "path";
import * as fs from "fs";
import type { PegaHttpClient } from "./PegaHttpClient";
import { saveRuleFile } from "./PegaCrawlHelper";
import type { MembershipSet } from "./DiskBackedSet";

type LogFn = (msg: string) => void;

/**
 * Discover work classes from Application rule + data classes from D_pyDataTypesOfApp.
 * @returns Array of pzInsKey strings for discovered classes
 */
export async function discoverAppClasses(
    pegaClient: PegaHttpClient, hierarchy: any, root: string, log: LogFn,
): Promise<string[]> {
    const classKeys: string[] = [];
    discoverWorkClasses(root, classKeys, log);
    await discoverDataClasses(pegaClient, hierarchy, classKeys, log);
    return classKeys;
}

/** Extract work class keys from Rule-Application JSON files in workspace. */
function discoverWorkClasses(root: string, classKeys: string[], log: LogFn): void {
    try {
        const appRulePath = path.join(root, 'rules', 'Rule-Application');
        if (!fs.existsSync(appRulePath)) return;
        const files = fs.readdirSync(appRulePath).filter((f: string) => f.endsWith('.pega.json'));
        for (const file of files) {
            const raw = fs.readFileSync(path.join(appRulePath, file), 'utf-8');
            const appJson = JSON.parse(raw);
            const workMeta = appJson.pyWorkMetaData as Array<Record<string, unknown>> | undefined;
            if (!Array.isArray(workMeta)) continue;
            for (const wm of workMeta) {
                const cls = wm.pyWorkTypeImplementationClassName as string;
                if (cls) {
                    classKeys.push(`RULE-OBJ-CLASS ${cls.toUpperCase()}`);
                    log(`[Pega Indexer] 📌 Work class from App: ${cls}`);
                }
            }
        }
    } catch (err: any) {
        log(`[Pega Indexer] ⚠️ Work class discovery failed: ${err.message}`);
    }
}

/** Fetch data class pzInsKeys via D_pyDataTypesOfApp DataPage. */
async function discoverDataClasses(
    pegaClient: PegaHttpClient, hierarchy: any, classKeys: string[], log: LogFn,
): Promise<void> {
    try {
        const appName = hierarchy.appName || '';
        const appVersion = (hierarchy.appVersion || '01.01').replace(/-/g, '.');
        if (!appName) return;
        const dataClassKeys = await pegaClient.fetchDataTypesOfApp(appName, appVersion);
        log(`[Pega Indexer] 📌 Data classes from D_pyDataTypesOfApp: ${dataClassKeys.length}`);
        classKeys.push(...dataClassKeys);
    } catch (err: any) {
        log(`[Pega Indexer] ⚠️ Data class discovery failed: ${err.message}`);
    }
}

/**
 * Traverse directChildren API to discover all rules for a class.
 * Level 1 → Level 2 → rule info → query pzInsKeys.
 */
export async function discoverRulesViaCategories(
    className: string, pegaClient: PegaHttpClient, log: LogFn,
): Promise<string[]> {
    const allKeys: string[] = [];
    try {
        const level1 = await pegaClient.fetchDirectChildren(className);
        const categories1 = level1.map((r: any) => r.pyLabel as string).filter(Boolean);

        for (const cat1 of categories1) {
            const level2 = await pegaClient.fetchDirectChildren(className, cat1);
            const categories2 = level2.map((r: any) => r.pyLabel as string).filter(Boolean);

            for (const cat2 of categories2) {
                const rules = await pegaClient.fetchDirectChildren(className, cat1, cat2);
                for (const rule of rules) {
                    const keys = await queryRuleKeysFromInfo(rule, pegaClient);
                    allKeys.push(...keys);
                }
            }
        }
        if (allKeys.length > 0) {
            log(`[Pega Indexer] 📋 Category discovery for "${className}": ${allKeys.length} rule keys`);
        }
    } catch (err: any) {
        log(`[Pega Indexer] ⚠️ Category discovery failed for "${className}": ${err.message}`);
    }
    return allKeys;
}

/** Query pzInsKeys from a single rule info record (level 2 result). */
async function queryRuleKeysFromInfo(
    rule: Record<string, unknown>, pegaClient: PegaHttpClient,
): Promise<string[]> {
    const ruleType = rule.pyClass as string;
    const appliesTo = rule.pyClassName as string;
    const ruleName = rule.pyRuleName as string;
    if (!ruleType || !appliesTo || !ruleName) return [];
    return pegaClient.queryRuleInsKeys(ruleType, appliesTo, ruleName);
}

/**
 * Fetch and save category-discovered rules that are not already visited.
 * Used inside fetchAllRules after the standard fetchRuleTypesInParallel.
 */
export async function fetchCategoryRules(
    className: string, pegaClient: PegaHttpClient,
    visitedKeys: MembershipSet, root: string, log: LogFn,
): Promise<Record<string, unknown>[]> {
    const fetched: Record<string, unknown>[] = [];
    const categoryRuleKeys = await discoverRulesViaCategories(className, pegaClient, log);
    for (const ruleKey of categoryRuleKeys) {
        if (visitedKeys.has(ruleKey)) continue;
        visitedKeys.add(ruleKey);
        try {
            const ruleJson = await pegaClient.getRuleByInsKey(ruleKey);
            saveRuleFile(ruleJson, root, log);
            fetched.push(ruleJson);
        } catch { /* skip individual failures */ }
    }
    return fetched;
}
