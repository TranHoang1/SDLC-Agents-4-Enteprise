/**
 * HTTP client for indexer operations — document ingestion and source file upload.
 * Delegates raw HTTP to http-client-utils for DRY compliance.
 */
import * as vscode from "vscode";
import * as path from "path";
import { httpPostJson as utilHttpPostJson, HttpPostOptions } from "../utils/http-client-utils";

export interface DocEntry {
    path: string;
    type: string;
    ticket: string;
    format?: string;
    content?: string;
}

export interface FileEntry {
    path: string;
    content: string;
}

export interface UnconvertibleEntry {
    file: string;
    reason: string;
}

export interface IngestResult {
    ingested: number;
    errors: number;
    summary: string;
    unconvertible: UnconvertibleEntry[];
}

export interface UploadResult {
    uploaded: number;
    errors: number;
    summary: string;
}

export class IndexerHttpClient {
    private tokenRefresher?: () => Promise<string | undefined>;

    constructor(private readonly backendUrl: string) {}

    /** SA4E-99: Set token refresher callback — called on 401 to get a fresh token. */
    setTokenRefresher(refresher: () => Promise<string | undefined>): void {
        this.tokenRefresher = refresher;
    }
    /** Expose backend base URL for other callers. */
    getBaseUrl(): string { return this.backendUrl; }

    async ingestDocuments(
        docs: DocEntry[],
        report: vscode.Progress<{ message?: string }>,
        token?: string
    ): Promise<IngestResult> {
        // SA4E-30: Use REST API endpoint instead of /mcp/tools/call
        const url = `${this.backendUrl}/api/v1/memory/ingest-file`;
        let ingested = 0;
        let errors = 0;

        const unconvertible: UnconvertibleEntry[] = [];
        for (let i = 0; i < docs.length; i++) {
            const d = docs[i];
            if (i % 10 === 0) { report.report({ message: `Ingesting ${i + 1}/${docs.length} files...` }); }

            let fileContent = d.content;
            if (!fileContent) { fileContent = await this.readFileContent(d.path); }
            if (fileContent) { await this.uploadDocumentFile(d.path, fileContent, token); }

            const payload = { file_path: d.path, type: d.type, format: "markdown", ...(fileContent ? { content: fileContent } : {}) };
            const { ok, body } = await this.httpPostJson(url, payload, token);
            if (!ok) { errors++; continue; }

            const result = parseIngestResponse(body, d.path);
            if (result.entry) { unconvertible.push(result.entry); } else { ingested++; }
        }

        const parts = [`✅ Indexed: ${ingested} files`];
        if (errors > 0) { parts.push(`⚠️ Failed: ${errors}`); }
        if (unconvertible.length > 0) { parts.push(`⏭️ Un-convertible: ${unconvertible.length}`); }
        return { ingested, errors, summary: parts.join(", "), unconvertible };
    }

