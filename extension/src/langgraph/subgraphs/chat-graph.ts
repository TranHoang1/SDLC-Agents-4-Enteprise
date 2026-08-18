/**
 * Chat Subgraph — ReAct Agent Loop with Full MCP Tool Calling
 * Flow: __start__ -> fetch_tools -> agent_step -> [route]
 *   - tool_use -> execute_tools -> [route] -> agent_step (loop) or synthesize
 *   - text -> verify_response -> [COMPLETE] -> __end__
 *                              -> [INCOMPLETE] -> agent_step (retry)
 *                              -> [TOOL_NEEDED] -> execute_tools
 */

import * as fs from "fs";
import * as path from "path";
import { StateGraph, END } from "@langchain/langgraph";
import { PipelineAnnotation, PipelineState } from "../core/state";
import { StreamHandler } from "../core/stream-handler";
import { McpBridge } from "../core/mcp-bridge";
import { ToolRegistry } from "../vscode/tool-registry";
import type { LlmProvider } from "../core/llm-provider";
import { loadSteeringRules, injectSteering } from "../steering/steering-loader";
import { HookEngine } from "../hooks/hook-engine";
import { debugLog } from "../../debug-logger";
import {
  createFetchToolsNode, createAgentStepNode,
  createExecuteToolsNode, createSynthesizeNode,
} from "./chat-graph-nodes";
import { createVerifyResponseNode, routeAfterVerify } from "./verify-node";
import {
  createRetrieveEvaluatorNode, createHallucinationGraderNode,
  routeAfterHallucinationGrade, getDefaultRagGraderConfig,
} from "./rag-grader-nodes";
import type { ToolApprovalGate } from "../../chat/engine/ToolApprovalGate";

const MAX_AGENT_ITERATIONS = 12;

const AGENT_SYSTEM_PROMPT = `You are a coding assistant with access to workspace tools. You can read files, search code, and list directories.

## PROJECT OVERVIEW:
- **SDLC-Agents-4-Enterprise** — multi-agent SDLC pipeline (agents: SM, BA, TA, SA, QA, DEV, DevOps, Security, UI).
- **Backend** (backend/): TypeScript + Hono + MCP SDK. Storage: SQLite (better-sqlite3) / PostgreSQL (pg). Local embeddings (ONNX Runtime + Xenova Transformers). Zod validation, Pino logging.
- **Extension** (extension/): VS Code/Kiro extension — TypeScript + LangGraph/LangChain orchestration, MCP SDK client, WebSocket (ws) / undici. Webview UI: Svelte 4 + Vite + TypeScript.
- **Orchestration**: LangGraph workflows (TypeScript) drive the pipeline; Python FastAPI servers (backend/servers/fastapi) provide presentation-generation MCP services.
- Use draw.io for diagrams (NEVER Mermaid).

## CRITICAL RULES:
1. When user asks about code/files in the project: use tools (list_directory, read_file) to find and read them BEFORE answering
2. NEVER say "please provide a file path" — use list_directory and read_file yourself
3. When user asks about code: call list_directory to find files, then read_file to read them
4. When user asks to review code: read the code first, THEN give your review
5. After list_directory results: IMMEDIATELY call read_file on source files you found. Do NOT respond with text asking for clarification.
6. NEVER finish a task by asking the user "which file should I look at" or "what do you want me to review". You must always pick files and read them yourself.
7. For general questions (concepts, explanations, your capabilities, tool list): answer directly WITHOUT calling tools. Not every question requires file reading.

## ANSWERING "WHAT DOES THIS PROJECT DO / BUSINESS / ARCHITECTURE":
If the user asks what the project does, its business purpose, or its architecture, you MUST read the key overview files BEFORE answering:
- read_file(path="README.md")
- read_file(path="AGENTS.md") if it exists
- read_file(path="package.json") at root, then read_file(path="backend/package.json") and/or read_file(path="extension/package.json")
- read_file on the main entry point(s): backend/src/index.ts or backend/src/server/HttpServer.ts, and extension/src/extension.ts
- read_file on backend/src/modules/ directory listing to see business modules
Then synthesize: what the system does (business), how it is structured (architecture), and key tech stack — with evidence from the files you read. Do NOT just restate directory names.

## AVAILABLE TOOLS:
- list_directory: List files in a directory (use path="." for project root, then drill into "backend" or "extension")
- read_file: Read file content by path
- write_file: Write/create files (path + content)
- search_text: Search for text patterns across files
- get_diagnostics: Check for errors in files
- Plus any MCP tools provided by connected MCP servers (mem_search, mem_ingest, find_tools, code_search, jira_*, drawio_*, export_docx, etc.)

## ANSWERING "WHAT TOOLS DO YOU HAVE / MCP TOOLS":
If the user asks what tools you have, what MCP tools are available, or your capabilities:
- DO NOT search the filesystem for tool definitions
- Instead, list the tools you can see in your current tool definitions (passed to you by the system)
- Categorize them: File tools, Search tools, Memory/KB tools, Jira tools, Doc tools, Code tools, etc.
- If you cannot see any MCP tools in your definitions, say: "I currently have workspace file tools (read, write, list, search). MCP tools may be available if the MCP server is connected."

## IMPORTANT: THIS IS A MONOREPO — there is NO "src" folder at the root.
Source code lives under "backend" (backend/src/) and "extension" (extension/src/).
NEVER call list_directory(path="src") — it is empty. Always explore "backend" and "extension".

## WORKFLOW:
1. User asks question → call list_directory(path=".") to see TOP-LEVEL only
2. See folder names (backend/, extension/, .kiro/, etc.) → call list_directory(path="backend") or list_directory(path="extension")
3. See src/ inside backend or extension → call list_directory(path="backend/src") or list_directory(path="extension/src")
4. See files → call read_file with start_line/end_line for RELEVANT SECTION ONLY
5. Have enough info → synthesize response
6. NEVER read entire large files. Use line ranges: read_file(path="x", start_line=1, end_line=80)
7. You CAN call tools multiple times — each call gives you more context

## AFTER list_directory: WHAT TO DO NEXT
- See "backend" or "extension" folder? → drill in with list_directory(path="backend/src") / list_directory(path="extension/src")
- See entry point (index.ts, main.ts, extension.ts, app.ts)? → read_file on it
- See specific .ts/.js/.kt/.py files? → read_file on 2-3 most important ones
- Not sure which file? → grep_search for "export" or "class" to find key modules
- NEVER say "which file do you want me to review" — just pick the main source files

## RESPONSE STYLE:
- Keep responses concise (5-15 sentences)
- Use bullet points
- Respond in same language as user
- After reading code: give specific feedback with line references`;

