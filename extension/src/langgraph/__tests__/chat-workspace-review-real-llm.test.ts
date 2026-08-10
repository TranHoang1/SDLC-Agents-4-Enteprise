/**
 * Real-Workspace + Real-LLM Workspace Review Test.
 * Runs the actual chat subgraph against the REAL workspace root with a REAL LLM
 * (OpenAI-compatible /chat/completions). The vscode.fs mock reads real files,
 * so list_directory / read_file tool results contain the true project content.
 *
 * Config:
 *   LLM_API_BASE (default http://localhost:1234/v1)
 *   LLM_MODEL    (default empty → server picks)
 *
 * Run: npx vitest run src/langgraph/__tests__/chat-workspace-review-real-llm.test.ts
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const API_BASE = (process.env.LLM_API_BASE || "http://localhost:1234/v1").replace(/\/$/, "");
const MODEL = process.env.LLM_MODEL || "";

// Workspace under review = the real repo root (extension/src/langgraph/__tests__ → repo root)
const WORKSPACE_ROOT = path.resolve(__dirname, "../../../..");

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
import type { LlmMessage, LlmOptions, LlmResponse, LlmProvider, LlmToolCall } from "../core/llm-provider";
import type { McpToolDefinition } from "../vscode/tool-registry";

function formatToolsForOpenAI(tools: McpToolDefinition[]) {
  return tools.map(t => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: (t.inputSchema || { type: "object", properties: {} }) },
  }));
}

function buildRealProvider() {
  async function callLLM(messages: any[], tools: McpToolDefinition[]): Promise<any> {
    const body: any = {
      model: MODEL,
      messages,
      max_tokens: 4096,
      temperature: 0.4,
    };
    if (tools.length > 0) { body.tools = formatToolsForOpenAI(tools); body.tool_choice = "auto"; }
    const res = await fetch(`${API_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`LLM API ${res.status}: ${txt.slice(0, 300)}`);
    }
    return (await res.json()) as any;
  }

  function toLlmResponse(data: any): LlmResponse {
    const msg = data.choices?.[0]?.message;
    const toolCalls: LlmToolCall[] = (msg?.tool_calls || []).map((tc: any) => ({
      id: tc.id,
      name: tc.function?.name || "",
      arguments: (() => { try { return JSON.parse(tc.function?.arguments || "{}"); } catch { return {}; } })(),
    }));
    if (toolCalls.length > 0) return { type: "tool_use", toolCalls };
    return { type: "text", text: msg?.content || "" };
  }

  function toOpenAiMessages(messages: LlmMessage[]): any[] {
    return messages.map(m => {
      if (m.role === "tool") {
        return { role: "tool", tool_call_id: m.toolCallId || "unknown", content: m.content };
      }
      if (m.role === "assistant" && (m as any).toolCalls) {
        return {
          role: "assistant",
          content: null,
          tool_calls: (m as any).toolCalls.map((tc: any) => ({
            id: tc.id, type: "function",
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
          })),
        };
      }
      return { role: m.role, content: m.content };
    });
  }

  const provider: LlmProvider = {
    type: "openai",
    async chat(messages: LlmMessage[], _opts?: LlmOptions): Promise<string> {
      const data = await callLLM(toOpenAiMessages(messages), []);
      return data.choices?.[0]?.message?.content || "";
    },
    async *chatStream(): AsyncGenerator<string> { return; },
    async isAvailable(): Promise<boolean> {
      try {
        const res = await fetch(`${API_BASE}/models`, { signal: AbortSignal.timeout(5000) });
        return res.ok;
      } catch { return false; }
    },
    getContextWindow(): number { return 64000; },
    dispose(): void {},
    async chatWithTools(messages: LlmMessage[], tools: McpToolDefinition[], _opts?: LlmOptions): Promise<LlmResponse> {
      const data = await callLLM(toOpenAiMessages(messages), tools);
      return toLlmResponse(data);
    },
  };
  return provider;
}

function captureHandler() {
  const emitted: any[] = [];
  const handler = new StreamHandler((msg) => emitted.push(msg));
  return { handler, emitted };
}

describe("chat-graph real-LLM review on real workspace", () => {
  it("reviews the actual repository via tools and real LLM", async () => {
    const available = await buildRealProvider().isAvailable();
    console.log(`\nLLM API ${API_BASE} reachable: ${available}${available ? "" : " — SKIPPING (start server first)"}`);
    if (!available) {
      console.log("No LLM server detected — not asserting real review. Fix: run LM Studio / your OpenAI-compatible server.");
      expect(true).toBe(true);
      return;
    }

    const { handler, emitted } = captureHandler();
    const provider = buildRealProvider();
    const graph = await buildChatSubgraph(handler, provider, undefined, WORKSPACE_ROOT);

    const finalState = await graph.invoke({
      currentStreamId: "stream-real-ws-1",
      chatHistory: [{
        role: "user",
        content: "Hãy review workspace thực tế này. YÊU CẦU BẮT BUỘC: trước khi trả lời, bạn PHẢI gọi read_file để đọc ít nhất 4-6 file quan trọng (ví dụ package.json, backend/src/index.ts hoặc backend/src/server/HttpServer.ts, extension/package.json, extension/src/extension.ts nếu tồn tại, README.md, một vài module trong backend/src/modules/). KHÔNG được trả lời text khi chưa đọc xong. Hãy gọi list_directory sâu (path=\"backend\" hoặc path=\"extension\") để tìm file, rồi gọi read_file từng file. Cuối cùng tổng hợp: stack công nghệ thực tế, cấu trúc thư mục, và vấn đề đáng chú ý có bằng chứng trong code.",
        timestamp: new Date().toISOString(),
      }],
    } as any);

    const outputs = (finalState as any).agentOutputs || [];
    const answer = outputs[0]?.content || "";
    console.log(`\n=== REAL LLM WORKSPACE REVIEW ANSWER (len=${answer.length}) ===\n${answer}\n=== END ===`);

    console.log("\n=== TOOL CALLS EXECUTED ===");
    const callEvents = emitted.filter((m) => m.type === "chat:toolCall");
    const updateEvents = emitted.filter((m) => m.type === "chat:toolCallUpdate");
    const seen = new Set<string>();
    for (const ev of callEvents) {
      const tc = ev.toolCall || {};
      if (seen.has(tc.id)) continue;
      seen.add(tc.id);
      const upd = updateEvents.find((u: any) => u.id === tc.id);
      const result = String(upd?.result || tc.result || "").slice(0, 120);
      console.log(`- ${tc.id} ${tc.name}(${JSON.stringify(tc.args || {}).slice(0, 80)}) -> ${result}`);
    }

    expect(answer.length).toBeGreaterThan(10);
  }, 600_000);
});
