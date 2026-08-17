/**
 * SA4E-110 - Token bucket rate limiter for Atlassian API calls.
 * P5: Starts at 25% capacity after reconnect to avoid burst storms.
 */
import type { RateLimiterInterface } from '../models/types.js';

/**
 * Token bucket rate limiter. maxTokens=100, refillRate=100/60000ms.
 * After reconnect, starts at 25% capacity to prevent burst storms.
 */
export class RateLimiter implements RateLimiterInterface {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms

  constructor(maxTokens = 100, refillIntervalMs = 60000) {
    this.maxTokens = maxTokens;
    this.refillRate = maxTokens / refillIntervalMs;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Acquire a token, waiting if bucket is empty.
   * @throws Never - waits until a token is available
   */
  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    // Wait for next token to become available
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
    await this.sleep(waitMs);
    this.refill();
    this.tokens -= 1;
  }

  /**
   * P5: Set reconnect mode - starts at 25% capacity.
   * @param isReconnect Whether server just reconnected
   */
  setReconnectMode(isReconnect: boolean): void {
    if (isReconnect) {
      this.tokens = Math.floor(this.maxTokens * 0.25);
      this.lastRefill = Date.now();
    }
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = elapsed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}