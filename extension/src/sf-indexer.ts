/**
 * Salesforce project indexing — "Kiro SDLC: Index Salesforce Project" command.
 * v2: Delegates to the code-intelligence MCP server's git_index tool which
 * auto-detects SFDX projects. Provides SF-specific progress and result messages.
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

let indexingInProgress = false;

/** Salesforce metadata categories for result reporting. */
interface SfIndexResult {
    apexClasses: number;
    flows: number;
    objects: number;
    lwc: number;
    triggers: number;
    total: number;
}

/**
 * Command handler for "kiroSdlc.indexSalesforceProject".
 * Detects SFDX project, then triggers the workspace indexer (code-intelligence
 * server already handles Apex, Flows, Objects, LWC, etc.).
 */
export async function handleIndexSalesforceProject(): Promise<void> {
    if (indexingInProgress) {
        vscode.window.showInformationMessage("Salesforce indexing already in progress");
        return;
    }

    const root = getWorkspaceRoot();
    if (!root) { return; }

    const sfdxRoot = detectSfdxProject(root);
    if (!sfdxRoot) {
        vscode.window.showErrorMessage(
            "No SFDX project found in workspace (missing sfdx-project.json)"
        );
        return;
    }

    indexingInProgress = true;
    try {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Indexing Salesforce project...",
                cancellable: false,
            },
            async (progress) => {
                progress.report({ message: "Scanning SFDX metadata..." });

                // Count SF metadata files before indexing for result reporting
                const sfCounts = countSalesforceMetadata(sfdxRoot);

                progress.report({ message: `Found ${sfCounts.total} SF components. Indexing...` });

                // Delegate to the existing workspace indexer command which uses
                // the code-intelligence MCP server (git_index auto-detects SFDX)
                await vscode.commands.executeCommand("kiroSdlc.indexWorkspace");

                // Show SF-specific result summary
                const parts: string[] = [];
                if (sfCounts.apexClasses > 0) { parts.push(`${sfCounts.apexClasses} Apex classes`); }
                if (sfCounts.flows > 0) { parts.push(`${sfCounts.flows} Flows`); }
                if (sfCounts.objects > 0) { parts.push(`${sfCounts.objects} Objects`); }
                if (sfCounts.lwc > 0) { parts.push(`${sfCounts.lwc} LWC components`); }
                if (sfCounts.triggers > 0) { parts.push(`${sfCounts.triggers} Triggers`); }

                const summary = parts.length > 0
                    ? parts.join(", ")
                    : `${sfCounts.total} metadata files`;

                vscode.window.showInformationMessage(
                    `✅ Salesforce project indexed: ${summary}`
                );
            }
        );
    } catch (err) {
        vscode.window.showErrorMessage(
            `❌ Salesforce indexing error: ${(err as Error).message}`
        );
    } finally {
        indexingInProgress = false;
    }
}

/**
 * Detect SFDX project root by looking for sfdx-project.json.
 * Checks workspace root first, then immediate subdirectories.
 */
function detectSfdxProject(root: string): string | null {
    if (fs.existsSync(path.join(root, "sfdx-project.json"))) { return root; }
    try {
        const dirs = fs.readdirSync(root, { withFileTypes: true })
            .filter(d => d.isDirectory() && !d.name.startsWith("."));
        for (const dir of dirs) {
            const dirPath = path.join(root, dir.name);
            if (fs.existsSync(path.join(dirPath, "sfdx-project.json"))) { return dirPath; }
        }
    } catch { /* ignore */ }
    return null;
}

/**
 * Count Salesforce metadata files by category for result reporting.
 */
function countSalesforceMetadata(sfdxRoot: string): SfIndexResult {
    const result: SfIndexResult = { apexClasses: 0, flows: 0, objects: 0, lwc: 0, triggers: 0, total: 0 };

    const walkDir = (dir: string, ext: string): number => {
        if (!fs.existsSync(dir)) { return 0; }
        try {
            return countFilesRecursive(dir, ext);
        } catch { return 0; }
    };

    // Standard SFDX source paths
    const forcePath = path.join(sfdxRoot, "force-app", "main", "default");
    const altPath = path.join(sfdxRoot, "src"); // legacy MDAPI format

    const basePath = fs.existsSync(forcePath) ? forcePath : altPath;
    if (!fs.existsSync(basePath)) {
        return result;
    }

    result.apexClasses = walkDir(path.join(basePath, "classes"), ".cls");
    result.triggers = walkDir(path.join(basePath, "triggers"), ".trigger");
    result.flows = walkDir(path.join(basePath, "flows"), ".flow-meta.xml")
        + walkDir(path.join(basePath, "flowDefinitions"), ".flowDefinition-meta.xml");
    result.objects = walkDir(path.join(basePath, "objects"), ".object-meta.xml")
        + countFilesRecursive(path.join(basePath, "objects"), ".field-meta.xml");
    result.lwc = countDirectories(path.join(basePath, "lwc"));

    result.total = result.apexClasses + result.triggers + result.flows + result.objects + result.lwc;
    return result;
}

/** Recursively count files matching an extension. */
function countFilesRecursive(dir: string, ext: string): number {
    if (!fs.existsSync(dir)) { return 0; }
    let count = 0;
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                count += countFilesRecursive(fullPath, ext);
            } else if (entry.name.endsWith(ext)) {
                count++;
            }
        }
    } catch { /* permission errors, etc. */ }
    return count;
}

/** Count immediate subdirectories (for LWC components). */
function countDirectories(dir: string): number {
    if (!fs.existsSync(dir)) { return 0; }
    try {
        return fs.readdirSync(dir, { withFileTypes: true })
            .filter(d => d.isDirectory() && !d.name.startsWith("."))
            .length;
    } catch { return 0; }
}

function getWorkspaceRoot(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        vscode.window.showErrorMessage("No workspace folder open.");
        return undefined;
    }
    return folders[0].uri.fsPath;
}
