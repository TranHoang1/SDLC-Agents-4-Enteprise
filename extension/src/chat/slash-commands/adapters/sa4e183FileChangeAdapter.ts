/**
 * SA4E-191 — Adapter for SA4E-183 (File Change Tracking).
 * Thin wrapper for diff query + file revert with timeout/fallback.
 * When SA4E-183 is not yet present, the default backend degrades gracefully.
 */
import type { DiffEntry } from '../types';
import { DependencyUnavailableError, withTimeout } from './timeout';

export interface FileChangeBackend {
  queryDiffs(sessionId: string, exchangeId: string): Promise<DiffEntry[]>;
  revert(entry: DiffEntry): Promise<boolean>;
}

/** Default backend used when SA4E-183 engine is absent. */
export class UnavailableFileChangeBackend implements FileChangeBackend {
  async queryDiffs(): Promise<DiffEntry[]> {
    throw new DependencyUnavailableError('SA4E-183');
  }
  async revert(): Promise<boolean> {
    throw new DependencyUnavailableError('SA4E-183');
  }
}

export class FileChangeAdapter {
  constructor(
    private readonly backend: FileChangeBackend = new UnavailableFileChangeBackend(),
    private readonly timeoutMs = 3000
  ) {}

  async queryDiffs(sessionId: string, exchangeId: string): Promise<DiffEntry[]> {
    try {
      return await withTimeout(this.backend.queryDiffs(sessionId, exchangeId), this.timeoutMs);
    } catch (e) {
      if (e instanceof DependencyUnavailableError) throw e;
      throw new DependencyUnavailableError('SA4E-183', (e as Error).message);
    }
  }

  async revert(entry: DiffEntry): Promise<boolean> {
    try {
      return await withTimeout(this.backend.revert(entry), this.timeoutMs);
    } catch (e) {
      if (e instanceof DependencyUnavailableError) throw e;
      throw new DependencyUnavailableError('SA4E-183', (e as Error).message);
    }
  }
}
