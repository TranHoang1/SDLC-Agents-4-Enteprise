/**
 * Workspace indexing — thin wrapper for backward compatibility.
 * Delegates to IndexingService class. Auto-detects Salesforce (SFDX) projects.
 */
import * as vscode from "vscode";
import { IndexingService, IndexOptions } from "./services/IndexingService";
import { IndexerHttpClient } from "./services/IndexerHttpClient";
import { detectSfdxProject, countSalesforceMetadata } from "./sf-indexer";

export { IndexingService } from "./services/IndexingService";
export { IndexerHttpClient } from "./services/IndexerHttpClient";

function getBackendUrl(): string {
    return vscode.workspace.getConfiguration("kiroSdlc").get<string>("backend.url") || "http://127.0.0.1:48721";
}

function getWorkspaceRoot(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) { vscode.window.showErrorMessage("No workspace folder open."); return undefined; }
    return folders[0].uri.fsPath;
}

let indexingOutputChannel: vscode.OutputChannel | undefined;

function getIndexingOutputChannel(): vscode.OutputChannel {
    if (!indexingOutputChannel) {
        indexingOutputChannel = vscode.window.createOutputChannel("SDLC Indexing");
    }
    return indexingOutputChannel;
}

function createService(): IndexingService {
    return new IndexingService(new IndexerHttpClient(getBackendUrl()), getIndexingOutputChannel());
}

export async function promptIndexAfterInject(root: string, token?: string): Promise<void> {
    const action = await vscode.window.showInformationMessage(
        "🔍 Injection complete. Index your workspace now?", "Index Now", "Later"
    );
    if (action === "Index Now") { await runIndexWorkspace(root, token); }
}

export async function handleIndexWorkspace(token?: string, secrets?: vscode.SecretStorage, refreshToken?: () => Promise<string | undefined>): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root) { return; }
    await runIndexWorkspace(root, token, secrets, refreshToken);
}

async function runIndexWorkspace(root: string, token?: string, secrets?: vscode.SecretStorage, refreshToken?: () => Promise<string | undefined>): Promise<void> {
    const picks = await showIndexOptions();
    if (!picks || picks.length === 0) { return; }

    const options: IndexOptions = {
        code: picks.includes("code"),
        documents: picks.includes("documents"),
        sync: picks.includes("sync"),
        schemas: picks.includes("schemas"),
        jira: picks.includes("jira"),
    };

    const channel = getIndexingOutputChannel();
    channel.show(true);

    const service = createService();
    if (refreshToken) { service.refreshTokenFn = refreshToken; }
    const results = await service.indexWorkspace(root, options, token, secrets);
    showIndexResults(results, picks, root, channel);
}

/** Build summary title matching selected operations. */
function describeSummaryTitle(options: string[]): string {
    if (options.length === 1) {
        switch (options[0]) {
            case "schemas": return "Pega Rule Schema Generation Summary";
            case "code": return "Source Code Indexing Summary";
            case "documents": return "Document Indexing Summary";
            case "sync": return "Code Symbol Sync Summary";
            case "jira": return "Jira Project Indexing Summary";
        }
    }
    return "Workspace Indexing Summary";
}

async function showIndexOptions(): Promise<string[] | undefined> {
    const root = getWorkspaceRoot();
    const isPega = root ? require("fs").existsSync(require("path").join(root, "pega-project.json")) : false;
    const items: Array<{ label: string; description: string; id: string; picked: boolean }> = [];
    if (isPega) {
        items.push({ label: "$(symbol-class) Index Pega Rule Schemas", description: "Generate JSON Schemas from Pega RuleForms (run first)", id: "schemas", picked: true });
    }
    items.push({ label: "$(code) Index Source Code", description: "Re-index all code symbols", id: "code", picked: true });
    items.push({ label: "$(book) Index Documents", description: "Index SDLC documents into KB", id: "documents", picked: true });
    items.push({ label: "$(sync) Sync Code → Memory", description: "Sync code entities into memory graph", id: "sync", picked: true });
    items.push({ label: "$(cloud-download) Index Jira Project", description: "Fetch all Jira tickets into KB", id: "jira", picked: false });
    const picks = await vscode.window.showQuickPick(items, { canPickMany: true, placeHolder: "Select what to index" });
    return picks?.map(p => p.id);
}

function showIndexResults(results: string[], options: string[], root: string, channel: vscode.OutputChannel): void {
    const summaryTitle = describeSummaryTitle(options);
    channel.appendLine(`\n=== ${summaryTitle} ===\n`);

    // Auto-detect Salesforce project and show SF-specific summary
    const sfdxRoot = detectSfdxProject(root);
    if (sfdxRoot) {
        const sfCounts = countSalesforceMetadata(sfdxRoot);
        channel.appendLine("🌩️ Salesforce Project Detected\n");
        const parts: string[] = [];
        if (sfCounts.apexClasses > 0) { parts.push(`  Apex classes: ${sfCounts.apexClasses}`); }
        if (sfCounts.triggers > 0) { parts.push(`  Triggers: ${sfCounts.triggers}`); }
        if (sfCounts.flows > 0) { parts.push(`  Flows: ${sfCounts.flows}`); }
        if (sfCounts.objects > 0) { parts.push(`  Objects: ${sfCounts.objects}`); }
        if (sfCounts.lwc > 0) { parts.push(`  LWC components: ${sfCounts.lwc}`); }
        if (parts.length > 0) { channel.appendLine(parts.join("\n")); }
        channel.appendLine(`  Total SF components: ${sfCounts.total}\n`);
    }

    channel.appendLine(results.join("\n"));
    channel.appendLine("\n--- Next Steps ---");
    if (options.includes("code")) { channel.appendLine("• Code: MCP server indexes automatically."); }
    if (options.includes("documents")) { channel.appendLine("• Documents: Indexed via HTTP API."); }
    if (options.includes("sync")) { channel.appendLine("• Sync: Code symbols synced to KB automatically."); }
    if (options.includes("jira")) { channel.appendLine("• Jira: Project tickets ingested into KB for agent context."); }
    vscode.window.showInformationMessage("📋 Indexing complete — see Output panel.", "Open Output")
        .then(action => { if (action === "Open Output") { channel.show(); } });
}
