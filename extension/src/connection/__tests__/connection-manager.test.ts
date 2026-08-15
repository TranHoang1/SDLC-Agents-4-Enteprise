/**
 * Unit tests for ConnectionManager — state machine, reconnect backoff, health-fail handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConnectionManager } from "../ConnectionManager";
import type { ConnectionState } from "../ConnectionManager";

vi.mock("vscode", () => ({
  EventEmitter: class {
    listeners: Array<(value: unknown) => void> = [];
    event = (listener: (value: unknown) => void) => {
      this.listeners.push(listener);
      return { dispose: () => {} };
    };
    fire = (value: unknown) => { this.listeners.forEach((l) => l(value)); };
    dispose = () => {};
  },
  window: { showErrorMessage: vi.fn(() => Promise.resolve(undefined)) },
}));

import * as vscode from "vscode";

function makeHttpClient() {
  let base = "http://backend:48721";
  return {
    healthCheck: vi.fn(async () => true),
    get baseUrl(): string { return base; },
    set baseUrl(value: string) { base = value; },
  };
}

describe("ConnectionManager", () => {
  let httpClient: ReturnType<typeof makeHttpClient>;
  let manager: ConnectionManager;

  beforeEach(() => {
    vi.useFakeTimers();
    httpClient = makeHttpClient();
    manager = new ConnectionManager(
      { url: "http://backend:48721", healthCheckInterval: 30000, toolCallTimeout: 300000, chatTimeout: 120000 },
      {} as never,
      httpClient as never
    );
  });

  afterEach(() => {
    manager.dispose();
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts in DISCONNECTED state", () => {
    expect(manager.currentState).toBe("DISCONNECTED");
    expect(manager.isConnected).toBe(false);
    expect(manager.backendUrl).toBe("http://backend:48721");
  });

  it("connect transitions to CONNECTED when backend is healthy", async () => {
    const states: ConnectionState[] = [];
    manager.onStateChange((s) => states.push(s));
    await manager.connect();
    expect(states).toEqual(["CONNECTING", "CONNECTED"]);
    expect(manager.isConnected).toBe(true);
    expect(httpClient.healthCheck).toHaveBeenCalled();
  });

  it("connect schedules a reconnect when backend is unhealthy", async () => {
    httpClient.healthCheck.mockResolvedValue(false);
    await manager.connect();
    expect(manager.currentState).toBe("DISCONNECTED");
  });

  it("health-fail detected during polling disconnects and reconnects", async () => {
    await manager.connect();
    expect(manager.isConnected).toBe(true);
    httpClient.healthCheck.mockResolvedValue(false);
    await vi.advanceTimersByTimeAsync(30000);
    expect(manager.currentState).toBe("DISCONNECTED");
  });

  it("reconnect attempts stop after reaching the max and show an error message", async () => {
    httpClient.healthCheck.mockResolvedValue(false);
    await manager.connect();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000);
    await vi.advanceTimersByTimeAsync(8000);
    await vi.advanceTimersByTimeAsync(16000);
    expect(manager.currentState).toBe("DISCONNECTED");
    expect(vi.mocked(vscode.window.showErrorMessage)).toHaveBeenCalled();
  });

  it("reconnects on a successful retry during backoff", async () => {
    httpClient.healthCheck.mockResolvedValueOnce(false).mockResolvedValue(true);
    await manager.connect();
    expect(manager.currentState).toBe("DISCONNECTED");
    await vi.advanceTimersByTimeAsync(1000);
    expect(manager.currentState).toBe("CONNECTED");
    expect(vi.mocked(vscode.window.showErrorMessage)).not.toHaveBeenCalled();
  });

  it("disconnect stops health polling and returns to DISCONNECTED", async () => {
    await manager.connect();
    const healthCalls = httpClient.healthCheck.mock.calls.length;
    manager.disconnect();
    expect(manager.currentState).toBe("DISCONNECTED");
    httpClient.healthCheck.mockResolvedValue(false);
    await vi.advanceTimersByTimeAsync(30000);
    expect(httpClient.healthCheck).toHaveBeenCalledTimes(healthCalls);
    expect(vi.mocked(vscode.window.showErrorMessage)).not.toHaveBeenCalled();
  });

  it("updateConfig changes backend URL and applies the new health interval", async () => {
    await manager.connect();
    manager.updateConfig({ url: "http://new-backend:9999", healthCheckInterval: 5000 });
    expect(manager.backendUrl).toBe("http://new-backend:9999");
    expect(httpClient.baseUrl).toBe("http://new-backend:9999");
    manager.disconnect();
    await manager.connect();
    httpClient.healthCheck.mockResolvedValue(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(manager.currentState).toBe("DISCONNECTED");
  });

  it("updateConfig ignores undefined fields", async () => {
    await manager.connect();
    manager.updateConfig({});
    expect(manager.backendUrl).toBe("http://backend:48721");
    expect(manager.currentState).toBe("CONNECTED");
  });

  it("dispose cancels pending reconnect timers", async () => {
    httpClient.healthCheck.mockResolvedValue(false);
    await manager.connect();
    const healthCalls = httpClient.healthCheck.mock.calls.length;
    manager.dispose();
    await vi.advanceTimersByTimeAsync(1000);
    expect(httpClient.healthCheck).toHaveBeenCalledTimes(healthCalls);
  });
});