/**
 * SA4E-85 — Unit Tests: ToolApprovalClassifier (UT-TAC-01).
 * Tests tool approval classification matrix and tool set accessors.
 */

import { describe, it, expect } from 'vitest';
import {
  requiresApproval,
  getDangerousTools,
  getSafeTools,
} from '../ToolApprovalClassifier';

describe('UT-TAC-01: Tool Approval Classification', () => {
  it('classifies dangerous tools as requiring approval', () => {
    const dangerous = [
      'write_file',
      'stream_write_file',
      'shell_execute',
      'delete_file',
      'git_commit',
      'git_push',
      'git_checkout',
      'git_merge',
      'git_rebase',
    ];
    for (const tool of dangerous) {
      expect(requiresApproval(tool)).toBe(true);
    }
  });

  it('classifies safe tools as auto-approve', () => {
    const safe = [
      'read_file',
      'search_text',
      'list_directory',
      'get_diagnostics',
      'grep_search',
      'file_search',
    ];
    for (const tool of safe) {
      expect(requiresApproval(tool)).toBe(false);
    }
  });

  it('classifies any git_* tool as dangerous via heuristic', () => {
    expect(requiresApproval('git_status')).toBe(true);
    expect(requiresApproval('git_log')).toBe(true);
    expect(requiresApproval('git_something_unknown')).toBe(true);
  });

  it('defaults unknown non-git tools to safe', () => {
    expect(requiresApproval('mcp_custom_tool')).toBe(false);
    expect(requiresApproval('totally_unknown')).toBe(false);
  });

  it('handles empty and case-sensitive tool names', () => {
    expect(requiresApproval('')).toBe(false);
    expect(requiresApproval('Write_File')).toBe(false);
    expect(requiresApproval('WRITE_FILE')).toBe(false);
  });
});

describe('UT-TAC-02: Tool Set Accessors', () => {
  it('returns the dangerous tool set with expected members', () => {
    const tools = getDangerousTools();
    expect(tools.has('write_file')).toBe(true);
    expect(tools.has('shell_execute')).toBe(true);
    expect(tools.has('git_push')).toBe(true);
    expect(tools.has('read_file')).toBe(false);
    expect(tools.size).toBeGreaterThanOrEqual(9);
  });

  it('returns the safe tool set with expected members', () => {
    const tools = getSafeTools();
    expect(tools.has('read_file')).toBe(true);
    expect(tools.has('grep_search')).toBe(true);
    expect(tools.has('file_search')).toBe(true);
    expect(tools.has('write_file')).toBe(false);
    expect(tools.size).toBeGreaterThanOrEqual(6);
  });

  it('safe and dangerous sets are disjoint', () => {
    const dangerous = getDangerousTools();
    const safe = getSafeTools();
    for (const tool of safe) {
      expect(dangerous.has(tool)).toBe(false);
    }
  });
});
