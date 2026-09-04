/**
 * SA4E-6 — ExecutionManager: session lifecycle + command routing (Facade over executors).
 * Resolves the executor strategy per session, enforces max-sessions / TTL / fallback,
 * and owns the SessionStore + Reaper (TDD §5.2).
 */

import type { Logger } from 'pino';
import type { SandboxConfig } from '../../config/SandboxConfig.js';
import type { SandboxHardening } from './executors/hardening.js';
import type { IExecutor, SessionCreateConfig, ExecOptions } from './executors/IExecutor.js';
import { LocalExecutor } from './executors/LocalExecutor.js';
import { DockerExecutor } from './executors/DockerExecutor.js';
import { SessionStore } from './SessionStore.js';
import { Reaper } from './Reaper.js';
import type { Session, ExecutionResult, SessionInfo, ExecutionMode } from './models.js';
import { MaxSessionsError, DockerUnavailableError, SessionNotFoundError } from './errors.js';

export class ExecutionManager {
  private local: LocalExecutor;
  private docker: DockerExecutor;
  private store = new SessionStore();
  private reaper: Reaper;
  private dockerAvailable = false;

  constructor(
    private readonly logger: Logger,
    private readonly config: SandboxConfig,
    hardening: SandboxHardening,
    socket?: string,
  ) {
    this.local = new LocalExecutor(logger, config);
    this.docker = new DockerExecutor(logger, config, hardening, socket);
    this.reaper = new Reaper(logger, this, config.reaperIntervalMs);
  }

  async initialize(): Promise<void> {
    this.dockerAvailable = await this.docker.isAvailable();
    if (!this.dockerAvailable) {
      this.logger.warn(
        { fallbackToLocal: this.config.fallbackToLocal },
        'Docker not available — sandbox will run in local mode',
      );
    }
    this.reaper.start();
  }

  async shutdown(): Promise<void> {
    this.reaper.stop();
    const sessions = this.store.all();
    await Promise.allSettled(sessions.map((s) => this.destroySession(s.sessionId)));
    this.logger.info('ExecutionManager shut down');
  }

  async recoverOrphans(): Promise<number> {
    return this.docker.recoverOrphans();
  }

  private effectiveMode(requested: ExecutionMode): ExecutionMode {
    if (requested === 'docker' && !this.dockerAvailable) {
      if (this.config.fallbackToLocal) return 'local';
      throw new DockerUnavailableError();
    }
    return requested;
  }

  async createSession(config: Partial<SessionCreateConfig> & { mode?: ExecutionMode }): Promise<Session> {
    if (this.store.count() >= this.config.maxSessions) {
      throw new MaxSessionsError(`Maximum ${this.config.maxSessions} concurrent sessions. Destroy idle sessions first.`);
    }
    const requested = config.mode ?? this.config.defaultMode;
    const mode = this.effectiveMode(requested);
    const full: SessionCreateConfig = {
      baseImage: config.baseImage ?? this.config.defaultImage,
      mode,
      mounts: config.mounts ?? [],
      resources: config.resources ?? this.config.defaultResources,
      networkEnabled: config.networkEnabled ?? false,
      env: config.env ?? {},
      ttl: config.ttl ?? this.config.defaultTtl,
      workdir: config.workdir,
    };
    const executor = this.executorFor(mode);
    const session = await executor.createSession(full);
    this.store.set(session);
    return session;
  }

  listSessions(): SessionInfo[] {
    return this.store.list();
  }

  getSession(sessionId: string): Session | undefined {
    return this.store.get(sessionId);
  }

  async destroySession(sessionId: string): Promise<void> {
    const session = this.store.get(sessionId);
    if (!session) throw new SessionNotFoundError(`Session ${sessionId} not found or already destroyed.`);
    const executor = this.executorFor(session.mode);
    try {
      await executor.destroySession(session);
    } finally {
      this.store.delete(sessionId);
    }
    this.logger.info({ sessionId, reason: 'explicit' }, 'Session destroyed');
  }

  /**
   * Execute a command. If sessionId is omitted, an ephemeral session (default mode,
   * with fallback) is created and destroyed around the command (FSD UC-04 / UC-13).
   */
  async execute(
    sessionId: string | undefined,
    command: string,
    options: ExecOptions,
    ephemeralMode?: ExecutionMode,
  ): Promise<ExecutionResult> {
    let targetId = sessionId;
    let ephemeral: Session | undefined;
    if (!targetId) {
      ephemeral = await this.createSession({ mode: ephemeralMode ?? this.config.defaultMode });
      targetId = ephemeral.sessionId;
    }
    const session = this.store.get(targetId);
    if (!session) throw new SessionNotFoundError(`Session ${targetId} not found. Create a new session first.`);
    const executor = this.executorFor(session.mode);
    try {
      const result = await executor.execute(session, command, options);
      this.store.touch(targetId);
      return result;
    } finally {
      if (ephemeral) {
        await this.destroySession(targetId).catch(() => {});
      }
    }
  }

  async reapExpired(): Promise<number> {
    const expired = this.store.getExpired(Date.now());
    let destroyed = 0;
    for (const s of expired) {
      try {
        await this.destroySession(s.sessionId);
        destroyed++;
        this.logger.info({ sessionId: s.sessionId, reason: 'ttl' }, 'Session reaped');
      } catch (err) {
        this.logger.warn({ err: (err as Error).message, sessionId: s.sessionId }, 'Reaper failed to destroy session');
      }
    }
    this.logger.debug({ expired: expired.length, destroyed }, 'Reaper cycle');
    return destroyed;
  }

  get activeCount(): number {
    return this.store.count();
  }

  get dockerReady(): boolean {
    return this.dockerAvailable;
  }

  private executorFor(mode: ExecutionMode): IExecutor {
    return mode === 'docker' && this.dockerAvailable ? this.docker : this.local;
  }
}