    async uploadSourceFiles(
        report: vscode.Progress<{ message?: string; increment?: number }>,
        token?: string,
        log?: (msg: string) => void
    ): Promise<UploadResult> {
        // Priority 1: Project source code (exclude all library/vendor directories at ANY depth)
        const libraryExcludes = "**/{node_modules,dist,.git,build,out,.opencode,vendor,packages,bower_components,.kilo,scratch,.code-intel,.analysis,SDLC-Agents-4-Enterprise}/**";
        const projectFiles = await vscode.workspace.findFiles(
            "**/*.{ts,tsx,kt,java,py,go,rs}", libraryExcludes
        );

        if (projectFiles.length === 0) { return { uploaded: 0, errors: 0, summary: "ℹ️ No source files found" }; }

        const url = `${this.backendUrl}/api/index/source`;
        let uploaded = 0;
        let errors = 0;
        const totalFiles = projectFiles.length;
        const batchSize = 20; // SA4E-99: reduced from 50 to avoid timeout on large files
        const totalBatches = Math.ceil(totalFiles / batchSize);
        const incrementPerBatch = 100 / totalBatches;

        // Create output channel for detailed error reporting
        const channel = vscode.window.createOutputChannel("Kiro Indexer");

        // Upload project code first (high priority)
        for (let i = 0; i < totalFiles; i += batchSize) {
            const batchNum = Math.floor(i / batchSize) + 1;
            const pct = Math.round((i / totalFiles) * 100);
            const progressMsg = `Indexing source code: ${pct}% (${i + 1}/${totalFiles} files, batch ${batchNum}/${totalBatches})`;
            report.report({ message: progressMsg, increment: incrementPerBatch });
            if (log) { log(progressMsg); }
            // SA4E-99: Delay between batches to prevent server overload (PG pool exhaustion)
            if (i > 0) { await new Promise(r => setTimeout(r, 500)); }
            const batch = projectFiles.slice(i, i + batchSize);
            const entries = await Promise.all(
                batch.map(async (file) => {
                    const content = await vscode.workspace.fs.readFile(file);
                    // SA4E-99: Strip workspace folder prefix to avoid nested folder creation
                    const folder = vscode.workspace.getWorkspaceFolder(file);
                    let relPath: string;
                    if (folder) {
                        relPath = file.fsPath.substring(folder.uri.fsPath.length + 1).replace(/\\/g, '/');
                    } else {
                        // Fallback: strip first workspace folder path manually
                        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
                        relPath = file.fsPath.startsWith(root)
                            ? file.fsPath.substring(root.length + 1).replace(/\\/g, '/')
                            : file.fsPath.replace(/\\/g, '/');
                    }
                    return { path: relPath, content: Buffer.from(content).toString("utf-8") };
                })
            );
            // SA4E-99: Retry with exponential backoff for 429/5xx/network errors
            const result = await this.sendBatchWithRetry(url, { files: entries }, token, 3);
            if (result.ok) {
                uploaded += batch.length;
            } else if (result.status === 401 && this.tokenRefresher) {
                const freshToken = await this.tokenRefresher();
                if (freshToken) {
                    token = freshToken;
                    const retry = await this.sendBatchWithRetry(url, { files: entries }, token, 2);
                    if (retry.ok) { uploaded += batch.length; }
                    else {
                        errors += batch.length;
                        channel.appendLine(`\n⚠️ Batch ${batchNum}/${totalBatches} FAILED after token refresh`);
                        channel.appendLine(`   Error: ${retry.error}`);
                        channel.show(true);
                    }
                } else {
                    errors += batch.length;
                    channel.appendLine(`\n⚠️ Batch ${batchNum}/${totalBatches} FAILED — no token`);
                    channel.show(true);
                }
            } else {
                errors += batch.length;
                channel.appendLine(`\n⚠️ Batch ${batchNum}/${totalBatches} FAILED (${batch.length} files)`);
                channel.appendLine(`   Error: ${result.error} | Status: ${result.status}`);
                channel.show(true);
            }
        }
        report.report({ message: `Indexing source code: 100% complete`, increment: 0 });

        // SA4E-99: Trigger full re-index ONCE after all files written (not per-batch)
        if (uploaded > 0) {
            report.report({ message: "Running full index on uploaded files..." });
            await this.triggerFullIndex(token);
        }

        const summary = `✅ Indexed ${uploaded} project files` + (errors > 0 ? `, ⚠️ Failed: ${errors} (see Output > Kiro Indexer for details)` : "");
        return { uploaded, errors, summary };
    }

    /** SA4E-99: Trigger a full re-index on backend after all source files are written. */
    private async triggerFullIndex(token?: string): Promise<void> {
        try {
            const url = `${this.backendUrl}/api/index/full`;
            await this.httpPostWithDetail(url, {}, token);
        } catch { /* non-fatal */ }
    }

