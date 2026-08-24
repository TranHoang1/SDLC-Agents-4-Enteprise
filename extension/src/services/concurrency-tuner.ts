/**
 * SA4E-92 — Auto-tune concurrency for I/O-bound HTTP tasks.
 * Computes optimal concurrency at runtime based on system resources
 * (CPU cores, free memory) and measured request latency.
 */

import { cpus, freemem, loadavg } from 'node:os';

/** Options for computing optimal concurrency. */
export interface ConcurrencyOpts {
  /** Measured avg response time in ms (from sample requests) */
  measuredLatencyMs: number;
  /** Target max acceptable total duration for the batch (ms) */
  targetDurationMs?: number;
  /** Total items to process in this batch */
  totalItems: number;
  /** Is target remote (true) or localhost (false)? */
  isRemote: boolean;
  /** Max connections to remote server (default: 15) */
  maxServerConnections?: number;
}

/** Estimated memory overhead per concurrent request (MB). */
const MB_PER_REQUEST = 3;

/** Default target duration if not specified (ms). */
const DEFAULT_TARGET_MS = 15_000;

/**
 * Compute optimal concurrency using Little's Law + system resource bounds.
 * Formula: max(floor, littles) capped by min(cpuBound, memBound, serverCap, totalItems)
 */
export function computeOptimalConcurrency(opts: ConcurrencyOpts): number {
  const cores = cpus().length;
  const { measuredLatencyMs, totalItems, isRemote } = opts;
  const targetMs = opts.targetDurationMs ?? DEFAULT_TARGET_MS;
  const maxServer = opts.maxServerConnections ?? 50;

  const cLittles = Math.ceil(totalItems * measuredLatencyMs / targetMs);
  const cFloor = Math.ceil(cores / 2);

  const load = loadavg()[0] || 0;
  const loadFactor = Math.max(0.3, 1 - (load / cores));
  const cCpuBound = Math.max(1, Math.floor(cores * (isRemote ? 6 : 12) * loadFactor));

  const availableMB = freemem() / (1024 * 1024);
  const cMemBound = Math.floor(availableMB / MB_PER_REQUEST);
  const cServerCap = isRemote ? maxServer : totalItems;

  const raw = Math.max(cFloor, cLittles);
  return Math.max(1, Math.min(raw, cCpuBound, cMemBound, cServerCap, totalItems));
}

/**
 * Measure avg latency by sampling a few concurrent requests.
 */
export async function measureLatency(
  sampleFn: () => Promise<unknown>,
  sampleCount = 3,
): Promise<number> {
  const start = Date.now();
  await Promise.all(Array.from({ length: sampleCount }, () => sampleFn()));
  return (Date.now() - start) / sampleCount;
}
