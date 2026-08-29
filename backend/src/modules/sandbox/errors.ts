/**
 * SA4E-6 — Sandbox-specific error hierarchy.
 * Each error carries a stable `code` consumed by the MCP tool handlers (FSD §3.5 / TDD §5.6).
 */

export class SandboxError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'SandboxError';
  }
}

export class DockerUnavailableError extends SandboxError {
  constructor(message = 'Docker is not available. Start Docker Desktop or set sandbox.fallbackToLocal=true') {
    super('DOCKER_UNAVAILABLE', message);
  }
}

export class MaxSessionsError extends SandboxError {
  constructor(message = 'Maximum 5 concurrent sessions. Destroy idle sessions first.') {
    super('MAX_SESSIONS', message);
  }
}

export class SessionNotFoundError extends SandboxError {
  constructor(message: string) {
    super('SESSION_NOT_FOUND', message);
  }
}

export class ExecTimeoutError extends SandboxError {
  constructor(message = 'Command timed out. Process killed.') {
    super('EXEC_TIMEOUT', message);
  }
}

export class OomKilledError extends SandboxError {
  constructor(message = 'Memory limit exceeded. Increase session memory or optimize command.') {
    super('OOM_KILLED', message);
  }
}

export class ImagePullError extends SandboxError {
  constructor(message: string) {
    super('IMAGE_PULL_FAILED', message);
  }
}

export class MountError extends SandboxError {
  constructor(message: string) {
    super('MOUNT_FAILED', message);
  }
}