    /**
     * SA4E-99: Send batch with exponential backoff retry.
     * Retries on: 429 (server busy), 5xx, network errors (ECONNRESET, ECONNREFUSED, timeout).
     * Does NOT retry on 401 (handled by caller with token refresh).
     */
    private async sendBatchWithRetry(
        url: string, payload: unknown, token: string | undefined, maxRetries: number,
    ): Promise<{ ok: boolean; error: string; status: number }> {
        let lastResult = { ok: false, error: 'no attempt', status: 0 };
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            if (attempt > 0) {
                // Exponential backoff: 2s, 4s, 8s (longer to allow server recovery)
                const delay = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
                await new Promise(r => setTimeout(r, delay));
            }
            lastResult = await this.httpPostWithDetail(url, payload, token);
            if (lastResult.ok) return lastResult;
            // Don't retry on 401 (auth issue) or 400 (client error)
            if (lastResult.status === 401 || lastResult.status === 400) return lastResult;
            // Retry on: 429, 5xx, network errors (status 0)
            const shouldRetry = lastResult.status === 429
                || lastResult.status >= 500
                || lastResult.status === 0;
            if (!shouldRetry) return lastResult;
        }
        return lastResult;
    }

    /**
     * Trigger code symbol sync on backend — syncs indexed code symbols into KB knowledge_entries.
     * Calls mem_sync_code via backend MCP endpoint. Auto-triggered after source upload.
     */
    async syncCodeSymbols(): Promise<string | null> {
        const url = `${this.backendUrl}/mcp`;
        const payload = {
            jsonrpc: "2.0",
            id: Date.now(),
            method: "tools/call",
            params: { name: "mem_sync_code", arguments: {} },
        };
        try {
            // MCP Streamable HTTP requires Accept header
            const body = JSON.stringify(payload);
            const parsedUrl = new URL(url);
            const http = await import("http");
            const result = await new Promise<{ ok: boolean; body: string }>((resolve) => {
                const req = http.default.request(
                    { hostname: parsedUrl.hostname, port: parsedUrl.port || undefined, path: parsedUrl.pathname, method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json, text/event-stream", "Content-Length": Buffer.byteLength(body).toString() } },
                    (res) => { let data = ""; res.on("data", (c: any) => { data += c; }); res.on("end", () => resolve({ ok: res.statusCode === 200, body: data })); },
                );
                req.on("error", () => resolve({ ok: false, body: "" }));
                req.setTimeout(60000, () => { req.destroy(); resolve({ ok: false, body: "" }); });
                req.write(body);
                req.end();
            });
            if (!result.ok) { return null; }
            const parsed = JSON.parse(result.body);
            const text = parsed?.result?.content?.[0]?.text;
            return typeof text === "string" ? text : null;
        } catch {
            return null;
        }
    }

    private async uploadDocumentFile(relPath: string, content: string, token?: string): Promise<boolean> {
        return this.httpPost(`${this.backendUrl}/api/index/document`, { path: relPath, content }, token);
    }

    private async readFileContent(relPath: string): Promise<string | undefined> {
        try {
            const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (root) {
                const raw = await vscode.workspace.fs.readFile(vscode.Uri.file(path.join(root, relPath)));
                return Buffer.from(raw).toString("utf-8");
            }
        } catch (err) {
          console.warn(`[IndexerHttpClient] readFileContent failed for '${relPath}': ${(err as Error).message}`);
        }
        return undefined;
    }

    /** POST JSON and return raw body + ok status. Delegates to http-client-utils. */
    private async httpPostJson(url: string, payload: unknown, token: string | undefined): Promise<{ ok: boolean; body: string }> {
        const headers = await this.buildHeaders(token);
        try {
            // Use the utility but we need the raw response body, so wrap with a raw request
            const body = JSON.stringify(payload);
            const parsedUrl = new URL(url);
            const http = await import("http");
            return new Promise((resolve) => {
                const reqBody = body;
                const reqHeaders: Record<string, string> = {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(reqBody).toString(),
                    ...headers,
                };
                const req = http.default.request(
                    { hostname: parsedUrl.hostname, port: parsedUrl.port || undefined, path: parsedUrl.pathname + parsedUrl.search, method: "POST", headers: reqHeaders },
                    (res) => {
                        let data = "";
                        res.on("data", (chunk: any) => { data += chunk; });
                        res.on("end", () => resolve({ ok: res.statusCode === 200 || res.statusCode === 201, body: data }));
                    }
                );
                req.on("error", () => resolve({ ok: false, body: "" }));
                req.setTimeout(30000, () => { req.destroy(); resolve({ ok: false, body: '{"error":"timeout"}' }); });
                req.write(reqBody);
                req.end();
            });
        } catch (err) {
            console.debug(`[IndexerHttpClient] httpPostJson failed (non-fatal): ${(err as Error).message}`);
            return { ok: false, body: "" };
        }
    }

    /** Simple POST returning boolean success. Delegates to http-client-utils. */
    private async httpPost(url: string, payload: unknown, token: string | undefined): Promise<boolean> {
        const headers = await this.buildHeaders(token);
        return utilHttpPostJson<unknown>(url, payload, { headers, timeoutMs: 30000 })
            .then(() => true)
            .catch(() => false);
    }

    /** POST with detailed error info for user-facing error reporting. */
    private async httpPostWithDetail(url: string, payload: unknown, token: string | undefined): Promise<{ ok: boolean; error: string; status: number }> {
        const headers = await this.buildHeaders(token);
        try {
            const result = await utilHttpPostJson<any>(url, payload, { headers, timeoutMs: 60000 });
            return { ok: true, error: "", status: 200 };
        } catch (err: any) {
            const status = err?.statusCode || err?.status || 0;
            const msg = err?.message || String(err);
            if (status === 401) return { ok: false, error: "Unauthorized", status: 401 };
            return { ok: false, error: msg.slice(0, 200), status };
        }
    }

    /** Build standard auth + project-id headers. */
    private async buildHeaders(token: string | undefined): Promise<Record<string, string>> {
        const headers: Record<string, string> = {};
        if (token) { headers["Authorization"] = `Bearer ${token}`; }
        const { getProjectId } = await import("../extension");
        const pid = getProjectId();
        if (pid && pid !== "default") { headers["X-Project-Id"] = pid; }
        // Send workspace root so server registers correct display_name
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            headers["X-Workspace-Root"] = workspaceFolders[0].uri.fsPath;
        }
        return headers;
    }
}

