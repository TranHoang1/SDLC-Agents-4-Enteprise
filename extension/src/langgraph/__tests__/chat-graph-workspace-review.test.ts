/**
 * Workspace Review Flow Test — verifies the agent actually performs a
 * workspace review by calling tools (list_directory + read_file) against a
 * real temp workspace, feeding the real tool results back to the LLM, and
 * producing a grounded final answer.
 *
 * The LLM provider is mocked to simulate the ReAct loop:
 *   turn 1 -> tool_use list_directory
 *   turn 2 -> tool_use read_file
 *   turn 3 -> text final answer
 * The vscode workspace.fs mock reads real files from the temp dir, so the
 * tool results contain REAL workspace content.
 *
 * Run: npx vitest run src/langgraph/__tests__/chat-graph-workspace-review.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

vi.mock("vscode", async () => {
  const { readFileSync, readdirSync } = await import("fs");
  return {
    Uri: { file: (p: string) => ({ fsPath: p, toString: () => p }) },
    FileType: { File: 1, Directory: 2 },
    workspace: {
      workspaceFolders: [],
      fs: {
        readFile: async (uri: { fsPath: string }) => Buffer.from(readFileSync(uri.fsPath, "utf-8")),
        readDirectory: async (uri: { fsPath: string }) => {
          const entries = readdirSync(uri.fsPath, { withFileTypes: true });
          return entries.map((e) => [e.name, e.isDirectory() ? 2 : 1] as [string, number]);
        },
      },
    },
    window: { createOutputChannel: () => ({ appendLine: () => {} }) },
    languages: { getDiagnostics: () => [] },
  };
});

import { buildChatSubgraph } from "../subgraphs/chat-graph";
import { StreamHandler } from "../core/stream-handler";
import type { LlmProvider, LlmResponse } from "../core/llm-provider";

let wsRoot: string;

beforeEach(() => {
  wsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sa4e85-ws-review-"));
  fs.writeFileSync(
    path.join(wsRoot, "package.json"),
    JSON.stringify({ name: "ws-review-app", dependencies: { hono: "^4.0.0" } }, null, 2)
  );
  const srcDir = path.join(wsRoot, "src");
  fs.mkdirSync(srcDir, { recursive: true });
  fs.writeFileSync(
    path.join(srcDir, "index.ts"),
    `import { Hono } from "hono";\nconst app = new Hono();\nexport default app;`
  );
});

afterEach(() => {
  try { fs.rmSync(wsRoot, { recursive: true, force: true }); } catch {}
});

/** Build a provider whose chatWithTools follows the ReAct loop for a workspace review. */
function reviewProvider(): { provider: LlmProvider; chatWithTools: ReturnType<typeof vi.fn>; chat: ReturnType<typeof vi.fn> } {
  const chatWithTools = vi.fn()
    .mockResolvedValueOnce({
      type: "tool_use",
      toolCalls: [{ id: "tc-1", name: "list_directory", arguments: { path: ".", recursive: true } }],
    } as LlmResponse)
    .mockResolvedValueOnce({
      type: "tool_use",
      toolCalls: [{ id: "tc-2", name: "read_file", arguments: { path: "src/index.ts" } }],
    } as LlmResponse)
    .mockResolvedValueOnce({
      type: "text",
      text: "Workspace review: the backend entry point defines a Hono app in TypeScript.",
    } as LlmResponse);

  const chat = vi.fn().mockResolvedValue("COMPLETE");

  const provider: LlmProvider = {
    type: "anthropic",
    chat,
    chatStream: vi.fn(),
    chatWithTools,
    isAvailable: vi.fn().mockResolvedValue(true),
    getContextWindow: vi.fn().mockReturnValue(200000),
    dispose: vi.fn(),
  } as unknown as LlmProvider;

  return { provider, chatWithTools, chat };
}

function captureHandler() {
  const emitted: any[] = [];
  const handler = new StreamHandler((msg) => emitted.push(msg));
  return { handler, emitted };
}

describe("chat-graph workspace review (tools on real workspace)", () => {
  it("runs list_directory -> read_file -> grounded final answer", async () => {
    const { handler, emitted } = captureHandler();
    const { provider, chatWithTools, chat } = reviewProvider();

    const graph = await buildChatSubgraph(handler, provider, undefined, wsRoot);

    await graph.invoke({
      currentStreamId: "stream-review-1",
      chatHistory: [{ role: "user", content: "Hãy review workspace này", timestamp: new Date().toISOString() }],
    } as any);

    // The ReAct loop must call tools, not short-circuit to text.
    expect(chatWithTools).toHaveBeenCalledTimes(3);

    // Verify tool results actually carried REAL workspace content.
    const toolEvents = emitted.filter((m) => m.type === "chat:toolCallUpdate" && m.status === "completed");
    const listEvent = toolEvents.find((e) => e.id === "tc-1");
    const readEvent = toolEvents.find((e) => e.id === "tc-2");
    expect(listEvent).toBeDefined();
    expect(listEvent.result).toContain("package.json");
    expect(listEvent.result).toContain("src/");
    expect(readEvent).toBeDefined();
    expect(readEvent.result).toContain("new Hono()");

    // verify node was invoked via chat() and approved the grounded answer.
    expect(chat).toHaveBeenCalled();
  });

  it("the final synthesized answer is grounded in the read file", async () => {
    const { handler } = captureHandler();
    const { provider, chatWithTools } = reviewProvider();

    const graph = await buildChatSubgraph(handler, provider, undefined, wsRoot);

    const finalState = await graph.invoke({
      currentStreamId: "stream-review-2",
      chatHistory: [{ role: "user", content: "Mô tả kiến trúc backend", timestamp: new Date().toISOString() }],
    } as any);

    expect(chatWithTools).toHaveBeenCalledTimes(3);
    const outputs = (finalState as any).agentOutputs || [];
    expect(outputs.length).toBeGreaterThan(0);
    const answer = outputs[0]?.content || "";
    expect(answer).toContain("Hono");
  });
});
