/**
 * PegaCrawlHelper — Parallel fetch strategies for Pega rule crawling.
 * Extracts fetch logic from IndexingService to keep files under 200 lines
 * and enable concurrent rule retrieval (SA4E-92 performance fix).
 */
import * as path from "path";
import * as fs from "fs";
import { parallelBatch } from "./parallel-utils";
import type { PegaHttpClient } from "./PegaHttpClient";

/** Concurrency limit: max parallel requests to Pega server */
const FETCH_CONCURRENCY = 5;

/** Rule types to crawl when a Class rule is encountered */
const RULE_TYPES_TO_CRAWL = [
    "Rule-Obj-Property",
    "Rule-Obj-Activity",
    "Rule-Obj-Flow",
    "Rule-Obj-Model",
    "Rule-HTML-Section",
    "Rule-Declare-Expressions",
    "Rule-Obj-FieldValue",
    "Rule-Obj-Report-Definition",
    "Rule-Service-REST",
] as const;

type LogFn = (msg: string) => void;

/** Item shape from crawlPlan response */
interface CrawlPlanItem {
    insKey: string;
    pxObjClass: string;
    pyClassName: string;
    pyRuleName: string;
}

/** Result of a successful rule fetch */
interface FetchedRule {
    ruleObj: Record<string, unknown>;
    item: CrawlPlanItem;
}

/** Aggregated result from parallel rule fetches */
export interface ParallelFetchResult {
    fetched: FetchedRule[];
    /** If a server error was detected, contains the error message to throw */
    serverError: string | null;
}

/** Sub-rule fetched from a class expansion */
export interface SubRuleFetched {
    rule: Record<string, unknown>;
    ruleType: string;
}

/**
 * Fetch rules in parallel with concurrency=5.
 * Server errors (5xx, connection failures) abort all remaining fetches.
 * Not-found errors are logged and skipped.
 */
export async function fetchRulesInParallel(
    chunk: CrawlPlanItem[],
    pegaClient: PegaHttpClient,
    log: LogFn,
): Promise<ParallelFetchResult> {
    const fetched: FetchedRule[] = [];
    let serverError: string | null = null;

    await parallelBatch(chunk, FETCH_CONCURRENCY, async (item) => {
        // Early exit: if a previous item detected a server error, skip
        if (serverError) { return null; }

        log(`[Pega Indexer] ⬇️ Fetching rule: ${item.pxObjClass} | ${item.pyClassName} | ${item.pyRuleName} (${item.insKey})`);
        try {
            const ruleObj = await pegaClient.getObject(item.pxObjClass, item.pyRuleName, item.pyClassName);
            if (ruleObj && (ruleObj.error || ruleObj.pyHTTPResponseCode === "404" || ruleObj.pyHTTPResponseCode === 404)) {
                throw new Error(String(ruleObj.error || "Rule not found on Pega Server"));
            }
            const ruleName = (ruleObj.pyRuleName as string) || (ruleObj.pyLabel as string) || item.pyRuleName;
            const jsonStr = JSON.stringify(ruleObj);
            log(`[Pega Indexer] ✅ Downloaded ${ruleObj.pxObjClass || item.pxObjClass} "${ruleName}" (${jsonStr.length} bytes)`);
            fetched.push({ ruleObj, item });
            return ruleObj;
        } catch (err: any) {
            const errMsg = String(err.message || err);
            const errorCategory = classifyFetchError(errMsg);

            if (errorCategory === "server") {
                log(`[Pega Indexer] ⛔ Server Error Detected: ${errMsg.substring(0, 150)}. Aborting crawl immediately.`);
                serverError = `Pega Server Connection Failed: ${errMsg.split("\n")[0]}`;
            } else {
                log(`[Pega Indexer] ❌ Failed to fetch ${item.pxObjClass} ${item.pyClassName} ${item.pyRuleName}: ${errMsg}`);
            }
            return null;
        }
    });

    return { fetched, serverError };
}

/**
 * Fetch all 9 rule types for a class in parallel (no concurrency limit needed
 * since it's only 9 requests, and they're independent).
 * Only returns rules not already in visitedKeys.
 */
export async function fetchRuleTypesInParallel(
    targetClassName: string,
    pegaClient: PegaHttpClient,
    visitedKeys: Set<string>,
    log: LogFn,
): Promise<SubRuleFetched[]> {
    const results: SubRuleFetched[] = [];

    // Fire all 9 rule type requests in parallel
    const ruleTypeResults = await Promise.all(
        RULE_TYPES_TO_CRAWL.map(async (rt) => {
            try {
                const subRules = await pegaClient.getClassRules(targetClassName, rt);
                return { rt, subRules };
            } catch {
                return { rt, subRules: [] as Record<string, unknown>[] };
            }
        }),
    );

    // Process results sequentially (visitedKeys mutation needs to be serial)
    for (const { rt, subRules } of ruleTypeResults) {
        if (subRules.length === 0) { continue; }
        log(`[Pega Indexer] 📌 Class "${targetClassName}": Loaded ${subRules.length} rules of type "${rt}". Saving files & ingesting...`);
        for (const sr of subRules) {
            const srInsKey = (sr as any).insKey
                || `${rt}:${targetClassName}:${(sr as any).pyRuleName || (sr as any).pyPropertyName || ''}`;
            if (!visitedKeys.has(srInsKey)) {
                visitedKeys.add(srInsKey);
                results.push({ rule: sr, ruleType: rt });
            }
        }
    }

    return results;
}

/**
 * Save a Pega rule object as a .pega.json file in the workspace rules/ directory.
 * Idempotent: skips if file already exists.
 */
export function saveRuleFile(
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
            || (rObj.pyFlowName as string)
            || (rObj.pyModelName as string)
            || (rObj.pyLabel as string)
            || fallbackName || "Rule";
        const safeClass = objClass.replace(/[^a-zA-Z0-9_-]/g, "_");
        const safeName = ruleName.replace(/[^a-zA-Z0-9_.-]/g, "_");

        const targetDir = path.join(root, "rules", safeClass);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        const filePath = path.join(targetDir, `${safeName}.pega.json`);
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(rObj, null, 2), "utf-8");
            log(`[Pega Indexer] 💾 Saved ${safeClass}/${safeName}.pega.json`);
        }
    } catch (fileErr: any) {
        log(`[Pega Indexer] ⚠️ File save error: ${fileErr.message}`);
    }
}

/**
 * Classify a fetch error as "server" (abort-worthy) or "not_found" (skip).
 * Server errors indicate the Pega instance is unreachable or broken.
 */
function classifyFetchError(errMsg: string): "server" | "not_found" | "other" {
    const lower = errMsg.toLowerCase();
    const isNotFound = lower.includes("not found")
        || lower.includes("rule not found")
        || lower.includes("record not found");
    if (isNotFound) { return "not_found"; }

    const serverPatterns = [
        "503", "502", "504", "500", "401", "403",
        "econnrefused", "enotfound", "etimedout",
        "fetch failed", "network error",
        "failed to connect", "service temporarily unavailable",
    ];
    const isServer = serverPatterns.some((p) => lower.includes(p));
    return isServer ? "server" : "other";
}
