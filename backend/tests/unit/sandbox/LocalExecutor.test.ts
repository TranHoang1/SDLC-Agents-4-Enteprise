import { describe, it, expect } from 'vitest';
import { LocalExecutor } from '../../../src/modules/sandbox/executors/LocalExecutor.js';
import { DEFAULT_SANDBOX_RESOURCES, SandboxConfigSchema } from '../../../src/config/SandboxConfig.js';
import type { SessionCreateConfig } from '../../../src/modules/sandbox/executors/IExecutor.js';

function cfg(overrides: Record<string, unknown> = {}) {
  return SandboxConfigSchema.parse(overrides);
}
function exec(overrides: Record<string, unknown> = {}) {
  return new LocalExecutor({} as any, cfg(overrides));
}
function sessionConfig(): SessionCreateConfig {
  return {
    baseImage: 'local',
    mode: 'local',
    mounts: [],
    resources: DEFAULT_SANDBOX_RESOURCES,
    networkEnabled: false,
    env: {},
    ttl: 1800,
  };
}

describe('LocalExecutor', () => {
  it('isAvailable is always true', async () => {
    expect(await exec().isAvailable()).toBe(true);
  });

  it('createSession returns a running local session', async () => {
    const e = exec();
    const s = await e.createSession(sessionConfig());
    expect(s.mode).toBe('local');
    expect(s.status).toBe('running');
    expect(s.sessionId.startsWith('sess_')).toBe(true);
  });

  it('executes a simple command (TC-02 / TC-16)', async () => {
    const e = exec();
    const s = await e.createSession(sessionConfig());
    const r = await e.execute(s, `node -e "console.log('hello')"`, { timeout: 30 });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('hello');
    expect(r.timedOut).toBe(false);
  });

  it('enforces timeout (TC-03)', async () => {
    const e = exec();
    const s = await e.createSession(sessionConfig());
    const sleepCmd = process.platform === 'win32' ? 'timeout 999 >nul' : 'sleep 999';
    const r = await e.execute(s, sleepCmd, { timeout: 1 });
    expect(r.timedOut).toBe(true);
    expect(r.exitCode).toBe(-1);
  });

  it('truncates output over the cap (TC-07)', async () => {
    const e = exec({ maxOutputBytes: 1024 });
    const s = await e.createSession(sessionConfig());
    const r = await e.execute(s, `node -e "process.stdout.write('a'.repeat(50000))"`, { timeout: 30 });
    expect(r.truncated).toBe(true);
    expect(Buffer.byteLength(r.stdout, 'utf-8')).toBeLessThanOrEqual(1024);
  });
});
