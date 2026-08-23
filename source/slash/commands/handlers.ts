import { slashMenu } from "../controller";
import { CommandContext } from "../context";
import * as fs from "fs";
import * as path from "path";

export async function copy(ctx: CommandContext) {
  const md = ctx.session.messages
    .map((m) => `**${m.role}**: ${m.content}`)
    .join("\n\n");
  await ctx.clipboard.write(md);
  console.log("Transcript copied to clipboard.");
}

export function debug(ctx: CommandContext) {
  const m = ctx.runtime.metrics;
  console.log(
    `Tokens in/out: ${m.tokensIn}/${m.tokensOut}\nTool calls: ${m.toolCalls}\nDuration: ${m.durationMs}ms\nHook fires: ${m.hookFires}\nSteering: ${m.steeringRules.join(", ")}`
  );
}

export function help(ctx: CommandContext) {
  for (const c of slashMenu.list()) {
    console.log(`/${c.name} - ${c.description}`);
  }
}

export function init(ctx: CommandContext) {
  const dir = path.join(process.cwd(), ".code-intel");
  fs.mkdirSync(path.join(dir, "skills"), { recursive: true });
  fs.mkdirSync(path.join(dir, "context"), { recursive: true });
  fs.mkdirSync(path.join(dir, "steering"), { recursive: true });
  fs.writeFileSync(path.join(dir, "skills", ".gitkeep"), "");
  console.log("Initialized .code-intel/ structure.");
}

export function sessions(ctx: CommandContext, args: string[]) {
  const all = ctx.runtime.sessionManager.list();
  if (args[0]) {
    ctx.runtime.sessionManager.switch(args[0]);
    console.log(`Switched to session ${args[0]}`);
  } else {
    console.log(all.map((s) => s.id).join("\n"));
  }
}

export async function skills(ctx: CommandContext, args: string[]) {
  if (args[0]) {
    await ctx.invokeSkill(args[0]);
  } else {
    console.log(`Skills dir: ${ctx.skillsDir}`);
  }
}

export function status(ctx: CommandContext) {
  const r = ctx.runtime;
  console.log(
    `Connection: ${r.connection.ok ? "OK" : "DOWN"}\nTools: ${r.tools.length}\nHooks: ${r.hooks.length}\nAgents: ${r.agents.length}\nSteering: ${r.steering.length}`
  );
}

export function thinking(ctx: CommandContext) {
  ctx.session.extendedThinking = !ctx.session.extendedThinking;
  console.log(`Extended thinking: ${ctx.session.extendedThinking ? "ON" : "OFF"}`);
}

export function registerAll() {
  slashMenu.register("copy", copy, { description: "Copy transcript to clipboard" });
  slashMenu.register("debug", debug, { description: "Show runtime debug metrics" });
  slashMenu.register("help", help, { description: "List all commands" });
  slashMenu.register("init", init, { description: "Initialize .code-intel project" });
  slashMenu.register("sessions", sessions, { description: "List/switch sessions" });
  slashMenu.register("skills", skills, { description: "List/invoke skills" });
  slashMenu.register("status", status, { description: "Show status panel" });
  slashMenu.register("thinking", thinking, { description: "Toggle extended thinking" });
}
