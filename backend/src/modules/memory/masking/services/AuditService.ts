import { MaskingAuditEntry } from '../models/MaskingTypes.js';

/**
 * Non-blocking audit logging for masking events.
 * Fire-and-forget writes to avoid adding latency to read path.
 */
export class AuditService {
  private buffer: MaskingAuditEntry[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private writeCallback: ((entries: MaskingAuditEntry[]) => Promise<void>) | null = null;

  constructor(writeCallback?: (entries: MaskingAuditEntry[]) => Promise<void>) {
    this.writeCallback = writeCallback ?? null;
    this.flushInterval = setInterval(() => this.flush(), 5000);
  }

  logEvent(event: MaskingAuditEntry): void {
    event.timestamp = event.timestamp ?? new Date().toISOString();
    this.buffer.push(event);
    if (this.buffer.length >= 50) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0 || !this.writeCallback) return;
    const batch = this.buffer.splice(0, this.buffer.length);
    try {
      await this.writeCallback(batch);
    } catch {
      this.buffer.unshift(...batch);
    }
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    void this.flush();
  }
}
