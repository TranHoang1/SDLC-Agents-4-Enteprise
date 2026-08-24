# Technical Design Document (TDD)

## SDLC-Agents-4-Enterprise — SA4E-192: Slash Commands (Tier 2)

| Jira Ticket | SA4E-192 |
|-------------|----------|
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-08-22 |
| Related FSD | fsd/SA4E-192/FSD.md |

---

## 1. Architecture
- **SlashMenuController**: central registry mapping command name → handler function. On startup, each Tier-2 command calls `register(command, handler, meta)`.
- **CommandContext**: passed to handlers, exposes `session`, `runtime` (tools/hooks/agents/steering registries), `clipboard`, `skillsDir`.

## 2. Component Design

### 2.1 SlashMenuController (extend)
```ts
type Handler = (ctx: CommandContext, args: string[]) => Promise<void> | void;
register(name: string, handler: Handler, meta: { description: string; shortcut?: string }): void
```

### 2.2 Handlers
| Command | Handler | Key dependencies |
|---------|---------|------------------|
| /copy | copyTranscript(ctx) | ctx.session.messages, ctx.clipboard |
| /debug | showDebug(ctx) | ctx.runtime.metrics |
| /help | listCommands(ctx) | SlashMenuController.registry |
| /init | initProject(ctx) | fs, skillsDir template |
| /sessions | sessionMenu(ctx, args) | ctx.runtime.sessionManager |
| /skills | skillsMenu(ctx, args) | ctx.skillsDir, invoke() |
| /status | statusPanel(ctx) | ctx.runtime counts |
| /thinking | toggleThinking(ctx) | ctx.session.extendedThinking |

## 3. Security Design
- All `args` are treated as data, never concatenated into shell commands.
- `/skills <name>` invokes only whitelisted skills from `.code-intel/skills/`.
- `/copy` redacts obvious secrets (api keys, tokens) before clipboard write? (Optional, logged as risk). Default: confirm before copy.
- `/init` writes only known template files; no arbitrary path traversal.

## 4. Sequence (example: /copy)
1. User types `/copy`.
2. SlashMenuController routes to copyTranscript.
3. Handler serializes `ctx.session.messages` → Markdown.
4. Calls `ctx.clipboard.write(markdown)`.
5. Renders confirmation.

## 5. Testability
- Handlers are pure functions of `CommandContext` → easy unit test with mocked ctx.
- Registry allows introspection for `/help` tests.

## 6. File Layout (proposed)
```
src/slash/
  controller.ts        # SlashMenuController
  commands/
    copy.ts
    debug.ts
    help.ts
    init.ts
    sessions.ts
    skills.ts
    status.ts
    thinking.ts
  context.ts           # CommandContext type
```
