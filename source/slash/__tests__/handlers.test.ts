import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import {
  copy,
  debug,
  help,
  init,
  sessions,
  skills,
  status,
  thinking,
  registerAll,
} from "../commands/handlers";

vi.mock("fs");

function makeCtx(overrides: any = {}) {
  return {
    session: {
      id: "s1",
      name: "test",
      messages: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
      ],
      extendedThinking: false,
    },
    runtime: {
      metrics: {
        tokensIn: 10,
        tokensOut: 20,
        toolCalls: 3,
        durationMs: 1500,
        hookFires: 2,
        steeringRules: ["rule-a"],
      },
      sessionManager: {
        list: () => [{ id: "s1" }, { id: "s2" }],
        switch: vi.fn(),
      },
      tools: [1, 2],
      hooks: [1],
      agents: [1, 2, 3],
      steering: [1],
      connection: { ok: true },
    },
    clipboard: { write: vi.fn().mockResolvedValue(undefined) },
    skillsDir: "/tmp/.code-intel/skills",
    invokeSkill: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

let logSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  registerAll();
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("slash command handlers (unit)", () => {
  it("TC-01 /copy serializes markdown and writes to clipboard", async () => {
    const ctx = makeCtx();
    await copy(ctx);
    expect(ctx.clipboard.write).toHaveBeenCalledTimes(1);
    const md = ctx.clipboard.write.mock.calls[0][0];
    expect(md).toContain("**user**: hi");
    expect(md).toContain("**assistant**: hello");
    expect(logSpy).toHaveBeenCalledWith("Transcript copied to clipboard.");
  });

  it("TC-02 /debug prints runtime metrics", () => {
    debug(makeCtx());
    const out = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(out).toContain("10/20");
    expect(out).toContain("Tool calls: 3");
    expect(out).toContain("rule-a");
  });

  it("TC-03 /help lists all 8 commands", () => {
    help(makeCtx());
    const out = logSpy.mock.calls.map((c) => c[0]).join("\n");
    for (const c of ["copy", "debug", "help", "init", "sessions", "skills", "status", "thinking"]) {
      expect(out).toContain("/" + c);
    }
  });

  it("TC-04 /init scaffolds .code-intel structure", () => {
    init(makeCtx());
    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("Initialized .code-intel/ structure.");
  });

  it("TC-05 /sessions lists and switches", () => {
    const ctx = makeCtx();
    sessions(ctx, []);
    expect(logSpy.mock.calls.map((c) => c[0]).join("\n")).toContain("s2");
    sessions(ctx, ["s2"]);
    expect(ctx.runtime.sessionManager.switch).toHaveBeenCalledWith("s2");
  });

  it("TC-06 /skills lists dir or invokes", async () => {
    const ctx = makeCtx();
    await skills(ctx, []);
    expect(logSpy.mock.calls.map((c) => c[0]).join("\n")).toContain("/tmp/.code-intel/skills");
    await skills(ctx, ["foo"]);
    expect(ctx.invokeSkill).toHaveBeenCalledWith("foo");
  });

  it("TC-07 /status shows counts", () => {
    status(makeCtx());
    const out = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(out).toContain("Tools: 2");
    expect(out).toContain("Hooks: 1");
    expect(out).toContain("Agents: 3");
    expect(out).toContain("OK");
  });

  it("TC-08 /thinking toggles flag", () => {
    const ctx = makeCtx();
    thinking(ctx);
    expect(ctx.session.extendedThinking).toBe(true);
    expect(logSpy.mock.calls.map((c) => c[0]).join("\n")).toContain("ON");
  });

  it("TC-09 security: args are data only (no shell exec)", async () => {
    const ctx = makeCtx();
    // sessions with malicious arg must not throw / execute
    expect(() => sessions(ctx, ["$(rm -rf /)"])).not.toThrow();
    expect(ctx.runtime.sessionManager.switch).toHaveBeenCalledWith("$(rm -rf /)");
  });
});
