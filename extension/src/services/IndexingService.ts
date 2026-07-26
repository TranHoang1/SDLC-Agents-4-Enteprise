/**
 * IndexingService — orchestrates workspace indexing with injected dependencies.
 */
import * as vscode from "vscode";
import * as path from "path";
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
    constructor(private readonly httpClient: IndexerHttpClient) {}

    async indexWorkspace(root: string, options: IndexOptions, token?: string, secrets?: vscode.SecretStorage): Promise<string[]> {
        const results: string[] = [];

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
        let caseTypes: string[] = [];

        try {
            const jsonUri = vscode.Uri.file(path.join(root, "pega-project.json"));
            const raw = await vscode.workspace.fs.readFile(jsonUri);
            const json = JSON.parse(Buffer.from(raw).toString("utf-8"));
            if (json.isPegaProject) {
                appName = json.applicationName || "";
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

        report.report({ message: `🏛️ Pega Project Detected (${appName}) — Crawling Pega rules...` });

        const seeds: string[] = [];
        if (pzInsKey) seeds.push(pzInsKey);
        seeds.push(`RULE-OBJ-CLASS ${appName}`);
        seeds.push(`RULE-OBJ-RULESET ${appName}`);
        for (const ct of caseTypes) {
            seeds.push(`RULE-OBJ-CASETYPE ${ct}`);
            seeds.push(`RULE-OBJ-FLOW ${ct}`);
            seeds.push(`RULE-OBJ-CLASS ${ct}`);
            seeds.push(`RULE-OBJ-FLOWACTION ${ct}`);
            seeds.push(`RULE-HTML-SECTION ${ct}`);
            seeds.push(`RULE-OBJ-PROPERTY ${ct}`);
        }

        if (!secrets) {
            return `🏛️ Pega Project Detected (App: "${appName}", ${caseTypes.length} CaseTypes) — Metadata in pega-project.json`;
        }

        try {
            const PegaHttpClient = (await import("./PegaHttpClient")).PegaHttpClient;
            const pegaClient = new PegaHttpClient(secrets);

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
                report.report({ message: `Crawling Pega rules (unique rules: ${visitedKeys.size}, queue: ${currentQueue.length})...` });

                const plan = await pegaClient.crawlPlan({
                    projectId,
                    ruleKeys: currentQueue,
                    visitedKeys: Array.from(visitedKeys),
                });

                if (!plan.missing || plan.missing.length === 0) break;

                const fetchedRules: Record<string, unknown>[] = [];
                const chunk = plan.missing.slice(0, 50);
                for (const item of chunk) {
                    visitedKeys.add(item.insKey);
                    try {
                        const obj = await pegaClient.getObject(item.pxObjClass, item.pyRuleName);
                        fetchedRules.push(obj);
                    } catch {
                        fetchedRules.push({
                            pxObjClass: item.pxObjClass,
                            pyClassName: item.pyClassName,
                            pyRuleName: item.pyRuleName,
                            pzInsKey: item.insKey,
                            pyApplication: appName,
                        });
                    }
                }

                if (fetchedRules.length === 0) break;

                totalFetchedInRun += fetchedRules.length;

                const batchRes = await pegaClient.crawlBatch({
                    projectId,
                    rules: fetchedRules,
                    visitedKeys: Array.from(visitedKeys),
                });

                if (batchRes.totalRulesInDb) {
                    totalStoredInDb = batchRes.totalRulesInDb;
                } else {
                    totalStoredInDb += batchRes.stored || fetchedRules.length;
                }

                if (batchRes.totalKbEntriesInDb) {
                    totalKbInDb = batchRes.totalKbEntriesInDb;
                }

                if (batchRes.totalGraphNodesInDb) {
                    totalGraphInDb = batchRes.totalGraphNodesInDb;
                }

                const nextKeys = (batchRes.nextBatch || []).map(b => b.insKey).filter(k => !visitedKeys.has(k));
                const remainingPlanKeys = plan.missing.slice(50).map(m => m.insKey).filter(k => !visitedKeys.has(k));
                currentQueue = Array.from(new Set([...remainingPlanKeys, ...nextKeys]));
            }

            return `🏛️ Pega Project Detected (App: "${appName}") — Ingested ${totalFetchedInRun} rules in this run (Total in KB Database: ${totalStoredInDb} Pega Rules, ${totalKbInDb} KB Entries, ${totalGraphInDb} Graph Nodes)`;
        } catch (err: any) {
            return `🏛️ Pega Project Detected (App: "${appName}") — Metadata indexed (${err.message})`;
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
