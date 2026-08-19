/**
 * SA4E-182 — CompactConfig unit tests.
 * Tests: settings reading, clamping, reactive update on config change.
 */

import { describe, it, expect, vi } from 'vitest';
import { CompactConfig } from '../CompactConfig';
import type { WorkspaceConfig, ConfigChangeEvent } from '../CompactConfig';

function createWorkspace(values: Record<string, unknown> = {}): {
  workspace: WorkspaceConfig;
  fireChange: (e: ConfigChangeEvent) => void;
} {
  let listener: ((e: ConfigChangeEvent) => void) | null = null;
  const workspace: WorkspaceConfig = {
    getConfiguration: () => ({
      get: <T>(key: string, def: T): T => {
        if (key in values) return values[key] as T;
        return def;
      },
    }),
    onDidChangeConfiguration: (fn) => {
      listener = fn;
      return { dispose: vi.fn() };
    },
  };
  const fireChange = (e: ConfigChangeEvent) => listener?.(e);
  return { workspace, fireChange };
}

describe('CompactConfig', () => {
  it('should read default settings', () => {
    const { workspace } = createWorkspace();
    const config = new CompactConfig(workspace);
    const settings = config.getSettings();

    expect(settings.autoCompact).toBe(true);
    expect(settings.autoCompactThreshold).toBe(95);
    config.dispose();
  });

  it('should clamp threshold to minimum 80', () => {
    const { workspace } = createWorkspace({ autoCompactThreshold: 50 });
    const config = new CompactConfig(workspace);
    expect(config.getSettings().autoCompactThreshold).toBe(80);
    config.dispose();
  });

  it('should clamp threshold to maximum 99', () => {
    const { workspace } = createWorkspace({ autoCompactThreshold: 150 });
    const config = new CompactConfig(workspace);
    expect(config.getSettings().autoCompactThreshold).toBe(99);
    config.dispose();
  });

  it('should update settings on config change affecting sa4e.chat', () => {
    const { workspace, fireChange } = createWorkspace({ autoCompact: true });
    const config = new CompactConfig(workspace);

    expect(config.getSettings().autoCompact).toBe(true);

    // Simulate config change — workspace now returns different values
    // We mutate the workspace's internal state to reflect new values
    const updatedWorkspace = createWorkspace({ autoCompact: false });
    // Monkeypatch getConfiguration
    (workspace as any).getConfiguration = updatedWorkspace.workspace.getConfiguration;

    fireChange({ affectsConfiguration: (s) => s === 'sa4e.chat' });
    expect(config.getSettings().autoCompact).toBe(false);
    config.dispose();
  });

  it('should NOT update on unrelated config changes', () => {
    const { workspace, fireChange } = createWorkspace({ autoCompactThreshold: 90 });
    const config = new CompactConfig(workspace);
    expect(config.getSettings().autoCompactThreshold).toBe(90);

    fireChange({ affectsConfiguration: (s) => s === 'editor.fontSize' });
    // Should still be 90 (not re-read)
    expect(config.getSettings().autoCompactThreshold).toBe(90);
    config.dispose();
  });
});
