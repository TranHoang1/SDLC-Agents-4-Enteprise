/**
 * SA4E-110 — Unit tests for CredentialManager (UT-05, UT-14, UT-21)
 * IPC message handling, auth header generation, staleness check.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CredentialManager } from '../credentials/credential-manager.js';

describe('UT-05: CredentialManager — IPC message handling', () => {
  let manager: CredentialManager;
  let messageHandler: (msg: unknown) => void;

  beforeEach(() => {
    manager = new CredentialManager();
    // Capture the process.on('message') handler
    vi.spyOn(process, 'on').mockImplementation((event: string, handler: any) => {
      if (event === 'message') messageHandler = handler;
      return process;
    });
    vi.spyOn(process, 'send' as any).mockImplementation(() => true);
    manager.initialize();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('ignores messages that do not match schema', () => {
    // Should not throw
    messageHandler({ type: 'unknown', data: 123 });
    messageHandler(null);
    messageHandler('not an object');
  });

  it('ignores messages with non-matching requestId', async () => {
    const promise = manager.getAuthHeaders();
    // Send a credential response with wrong requestId
    messageHandler({
      type: 'credentials',
      requestId: '00000000-0000-0000-0000-000000000000',
      timestamp: Date.now(),
      credentials: { email: 'a@b.com', apiToken: 'tok', baseUrl: 'https://x.atlassian.net' },
    });
    // Promise should still be pending (won't resolve with wrong ID)
    const raceResult = await Promise.race([
      promise.then(() => 'resolved'),
      new Promise(resolve => setTimeout(resolve, 50, 'pending')),
    ]);
    expect(raceResult).toBe('pending');
  });
});

describe('UT-14: CredentialManager — auth header generation', () => {
  let manager: CredentialManager;
  let messageHandler: (msg: unknown) => void;

  beforeEach(() => {
    manager = new CredentialManager();
    vi.spyOn(process, 'on').mockImplementation((event: string, handler: any) => {
      if (event === 'message') messageHandler = handler;
      return process;
    });
    vi.spyOn(process, 'send' as any).mockImplementation((msg: any) => {
      // Simulate parent response immediately
      setTimeout(() => {
        messageHandler({
          type: 'credentials',
          requestId: msg.requestId,
          timestamp: Date.now(),
          credentials: { email: 'user@test.com', apiToken: 'mytoken', baseUrl: 'https://site.atlassian.net' },
        });
      }, 0);
      return true;
    });
    manager.initialize();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('generates correct Basic auth header', async () => {
    const headers = await manager.getAuthHeaders();
    const expected = Buffer.from('user@test.com:mytoken').toString('base64');
    expect(headers.Authorization).toBe(`Basic ${expected}`);
    expect(headers.Accept).toBe('application/json');
  });

  it('caches credentials after first fetch', async () => {
    const headers1 = await manager.getAuthHeaders();
    const headers2 = await manager.getAuthHeaders();
    expect(headers1).toEqual(headers2);
    // process.send should be called only once
    expect(process.send).toHaveBeenCalledTimes(1);
  });
});

describe('UT-21: CredentialManager — staleness rejection', () => {
  let manager: CredentialManager;
  let messageHandler: (msg: unknown) => void;

  beforeEach(() => {
    manager = new CredentialManager();
    vi.spyOn(process, 'on').mockImplementation((event: string, handler: any) => {
      if (event === 'message') messageHandler = handler;
      return process;
    });
    vi.spyOn(process, 'send' as any).mockImplementation(() => true);
    manager.initialize();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('rejects credential response older than 5 seconds', async () => {
    const promise = manager.getAuthHeaders();
    // Get the requestId from the send call
    const sentMsg = (process.send as any).mock.calls[0][0];

    // Respond with stale timestamp (6 seconds ago)
    messageHandler({
      type: 'credentials',
      requestId: sentMsg.requestId,
      timestamp: Date.now() - 6000,
      credentials: { email: 'a@b.com', apiToken: 'tok', baseUrl: 'https://x.atlassian.net' },
    });

    await expect(promise).rejects.toThrow('stale');
  });
});