/**
 * SA4E-85 v3.1: Load agent instruction bodies from all .md files in
 * .code-intel/agents/ (no front-matter — use full body).
 * Returns concatenated instruction block for system prompt.
 */
function loadAgentInstructions(workspaceRoot: string): string {
  const agentsDir = path.join(workspaceRoot, ".code-intel", "agents");

  let mdFiles: string[] = [];
  try {
    mdFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith(".md")).map(f => path.join(agentsDir, f));
  } catch (err) { console.debug('[chat-graph] ignore :', (err as Error).message); }

  if (mdFiles.length === 0) return "";

  const instructions: string[] = [];
  for (const file of mdFiles) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const afterFm = content.replace(/^---[\s\S]*?---\r?\n?/, "").trim();
      const name = path.basename(file, ".md");
      instructions.push(`### Agent: ${name}\n\n${afterFm}`);
    } catch (err) { console.debug('[chat-graph] skip unreadable :', (err as Error).message); }
  }
  // Budget: limit to ~6000 chars
  let block = "";
  for (const ins of instructions) {
    if (block.length + ins.length > 6000) break;
    block += "\n\n---\n\n" + ins;
  }
  return block;
}

/**
 * SA4E-174: Direct routing for large models — skip verify node entirely.
 * Text response → END, tool calls → execute_tools.
 */
function routeAgentStepDirect(state: PipelineState): string {
  if (state.pipelineStatus === "failed") {
    debugLog(`[graph] routeAgentStepDirect: pipeline FAILED -> __end__`);
    return "__end__";
  }
  if (state.toolCalls && state.toolCalls.length > 0) {
    debugLog(`[graph] routeAgentStepDirect: ${state.toolCalls.length} toolCalls -> execute_tools`);
    return "execute_tools";
  }
  debugLog(`[graph] routeAgentStepDirect: text response -> __end__ (large model, no verify)`);
  return "__end__";
}

function routeAgentStep(state: PipelineState): string {
  // Circuit breaker: if pipeline already failed (e.g., LLM crash/context exceeded), stop immediately
  if (state.pipelineStatus === "failed") {
    debugLog(`[graph] routeAgentStep: pipeline FAILED -> verify_response (will route to __end__)`);
    return "verify_response";
  }
  if (state.toolCalls && state.toolCalls.length > 0) {
    debugLog(`[graph] routeAgentStep: ${state.toolCalls.length} toolCalls -> execute_tools`);
    return "execute_tools";
  }
  debugLog(`[graph] routeAgentStep: text response -> verify_response`);
  return "verify_response";
}

function routeAfterToolExec(state: PipelineState): string {
  // Stop if pipeline failed (LLM crash during tool execution cycle)
  if (state.pipelineStatus === "failed") return "synthesize";
  if ((state.agentIterations || 0) >= MAX_AGENT_ITERATIONS) return "synthesize";
  return "agent_step";
}

