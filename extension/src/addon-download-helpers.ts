/**
 * Download helpers for native addon management.
 * Extracted from native-addon-manager.ts for file size compliance.
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as crypto from "crypto";
import { Readable } from "stream";

/**
 * Download a file with redirect support, progress reporting, and cancellation.
 * Uses fetch() which is globally proxy-patched by ProxyAgentFactory.
 */
export async function downloadFile(
  url: string,
  target: string,
  expectedSize: number,
  progress: vscode.Progress<{ message?: string; increment?: number }>,
  token: vscode.CancellationToken,
  _proxyUrl: string | undefined,
  outputChannel: vscode.OutputChannel,
  _maxRedirects = 10
): Promise<void> {
  if (token.isCancellationRequested) {
    throw new Error("Cancelled");
  }

  const abortController = new AbortController();
  const cancelDisposable = token.onCancellationRequested(() => abortController.abort());

  try {
    outputChannel.appendLine(`[NativeAddon] Downloading: ${url}`);
    // fetch() follows redirects automatically and is proxy-patched globally
    const response = await fetch(url, {
      headers: { "User-Agent": "kiro-sdlc-agents/1.0" },
      signal: abortController.signal,
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
    }
    if (!response.body) {
      throw new Error("No response body for download");
    }

    const totalBytes = parseInt(response.headers.get("content-length") || String(expectedSize), 10);
    let downloadedBytes = 0;
    let lastReportedPercent = 0;

    const file = fs.createWriteStream(target);
    // Convert web ReadableStream to Node Readable for piping to file
    const nodeStream = Readable.fromWeb(response.body as any);

    await new Promise<void>((resolve, reject) => {
      nodeStream.on("data", (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        const percent = Math.floor((downloadedBytes / totalBytes) * 100);
        if (percent > lastReportedPercent) {
          const mb = (downloadedBytes / 1024 / 1024).toFixed(1);
          const totalMb = (totalBytes / 1024 / 1024).toFixed(1);
          progress.report({ message: `${mb} MB / ${totalMb} MB (${percent}%)`, increment: percent - lastReportedPercent });
          lastReportedPercent = percent;
        }
      });
      nodeStream.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
      file.on("error", (err) => { file.close(); cleanup(target); reject(err); });
      nodeStream.on("error", (err) => { file.close(); cleanup(target); reject(err); });
    });
  } catch (err) {
    cleanup(target);
    if (abortController.signal.aborted) {
      throw new Error("Cancelled");
    }
    throw err;
  } finally {
    cancelDisposable.dispose();
  }
}

/** Remove partial download on failure. */
function cleanup(target: string): void {
  try { if (fs.existsSync(target)) { fs.unlinkSync(target); } }
  catch (e) { console.debug('[addon-download-helpers] cleanup unlink failed: ' + (e as Error).message); }
}

/**
 * Compute SHA-256 hash of a file.
 */
export function computeSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

/**
 * Get proxy URL from VS Code config or environment.
 */
export function getProxyUrl(): string | undefined {
  try {
    const config = vscode.workspace.getConfiguration("http");
    return config.get<string>("proxy") || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  } catch (err) {
    console.warn('[addon-download-helpers] getProxyUrl failed: ' + (err as Error).message);
    return process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  }
}

