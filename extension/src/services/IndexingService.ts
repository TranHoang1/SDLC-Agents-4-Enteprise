/**
 * IndexingService — orchestrates workspace indexing with injected dependencies.
 */
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { IndexerHttpClient } from "./IndexerHttpClient";
import { discoverDocuments } from "../indexer-discovery";
import { getProjectId } from "../extension";

export interface IndexOptions {
    code: boolean;
    documents: boolean;
    sync: boolean;
}

export type ProgressReporter = vscode.Progress<{ message?: string }>;

export class IndexingService {
    constructor(
        private readonly httpClient: IndexerHttpClient,
        private readonly outputChannel?: vscode.OutputChannel
    ) {}

    private log(msg: string): void {
        if (this.outputChannel) {
            this.outputChannel.appendLine(msg);
        } else {
            console.log(msg);
        }
    }

    async indexWorkspace(root: string, options: IndexOptions, token?: string, secrets?: vscode.SecretStorage): Promise<string[]> {
        const results: string[] = [];
        if (this.outputChannel) {
            this.outputChannel.show(true);
            this.outputChannel.appendLine("=== Workspace Indexing Started ===\n");
        }

        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: "Indexing workspace...", cancellable: false },
            async (report) => {
                // Crawl and index Pega Project rules if Pega project is present
                const pegaSummary = await this.indexPegaProject(root, report, secrets);
                if (pegaSummary) {
                    results.push(pegaSummary);
                }

                if (options.code) {
                    report.report({ message: "Scanning and uploading source code files..." });
                    const res = await this.httpClient.uploadSourceFiles(report, token);
                    results.push(res.summary);
                }
                if (options.documents) {
                    report.report({ message: "Discovering documents..." });
                    results.push(await this.indexDocuments(root, report, token));
                }
                if (options.sync) {
                    report.report({ message: "Syncing code symbols to memory..." });
                    results.push("✅ Code symbol sync triggered");
                }
            }
        );

        return results;
    }

    private async indexPegaProject(
        root: string,
        report: ProgressReporter,
        secrets?: vscode.SecretStorage
    ): Promise<string | null> {
        let appName = "";
        let pzInsKey = "";
        let operatorId = "";
        let operatorInsKey = "";
        let caseTypes: string[] = [];

        try {
            const jsonUri = vscode.Uri.file(path.join(root, "pega-project.json"));
            const raw = await vscode.workspace.fs.readFile(jsonUri);
            const json = JSON.parse(Buffer.from(raw).toString("utf-8"));
            if (json.isPegaProject) {
                appName = json.applicationName || "";
                operatorId = json.operatorId || "";
                operatorInsKey = json.operatorInsKey || "";
                pzInsKey = json.pzInsKey || json.applicationInsKey || (appName ? `RULE-APPLICATION ${appName.toUpperCase()}` : "");
                if (Array.isArray(json.caseTypes)) {
                    caseTypes = json.caseTypes.map((c: any) => c.caseTypeID || c.name);
                }
            }
        } catch {
            try {
                const xmlUri = vscode.Uri.file(path.join(root, "Application.xml"));
                const raw = await vscode.workspace.fs.readFile(xmlUri);
                const content = Buffer.from(raw).toString("utf-8");
                const m = content.match(/<application\s+name=['"]([^'"]+)['"]/i);
                if (m) {
                    appName = m[1];
                    pzInsKey = `RULE-APPLICATION ${appName.toUpperCase()}`;
                }
            } catch { /* not a Pega project */ }
        }

        if (!appName) { return null; }

        this.log(`[Pega Indexer] 🏛️ Pega Project Detected (App: "${appName}")`);
        report.report({ message: `🏛️ Pega Project Detected (${appName}) — Crawling Pega rules...` });

        if (!secrets) {
            this.log(`[Pega Indexer] ⚠️ Credentials not available in SecretStorage. Skipping live fetch.`);
            return `🏛️ Pega Project Detected (App: "${appName}", ${caseTypes.length} CaseTypes) — Metadata in pega-project.json`;
        }

        try {
            const PegaHttpClient = (await import("./PegaHttpClient")).PegaHttpClient;
            const pegaClient = new PegaHttpClient(secrets, this.outputChannel);

            // Deterministic 4-Step Resolution Pipeline:
            // 1. Account (Operator ID) => 2. Access Group => 3. Application Rule => 4. RuleSets & Rules/Data
            this.log(`[Pega Indexer] 🔄 Resolving Deterministic Pega Hierarchy (Account -> Access Group -> App Rule -> RuleSets -> Rules)...`);
            const hierarchy = await pegaClient.resolveDeterministicPegaHierarchy(operatorId || "SSA@TGB");

            const seedSet = new Set<string>(hierarchy.seeds);
            for (const ct of caseTypes) {
                seedSet.add(`RULE-OBJ-CLASS ${ct}`);
            }
            const seeds = Array.from(seedSet);

            this.log(`[Pega Indexer] Resolved Deterministic Queue (${seeds.length} items, App: "${hierarchy.appName}", RuleSets: ${hierarchy.ruleSets.join(", ") || "Auto"}):`);
            for (const s of seeds) {
                this.log(`  - ${s}`);
            }

            const projectId = getProjectId() || path.basename(root);
            const visitedKeys = new Set<string>();
            let currentQueue = seeds;
            let totalStored = 0;
            let totalFetchedInRun = 0;
            let totalStoredInDb = 0;
            let totalKbInDb = 0;
            let totalGraphInDb = 0;
            let iterations = 0;
            const MAX_ITERATIONS = 1000;

            while (currentQueue.length > 0 && iterations < MAX_ITERATIONS) {
                iterations++;
                this.log(`[Pega Indexer] Iteration ${iterations}: processing queue (${currentQueue.length} items, visited: ${visitedKeys.size})...`);
                report.report({ message: `Crawling Pega rules (unique rules: ${visitedKeys.size}, queue: ${currentQueue.length})...` });

                const plan = await pegaClient.crawlPlan({
                    projectId,
                    ruleKeys: currentQueue,
                    visitedKeys: Array.from(visitedKeys),
                });

                if (!plan.missing || plan.missing.length === 0) {
                    this.log(`[Pega Indexer] Crawl plan returned no missing items. Finish crawling.`);
                    break;
                }

                this.log(`[Pega Indexer] Crawl plan: ${plan.missing.length} missing rules to fetch.`);

                const fetchedRules: Record<string, unknown>[] = [];
                const chunk = plan.missing.slice(0, 50);
                for (const item of chunk) {
                    visitedKeys.add(item.insKey);
                    let ruleObj: Record<string, unknown>;
                    try {
                        this.log(`[Pega Indexer] ⬇️ Fetching rule: ${item.pxObjClass} | ${item.pyClassName} | ${item.pyRuleName} (${item.insKey})`);
                        ruleObj = await pegaClient.getObject(item.pxObjClass, item.pyRuleName, item.pyClassName);
                        if (ruleObj && (ruleObj.error || ruleObj.pyHTTPResponseCode === "404" || ruleObj.pyHTTPResponseCode === 404)) {
                            throw new Error(String(ruleObj.error || "Rule not found on Pega Server"));
                        }
                        fetchedRules.push(ruleObj);
                        const ruleName = (ruleObj.pyRuleName as string) || (ruleObj.pyLabel as string) || item.pyRuleName;
                        const jsonStr = JSON.stringify(ruleObj);
                        this.log(`[Pega Indexer] ✅ Downloaded ${ruleObj.pxObjClass || item.pxObjClass} "${ruleName}" (${jsonStr.length} bytes)`);
                    } catch (err: any) {
                        const errMsg = String(err.message || err);
                        const lowerMsg = errMsg.toLowerCase();
                        const isNotFound = lowerMsg.includes("not found") || lowerMsg.includes("rule not found") || lowerMsg.includes("record not found");
                        const isServerError = !isNotFound && (
                            lowerMsg.includes("503") ||
                            lowerMsg.includes("502") ||
                            lowerMsg.includes("504") ||
                            lowerMsg.includes("500") ||
                            lowerMsg.includes("401") ||
                            lowerMsg.includes("403") ||
                            lowerMsg.includes("econnrefused") ||
                            lowerMsg.includes("enotfound") ||
                            lowerMsg.includes("etimedout") ||
                            lowerMsg.includes("fetch failed") ||
                            lowerMsg.includes("network error") ||
                            lowerMsg.includes("failed to connect") ||
                            lowerMsg.includes("service temporarily unavailable")
                        );

                        if (isServerError) {
                            this.log(`[Pega Indexer] ⛔ Server Error Detected: ${errMsg.substring(0, 150)}. Aborting crawl immediately.`);
                            throw new Error(`Pega Server Connection Failed: ${errMsg.split("\n")[0]}`);
                        }

                        this.log(`[Pega Indexer] ❌ Failed to fetch ${item.pxObjClass} ${item.pyClassName} ${item.pyRuleName}: ${errMsg}`);
                        continue;
                    }

                    // Helper to save physical .pega.json file into workspace rules/ directory
                    const saveRuleFile = (rObj: Record<string, unknown>, fallbackClass?: string, fallbackName?: string) => {
                        try {
                            const objClass = (rObj.pxObjClass as string) || fallbackClass || "Rule";
                            const ruleName = (rObj.pyRuleName as string) || (rObj.pyPropertyName as string) || (rObj.pyActivityName as string) || (rObj.pyFlowName as string) || (rObj.pyModelName as string) || (rObj.pyLabel as string) || fallbackName || "Rule";
                            const safeClass = objClass.replace(/[^a-zA-Z0-9_-]/g, "_");
                            const safeName = ruleName.replace(/[^a-zA-Z0-9_.-]/g, "_");

                            const targetDir = path.join(root, "rules", safeClass);
                            if (!fs.existsSync(targetDir)) {
                                fs.mkdirSync(targetDir, { recursive: true });
                            }
                            const filePath = path.join(targetDir, `${safeName}.pega.json`);
                            if (!fs.existsSync(filePath)) {
                                fs.writeFileSync(filePath, JSON.stringify(rObj, null, 2), "utf-8");
                                this.log(`[Pega Indexer] 💾 Saved ${safeClass}/${safeName}.pega.json`);
                            }
                        } catch (fileErr: any) {
                            this.log(`[Pega Indexer] ⚠️ File save error: ${fileErr.message}`);
                        }
                    };

                    saveRuleFile(ruleObj, item.pxObjClass, item.pyRuleName);

                    // Class => Full Rules Resolution: Auto-fetch ALL Rule types (Activities, Flows, Data Transforms, Sections, Properties, Expressions, FieldValues, Reports)
                    if (item.pxObjClass === "Rule-OBJ-CLASS" || item.pxObjClass === "Rule-Obj-Class" || (ruleObj && ruleObj.pxObjClass === "Rule-Obj-Class")) {
                        const targetClassName = (ruleObj.pyClassName as string) || item.pyClassName;
                        if (targetClassName) {
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
                            ];
                            for (const rt of RULE_TYPES_TO_CRAWL) {
                                try {
                                    const subRules = await pegaClient.getClassRules(targetClassName, rt);
                                    if (subRules.length > 0) {
                                        this.log(`[Pega Indexer] 📌 Class "${targetClassName}": Loaded ${subRules.length} rules of type "${rt}". Saving files & ingesting...`);
                                        for (const sr of subRules) {
                                            saveRuleFile(sr, rt);
                                            fetchedRules.push(sr);
                                        }
                                    }
                                } catch { /* ignore rule type fetch notice */ }
                            }
                        }
                    }
                }

                if (fetchedRules.length === 0 && plan.missing.length <= chunk.length) {
                    this.log(`[Pega Indexer] No rules could be fetched in this batch. Crawl finished.`);
                    break;
                }

                if (fetchedRules.length > 0) {
                    totalFetchedInRun += fetchedRules.length;
                    this.log(`[Pega Indexer] Ingesting total of ${fetchedRules.length} rules into Backend DB (in 200-rule sub-batches)...`);

                    const BATCH_SIZE = 200;
                    let lastBatchRes: any = null;
                    const totalChunks = Math.ceil(fetchedRules.length / BATCH_SIZE);
                    
                    for (let i = 0; i < fetchedRules.length; i += BATCH_SIZE) {
                        const subChunk = fetchedRules.slice(i, i + BATCH_SIZE);
                        const chunkNum = Math.floor(i / BATCH_SIZE) + 1;
                        this.log(`[Pega Indexer] 📤 Ingesting chunk ${chunkNum}/${totalChunks} (${subChunk.length} rules) into Backend DB...`);
                        
                        try {
                            const res = await pegaClient.crawlBatch({
                                projectId,
                                rules: subChunk,
                                visitedKeys: Array.from(visitedKeys),
                            });
                            lastBatchRes = res;
                        } catch (subErr: any) {
                            this.log(`[Pega Indexer] ⚠️ Batch chunk ${chunkNum} notice: ${subErr.message}`);
                        }
                    }

                    if (lastBatchRes) {
                        if (lastBatchRes.totalRulesInDb) {
                            totalStoredInDb = lastBatchRes.totalRulesInDb;
                        } else {
                            totalStoredInDb += lastBatchRes.stored || fetchedRules.length;
                        }

                        if (lastBatchRes.totalKbEntriesInDb) {
                            totalKbInDb = lastBatchRes.totalKbEntriesInDb;
                        }

                        if (lastBatchRes.totalGraphNodesInDb) {
                            totalGraphInDb = lastBatchRes.totalGraphNodesInDb;
                        }

                        currentQueue = lastBatchRes.nextBatch ? lastBatchRes.nextBatch.map((k: any) => k.insKey) : [];
                    } else {
                        currentQueue = [];
                    }
                    this.log(`[Pega Indexer] Ingestion complete. Total DB Rules: ${totalStoredInDb}`);
                } else {
                    const remainingPlanKeys = plan.missing.slice(50).map(m => m.insKey).filter(k => !visitedKeys.has(k));
                    currentQueue = remainingPlanKeys;
                }
            }

            this.log(`[Pega Indexer] Crawl finished. Total fetched in run: ${totalFetchedInRun}`);
            return `🏛️ Pega Project Detected (App: "${appName}") — Ingested ${totalFetchedInRun} rules in this run (Total in KB Database: ${totalStoredInDb} Pega Rules, ${totalKbInDb} KB Entries, ${totalGraphInDb} Graph Nodes)`;
        } catch (err: any) {
            this.log(`[Pega Indexer] ❌ Fatal indexing error: ${err.message}`);
            return `❌ Pega Server Connection Failed: ${err.message}. Indexing ABORTED.`;
        }
    }

    async indexDocuments(root: string, report: ProgressReporter, token?: string): Promise<string> {
        const docs = discoverDocuments(root);
        if (docs.length === 0) { return "ℹ️ No documents found in documents/ folder"; }

        const mdDocs = docs.filter(d => d.format === "markdown");
        const textDocs = docs.filter(d => d.format === "text");
        const binaryDocs = docs.filter(d => d.format !== "markdown" && d.format !== "text");
        report.report({ message: `Found ${docs.length} files (${binaryDocs.length} binary → server-side convert)` });

        const channel = vscode.window.createOutputChannel("SDLC Indexing");

        // Text formats: read content locally, send with content (Task 7: client only handles text)
        const textWithContent = await this.readTextDocs(textDocs, root, channel);

        // Binary formats: send file_path only — server handles conversion via ConvertToolResolver (Task 7)
        const binaryForServer = binaryDocs.map(d => ({ ...d, content: undefined }));
        for (const d of binaryForServer) { channel.appendLine(`  📤 Server-convert: ${d.path}`); }

        const allDocsForIngest = [...mdDocs, ...textWithContent, ...binaryForServer];
        report.report({ message: `Indexing ${allDocsForIngest.length} files...` });
        const apiResult = await this.httpClient.ingestDocuments(allDocsForIngest, report, token);

        // Server-side un-convertible files → hiển thị log cho user (Design R1/NFR-5)
        if (apiResult.unconvertible.length > 0) {
            channel.appendLine("");
            channel.appendLine(`⚠️ ${apiResult.unconvertible.length} file(s) server không convert được (không index):`);
            for (const u of apiResult.unconvertible) { channel.appendLine(`   - ${u.file} (reason=${u.reason})`); }
            channel.show(true);
        }

        const serverConverted = apiResult.ingested - mdDocs.length - textWithContent.length;
        const skipped = binaryDocs.length - Math.max(serverConverted, 0);
        return this.buildSummary(docs.length, mdDocs.length + textWithContent.length, Math.max(serverConverted, 0), skipped, apiResult.summary, []);
    }

    private async readTextDocs(
        textDocs: Array<{ path: string; type: string; ticket: string; format: string }>,
        root: string, channel: vscode.OutputChannel,
    ): Promise<Array<{ path: string; type: string; ticket: string; format: string; content: string }>> {
        const results: Array<{ path: string; type: string; ticket: string; format: string; content: string }> = [];
        for (const doc of textDocs) {
            try {
                const absPath = path.join(root, doc.path);
                const raw = await vscode.workspace.fs.readFile(vscode.Uri.file(absPath));
                results.push({ ...doc, content: Buffer.from(raw).toString("utf-8") });
                channel.appendLine(`  📄 Text read: ${doc.path}`);
            } catch (err) {
                console.debug(`[IndexingService] readTextDocs failed for ${doc.path} (non-fatal): ${(err as Error).message}`);
                channel.appendLine(`  ⚠️ Cannot read: ${doc.path}`);
            }
        }
        return results;
    }

    private buildSummary(
        total: number, direct: number, converted: number, skipped: number,
        apiSummary: string, errors: Array<{ file: string; error: string }>
    ): string {
        const summary = [
            `✅ Documents: ${total} discovered`,
            `   📄 Direct: ${direct}`,
            `   🔄 Converted: ${converted}`,
            `   ⏭️ Skipped: ${skipped}`,
            `   ${apiSummary}`,
        ];
        if (errors.length > 0) {
            summary.push(`   ⚠️ Errors:`);
            for (const e of errors.slice(0, 5)) { summary.push(`      - ${path.basename(e.file)}: ${e.error}`); }
            if (errors.length > 5) { summary.push(`      ... and ${errors.length - 5} more`); }
        }
        return summary.join("\n");
    }
}
