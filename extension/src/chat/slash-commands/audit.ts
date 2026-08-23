/**
 * SA4E-191 — Audit logging (NFR-08-T).
 * Append-only audit sink. Emits one structured event per command invocation
 * (success + failure). In-memory sink also writes a console line for dev
 * visibility. No PII: only userId, command, timestamp, and target (session id).
 */

export interface AuditEvent {
  event: 'slash.command';
  userId: string;
  command: string;
  ts: string;
  target: string;
  status: 'ok' | 'error';
  durationMs?: number;
}

export interface AuditSink {
  emit(event: AuditEvent): void;
}

export class InMemoryAuditSink implements AuditSink {
  private readonly events: AuditEvent[] = [];

  emit(event: AuditEvent): void {
    this.events.push(event);
    // Dev visibility only; contains no PII.
    // eslint-disable-next-line no-console
    console.debug('[slash-audit]', JSON.stringify(event));
  }

  getAll(): AuditEvent[] {
    return this.events.slice();
  }

  clear(): void {
    this.events.length = 0;
  }
}

export function createAuditSink(): AuditSink {
  return new InMemoryAuditSink();
}
