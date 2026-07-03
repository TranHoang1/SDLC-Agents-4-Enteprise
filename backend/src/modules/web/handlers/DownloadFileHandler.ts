/**
 * Handler for download_file tool.
 * Downloads files with size/extension validation.
 */

import type { ToolResult } from '../../../types/tool.js';
import type { WebModuleConfig } from '../models/WebModuleConfig.js';
import { SsrfGuard } from '../middleware/SsrfGuard.js';
import { RateLimiter } from '../middleware/RateLimiter.js';
import { validateUrl } from '../utils/UrlValidator.js';
import { WebToolError } from '../models/WebError.js';
import { successResult, errorResult } from '../models/WebToolResult.js';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

export class DownloadFileHandler {
  constructor(private ssrfGuard: SsrfGuard, private rateLimiter: RateLimiter, private config: WebModuleConfig) {}

  async handle(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const url = args.url as string;
      const destPath = args.dest_path as string | undefined;
      validateUrl(url);
      await this.ssrfGuard.validate(url);
      this.rateLimiter.consumeOrThrow('download_file');
      const filename = this.resolveFilename(url, destPath);
      this.validateExtension(filename);
      const fullPath = this.resolvePath(filename);
      const res = await fetch(url, { headers: { 'User-Agent': this.config.userAgent }, signal: AbortSignal.timeout(this.config.timeoutMs) });
      if (!res.ok) throw new WebToolError('TIMEOUT', `Download failed: ${res.status}`);
      const cl = parseInt(res.headers.get('content-length') || '0', 10);
      if (cl > this.config.maxDownloadMb * 1024 * 1024) throw new WebToolError('CONTENT_TOO_LARGE', `File too large (max ${this.config.maxDownloadMb}MB)`);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (res.body) { const s = Readable.fromWeb(res.body as never); await pipeline(s, fs.createWriteStream(fullPath)); }
      const stats = fs.statSync(fullPath);
      return successResult({ path: path.relative(this.config.workspace, fullPath), filename: path.basename(fullPath), size: stats.size, content_type: res.headers.get('content-type') || '' });
    } catch (err) {
      if (err instanceof WebToolError) return errorResult(err);
      return errorResult(new WebToolError('TIMEOUT', (err as Error).message));
    }
  }

  private resolveFilename(url: string, destPath?: string): string {
    if (destPath) return destPath;
    const urlPath = new URL(url).pathname;
    return path.basename(urlPath) || 'download';
  }

  private validateExtension(filename: string): void {
    const ext = path.extname(filename).toLowerCase();
    if (this.config.blockedExtensions.includes(ext)) {
      throw new WebToolError('BLOCKED_EXTENSION', `Blocked file type: ${ext}`);
    }
  }

  private resolvePath(filename: string): string {
    const resolved = path.resolve(this.config.workspace, filename);
    if (!resolved.startsWith(this.config.workspace)) {
      throw new WebToolError('INVALID_URL', 'Path must be within workspace');
    }
    return resolved;
  }
}
