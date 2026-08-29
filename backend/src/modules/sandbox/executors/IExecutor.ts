/**
 * SA4E-6 — Executor strategy interface (Strategy Pattern, TDD §5.4).
 * Local and Docker executors implement this contract so ExecutionManager can
 * swap execution backends without change (K8s can be added later per SD-1).
 */

import type { Session, ExecutionResult, ExecutionMode, Mount, ResourceLimits } from '../models.js';

export interface SessionCreateConfig {
  baseImage: string;
  mode: ExecutionMode;
  mounts: Mount[];
  resources: ResourceLimits;
  networkEnabled: boolean;
  env: Record<string, string>;
  ttl: number;
  workdir?: string;
}

export interface ExecOptions {
  workdir?: string;
  timeout: number;
  env?: Record<string, string>;
}

export interface IExecutor {
  readonly mode: ExecutionMode;
  createSession(config: SessionCreateConfig): Promise<Session>;
  destroySession(session: Session): Promise<void>;
  execute(session: Session, command: string, options: ExecOptions): Promise<ExecutionResult>;
  isAvailable(): Promise<boolean>;
}
