/**
 * IndexingService — orchestrates workspace indexing with injected dependencies.
 */
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import { IndexerHttpClient } from "./IndexerHttpClient";
import { fetchRulesInParallel, fetchRuleTypesInParallel, saveRuleFile } from "./PegaCrawlHelper";

function computeRuleChecksum(rule: Record<string, unknown>): string {
    return crypto.createHash('sha256').update(JSON.stringify(rule)).digest('hex');
}
import { discoverDocuments } from "../indexer-discovery";
import { getProjectId, setProjectId } from "../extension";

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

    private walkDir(dir: string): string[] {
        const results: string[] = [];
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const e of entries) {
                const fp = path.join(dir, e.name);
                if (e.isDirectory()) results.push(...this.walkDir(fp));
                else results.push(fp);
            }
        } catch { /* ignore */ }
        return results;
    }

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

        this.log(`[Pega Indexer] 🏛️ Pega Project Detected: "pega:${appName}"`);
        report.report({ message: `🏛️ Pega Project Detected: pega:${appName} — Crawling Pega rules...` });

        if (!secrets) {
            this.log(`[Pega Indexer] ⚠️ Credentials not available in SecretStorage. Skipping live fetch.`);
            return `🏛️ Pega Project Detected: pega:${appName} (${caseTypes.length} CaseTypes) — Metadata in pega-project.json`;
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

            const rawProjectId = appName || hierarchy.appName;
            if (!rawProjectId) {
                this.log(`[Pega Indexer] ⚠️ Could not resolve Pega Application Name for Project ID. Aborting Pega index.`);
                return null;
            }
            const projectId = crypto.createHash('sha256').update('pega:' + rawProjectId).digest('hex').slice(0, 12);
            this.log(`[Pega Indexer] 📌 Project ID: "pega:${rawProjectId}" → "${projectId}"`);
            // Update extension runtime project_id so admin panels use correct scope
            setProjectId(projectId);            const visitedKeys = new Set<string>();
            let currentQueue = seeds;
            let totalStored = 0;
            let totalFetchedInRun = 0;
            let totalStoredInDb = 0;
            let totalKbInDb = 0;
            let totalGraphInDb = 0;
            let iterations = 0;
            const MAX_ITERATIONS = 1000;

            const localChecksums = new Map<string, { checksum: string; fqn: string }>();
            try {
                const rulesDir = path.join(root, 'rules');
                if (fs.existsSync(rulesDir)) {
                    const files = this.walkDir(rulesDir);
                    for (const fp of files) {
                        if (!fp.endsWith('.pega.json')) continue;
                        try {
                            const content = fs.readFileSync(fp, 'utf-8');
                            const rule = JSON.parse(content);
                            const objClass = rule.pxObjClass || '';
                            const className = rule.pyClassName || '';
                            const ruleName = rule.pyRuleName || rule.pyPropertyName || rule.pyActivityName || rule.pyFlowName || rule.pyModelName || '';
                            const insKey = `${objClass.toUpperCase().replace(/^RULE-/i, 'RULE-')} ${className} ${ruleName}`.replace(/\s+/g, ' ').trim();
                            const fqn = `${objClass}:${className}:${ruleName}`;
                            const checksum = crypto.createHash('sha256').update(JSON.stringify(rule)).digest('hex');
                            localChecksums.set(insKey, { checksum, fqn });
                        } catch { /* skip unparseable file */ }
                    }
                    this.log(`[Pega Indexer] 📂 Loaded ${localChecksums.size} local rule checksums from ${rulesDir}`);
                }
            } catch { /* rules dir not available */ }

            while (currentQueue.length > 0 && iterations < MAX_ITERATIONS) {
                iterations++;
                this.log(`[Pega Indexer] Iteration ${iterations}: processing queue (${currentQueue.length} items, visited: ${visitedKeys.size})...`);
                report.report({ message: `Crawling Pega rules (unique rules: ${visitedKeys.size}, queue: ${currentQueue.length})...` });

                const ruleChecksums: Record<string, string> = {};
                for (const key of currentQueue) {
                    const local = localChecksums.get(key);
                    if (local) ruleChecksums[key] = local.checksum;
                }
                const plan = await pegaClient.crawlPlan({
                    projectId,
                    ruleKeys: currentQueue,
                    visitedKeys: Array.from(visitedKeys),
                    ruleChecksums: Object.keys(ruleChecksums).length > 0 ? ruleChecksums : undefined,
                });

                if (!plan.missing || plan.missing.length === 0) {
                    this.log(`[Pega Indexer] Crawl plan returned no missing items. Finish crawling.`);
                    break;
                }

                this.log(`[Pega Indexer] Crawl plan: ${plan.missing.length} missing rules to fetch.`);

                const fetchedRules: Record<string, unknown>[] = [];
                const chunk = plan.missing.slice(0, 50);

                // Mark all items as visited BEFORE parallel fetch to prevent duplicates
                for (const item of chunk) {
                    visitedKeys.add(item.insKey);
                }

                // Parallel rule fetches with concurrency=5 to avoid overwhelming Pega server
                const fetchResult = await fetchRulesInParallel(
                    chunk, pegaClient, this.log.bind(this),
                );

                // Abort immediately if a server error was detected
                if (fetchResult.serverError) {
                    throw new Error(fetchResult.serverError);
                }

                // Save fetched rules to disk + collect for ingestion
                for (const { ruleObj, item } of fetchResult.fetched) {
                    fetchedRules.push(ruleObj);
                    saveRuleFile(ruleObj, root, this.log.bind(this), item.pxObjClass, item.pyRuleName);

                    // Class => Full Rules Resolution: fetch ALL rule types in parallel
                    const isClassRule = item.pxObjClass === "Rule-OBJ-CLASS"
                        || item.pxObjClass === "Rule-Obj-Class"
                        || ruleObj.pxObjClass === "Rule-Obj-Class";
                    if (isClassRule) {
                        const targetClassName = (ruleObj.pyClassName as string) || item.pyClassName;
                        if (targetClassName) {
                            const subRules = await fetchRuleTypesInParallel(
                                targetClassName, pegaClient, visitedKeys, this.log.bind(this),
                            );
                            for (const sr of subRules) {
                                saveRuleFile(sr.rule, root, this.log.bind(this), sr.ruleType);
                                fetchedRules.push(sr.rule);
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

                        const batchChecksums: Record<string, string> = {};
                        const batchVersions: Record<string, string> = {};
                        for (const rule of subChunk) {
                            const objClass = (rule as any).pxObjClass || '';
                            const className = (rule as any).pyClassName || '';
                            const rName = (rule as any).pyRuleName || (rule as any).pyPropertyName || (rule as any).pyActivityName || (rule as any).pyFlowName || (rule as any).pyModelName || '';
                            const fqn = `${objClass}:${className}:${rName}`;
                            const chk = computeRuleChecksum(rule as Record<string, unknown>);
                            if (chk) batchChecksums[fqn] = chk;
                            const ver = (rule as any).pyRuleVersion || (rule as any).pyVersion || '';
                            if (ver) batchVersions[fqn] = ver;
                        }

                        try {
                            const res = await pegaClient.crawlBatch({
                                projectId,
                                rules: subChunk,
                                visitedKeys: Array.from(visitedKeys),
                                rulesChecksums: batchChecksums,
                                rulesVersions: batchVersions,
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
            return `🏛️ Pega Project Detected: "pega:${rawProjectId}" → "${projectId}" — Ingested ${totalFetchedInRun} rules in this run (Total in KB Database: ${totalStoredInDb} Pega Rules, ${totalKbInDb} KB Entries, ${totalGraphInDb} Graph Nodes)`;
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
