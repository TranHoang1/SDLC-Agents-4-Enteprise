import { describe, it, expect, vi, beforeAll } from "vitest";
import * as os from "os";
import * as path from "path";
import { slashMenu } from "../controller";
import { registerAll } from "../commands/handlers";

const cwdSpy = vi.spyOn(process, "cwd");
const tmp = path.join(os.tmpdir(), "sa4e192-e2e-" + Date.now());
cwdSpy.mockReturnValue(tmp);

let clipboard: string[] = [];
const logs: string[] = [];
let skillInvoked: string | null = null;

const sessionsStore = [
  { id: "a", name: "sess-a", messages: [], extendedThinking: false },
  { id: "b", name: "sess-b", messages: [], extendedThinking: false },
];

const ctx = {
  session: sessionsStore[0],
  runtime: {
    metrics: {
      tokensIn: 5,
      tokensOut: 7,
      toolCalls: 1,
      durationMs: 200,
      hookFires: 0,
      steeringRules: [],
    },
    sessionManager: {
      list: () => sessionsStore,
      switch: (id: string) => {
        const s = sessionsStore.find((x) => x.id === id);
        if (s) (ctx as any).session = s;
      },
    },
    tools: [1],
    hooks: [1],
    agents: [1],
    steering: [1],
    connection: { ok: true },
  },
  clipboard: { write: async (t: string) => { clipboard.push(t); } },
  skillsDir: path.join(tmp, ".code-intel", "skills"),
  invokeSkill: async (n: string) => { skillInvoked = n; },
} as any;

beforeAll(() => {
  vi.spyOn(console, "log").mockImplementation((...a: any[]) => {
    logs.push(a.map(String).join(" "));
  });
  registerAll();
});

function route(name: string, args: string[] = []) {
  logs.length = 0;
  return slashMenu.route(name, ctx, args);
}

describe("slash commands e2e (real modules)", () => {
  it("registers exactly 8 commands", () => {
    expect(slashMenu.list()).toHaveLength(8);
  });

  it("/help outputs all commands", async () => {
    await route("help");
    const out = logs.join("\n");
    for (const c of ["copy", "debug", "help", "init", "sessions", "skills", "status", "thinking"]) {
      expect(out).toContain("/" + c);
    }
  });

  it("/copy writes markdown to clipboard", async () => {
    ctx.session.messages = [
      { role: "user", content: "u" },
      { role: "assistant", content: "a" },
    ];
    clipboard = [];
    await route("copy");
    expect(clipboard[0]).toContain("**user**: u");
  });

  it("/init creates .code-intel on disk", async () => {
    await route("init");
    const fs = require("fs");
    expect(fs.existsSync(path.join(tmp, ".code-intel", "skills"))).toBe(true);
  });

  it("/sessions switches session", async () => {
    await route("sessions", ["b"]);
    expect((ctx as any).session.id).toBe("b");
  });

  it("/skills invokes a skill", async () => {
    skillInvoked = null;
    await route("skills", ["demo"]);
    expect(skillInvoked).toBe("demo");
  });

  it("/status and /debug and /thinking run without error", async () => {
    await route("status");
    await route("debug");
    const before = (ctx as any).session.extendedThinking;
    await route("thinking");
    expect((ctx as any).session.extendedThinking).toBe(!before);
  });

  it("unknown command shows friendly error", async () => {
    await route("fantasy");
    expect(logs.join("\n")).toContain("Unknown command, try /help");
  });
});
