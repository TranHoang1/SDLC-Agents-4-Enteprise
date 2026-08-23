/**
 * SA4E-191 — Adapter for SA4E-182 (Compaction Service).
 * Thin wrapper that forwards to the compaction engine with timeout/fallback.
 * When SA4E-182 is not yet present, the default backend degrades gracefully
 * by throwing DependencyUnavailableError so handlers show EF-1 messaging.
 */
import { DependencyUnavailableError, withTimeout } from './timeout';

export interface CompactionBackend {
  compact(contextRef: string, historyRef: string): Promise<{ compactedSummaryRef: string }>;
}

/** Default backend used when SA4E-182 engine is absent. */
export class UnavailableCompactionBackend implements CompactionBackend {
  async compact(): Promise<{ compactedSummaryRef: string }> {
    throw new DependencyUnavailableError('SA4E-182');
  }
}

export class CompactionAdapter {
  constructor(
    private readonly backend: CompactionBackend = new UnavailableCompactionBackend(),
    private readonly timeoutMs = 10000
  ) {}

  async compact(
    sessionId: string,
    contextRef: string,
    historyRef: string
  ): Promise<{ compactedSummaryRef: string }> {
    try {
      return await withTimeout(this.backend.compact(contextRef, historyRef), this.timeoutMs);
    } catch (e) {
      if (e instanceof Error && e instanceof DependencyUnavailableError) throw e;
      throw new DependencyUnavailableError('SA4E-182', (e as Error).message);
    }
  }
}
