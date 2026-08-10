/**
 * IndexingService — Orchestrates workspace indexing by delegating to specialized indexers.
 * Each indexer (Schema, Document, PegaProject) is in its own file (≤200 LOC).
 */
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { IndexerHttpClient } from "./IndexerHttpClient";

export interface IndexOptions {
    code: boolean;
    documents: boolean;
    sync: boolean;
    schemas: boolean;
}

export type ProgressReporter = vscode.Progress<{ message?: string }>;

export class IndexingService {
    constructor(
        private readonly httpClient: IndexerHttpClient,
        private readonly outputChannel?: vscode.OutputChannel
    ) {}

    private log(msg: string): void {
        if (this.outputChannel) { this.outputChannel.appendLine(msg); }
        else { console.log(msg); }
    }

    /** Build a human-readable label describing which tasks are selected. */
    private describeTasks(options: IndexOptions): string {
        const tasks: string[] = [];
        if (options.schemas) { tasks.push("Pega Rule Schema Generation"); }
        if (options.code) { tasks.push("Source Code Indexing"); }
        if (options.documents) { tasks.push("Document Indexing"); }
        if (options.sync) { tasks.push("Code Symbol Sync"); }
        if (tasks.length === 0) { return "Workspace Indexing"; }
        if (tasks.length === 1) { return tasks[0]; }
        return "Workspace Indexing";
    }

    async indexWorkspace(root: string, options: IndexOptions, token?: string, secrets?: vscode.SecretStorage): Promise<string[]> {
        const results: string[] = [];

        // Auto-enable schema generation if no schemas exist yet
        if (!options.schemas && secrets && !this.hasExistingSchemas(root)) {
            options.schemas = true;
            this.log("[IndexingService] Auto-enabling schema generation (no schemas found in workspace).");
        }

        if (this.outputChannel) {
            this.outputChannel.show(true);
            this.outputChannel.appendLine(`=== ${this.describeTasks(options)} Started ===\n`);
        }

        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: "SDLC Agents", cancellable: false },
            async (report) => {
                if (options.schemas && secrets) {
                    const summary = await this.runSchemaIndexer(root, report, secrets);
                    if (summary) { results.push(summary); }
                }

                // Pega project: rules ARE the code — detect and adjust behavior
                const isPegaProject = this.isPegaProject(root);
                let pegaRulesIndexed = false;

                if (options.sync) {
                    const pegaSummary = await this.runPegaProjectIndexer(root, report, secrets);
                    if (pegaSummary) { results.push(pegaSummary); pegaRulesIndexed = true; }
                }
                if (options.code) {
                    if (isPegaProject) {
                        results.push(pegaRulesIndexed
                            ? "✅ Source code: Pega rules are the source code — already indexed above"
                            : "ℹ️ Pega project detected — rules are indexed via Sync option");
                    } else {
                        report.report({ message: "Scanning and uploading source code files..." });
                        const res = await this.httpClient.uploadSourceFiles(report, token);
                        results.push(res.summary);
                    }
                }
                if (options.documents) {
                    report.report({ message: "Discovering documents..." });
                    const { DocumentIndexer } = await import("./DocumentIndexer");
                    const docIndexer = new DocumentIndexer(this.httpClient);
                    results.push(await docIndexer.run(root, report, token));
                }
                if (options.sync) {
                    if (isPegaProject) {
                        results.push("✅ Code symbol sync: Pega rules projected to KB graph during indexing");
                    } else {
                        report.report({ message: "Syncing code symbols to memory..." });
                        const syncResult = await this.httpClient.syncCodeSymbols();
                        results.push(syncResult
                            ? `✅ Code symbol sync: ${syncResult}`
                            : "⚠️ Code symbol sync failed — run manually via mem_sync_code");
                    }
                }
            }
        );
        return results;
    }

    /** Delegate to PegaSchemaIndexer — batch generate all RuleForm schemas. */
    private async runSchemaIndexer(
        root: string, report: ProgressReporter, secrets: vscode.SecretStorage,
    ): Promise<string | null> {
        try {
            const config = vscode.workspace.getConfiguration("kiroSdlc");
            const username = config.get<string>("pegaUsername", "");
            const password = (await secrets.get("kiroSdlc.pegaPassword")) || "";
            if (!username || !password) {
                return "⚠️ Pega Schema: credentials not configured (set pegaUsername + password in settings)";
            }
            const { PegaHttpClient } = await import("./PegaHttpClient");
            const { PegaSchemaIndexer } = await import("./PegaSchemaIndexer");
            const pegaClient = new PegaHttpClient(secrets, this.outputChannel);
            const indexer = new PegaSchemaIndexer(this.httpClient, this.log.bind(this));
            return await indexer.run(root, report, pegaClient);
        } catch (err: any) {
            this.log(`[SchemaGen] ❌ Fatal error: ${err.message}`);
            return `❌ Pega Schema Generation Failed: ${err.message}`;
        }
    }

    /** Delegate to PegaProjectIndexer — crawl and ingest Pega project rules. */
    private async runPegaProjectIndexer(
        root: string, report: ProgressReporter, secrets?: vscode.SecretStorage,
    ): Promise<string | null> {
        try {
            const { PegaProjectIndexer } = await import("./PegaProjectIndexer");
            const indexer = new PegaProjectIndexer(this.httpClient, this.outputChannel, this.log.bind(this));
            return await indexer.run(root, report, secrets);
        } catch (err: any) {
            this.log(`[Pega Indexer] ❌ Fatal error: ${err.message}`);
            return `❌ Pega Project Indexing Failed: ${err.message}`;
        }
    }

    /** Check KB for existing Pega rule schemas (via backend mem_search). */
    private hasExistingSchemas(root: string): boolean {
        // Synchronous check: look for schema files on disk as quick proxy.
        // KB is the authoritative source, but sync check via HTTP is not possible here.
        // Schema gen will also ingest into KB, so next run will find them.
        const schemaDir = path.join(root, "schemas", "auto");
        try {
            const files = fs.readdirSync(schemaDir);
            return files.some((f: string) => f.endsWith(".json"));
        } catch { return false; }
    }

    /** Detect if workspace is a Pega project (has pega-project.json). */
    private isPegaProject(root: string): boolean {
        try { return fs.existsSync(path.join(root, "pega-project.json")); }
        catch { return false; }
    }
}