/**
 * Parse structured JSON response from server (Task 8).
 * Server returns: { status: "ingested"|"unconvertible", entries?: number, reason?: string }
 * Falls back to legacy regex marker parsing for backward compatibility.
 */
export function parseIngestResponse(responseBody: string, fallbackFile: string): { ingested: boolean; entry?: UnconvertibleEntry } {
    if (!responseBody) { return { ingested: false }; }
    try {
        const parsed = JSON.parse(responseBody);
        // New structured format from server
        if (parsed?.status === 'unconvertible') {
            return { ingested: false, entry: { file: parsed.file || fallbackFile, reason: parsed.reason || 'unknown' } };
        }
        if (parsed?.status === 'ingested') { return { ingested: true }; }
        // Legacy MCP-style wrapper
        const inner = parsed?.data?.content?.[0]?.text;
        if (typeof inner === 'string') {
            const legacy = parseLegacyMarker(inner, fallbackFile);
            if (legacy) { return { ingested: false, entry: legacy }; }
            return { ingested: true };
        }
    } catch (err) {
      console.debug(`[IndexerHttpClient] response parse failed, trying legacy (non-fatal): ${(err as Error).message}`);
    }

    const legacy = parseLegacyMarker(responseBody, fallbackFile);
    if (legacy) { return { ingested: false, entry: legacy }; }
    return { ingested: true };
}

/** Legacy: detect UNCONVERTIBLE marker in plain text response. */
function parseLegacyMarker(text: string, fallbackFile: string): UnconvertibleEntry | null {
    const m = text.match(/UNCONVERTIBLE:\s*(.+?)\s*\(reason=([^)]+)\)/);
    if (m) { return { file: m[1] || fallbackFile, reason: m[2] }; }
    return null;
}

/**
 * @deprecated Use parseIngestResponse instead. Kept for backward compatibility.
 */
export function parseUnconvertible(responseBody: string, fallbackFile: string): UnconvertibleEntry | null {
    const result = parseIngestResponse(responseBody, fallbackFile);
    return result.entry ?? null;
}

