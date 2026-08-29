/**
 * SA4E-6 — Core data models for the Sandbox Execution module.
 * In-memory session metadata, resource limits, and execution/test results.
 */

export type ExecutionMode = 'local' | 'docker';
export type SessionStatus = 'creating' | 'running' | 'stopping' | 'destroyed';

export interface Mount {
  source: string;
  target: string;
  readOnly: boolean;
  excludePatterns?: string[];
}

export interface ResourceLimits {
  memory: string;
  cpu: string;
  disk: string;
  pidsLimit: number;
}

export interface Session {
  sessionId: string;
  mode: ExecutionMode;
  status: SessionStatus;
  containerId?: string;
  baseImage: string;
  mounts: Mount[];
  resources: ResourceLimits;
  networkEnabled: boolean;
  createdAt: Date;
  lastActivity: Date;
  ttl: number;
  env: Record<string, string>;
  workdir?: string;
}

export interface SessionInfo {
  sessionId: string;
  mode: ExecutionMode;
  status: SessionStatus;
  baseImage: string;
  createdAt: string;
  lastActivity: string;
  idleSeconds: number;
  ttl: number;
  networkEnabled: boolean;
  containerId?: string;
}

export interface ExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  truncated: boolean;
  sessionId: string;
  timedOut: boolean;
  binary?: boolean;
}

export interface TestFailure {
  test: string;
  message: string;
  file?: string;
  line?: number;
}

export interface CoverageSummary {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

export interface TestResult extends ExecutionResult {
  status: 'success' | 'failure' | 'error';
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  failures: TestFailure[];
  coverage?: CoverageSummary;
  rawOutput?: string;
}

const SESSION_ID_RE = /^sess_[a-f0-9]{12}$/;

export function generateSessionId(): string {
  // crypto.randomUUID is Node built-in; prefix + 12 hex chars.
  return 'sess_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

export function sessionIdValid(id: string): boolean {
  return SESSION_ID_RE.test(id);
}
