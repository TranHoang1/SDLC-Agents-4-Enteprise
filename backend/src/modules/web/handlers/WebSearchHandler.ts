/**
 * Handler for the web_search tool.
 * Searches via SearXNG with DuckDuckGo fallback.
 */

import type { ToolResult } from '../../../types/tool.js';
import type { WebModuleConfig } from '../models/WebModuleConfig.js';
import { RateLimiter } from '../middleware/RateLimiter.js';
import { WebToolError } from '../models/WebError.js';
import { successResult, errorResult } from '../models/WebToolResult.js';

interface SearchResult { title: string; url: string; snippet: string; }

export class WebSearchHandler {
  constructor(private rateLimiter: RateLimiter, private config: WebModuleConfig) {}

  async handle(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const query = args.query as string;
      if (!query?.trim()) throw new WebToolError('INVALID_URL', 'Search query cannot be empty');
      const numResults = Math.min((args.num_results as number) || 5, 10);
      const category = (args.category as string) || 'general';
      const language = (args.language as string) || 'en';
      this.rateLimiter.consumeOrThrow('web_search');

      const results = await this.searchSearXNG(query, numResults, category, language)
        .catch(() => this.searchDuckDuckGo(query, numResults));
      return successResult({ results, total_found: results.length, search_engine: 'searxng' });
    } catch (err) {
      if (err instanceof WebToolError) return errorResult(err);
      return errorResult(new WebToolError('TIMEOUT', (err as Error).message));
    }
  }

  private async searchSearXNG(query: string, num: number, cat: string, lang: string): Promise<SearchResult[]> {
    const url = `${this.config.searxngUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=${cat}&language=${lang}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(this.config.timeoutMs) });
    if (!res.ok) throw new Error(`SearXNG error: ${res.status}`);
    const data = await res.json() as { results: Array<{ title: string; url: string; content: string }> };
    return (data.results || []).slice(0, num).map(r => ({ title: r.title, url: r.url, snippet: r.content }));
  }

  private async searchDuckDuckGo(query: string, num: number): Promise<SearchResult[]> {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(this.config.timeoutMs) });
    if (!res.ok) throw new WebToolError('TIMEOUT', 'Search service temporarily unavailable');
    const data = await res.json() as { RelatedTopics: Array<{ Text: string; FirstURL: string }> };
    return (data.RelatedTopics || []).slice(0, num).map(r => ({ title: r.Text?.slice(0, 60) || '', url: r.FirstURL || '', snippet: r.Text || '' }));
  }
}
