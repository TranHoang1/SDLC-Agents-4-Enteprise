/**
 * SA4E-85 — ApprovalEventLog unit tests.
 * Covers: emit, readAll, close, no-op when null path, best-effort writes.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ApprovalEventLog } from '../ApprovalEventLog';

describe('ApprovalEventLog', () => {
  let tmpDir: string;
  let logPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'approval-log-'));
    logPath = path.join(tmpDir, 'events.jsonl');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should write events as JSONL lines', () => {
    const log = new ApprovalEventLog({ logFilePath: logPath });
    log.emit({ event: 'request', toolCallId: 'tc-1' });
    log.emit({ event: 'approve', toolCallId: 'tc-1' });

    const events = log.readAll();
    expect(events).toHaveLength(2);
    expect(events[0].event).toBe('request');
    expect(events[0].toolCallId).toBe('tc-1');
    expect(events[0].id).toBe(1);
    expect(events[1].id).toBe(2);
    expect(events[1].event).toBe('approve');
  });

  it('should assign sequential ids', () => {
    const log = new ApprovalEventLog({ logFilePath: logPath });
    log.emit({ event: 'request', toolCallId: 'tc-a' });
    log.emit({ event: 'timeout', toolCallId: 'tc-a' });
    log.emit({ event: 'retry', toolCallId: 'tc-a', data: { attempt: 2 } });

    const events = log.readAll();
    expect(events.map((e) => e.id)).toEqual([1, 2, 3]);
  });

  it('should include timestamp on each event', () => {
    const log = new ApprovalEventLog({ logFilePath: logPath });
    const before = Date.now();
    log.emit({ event: 'request', toolCallId: 'tc-ts' });
    const after = Date.now();

    const events = log.readAll();
    expect(events[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(events[0].timestamp).toBeLessThanOrEqual(after);
  });

  it('should include optional data field', () => {
    const log = new ApprovalEventLog({ logFilePath: logPath });
    log.emit({ event: 'retry', toolCallId: 'tc-d', data: { attempt: 3 } });

    const events = log.readAll();
    expect(events[0].data).toEqual({ attempt: 3 });
  });

  it('should be no-op when logFilePath is null', () => {
    const log = new ApprovalEventLog({ logFilePath: null });
    log.emit({ event: 'request', toolCallId: 'tc-null' });

    const events = log.readAll();
    expect(events).toEqual([]);
  });

  it('should prevent writes after close()', () => {
    const log = new ApprovalEventLog({ logFilePath: logPath });
    log.emit({ event: 'request', toolCallId: 'tc-close' });
    log.close();
    log.emit({ event: 'approve', toolCallId: 'tc-close' });

    const events = log.readAll();
    expect(events).toHaveLength(1);
  });

  it('should return empty array if file does not exist', () => {
    const log = new ApprovalEventLog({ logFilePath: '/nonexistent/path.jsonl' });
    expect(log.readAll()).toEqual([]);
  });

  it('should create parent directories', () => {
    const nested = path.join(tmpDir, 'a', 'b', 'c', 'events.jsonl');
    const log = new ApprovalEventLog({ logFilePath: nested });
    log.emit({ event: 'request', toolCallId: 'tc-nested' });

    const events = log.readAll();
    expect(events).toHaveLength(1);
  });
});
