/**
 * Unit tests for TokenRefreshTimer — interval scheduling, stop on logout/unauthenticated.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TokenRefreshTimer } from "../TokenRefreshTimer";

const INTERVAL_MS = 5 * 60 * 1000;

class StubAuthManager {
  isAuthenticated = true;
  refreshToken = vi.fn(async () => {});
}

describe("TokenRefreshTimer", () => {
  let auth: StubAuthManager;
  let timer: TokenRefreshTimer;

  beforeEach(() => {
    vi.useFakeTimers();
    auth = new StubAuthManager();
    timer = new TokenRefreshTimer(auth as never);
  });

  afterEach(() => {
    timer.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("invokes refreshToken on each interval while authenticated", async () => {
    timer.start();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(auth.refreshToken).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(auth.refreshToken).toHaveBeenCalledTimes(2);
  });

  it("stops itself and does not refresh when not authenticated", async () => {
    auth.isAuthenticated = false;
    timer.start();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(auth.refreshToken).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(auth.refreshToken).not.toHaveBeenCalled();
  });

  it("start resets a previously scheduled timer", async () => {
    timer.start();
    timer.start();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(auth.refreshToken).toHaveBeenCalledTimes(1);
  });

  it("stop clears the interval", async () => {
    timer.start();
    timer.stop();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 2);
    expect(auth.refreshToken).not.toHaveBeenCalled();
  });

  it("stop is safe to call multiple times", async () => {
    timer.start();
    timer.stop();
    timer.stop();
    expect(() => timer.stop()).not.toThrow();
  });

  it("survives a refresh error without unhandled rejections", async () => {
    auth.refreshToken.mockRejectedValue(new Error("refresh boom"));
    const errorSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    timer.start();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(auth.refreshToken).toHaveBeenCalledTimes(1);
    expect(console.debug).toHaveBeenCalledWith(expect.stringContaining("Token refresh failed"));
    errorSpy.mockRestore();
  });
});