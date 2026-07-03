/**
 * Handler for api_call tool. Makes HTTP API requests.
 */

import type { ToolResult } from '../../../types/tool.js';
import type { WebModuleConfig } from '../models/WebModuleConfig.js';
import { SsrfGuard } from '../middleware/SsrfGuard.js';
import { RateLimiter } from '../middleware/RateLimiter.js';
import { ContentTruncator } from '../middleware/ContentTruncator.js';
import { validateUrl } from '../utils/UrlValidator.js';
import { WebToolError } from '../models/WebError.js';
import { successResult, errorResult } from '../models/WebToolResult.js';

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);

export class ApiCallHandler {
  constructor(private ssrfGuard: SsrfGuard, private rateLimiter: RateLimiter, private truncator: ContentTruncator, private config: WebModuleConfig) {}

  async handle(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const url = args.url as string;
      const method = ((args.method as string) || 'GET').toUpperCase();
      const headers = (args.headers as Record<string, string>) || {};
      const body = args.body;
      const timeout = Math.min((args.timeout as number) || this.config.timeoutMs, 60000);
      if (!ALLOWED_METHODS.has(method)) throw new WebToolError('INVALID_URL', 'Method must be GET/POST/PUT/DELETE/PATCH');
      validateUrl(url);
      await this.ssrfGuard.validate(url);
      this.rateLimiter.consumeOrThrow('api_call');
      const start = Date.now();
      const opts: RequestInit = { method, headers: { 'User-Agent': this.config.userAgent, ...headers }, signal: AbortSignal.timeout(timeout) };
      if (body && method !== 'GET') {
        opts.body = typeof body === 'string' ? body : JSON.stringify(body);
        if (!headers['Content-Type'] && typeof body === 'object') (opts.headers as Record<string, string>)['Content-Type'] = 'application/json';
      }
      const res = await fetch(url, opts);
      const resBody = await res.text();
      const truncated = this.truncator.truncate(resBody);
      const resHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => { resHeaders[k] = v; });
      return successResult({ status: res.status, headers: resHeaders, body: truncated.content, elapsed_ms: Date.now() - start });
    } catch (err) {
      if (err instanceof WebToolError) return errorResult(err);
      if ((err as Error).name === 'AbortError') return errorResult(new WebToolError('TIMEOUT', 'Request timed out'));
      return errorResult(new WebToolError('TIMEOUT', (err as Error).message));
    }
  }
}
