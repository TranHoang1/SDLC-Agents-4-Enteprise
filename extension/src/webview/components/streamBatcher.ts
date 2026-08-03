/**
 * SA4E-85 — Stream Token Batcher (Task 2.6).
 * Batches incoming tokens using requestAnimationFrame for smooth 60fps rendering.
 * Prevents layout thrashing by coalescing rapid token updates into single frames.
 */

/** Callback invoked once per animation frame with batched token string */
type FlushCallback = (batchedTokens: string) => void;

/**
 * Creates a RAF-batched token accumulator.
 * Tokens are buffered and flushed at most once per animation frame,
 * ensuring the DOM only updates at 60fps regardless of token arrival rate.
 */
export function createStreamBatcher(onFlush: FlushCallback): StreamBatcher {
  let buffer = '';
  let rafId: number | null = null;

  function flush(): void {
    if (buffer.length > 0) {
      onFlush(buffer);
      buffer = '';
    }
    rafId = null;
  }

  function push(token: string): void {
    buffer += token;
    // Schedule flush on next frame if not already scheduled
    if (rafId === null) {
      rafId = requestAnimationFrame(flush);
    }
  }

  function dispose(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    // Flush remaining buffer synchronously on dispose
    if (buffer.length > 0) {
      onFlush(buffer);
      buffer = '';
    }
  }

  return { push, dispose };
}

/** Public interface for the stream batcher */
export interface StreamBatcher {
  /** Queue a token for batched flush */
  push(token: string): void;
  /** Cancel pending RAF and flush remaining buffer */
  dispose(): void;
}
