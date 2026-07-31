/**
 * EnrichmentDedup — SA4E-79
 * In-memory dedup to prevent concurrent enrichment of same entry.
 * Safety timeout auto-releases entries stuck > 60s.
 */

/** Stale timeout: auto-release after 60 seconds to prevent memory leaks. */
const STALE_TIMEOUT_MS = 60_000;

/**
 * Tracks in-flight enrichment entry IDs to prevent duplicate processing.
 * Uses Map<entryId, timestamp> with automatic stale cleanup.
 */
export class EnrichmentDedup {
  private inFlight: Map<number, number> = new Map();

  /**
   * Check if an entry can be processed (not currently in-flight).
   * Also cleans stale entries that exceeded timeout.
   * @param entryId - KB entry ID to check
   * @returns true if entry is available for processing
   */
  canProcess(entryId: number): boolean {
    this.cleanStale();
    return !this.inFlight.has(entryId);
  }

  /**
   * Mark entry as in-flight with current timestamp.
   * @param entryId - KB entry ID being processed
   */
  markInFlight(entryId: number): void {
    this.inFlight.set(entryId, Date.now());
  }

  /**
   * Release entry from in-flight set after processing completes.
   * @param entryId - KB entry ID to release
   */
  release(entryId: number): void {
    this.inFlight.delete(entryId);
  }

  /** Get current in-flight count (for diagnostics). */
  getInflightCount(): number {
    return this.inFlight.size;
  }

  /** Remove entries older than STALE_TIMEOUT_MS. */
  private cleanStale(): void {
    const now = Date.now();
    for (const [id, ts] of this.inFlight) {
      if (now - ts > STALE_TIMEOUT_MS) {
        this.inFlight.delete(id);
      }
    }
  }
}
