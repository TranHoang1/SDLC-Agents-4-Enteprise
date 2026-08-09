/**
 * DocumentIndexer — Discovers and ingests SDLC documents into KB.
 * Handles markdown, text (read locally), and binary (server-side conversion).
 */
import * as vscode from "vscode";
import * as path from "path";
import type { IndexerHttpClient } from "./IndexerHttpClient";
import { discoverDocuments } from "../indexer-discovery";

type ProgressReporter = vscode.Progress<{ message?: string }>;

export class DocumentIndexer {
    constructor(private readonly httpClient: IndexerHttpClient) {}

    /** Discover and ingest all documents from workspace. */
    async run(root: string, report: ProgressReporter, token?: string): Promise<string> {
        const docs = discoverDocuments(root);
        if (docs.length === 0) { return "ℹ️ No documents found in documents/ folder"; }

        const mdDocs = docs.filter(d => d.format === "markdown");
        const textDocs = docs.filter(d => d.format === "text");
        const binaryDocs = docs.filter(d => d.format !== "markdown" && d.format !== "text");
        report.report({ message: `Found ${docs.length} files (${binaryDocs.length} binary → server-side convert)` });

        const channel = vscode.window.createOutputChannel("SDLC Indexing");

        const textWithContent = await this.readTextDocs(textDocs, root, channel);
        const binaryForServer = binaryDocs.map(d => ({ ...d, content: undefined }));
        for (const d of binaryForServer) { channel.appendLine(`  📤 Server-convert: ${d.path}`); }

        const allDocsForIngest = [...mdDocs, ...textWithContent, ...binaryForServer];
        report.report({ message: `Indexing ${allDocsForIngest.length} files...` });
        const apiResult = await this.httpClient.ingestDocuments(allDocsForIngest, report, token);

        if (apiResult.unconvertible.length > 0) {
            channel.appendLine("");
            channel.appendLine(`⚠️ ${apiResult.unconvertible.length} file(s) server không convert được:`);
            for (const u of apiResult.unconvertible) { channel.appendLine(`   - ${u.file} (reason=${u.reason})`); }
            channel.show(true);
        }

        const serverConverted = apiResult.ingested - mdDocs.length - textWithContent.length;
        const skipped = binaryDocs.length - Math.max(serverConverted, 0);
        return this.buildSummary(docs.length, mdDocs.length + textWithContent.length, Math.max(serverConverted, 0), skipped, apiResult.summary);
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
                channel.appendLine(`  ⚠️ Cannot read: ${doc.path}`);
            }
        }
        return results;
    }

    private buildSummary(
        total: number, direct: number, converted: number, skipped: number, apiSummary: string,
    ): string {
        const lines = [
            `✅ Documents: ${total} discovered`,
            `   📄 Direct: ${direct}`,
            `   🔄 Converted: ${converted}`,
            `   ⏭️ Skipped: ${skipped}`,
            `   ${apiSummary}`,
        ];
        return lines.join("\n");
    }
}
