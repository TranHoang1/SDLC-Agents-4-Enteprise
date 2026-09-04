/**
 * SA4E-6 — LocalExecutor: executes commands directly on the host via child_process.
 * Provides NO isolation (FSD §7.4) but still enforces timeout + output cap.
 * Always available — used as the fallback when Docker is unavailable (UC-13).
 */

import { spawn, type ChildProcess } from 'child_process';
import type { Logger } from 'pino';
import type { SandboxConfig } from '../../../config/SandboxConfig.js';
import type { IExecutor, SessionCreateConfig, ExecOptions } from './IExecutor.js';
import type { Session, ExecutionResult } from '../models.js';
import { OutputBuffer } from '../parsers/OutputBuffer.js';
import { buildExecutionResult } from './result.js';
import { generateSessionId } from '../models.js';

export class LocalExecutor implements IExecutor {
  readonly mode = 'local' as const;
  private processes = new Map<number, ChildProcess>();

  constructor(
    private readonly logger: Logger,
    private readonly config: SandboxConfig,
  ) {}

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async createSession(config: SessionCreateConfig): Promise<Session> {
    const now = new Date();
    this.logger.info({ mode: 'local' }, 'Creating local sandbox session');
    return {
      sessionId: generateSessionId(),
      mode: 'local',
      status: 'running',
      baseImage: config.baseImage,
      mounts: config.mounts,
      resources: config.resources,
      networkEnabled: config.networkEnabled,
      createdAt: now,
      lastActivity: now,
      ttl: config.ttl,
      env: config.env,
      workdir: config.workdir,
    };
  }

  async destroySession(_session: Session): Promise<void> {
    // Best-effort: kill any lingering child process tracked for this session.
    return;
  }

  async execute(session: Session, command: string, options: ExecOptions): Promise<ExecutionResult> {
    const start = Date.now();
    const timeoutSec = Math.min(
      Math.max(options.timeout || this.config.commandTimeoutDefault, 1),
      this.config.commandTimeoutMax,
    );
    const timeoutMs = timeoutSec * 1000;
    const maxBytes = this.config.maxOutputBytes;
    const stdoutBuf = new OutputBuffer(maxBytes);
    const stderrBuf = new OutputBuffer(maxBytes);

    const env = {
      ...process.env,
      ...session.env,
      ...(options.env || {}),
    } as Record<string, string>;
    const workdir = options.workdir || session.workdir;

    return new Promise<ExecutionResult>((resolve) => {
      // Use `shell: true` so the shell handles command-line quoting natively.
      // On Windows this invokes cmd.exe (/d /s /c) which correctly interprets
      // embedded quotes; a manual spawn('cmd.exe', ['/c', command]) lets Node
      // re-quote the argument and corrupts the command (empty stdout).
      const child = spawn(command, {
        cwd: workdir,
        env,
        shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
        windowsHide: true,
      });
      if (child.pid) this.processes.set(child.pid, child);

      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        try {
          child.kill('SIGKILL');
        } catch {
          /* ignore */
        }
      }, timeoutMs);

      child.stdout?.on('data', (d: Buffer) => stdoutBuf.append(d.toString('utf-8')));
      child.stderr?.on('data', (d: Buffer) => stderrBuf.append(d.toString('utf-8')));

      const finish = (code: number | null, signal: NodeJS.Signals | null) => {
        clearTimeout(timer);
        if (child.pid) this.processes.delete(child.pid);
        const duration = Date.now() - start;
        this.logger.info(
          { sessionId: session.sessionId, command: command.slice(0, 100), exitCode: code, duration, timedOut },
          'Local command executed',
        );
        if (timedOut) {
          resolve(buildExecutionResult(-1, stdoutBuf, stderrBuf, session.sessionId, duration, true));
          return;
        }
        if (code === null && signal) {
          // Killed by signal — treat as error exit.
          resolve(buildExecutionResult(1, stdoutBuf, stderrBuf, session.sessionId, duration, false));
          return;
        }
        resolve(buildExecutionResult(code ?? -1, stdoutBuf, stderrBuf, session.sessionId, duration, false));
      };

      child.on('error', (err) => {
        clearTimeout(timer);
        if (child.pid) this.processes.delete(child.pid);
        const duration = Date.now() - start;
        resolve(
          buildExecutionResult(
            -1,
            stdoutBuf,
            stderrBuf,
            session.sessionId,
            duration,
            false,
          ),
        );
        this.logger.warn({ err: err.message }, 'Local command spawn error');
      });

      child.on('close', (code, signal) => finish(code, signal));
    });
  }
}
