import { CommandContext } from "./context";

export type Handler = (ctx: CommandContext, args: string[]) => Promise<void> | void;

interface CommandMeta {
  description: string;
  shortcut?: string;
}

class SlashMenuController {
  private registry = new Map<string, { handler: Handler; meta: CommandMeta }>();

  register(name: string, handler: Handler, meta: CommandMeta) {
    this.registry.set(name, { handler, meta });
  }

  list() {
    return [...this.registry.entries()].map(([name, { meta }]) => ({ name, ...meta }));
  }

  async route(name: string, ctx: CommandContext, args: string[]) {
    const entry = this.registry.get(name);
    if (!entry) {
      console.log("Unknown command, try /help");
      return;
    }
    await entry.handler(ctx, args);
  }
}

export const slashMenu = new SlashMenuController();
