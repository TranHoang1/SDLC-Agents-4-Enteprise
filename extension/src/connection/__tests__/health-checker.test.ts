/**
 * Unit tests for HealthChecker — interval polling and fail listeners.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HealthChecker } from "../HealthChecker";

describe("HealthChecker", () => {
  let httpClient: { healthCheck: ReturnType<typeof vi.fn> };
  let checker: HealthChecker;

  beforeEach(() => {
    vi.useFakeTimers();
    httpClient = { healthCheck: vi.fn(async () => true) };
    checker = new HealthChecker(httpClient as never, 5000);
  });

  afterEach(() => {
    checker.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("checkOnce returns the health check result", async () => {
    await expect(checker.checkOnce()).resolves.toBe(true);
    httpClient.healthCheck.mockResolvedValue(false);
    await expect(checker.checkOnce()).resolves.toBe(false);
  });

  it("fires fail listeners when a poll finds the backend unhealthy", async () => {
    const onFail = vi.fn();
    checker.onHealthFail(onFail);
    checker.start();
    httpClient.healthCheck.mockResolvedValue(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(onFail).toHaveBeenCalledTimes(1);
  });

  it("does not fire fail listeners while backend is healthy", async () => {
    const onFail = vi.fn();
    checker.onHealthFail(onFail);
    checker.start();
    await vi.advanceTimersByTimeAsync(10000);
    expect(onFail).not.toHaveBeenCalled();
  });

  it("fires every poll that is unhealthy", async () => {
    const onFail = vi.fn();
    checker.onHealthFail(onFail);
    checker.start();
    httpClient.healthCheck.mockResolvedValue(false);
    await vi.advanceTimersByTimeAsync(10000);
    expect(onFail).toHaveBeenCalledTimes(2);
  });

  it("stop clears the interval so polls stop", async () => {
    const onFail = vi.fn();
    checker.onHealthFail(onFail);
    checker.start();
    checker.stop();
    httpClient.healthCheck.mockResolvedValue(false);
    await vi.advanceTimersByTimeAsync(10000);
    expect(httpClient.healthCheck).not.toHaveBeenCalled();
  });

  it("start replaces any existing interval with a single timer", async () => {
    const onFail = vi.fn();
    checker.onHealthFail(onFail);
    checker.start();
    checker.start();
    httpClient.healthCheck.mockResolvedValue(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(httpClient.healthCheck).toHaveBeenCalledTimes(1);
  });

  it("supports multiple fail listeners", async () => {
    const a = vi.fn();
    const b = vi.fn();
    checker.onHealthFail(a);
    checker.onHealthFail(b);
    checker.start();
    httpClient.healthCheck.mockResolvedValue(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});