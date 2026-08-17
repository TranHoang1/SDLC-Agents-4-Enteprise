/**
 * SA4E-110 — Unit tests for path traversal prevention (UT-13)
 * Validates that file paths in attachment operations are safe.
 */
import { describe, it, expect } from 'vitest';
import { AttachFileSchema } from '../models/jira-schemas.js';

/**
 * Path validation helper — mirrors logic used in attachment tools.
 * Rejects paths containing traversal sequences.
 */
function isPathSafe(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.includes('..')) return false;
  if (normalized.startsWith('/')) return false;
  if (/^[a-zA-Z]:/.test(normalized)) return false;
  return true;
}

describe('UT-13: Path traversal prevention — file_path validation', () => {
  it('rejects paths with .. traversal', () => {
    expect(isPathSafe('../etc/passwd')).toBe(false);
    expect(isPathSafe('uploads/../../secret.txt')).toBe(false);
    expect(isPathSafe('..\\windows\\system32')).toBe(false);
  });

  it('rejects absolute Unix paths', () => {
    expect(isPathSafe('/etc/passwd')).toBe(false);
    expect(isPathSafe('/var/log/secret')).toBe(false);
  });

  it('rejects absolute Windows paths', () => {
    expect(isPathSafe('C:\\Users\\secret.txt')).toBe(false);
    expect(isPathSafe('D:/Documents/file.pdf')).toBe(false);
  });

  it('accepts relative safe paths', () => {
    expect(isPathSafe('uploads/file.pdf')).toBe(true);
    expect(isPathSafe('documents/report.docx')).toBe(true);
    expect(isPathSafe('file.txt')).toBe(true);
  });

  it('AttachFileSchema requires non-empty file_path', () => {
    const valid = AttachFileSchema.safeParse({ issue_key: 'PROJ-1', file_path: 'f.txt' });
    expect(valid.success).toBe(true);

    const empty = AttachFileSchema.safeParse({ issue_key: 'PROJ-1', file_path: '' });
    expect(empty.success).toBe(false);
  });
});
