/**
 * Handler for the fetch_url tool.
 * Fetches content from URLs with modes: full, truncated, selective.
 */

import type { ToolResult } from '../../../types/tool.js';
import type { WebModuleConfig } from '../models/WebModuleConfig.js';
import { SsrfGuard } from '../middleware/SsrfGuard.js';
import { RateLimiter } from '../middleware/RateLimiter.js';
import { ContentTruncator } from '../middleware/ContentTruncator.js';
import { HtmlExtractor } from '../utils/HtmlExtractor.js';
import { validateUrl } from '../utils/UrlValidator.js';
import { WebToolError } from '../models/WebError.js';
import { successResult, errorResult } from '../models/WebToolResult.js';

export class FetchUrlHandler {
  private htmlExtractor = new HtmlExtractor();

  constructor(
    private ssrfGuard: SsrfGuard,
    private rateLimiter: RateLimiter,
    private truncator: ContentTruncator,
    private config: WebModuleConfig,
  ) {}

  async handle(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const url = args.url as string;
      const mode = (args.mode as string) || 'full';
      const maxLength = args.max_length as number | undefined;
      const selector = args.selector as string | undefined;

      validateUrl(url);
      await this.ssrfGuard.validate(url);
      this.rateLimiter.consumeOrThrow('fetch_url');

      const response = await this.fetchWithTimeout(url);
      const body = await response.text();
      const content = this.processContent(body, mode, maxLength, selector);
      const result = this.truncator.truncate(content, maxLength);

      return successResult({
        content: result.content,
        metadata: {
          status_code: response.status,
          content_type: response.headers.get('content-type') || '',
          content_length: result.originalLength,
          title: this.extractTitle(body),
          truncated: result.truncated,
          url: response.url,
        },
      });
    } catch (err) {
      if (err instanceof WebToolError) return errorResult(err);
      return errorResult(new WebToolError('TIMEOUT', (err as Error).message));
    }
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      return await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': this.config.userAgent },
        redirect: 'follow',
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new WebToolError('TIMEOUT', `Request timed out after ${this.config.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  private processContent(body: string, mode: string, maxLength?: number, selector?: string): string {
    switch (mode) {
      case 'selective':
        return selector ? this.htmlExtractor.extractBySelector(body, selector) : this.htmlExtractor.toText(body);
      case 'truncated':
        return this.htmlExtractor.toText(body).slice(0, maxLength || 50000);
      default:
        return this.htmlExtractor.toText(body);
    }
  }

  private extractTitle(html: string): string {
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match ? match[1].trim() : '';
  }
}
