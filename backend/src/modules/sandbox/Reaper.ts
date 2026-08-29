/**
 * SA4E-6 — Reaper: background timer that destroys expired sessions (UC-10, FSD §3.6.2).
 * Observer over the SessionStore via the ExecutionManager.destroySession path.
 */

import type { Logger } from 'pino';
import type { ExecutionManager } from './ExecutionManager.js';

export class Reaper {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly logger: Logger,
    private readonly manager: ExecutionManager,
    private readonly intervalMs: number,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.manager.reapExpired().catch((err) => {
        this.logger.warn({ err: (err as Error).message }, 'Reaper cycle failed');
      });
    }, this.intervalMs);
    this.logger.debug({ intervalMs: this.intervalMs }, 'Reaper started');
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.debug('Reaper stopped');
    }
  }

  get running(): boolean {
    return this.timer !== null;
  }
}
