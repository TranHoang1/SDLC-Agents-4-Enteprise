import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-root-'));

vi.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: tmpDir } }]
  }
}));

// Import after mock
import { executeLocalTool } from '../backend-local-tools';

beforeAll(() => {
  // ensure tmp dir exists
});

afterAll(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

describe('stream_write_file path reject', () => {
  it('rejects path outside workspace', async () => {
    const outside = path.join(os.tmpdir(), 'outside-file.txt');
    const result = await executeLocalTool('stream_write_file', {
      file_path: outside,
      content: 'x',
      mode: 'write'
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Path rejected');
  });

  // Inside path test requires vscode mock to work; covered by existing TC-05/TC-06 with cwd fallback
  it('allows relative path with cwd fallback', async () => {
    const rel = 'mock-reject-test.txt';
    const result = await executeLocalTool('stream_write_file', {
      file_path: rel,
      content: 'ok',
      mode: 'write'
    });
    expect(result.isError).toBe(false);
    const full = path.join(process.cwd(), rel);
    expect(fs.existsSync(full)).toBe(true);
    fs.unlinkSync(full);
  });
});
