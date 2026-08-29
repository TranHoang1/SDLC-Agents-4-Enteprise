import { describe, it, expect } from 'vitest';
import pino from 'pino';
import { SandboxModule } from '../../../src/modules/sandbox/SandboxModule.js';
import { ModuleRegistry } from '../../../src/modules/ModuleRegistry.js';

const logger = pino({ level: 'silent' });

describe('SandboxModule (full IModule wiring)', () => {
  it('initializes, registers 5 tools, and runs a local session lifecycle (UC-01..UC-03)', async () => {
    const registry = new ModuleRegistry(logger);
    const mod = new SandboxModule(logger, registry);
    await mod.initialize();
    expect(mod.status).toBe('ready');

    const defs = mod.getToolDefinitions();
    expect(defs.length).toBe(5);
    expect(defs.map((d) => d.name).sort()).toEqual(
      ['sandbox_exec', 'sandbox_install', 'sandbox_run', 'sandbox_session', 'sandbox_test'].sort(),
    );
    expect(defs.every((d) => d.category === 'sandbox')).toBe(true);

    const handlers = mod.getToolHandlers();
    for (const name of ['sandbox_session', 'sandbox_exec', 'sandbox_run', 'sandbox_install', 'sandbox_test']) {
      expect(handlers.has(name)).toBe(true);
    }

    const sessionHandler = handlers.get('sandbox_session')!;
    const createRes = await sessionHandler({ action: 'create', config: { mode: 'local' } });
    expect(createRes.isError).toBe(false);
    const created = JSON.parse(createRes.content[0].text);
    expect(created.sessionId.startsWith('sess_')).toBe(true);
    expect(created.mode).toBe('local');

    const listRes = await sessionHandler({ action: 'list' });
    const list = JSON.parse(listRes.content[0].text);
    expect(list.sessions.length).toBeGreaterThan(0);

    const destroyRes = await sessionHandler({ action: 'destroy', sessionId: created.sessionId });
    expect(JSON.parse(destroyRes.content[0].text).destroyed).toBe(true);

    await mod.shutdown();
    expect(mod.status).toBe('stopped');
  });

  it('rejects a malformed sessionId on destroy with a structured error', async () => {
    const mod = new SandboxModule(logger, new ModuleRegistry(logger));
    await mod.initialize();
    const handlers = mod.getToolHandlers();
    const res = await handlers.get('sandbox_session')!({ action: 'destroy', sessionId: 'not-valid' });
    expect(res.isError).toBe(true);
    expect(JSON.parse(res.content[0].text).error).toBe('SESSION_NOT_FOUND');
    await mod.shutdown();
  });
});
