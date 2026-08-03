/**
 * SA4E-85 — TokenBuffer.
 * Batches STREAM_TOKEN messages at Extension Host before postMessage.
 * TDD-Review-01: Reduces cross-boundary calls from per-char to per-frame.
 * Flushes on: timer expiry (16-50ms), STREAM_END, or buffer > 256 chars.
 */

/** Callback invoked when buffer flushes accumulated tokens */
export type FlushCallback = (messageId: string, batchedToken: string) => void;

/** Configuration for token buffering behavior */
export interface TokenBufferConfig {
  /** Flush interval in ms (default 32ms ≈ 2 frames at 60fps) */
  flushIntervalMs: number;
  /** Max chars before forced flush (default 256) */
  maxBufferChars: number;
}

const DEFAULT_CONFIG: TokenBufferConfig = {
  flushIntervalMs: 32,
  maxBufferChars: 256,
};

/**
 * Accumulates streaming tokens and flushes in batches.
 * Reduces postMessage overhead by coalescing per-char tokens
 * into per-frame batches (16-50ms window).
 */
export class TokenBuffer {
  private buffer = '';
  private currentMessageId: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly config: TokenBufferConfig;
  private readonly onFlush: FlushCallback;

  constructor(onFlush: FlushCallback, config?: Partial<TokenBufferConfig>) {
    this.onFlush = onFlush;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Add a token to the buffer for the given message */
  push(messageId: string, token: string): void {
    // If message changed, flush previous first
    if (this.currentMessageId && this.currentMessageId !== messageId) {
      this.flush();
    }

    this.currentMessageId = messageId;
    this.buffer += token;

    // Force flush if buffer exceeds max chars
    if (this.buffer.length >= this.config.maxBufferChars) {
      this.flush();
      return;
    }

    // Start timer if not already running
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.config.flushIntervalMs);
    }
  }

  /** Force flush all accumulated tokens immediately */
  flush(): void {
    this.clearTimer();

    if (this.buffer.length > 0 && this.currentMessageId) {
      this.onFlush(this.currentMessageId, this.buffer);
      this.buffer = '';
    }
  }

  /** Reset buffer state (call on STREAM_END) */
  reset(): void {
    this.flush();
    this.currentMessageId = null;
  }

  /** Dispose and clear any pending timer */
  dispose(): void {
    this.clearTimer();
    this.buffer = '';
    this.currentMessageId = null;
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
