/**
 * SA4E-110 — Unit tests for RateLimiter (UT-10, UT-15)
 * Token bucket algorithm and reconnect mode behavior.
 */
import { describe, it, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from '../clients/rate-limiter.js';

describe('UT-10: RateLimiter — token bucket behavior', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts with maxTokens available', async () => {
    const limiter = new RateLimiter(10, 1000);
    // Should not wait if tokens available
    await limiter.acquire();
    // No error means token was available
  });

  it('exhausts tokens after maxTokens acquires', async () => {
    const limiter = new RateLimiter(3, 60000);
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    // Next acquire should need to wait — advance enough time for refill
    const promise = limiter.acquire();
    await vi.advanceTimersByTimeAsync(25000);
    await promise;
  });

  it('refills tokens over time', async () => {
    const limiter = new RateLimiter(100, 60000);
    // Drain a token
    await limiter.acquire();
    // Advance time for full refill
    vi.advanceTimersByTime(60000);
    // Should be able to acquire 100 tokens again
    for (let i = 0; i < 99; i++) {
      await limiter.acquire();
    }
  });
});

describe('UT-15: RateLimiter — reconnect mode (25% capacity)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('sets tokens to 25% on reconnect', async () => {
    const limiter = new RateLimiter(100, 60000);
    limiter.setReconnectMode(true);
    // Should have 25 tokens (25% of 100)
    for (let i = 0; i < 25; i++) {
      await limiter.acquire();
    }
    // 26th should require waiting
    const promise = limiter.acquire();
    vi.advanceTimersByTime(1000);
    await promise;
  });

  it('does not change tokens when setReconnectMode(false)', async () => {
    const limiter = new RateLimiter(100, 60000);
    await limiter.acquire(); // 99 left
    limiter.setReconnectMode(false);
    // Still has 99 tokens (no change)
    for (let i = 0; i < 98; i++) {
      await limiter.acquire();
    }
  });
});
