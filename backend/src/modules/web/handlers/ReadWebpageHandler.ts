/**
 * Handler for read_webpage tool. Renders JS pages via Playwright.
 */

import type { ToolResult } from '../../../types/tool.js';
import type { WebModuleConfig } from '../models/WebModuleConfig.js';
import { SsrfGuard } from '../middleware/SsrfGuard.js';
import { RateLimiter } from '../middleware/RateLimiter.js';
import { ContentTruncator } from '../middleware/ContentTruncator.js';
import { validateUrl } from '../utils/UrlValidator.js';
import { WebToolError } from '../models/WebError.js';
import { successResult, errorResult } from '../models/WebToolResult.js';
import type { Browser } from 'playwright';

export class ReadWebpageHandler {
  private browser: Browser | null = null;
  private activeContexts = 0;

  constructor(private ssrfGuard: SsrfGuard, private rateLimiter: RateLimiter, private truncator: ContentTruncator, private config: WebModuleConfig) {}

  async handle(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const url = args.url as string;
      const waitFor = (args.wait_for as string) || 'networkidle';
      const selector = args.selector as string | undefined;
      const timeout = (args.timeout as number) || this.config.timeoutMs;
      const blockRes = (args.block_resources as string[]) || ['image', 'font', 'media'];
      validateUrl(url);
      await this.ssrfGuard.validate(url);
      this.rateLimiter.consumeOrThrow('read_webpage');
      if (this.activeContexts >= this.config.maxBrowserContexts) throw new WebToolError('RATE_LIMITED', 'Max browser contexts reached');

      const browser = await this.getBrowser();
      const ctx = await browser.newContext({ userAgent: this.config.userAgent });
      this.activeContexts++;
      try {
        const page = await ctx.newPage();
        await page.route('**/*', r => blockRes.includes(r.request().resourceType()) ? r.abort() : r.continue());
        const wt = waitFor === 'networkidle' ? 'networkidle' : waitFor === 'load' ? 'load' : 'domcontentloaded';
        await page.goto(url, { timeout, waitUntil: wt as never });
        if (waitFor === 'selector' && selector) await page.waitForSelector(selector, { timeout });
        const content = selector ? (await page.locator(selector).textContent()) || '' : await page.innerText('body');
        const title = await page.title();
        const truncated = this.truncator.truncate(content);
        return successResult({ content: truncated.content, title, url: page.url(), metadata: { partial: truncated.truncated } });
      } finally { await ctx.close(); this.activeContexts--; }
    } catch (err) {
      if (err instanceof WebToolError) return errorResult(err);
      return errorResult(new WebToolError('BROWSER_FAILED', (err as Error).message));
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) { const { chromium } = await import('playwright'); this.browser = await chromium.launch({ headless: true }); }
    return this.browser;
  }

  async shutdown(): Promise<void> { if (this.browser) { await this.browser.close(); this.browser = null; } }
}
