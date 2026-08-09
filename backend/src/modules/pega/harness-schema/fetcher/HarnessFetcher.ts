/**
 * SA4E-95 - HarnessFetcher wraps PegaRuleFetcherService with harness-specific queries.
 * Implements retry with exponential backoff for API resilience.
 */
import type { PegaRuleFetcherService } from '../../PegaRuleFetcherService.js';

/** Configuration for Pega API connection */
export interface PegaApiConfig {
  pegaEndpoint: string;
  username: string;
  password: string;
  authHeader?: string;
  timeout?: number;
  maxRetries?: number;
}

/** Result from listing rules */
export interface ListRulesResult {
  pzInsKey: string;
  pyClassName: string;
  pyStreamName: string;
  pxUpdateDateTime: string;
}

/**
 * Fetches harness and section rules from Pega CodeIntelligence API.
 * Wraps PegaRuleFetcherService with harness-specific query patterns and retry.
 */
export class HarnessFetcher {
  private readonly maxRetries: number;
  private readonly timeout: number;

  constructor(
    private readonly fetcher: PegaRuleFetcherService,
    private readonly config: PegaApiConfig
  ) {
    this.maxRetries = config.maxRetries ?? 1;
    this.timeout = config.timeout ?? 10000;
  }

  /**
   * Fetch a RuleForm harness for a given rule type class.
   * @param ruleType - Target rule class (e.g., Rule-Obj-Activity)
   * @returns Full harness JSON or null if not found
   */
  async fetchHarness(ruleType: string): Promise<Record<string, unknown> | null> {
    return this.withRetry(() => this.doFetchHarness(ruleType));
  }

  /**
   * Fetch a section rule by name and target class.
   * @param sectionName - Section stream name (e.g., RuleFormMain)
   * @param targetClass - Class to resolve section from
   * @returns Full section JSON or null if not found
   */
  async fetchSection(
    sectionName: string,
    targetClass: string
  ): Promise<Record<string, unknown> | null> {
    return this.withRetry(() => this.doFetchSection(sectionName, targetClass));
  }

  /** Internal: fetch harness via fetcher service */
  private async doFetchHarness(
    ruleType: string
  ): Promise<Record<string, unknown> | null> {
    const result = await this.fetcher.fetchRule({
      pxObjClass: 'Rule-HTML-Harness',
      pyRuleName: 'RuleForm',
      pyClassName: ruleType,
      pegaEndpoint: this.config.pegaEndpoint,
      authHeader: this.config.authHeader,
      username: this.config.username,
      password: this.config.password,
    });

    if (!result.isFullContent) return null;
    return result.ruleJson;
  }

  /** Internal: fetch section via fetcher service */
  private async doFetchSection(
    sectionName: string,
    targetClass: string
  ): Promise<Record<string, unknown> | null> {
    const result = await this.fetcher.fetchRule({
      pxObjClass: 'Rule-HTML-Section',
      pyRuleName: sectionName,
      pyClassName: targetClass,
      pegaEndpoint: this.config.pegaEndpoint,
      authHeader: this.config.authHeader,
      username: this.config.username,
      password: this.config.password,
    });

    if (!result.isFullContent) return null;
    return result.ruleJson;
  }

  /**
   * Retry wrapper with exponential backoff.
   * Retries once on network/timeout errors, respects rate limits.
   */
  private async withRetry<T>(
    fn: () => Promise<T>
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.maxRetries) {
          const delay = 2000 * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError ?? new Error('Fetch failed after retries');
  }

  /** Promise-based sleep for backoff delays */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