export async function buildChatSubgraph(
  streamHandler: StreamHandler,
  llmProvider?: LlmProvider,
  mcpBridge?: McpBridge,
  workspaceRoot?: string,
  hookEngine?: HookEngine,
  approvalGate?: ToolApprovalGate
) {
  const toolRegistry = mcpBridge ? new ToolRegistry(mcpBridge) : null;
  const wsRoot = workspaceRoot || require("vscode").workspace.workspaceFolders?.[0]?.uri.fsPath || "";

  const contextWindow = llmProvider?.getContextWindow?.() || 0;
  if (contextWindow > 0) {
    debugLog(`[chat-graph] Context window detected: ${contextWindow} tokens`);
  }

  let enrichedSystemPrompt = AGENT_SYSTEM_PROMPT;
  try {
    if (wsRoot) {
      const rules = await loadSteeringRules(wsRoot, "langgraph");
      enrichedSystemPrompt = injectSteering(enrichedSystemPrompt, rules);
      if (rules.length > 0 && streamHandler) {
        const ruleNames = rules.map(r => r.meta.title || r.filePath).join(", ");
        streamHandler.emitDirect({
          type: "chat:toolCall",
          toolCall: {
            id: `steering-${Date.now()}`, name: "steering_rules_loaded",
            args: { count: rules.length, rules: ruleNames.slice(0, 200) },
            status: "completed", result: `${rules.length} steering rules injected`, duration: 0,
          },
        } as any);
      }
    }
  } catch (err) {
    console.debug(`[chat-graph] steering injection failed (non-fatal): ${(err as Error).message}`);
  }

  // SA4E-85 v3.1: Load agent instructions from .code-intel/agents/*.md
  const agentInstructions = loadAgentInstructions(wsRoot);
  if (agentInstructions) {
    enrichedSystemPrompt = `${enrichedSystemPrompt}\n\n# Agent Instructions\n${agentInstructions}`;
  }

  // SA4E-85 v3.1: Factory-supplied function that builds final LLM-ready system prompt
  // from base + steering + KB context + user prompt (kbContext from state).
  function buildFinalSystemPrompt(state: PipelineState): string {
    if (state.kbContext) {
      return `${enrichedSystemPrompt}\n\n---\n${state.kbContext}\n---`;
    }
    return enrichedSystemPrompt;
  }

  const verifyNode = createVerifyResponseNode(llmProvider, streamHandler);

  // Create a budget-injecting fetch_tools node that also sets maxContextTokens
  const fetchToolsBase = createFetchToolsNode(toolRegistry);
  const fetchToolsWithBudget = async (state: PipelineState) => {
    const baseResult = await fetchToolsBase(state);
    // Inject context budget into state if provider reports it
    if (contextWindow > 0 && !state.maxContextTokens) {
      return { ...baseResult, maxContextTokens: contextWindow };
    }
    return baseResult;
  };

  // RAG grading config — enabled for small models only
  const ragConfig = getDefaultRagGraderConfig(contextWindow);
  if (ragConfig.enableHallucinationGrade) {
    debugLog(`[chat-graph] Corrective RAG enabled (contextWindow=${contextWindow}): retrieve-eval + hallucination-grader`);
  }

  if (ragConfig.enableHallucinationGrade) {
    // Graph with Corrective RAG nodes for small models
    const graph = new StateGraph(PipelineAnnotation)
      .addNode("fetch_tools", fetchToolsWithBudget)
      .addNode("agent_step", createAgentStepNode(llmProvider, streamHandler, buildFinalSystemPrompt))
      .addNode("execute_tools", createExecuteToolsNode(mcpBridge, streamHandler, hookEngine, wsRoot, approvalGate))
      .addNode("verify_response", verifyNode)
      .addNode("synthesize", createSynthesizeNode(llmProvider, streamHandler, buildFinalSystemPrompt))
      .addNode("hallucination_grader", createHallucinationGraderNode(llmProvider, streamHandler, ragConfig))
      .addEdge("__start__", "fetch_tools")
      .addEdge("fetch_tools", "agent_step")
      .addConditionalEdges("agent_step", routeAgentStep, { execute_tools: "execute_tools", verify_response: "verify_response" })
      .addConditionalEdges("execute_tools", routeAfterToolExec, { agent_step: "agent_step", synthesize: "synthesize" })
      .addConditionalEdges("verify_response", routeAfterVerify, { execute_tools: "execute_tools", agent_step: "agent_step", __end__: "hallucination_grader" })
      .addConditionalEdges("hallucination_grader", routeAfterHallucinationGrade, { agent_step: "agent_step", __end__: END })
      .addEdge("synthesize", END);

    return graph.compile();
  }

  // Standard graph without RAG grading (large models)
  const graph = new StateGraph(PipelineAnnotation)
    .addNode("fetch_tools", fetchToolsWithBudget)
    .addNode("agent_step", createAgentStepNode(llmProvider, streamHandler, buildFinalSystemPrompt))
    .addNode("execute_tools", createExecuteToolsNode(mcpBridge, streamHandler, hookEngine, wsRoot, approvalGate))
    .addNode("verify_response", verifyNode)
    .addNode("synthesize", createSynthesizeNode(llmProvider, streamHandler, buildFinalSystemPrompt))
    .addEdge("__start__", "fetch_tools")
    .addEdge("fetch_tools", "agent_step")
    .addConditionalEdges("agent_step", routeAgentStep, { execute_tools: "execute_tools", verify_response: "verify_response" })
    .addConditionalEdges("verify_response", routeAfterVerify, { execute_tools: "execute_tools", agent_step: "agent_step", __end__: END })
    .addConditionalEdges("execute_tools", routeAfterToolExec, { agent_step: "agent_step", synthesize: "synthesize" })
    .addEdge("synthesize", END);

  return graph.compile();
}
