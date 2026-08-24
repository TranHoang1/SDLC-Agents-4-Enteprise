/**
 * SA4E-191 — DiffCommand unit tests (UT-08 main, UT-09 AF-1).
 */
import { describe, it, expect, vi } from 'vitest';
import { DiffCommand } from '../handlers/DiffCommand';
import { FileChangeAdapter } from '../adapters/sa4e183FileChangeAdapter';
import type { FileChangeBackend } from '../adapters/sa4e183FileChangeAdapter';
import { makeCtx, stubUI, sampleDiff } from './helpers';

class FakeFileChangeBackend implements FileChangeBackend {
  constructor(private diffs: any[] = [], private throws = false) {}
  async queryDiffs(): Promise<any[]> {
    if (this.throws) throw new Error('down');
    return this.diffs;
  }
  async revert(): Promise<boolean> {
    return true;
  }
}

describe('DiffCommand', () => {
  it('UT-08: main flow populates viewer', async () => {
    const diffs = [sampleDiff('src/app.ts')];
    const ui = stubUI();
    const showSpy = vi.spyOn(ui, 'showDiffViewer');
    const cmd = new DiffCommand(new FileChangeAdapter(new FakeFileChangeBackend(diffs)), ui);
    const res = await cmd.execute(makeCtx('diff'));
    expect(res.status).toBe('ok');
    expect((res.result as any).changedFiles.length).toBe(1);
    expect(showSpy).toHaveBeenCalledWith(diffs);
  });

  it('UT-09: AF-1 no changes -> empty-state', async () => {
    const ui = stubUI();
    const showSpy = vi.spyOn(ui, 'showDiffViewer');
    const cmd = new DiffCommand(new FileChangeAdapter(new FakeFileChangeBackend([])), ui);
    const res = await cmd.execute(makeCtx('diff'));
    expect(res.status).toBe('ok');
    expect((res.result as any).changedFiles.length).toBe(0);
    expect(showSpy).toHaveBeenCalledWith([], 'No file changes in this session.');
  });

  it('EF-1: tracking unavailable -> TRACKING_UNAVAILABLE', async () => {
    const cmd = new DiffCommand(new FileChangeAdapter(new FakeFileChangeBackend([], true)), stubUI());
    const res = await cmd.execute(makeCtx('diff'));
    expect(res.status).toBe('error');
    expect(res.error?.code).toBe('TRACKING_UNAVAILABLE');
  });
});
