/**
 * Unit tests for TimestampResolver — git → fs → now priority, SEC-07 safe paths.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TimestampResolver } from "../TimestampResolver";

vi.mock("child_process", () => ({ execFile: vi.fn() }));

import { execFile } from "child_process";

const execFileMock = vi.mocked(execFile);

function gitResult(stdout: string, err?: Error): void {
  execFileMock.mockImplementation((_cmd, _args, _opts, cb: unknown) => {
    (cb as (err: Error | null, stdout: string, stderr: string) => void)(err ?? null, stdout, "");
    return {} as never;
  });
}

describe("TimestampResolver", () => {
  let resolver: TimestampResolver;

  beforeEach(() => {
    execFileMock.mockReset();
    resolver = new TimestampResolver();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses git commit time when git succeeds", async () => {
    gitResult("2026-07-17T10:30:00+07:00\n");
    await expect(resolver.resolve("src/main.ts", "/workspace")).resolves.toBe("2026-07-17T10:30:00+07:00");
    expect(execFileMock).toHaveBeenCalledWith(
      "git",
      ["log", "-1", "--format=%aI", "--", "src/main.ts"],
      expect.objectContaining({ cwd: "/workspace", timeout: 5000 }),
      expect.any(Function)
    );
  });

  it("passes args as an array via execFile (no shell interpolation)", async () => {
    gitResult("2026-01-01T00:00:00Z\n");
    await resolver.resolve("safe/path.ts", "/w");
    const call = execFileMock.mock.calls[0];
    expect(call?.[0]).toBe("git");
    expect(Array.isArray(call?.[1])).toBe(true);
  });

  it("does not call git for paths with shell metacharacters", async () => {
    const result = await resolver.resolve("file;rm -rf /", "/w");
    expect(execFileMock).not.toHaveBeenCalled();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("does not call git for path traversal paths", async () => {
    const result = await resolver.resolve("../../../etc/passwd", "/w");
    expect(execFileMock).not.toHaveBeenCalled();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("falls back to fs mtime when git has no history", async () => {
    gitResult("", new Error("exit code 128"));
    const result = await resolver.resolve("src/main.ts", "/w");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("falls back to fs mtime even for unsafe paths", async () => {
    const result = await resolver.resolve("name;evil.sh", "/w");
    expect(execFileMock).not.toHaveBeenCalled();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});