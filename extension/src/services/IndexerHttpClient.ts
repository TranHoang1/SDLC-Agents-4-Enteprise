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
    constructor(private readonly backendUrl: string) {}

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
        report: vscode.Progress<{ message?: string }>,
        token?: string,
        /** Optional: token provider for refresh-on-401. Returns fresh token. */
        refreshToken?: () => Promise<string | undefined>
    ): Promise<UploadResult> {
        // SA4E-108: Detect project type → use type-aware file patterns
        const { ProjectTypeDetector } = await import('./ProjectTypeDetector');
        const detector = new ProjectTypeDetector(this.backendUrl);
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
        const detection = await detector.detect(workspaceRoot);

        // Use detected type patterns (or fallback to hardcoded defaults)
        const includeGlob = detector.getFileGlob(detection);
        const excludeGlob = detector.getExcludeGlob(detection);
        const allProjectFiles = await vscode.workspace.findFiles(includeGlob, excludeGlob);

        // SA4E-104: Post-filter — exclude any file under a dot-folder (e.g. .kilo/, .vscode/)
        const projectFiles = allProjectFiles.filter(f => {
            const rel = vscode.workspace.asRelativePath(f, false);
            return !rel.split(/[\\/]/).some(seg => seg.startsWith('.') && seg.length > 1);
        });

        if (projectFiles.length === 0) { return { uploaded: 0, errors: 0, summary: "ℹ️ No source files found" }; }

        const url = `${this.backendUrl}/api/index/source`;
        let uploaded = 0;
        let errors = 0;
        let currentToken = token;

        // Create output channel for detailed error reporting
        const channel = vscode.window.createOutputChannel("Kiro Indexer");

        // Upload project code first (high priority)
        for (let i = 0; i < projectFiles.length; i += 50) {
            const batchNum = Math.floor(i / 50) + 1;
            const totalBatches = Math.ceil(projectFiles.length / 50);
            report.report({ message: `Indexing project code ${i + 1}/${projectFiles.length} (batch ${batchNum}/${totalBatches})...` });
            const batch = projectFiles.slice(i, i + 50);
            const entries = await Promise.all(
                batch.map(async (file) => {
                    const content = await vscode.workspace.fs.readFile(file);
                    return { path: vscode.workspace.asRelativePath(file), content: Buffer.from(content).toString("utf-8") };
                })
            );

            // Refresh token before each batch to prevent mid-indexing expiry
            if (refreshToken) {
                const freshToken = await refreshToken();
                if (freshToken) { currentToken = freshToken; }
            }

            let result = await this.httpPostWithDetail(url, { files: entries }, currentToken);

            // Retry once on 401: refresh token then retry the same batch
            if (result.status === 401 && refreshToken) {
                const freshToken = await refreshToken();
                if (freshToken) {
                    currentToken = freshToken;
                    result = await this.httpPostWithDetail(url, { files: entries }, currentToken);
                }
            }

            if (result.ok) {
                uploaded += batch.length;
            } else {
                errors += batch.length;
                const batchFiles = batch.map(f => vscode.workspace.asRelativePath(f)).join(", ");
                channel.appendLine(`\n⚠️ Batch ${batchNum}/${totalBatches} FAILED (${batch.length} files)`);
                channel.appendLine(`   Error: ${result.error}`);
                channel.appendLine(`   HTTP status: ${result.status}`);
                channel.appendLine(`   Files in batch: ${batchFiles.length > 200 ? batchFiles.slice(0, 200) + "..." : batchFiles}`);
                channel.show(true);
            }
        }

        const summary = `✅ Indexed ${uploaded} project files` + (errors > 0 ? `, ⚠️ Failed: ${errors} (see Output > Kiro Indexer for details)` : "");
        return { uploaded, errors, summary };
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
            const headers = await this.buildHeaders(undefined);
            const body = JSON.stringify(payload);
            const parsedUrl = new URL(url);
            const http = await import("http");
            const result = await new Promise<{ ok: boolean; body: string }>((resolve) => {
                const req = http.default.request(
                    { hostname: parsedUrl.hostname, port: parsedUrl.port || undefined, path: parsedUrl.pathname, method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json, text/event-stream", "Content-Length": Buffer.byteLength(body).toString(), ...headers } },
                    (res) => { let data = ""; res.on("data", (c: any) => { data += c; }); res.on("end", () => resolve({ ok: res.statusCode === 200, body: data })); },
                );
                req.on("error", () => resolve({ ok: false, body: "" }));
                req.setTimeout(60000, () => { req.destroy(); resolve({ ok: false, body: "" }); });
                req.write(body);
                req.end();
            });
            if (!result.ok) { return null; }
            // MCP Streamable HTTP returns SSE format: "event: message\ndata: {...}\n"
            let jsonText = result.body;
            const dataMatch = result.body.match(/^data:\s*(.+)$/m);
            if (dataMatch) { jsonText = dataMatch[1]; }
            const parsed = JSON.parse(jsonText);
            const text = parsed?.result?.content?.[0]?.text;
            return typeof text === "string" ? text : null;
        } catch {
            return null;
        }
    }

    /**
     * SA4E-157: GET enrichment status from backend.
     * Lightweight polling — 10s timeout, no retry (next poll handles failures).
     * @param token JWT auth token
     * @returns ok flag + raw body string
     */
    async getEnrichmentStatus(token?: string): Promise<{ ok: boolean; body: string }> {
        const url = this.backendUrl + "/api/v1/enrichment/status";
        return this.httpGetJson(url, token);
    }

    /**
     * SA4E-158: Trigger Phase 2 — sync indexed Pega rules to KB + graph + enrichment.
     * Calls POST /api/v1/pega/sync-to-kb with projectId.
     * @param projectId Pega project identifier
     * @param token JWT auth token
     * @returns Sync result with counts (synced, errors)
     */
    async syncPegaRulesToKb(projectId: string, token?: string): Promise<{ ok: boolean; synced: number; errors: number; message: string }> {
        const url = `${this.backendUrl}/api/v1/pega/sync-to-kb`;
        const { ok, body } = await this.httpPostJson(url, { projectId }, token);
        if (!ok) {
            return { ok: false, synced: 0, errors: 0, message: `Sync failed: ${body || 'unknown error'}` };
        }
        try {
            const parsed = JSON.parse(body);
            const data = parsed?.data;
            return {
                ok: true,
                synced: data?.synced ?? 0,
                errors: data?.errors ?? 0,
                message: `✅ Synced ${data?.synced ?? 0} rules to KB (${data?.errors ?? 0} errors)`,
            };
        } catch {
            return { ok: true, synced: 0, errors: 0, message: "Sync completed (could not parse response)" };
        }
    }

    /**
     * SA4E-157: Generic HTTP GET with JSON response.
     * Reusable for future GET endpoints. 10s timeout for lightweight status queries.
     */
    private async httpGetJson(url: string, token: string | undefined): Promise<{ ok: boolean; body: string }> {
        const headers = await this.buildHeaders(token);
        const parsedUrl = new URL(url);
        const http = await import("http");
        return new Promise((resolve) => {
            const req = http.default.request(
                {
                    hostname: parsedUrl.hostname,
                    port: parsedUrl.port || undefined,
                    path: parsedUrl.pathname + parsedUrl.search,
                    method: "GET",
                    headers: { "Accept": "application/json", ...headers },
                },
                (res) => {
                    let data = "";
                    res.on("data", (chunk: any) => { data += chunk; });
                    res.on("end", () => resolve({ ok: res.statusCode === 200, body: data }));
                }
            );
            req.on("error", () => resolve({ ok: false, body: "" }));
            // 10s timeout — enrichment status is a lightweight aggregate query
            req.setTimeout(10000, () => { req.destroy(); resolve({ ok: false, body: '{"error":"timeout"}' }); });
            req.end();
        });
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
        const body = JSON.stringify(payload);
        const parsedUrl = new URL(url);
        const http = await import("http");
        return new Promise((resolve) => {
            const reqHeaders: Record<string, string> = {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body).toString(),
                ...headers,
            };
            const req = http.default.request(
                { hostname: parsedUrl.hostname, port: parsedUrl.port || undefined, path: parsedUrl.pathname + parsedUrl.search, method: "POST", headers: reqHeaders },
                (res) => {
                    let data = "";
                    res.on("data", (chunk: any) => { data += chunk; });
                    res.on("end", () => {
                        const status = res.statusCode || 0;
                        const ok = status === 200 || status === 201;
                        let error = ok ? "" : `HTTP ${status}`;
                        if (!ok && data) {
                            try { error = JSON.parse(data).error || JSON.parse(data).message || error; } catch { error = data.slice(0, 200); }
                        }
                        resolve({ ok, error, status });
                    });
                }
            );
            req.on("error", (err: Error) => resolve({ ok: false, error: `Network error: ${err.message}`, status: 0 }));
            req.setTimeout(30000, () => { req.destroy(); resolve({ ok: false, error: "Request timeout (30s) — batch may be too large", status: 0 }); });
            req.write(body);
            req.end();
        });
    }

    /** Build standard auth + project-id headers. */
    private async buildHeaders(token: string | undefined): Promise<Record<string, string>> {
        const headers: Record<string, string> = {};
        if (token) { headers["Authorization"] = `Bearer ${token}`; }
        const { getProjectId } = await import("../extension");
        const pid = getProjectId();
        // SA4E-103: Always send X-Project-Id (even "default") so backend can scope entries correctly
        if (pid) { headers["X-Project-Id"] = pid; }
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

