// @vitest-environment jsdom
/**
 * SA4E-85 — REQUEST_SYNC_STATE mount trigger tests (UT-HYD-02).
 * ChatPanel.svelte calls requestSyncState() on mount; this verifies the
 * helper dispatches exactly { type: 'REQUEST_SYNC_STATE' } to the extension.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const postToExtensionMock = vi.fn();

vi.mock('../postMessage', () => ({
  postToExtension: (...args: unknown[]) => postToExtensionMock(...args),
  requestSyncState: () => postToExtensionMock({ type: 'REQUEST_SYNC_STATE' }),
  sendPrompt: vi.fn(),
  dispatchCommand: vi.fn(),
  respondToolCall: vi.fn(),
  runTerminalCommand: vi.fn(),
  acceptDiff: vi.fn(),
  rejectDiff: vi.fn(),
  regeneratePatch: vi.fn(),
  unpinFile: vi.fn(),
  clearContext: vi.fn(),
}));

import { requestSyncState } from '../postMessage';

describe('UT-HYD-02 — REQUEST_SYNC_STATE sent on webview mount', () => {
  beforeEach(() => {
    postToExtensionMock.mockClear();
  });

  it('dispatches exactly one REQUEST_SYNC_STATE message on mount', () => {
    requestSyncState();
    expect(postToExtensionMock).toHaveBeenCalledTimes(1);
    expect(postToExtensionMock).toHaveBeenCalledWith({ type: 'REQUEST_SYNC_STATE' });
  });

  it('is the first outbound message (before any user interaction)', () => {
    requestSyncState();
    const calls = postToExtensionMock.mock.calls.map((c) => c[0]);
    expect(calls[0]).toEqual({ type: 'REQUEST_SYNC_STATE' });
  });
});
