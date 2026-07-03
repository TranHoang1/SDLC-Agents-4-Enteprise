/**
 * Token bucket rate limiter for WebModule tools.
 * Each tool gets an independent bucket with configurable RPM.
 */

import { WebToolError } from '../models/WebError.js';

interface TokenBucket {
  tokens: number;
  maxTokens: number;
  refillRate: number;
  lastRefill: number;
}

export interface ConsumeResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

export class RateLimiter {
  private buckets = new Map<string, TokenBucket>();
  private maxTokens: number;
  private refillRate: number;

  constructor(rpm: number) {
    this.maxTokens = rpm;
    this.refillRate = rpm / 60_000;
  }

  consume(toolName: string): ConsumeResult {
    const bucket = this.getBucket(toolName);
    this.refill(bucket);
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true, remaining: Math.floor(bucket.tokens), resetMs: 0 };
    }
    const resetMs = Math.ceil((1 - bucket.tokens) / this.refillRate);
    return { allowed: false, remaining: 0, resetMs };
  }

  consumeOrThrow(toolName: string): void {
    const result = this.consume(toolName);
    if (!result.allowed) {
      throw new WebToolError('RATE_LIMITED',
        `Rate limit exceeded. Reset in ${Math.ceil(result.resetMs / 1000)}s`,
        { remaining: 0, resetMs: result.resetMs });
    }
  }

  private getBucket(toolName: string): TokenBucket {
    if (!this.buckets.has(toolName)) {
      this.buckets.set(toolName, {
        tokens: this.maxTokens,
        maxTokens: this.maxTokens,
        refillRate: this.refillRate,
        lastRefill: Date.now(),
      });
    }
    return this.buckets.get(toolName)!;
  }

  private refill(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = elapsed * bucket.refillRate;
    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }
}
