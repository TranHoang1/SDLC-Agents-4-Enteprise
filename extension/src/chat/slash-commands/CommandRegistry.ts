/**
 * SA4E-191 — CommandRegistry.
 * Central registration + dispatch. Enforces cross-cutting policies:
 *  - BR-1  register exactly once (throws on duplicate id)
 *  - BR-2  shortcut-hint uniqueness (throws on duplicate hint)
 *  - BR-5  owner-only enforcement (defense in depth)
 *  - NFR-07-T token-bucket rate limit (20 req/min per session per command)
 *  - NFR-06-T per-command timeout + circuit breaker
 *  - NFR-08-T audit logging before returning
 */

import type {
  SlashCommandDescriptor,
  CommandContext,
  CommandHandler,
  CommandResult,
} from './types';
import { createAuditSink, type AuditSink } from './audit';
import type { AuditEvent } from './audit';

const DEFAULT_RATE_CAPACITY = 20;
const DEFAULT_RATE_REFILL_PER_MS = DEFAULT_RATE_CAPACITY / 60000; // 20 per minute

/** Token bucket per session+command key (NFR-07-T). */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(private readonly capacity: number, private readonly refillPerMs: number) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  allow(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
    this.lastRefill = now;
  }
}

export class RateLimiter {
  private readonly buckets = new Map<string, TokenBucket>();

  constructor(
    private readonly capacity = DEFAULT_RATE_CAPACITY,
    private readonly refillPerMs = DEFAULT_RATE_REFILL_PER_MS
  ) {}

  allow(sessionId: string, commandId: string): boolean {
    const key = `${sessionId}:${commandId}`;
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = new TokenBucket(this.capacity, this.refillPerMs);
      this.buckets.set(key, bucket);
    }
    return bucket.allow();
  }
}

/** Thrown when the circuit breaker is open and rejects a call fast. */
export class CircuitBreakerOpenError extends Error {
  constructor(message = 'Circuit breaker is open') {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

/** Consecutive-failure circuit breaker (OPEN after threshold, half-open probe). */
export class CircuitBreaker {
  private failures = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private openedAt = 0;

  constructor(private readonly threshold = 3, private readonly halfOpenAfterMs = 30000) {}

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.openedAt >= this.halfOpenAfterMs) {
        this.state = 'HALF_OPEN';
      } else {
        throw new CircuitBreakerOpenError();
      }
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (e) {
      this.onFailure();
      throw e;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures += 1;
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
    }
  }

  getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    return this.state;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout ${ms}ms exceeded`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export interface CommandRegistryOptions {
  rateLimiter?: RateLimiter;
  auditSink?: AuditSink;
}

export class CommandRegistry {
  private readonly handlers = new Map<string, CommandHandler>();
  private readonly descriptors = new Map<string, SlashCommandDescriptor>();
  private readonly shortcutHints = new Set<string>();
  private readonly breakers = new Map<string, CircuitBreaker>();
  private readonly rateLimiter: RateLimiter;
  private readonly auditSink: AuditSink;

  constructor(opts: CommandRegistryOptions = {}) {
    this.rateLimiter = opts.rateLimiter ?? new RateLimiter();
    this.auditSink = opts.auditSink ?? createAuditSink();
  }

  /** BR-1 (register once) + BR-2 (shortcut uniqueness). */
  register(descriptor: SlashCommandDescriptor, handler: CommandHandler): void {
    if (this.descriptors.has(descriptor.id)) {
      throw new Error(`Command already registered: ${descriptor.id}`);
    }
    if (this.shortcutHints.has(descriptor.shortcutHint)) {
      throw new Error(`Shortcut hint already used: ${descriptor.shortcutHint}`);
    }
    this.descriptors.set(descriptor.id, descriptor);
    this.handlers.set(descriptor.id, handler);
    this.shortcutHints.add(descriptor.shortcutHint);
    this.breakers.set(descriptor.id, new CircuitBreaker(3, 30000));
  }

  resolve(
    commandId: string
  ): { descriptor: SlashCommandDescriptor; handler: CommandHandler } | null {
    const descriptor = this.descriptors.get(commandId);
    const handler = this.handlers.get(commandId);
    return descriptor && handler ? { descriptor, handler } : null;
  }

  getAuditSink(): AuditSink {
    return this.auditSink;
  }

  async dispatch(ctx: CommandContext): Promise<CommandResult> {
    const entry = this.resolve(ctx.commandId);
    if (!entry) {
      return this.fail(ctx, 'UNKNOWN_COMMAND', 'Unknown command.', false);
    }

    // BR-5 — owner-only enforcement (defense in depth; UI also disables).
    if (entry.descriptor.requiresOwner && ctx.session.userId !== ctx.session.ownerId) {
      return this.fail(ctx, 'PERMISSION_DENIED', 'Permission denied.', false);
    }

    // NFR-07-T — token-bucket rate limit.
    if (!this.rateLimiter.allow(ctx.session.id, ctx.commandId)) {
      return this.fail(ctx, 'RATE_LIMITED', 'Too many requests, please wait.', true);
    }

    const start = Date.now();
    try {
      const result = await withTimeout(
        this.breakers.get(ctx.commandId)!.exec(() => Promise.resolve(entry.handler.execute(ctx))),
        entry.descriptor.timeoutMs
      );
      this.audit(ctx, 'ok', Date.now() - start);
      return result;
    } catch (err) {
      this.audit(ctx, 'error', Date.now() - start);
      return this.fail(ctx, 'HANDLER_ERROR', (err as Error).message, false);
    }
  }

  private fail(ctx: CommandContext, code: string, msg: string, retryable: boolean): CommandResult {
    return {
      status: 'error',
      commandId: ctx.commandId,
      error: { code, userMessage: msg, retryable },
    };
  }

  private audit(ctx: CommandContext, status: 'ok' | 'error', durationMs: number): void {
    const event: AuditEvent = {
      event: 'slash.command',
      userId: ctx.session.userId,
      command: ctx.commandId,
      ts: new Date().toISOString(),
      target: ctx.session.id,
      status,
      durationMs,
    };
    this.auditSink.emit(event);
  }
}
