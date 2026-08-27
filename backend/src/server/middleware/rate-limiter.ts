/**
 * Simple in-memory rate limiter middleware for admin API.
 * Sliding window per IP. Lightweight — no external dependencies.
 *
 * Two-tier limit model:
 *  - Server hard cap: authoritative, owned by the server. Configured in the web
 *    admin (section `rateLimit.maxRpm`, hot-reloaded via EventBus) with the
 *    RATE_LIMIT_MAX_RPM env as the startup default.
 *  - Client request:  X-Rate-Limit-RPM header sent by the extension.
 * The effective limit is min(clientRequested, serverHardCap). A client can dial
 * its own limit anywhere UP TO the server cap, but can NEVER exceed it — the
 * server always retains the final say so a client cannot grant itself unlimited
 * access. Missing/invalid header → the server hard cap is used.
 */

import type { Context, Next } from 'hono';
import { bus, Events } from '../../shared/EventBus.js';

interface RateLimitEntry {
  timestamps: number[];
}

const store: Map<string, RateLimitEntry> = new Map();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 60000;
  for (const [ip, entry] of store) {
    entry.timestamps = entry.timestamps.filter(t => t > cutoff);
    if (entry.timestamps.length === 0) store.delete(ip);
  }
}, 300000).unref();

const WINDOW_MS = 60000; // 1 minute

/**
 * Resolve the server hard cap (authoritative upper bound, per IP).
 * Priority: RATE_LIMIT_MAX_RPM env (if a positive integer) → production default
 * (6000 rpm ≈ 100 rps) → non-production default (10000).
 */
function resolveServerHardCap(): number {
  const raw = process.env.RATE_LIMIT_MAX_RPM;
  if (raw !== undefined) {
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return process.env.NODE_ENV === 'production' ? 6000 : 10000;
}

/**
 * Server-owned hard cap — a client request can never exceed this. Mutable so the
 * web admin can hot-reload it (via RATE_LIMIT_CONFIG_CHANGED) without a restart.
 */
let serverHardCap = resolveServerHardCap();

/** Current server hard cap (rpm). Exposed for admin config reporting/tests. */
export function getServerHardCap(): number {
  return serverHardCap;
}

/**
 * Update the server hard cap at runtime. Ignores non-positive/non-integer values.
 * @param rpm New requests-per-minute cap.
 */
export function setServerHardCap(rpm: number): void {
  if (!Number.isInteger(rpm) || rpm <= 0) return;
  serverHardCap = rpm;
}

/**
 * Load the persisted rate-limit cap from the admin config store at startup so an
 * admin-saved value survives a restart. Non-blocking; falls back to the env
 * default when the DB/table is unavailable. Mirrors the TaskWorker config loader.
 */
export async function loadPersistedRateLimitCap(): Promise<void> {
  try {
    const { getDbAdapter } = await import('../../admin/db/core.js');
    const adapter = getDbAdapter();
    const row = await adapter.getAsync<{ new_value: string }>(
      "SELECT new_value FROM config_changes WHERE section = 'rateLimit' AND key = 'maxRpm' ORDER BY changed_at DESC LIMIT 1",
    );
    if (row?.new_value) setServerHardCap(parseInt(row.new_value, 10));
  } catch { /* config_changes table may not exist yet — keep env default */ }
}

// Hot-reload the cap when the admin saves a rateLimit config change.
bus.on<{ section: string; key: string; value: unknown }>(
  Events.RATE_LIMIT_CONFIG_CHANGED,
  ({ key, value }) => {
    if (key !== 'maxRpm') return;
    const n = typeof value === 'string' ? Number(value) : value;
    if (typeof n === 'number') setServerHardCap(n);
  },
);

/**
 * Effective per-request limit = min(clientRequested, serverHardCap).
 * @param headerValue Raw X-Rate-Limit-RPM header (client's desired limit).
 * @returns The clamped limit; falls back to the server hard cap when the header
 *   is absent or not a positive integer.
 */
function resolveEffectiveLimit(headerValue: string | undefined): number {
  if (headerValue === undefined) return serverHardCap;
  const requested = Number(headerValue);
  if (!Number.isInteger(requested) || requested <= 0) return serverHardCap;
  return Math.min(requested, serverHardCap);
}

/**
 * Rate limiting middleware — effectiveLimit/minute per IP.
 * effectiveLimit = min(X-Rate-Limit-RPM header, serverHardCap).
 * Applied to /api/admin/* and knowledge (/threads*, /agents) endpoints.
 */
export async function rateLimiter(c: Context, next: Next): Promise<Response | void> {
    // Only trust proxy headers when behind a reverse proxy (configurable)
  const trustProxy = process.env.TRUST_PROXY === 'true';
  const ip = trustProxy
    ? (c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || '127.0.0.1')
    : '127.0.0.1'; // When not behind proxy, all connections are local

  // Client can dial its own limit up to (never above) the server hard cap.
  const limit = resolveEffectiveLimit(c.req.header('x-rate-limit-rpm'));
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  let entry = store.get(ip);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(ip, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter(t => t > cutoff);

  if (entry.timestamps.length >= limit) {
    const retryAfter = Math.ceil((entry.timestamps[0] + WINDOW_MS - now) / 1000);
    return c.json(
      { error: 'Too many requests', retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  entry.timestamps.push(now);

  // Set rate limit headers
  c.header('X-RateLimit-Limit', String(limit));
  c.header('X-RateLimit-Remaining', String(limit - entry.timestamps.length));
  c.header('X-RateLimit-Reset', String(Math.ceil((cutoff + WINDOW_MS) / 1000)));

  await next();
}
