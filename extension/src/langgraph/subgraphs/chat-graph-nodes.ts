/**
 * Chat Graph Node Implementations — extracted from chat-graph.ts
 * Contains fetch_tools, agent_step, execute_tools, and synthesize node logic.
 */

import { PipelineState } from "../core/state";
import { StreamHandler } from "../core/stream-handler";
import { McpBridge } from "../core/mcp-bridge";
import { ToolRegistry } from "../vscode/tool-registry";
import type { McpToolDefinition } from "../vscode/tool-registry";
import type { LlmProvider, LlmMessage } from "../core/llm-provider";
import { VSCODE_TOOL_DEFINITIONS, isVscodeTool, executeVscodeTool } from "../vscode/vscode-tools";
import { HookEngine } from "../hooks/hook-engine";
import { debugLog, debugError } from "../../debug-logger";
import { buildBudgetAwareMessages, estimateMessagesTokens, getDynamicToolResultLimits } from "../core/context-budget";
import { requiresApproval } from "../../chat/engine/ToolApprovalClassifier";
import type { ToolApprovalGate } from "../../chat/engine/ToolApprovalGate";
import type { CommandPatternMatcher } from "../../chat/engine/CommandPatternMatcher";
import type { ActiveAgentConfig } from "../agents/agent-config-resolver";
import { filterTools, isToolAllowed, buildToolBlockedMessage } from "../agents/tool-filter";
import type { DiagnosticsFeedService } from "../diagnostics/diagnostics-feed-service";
import type { IDiffTracker } from "../../chat/diff/IDiffTracker";
import { DIFF_TRACKED_TOOLS, computeUnifiedDiff, countDiffLines, isSensitiveFile } from "../../chat/diff/diff-utils";
import { captureFileMatchSteering } from "../steering/post-tool-use";
import type { ActiveSteeringRule } from "../steering/frontmatter";
import * as vscode from "vscode";
import * as path from "path";

const LLM_CALL_TIMEOUT_MS = 300_000;

export function buildMessages(state: PipelineState, tools: McpToolDefinition[], systemPrompt: string): LlmMessage[] {
  const contextBudget = state.maxContextTokens || 0;

  // If no budget set (0), use original unbounded behavior
  if (contextBudget <= 0) {
    return buildMessagesUnbounded(state, tools, systemPrompt);
  }

  // Budget-aware path
  let toolNudge: LlmMessage | undefined;
  if ((!state.agentScratchpad || state.agentScratchpad.length === 0) && tools.length > 0) {
    const lastUser = (state.chatHistory || []).filter(m => m.role === "user").pop();
    if (lastUser && looksLikeCodeRequest(lastUser.content)) {
      toolNudge = {
        role: "system",
        content: "You MUST call a tool now. Start with list_directory path=\".\" to see the project structure, then read relevant files. Do NOT respond with text yet.",
      };
    }
  }

  const result = buildBudgetAwareMessages(
    systemPrompt,
    state.chatHistory || [],
    state.agentScratchpad || [],
    tools,
    contextBudget,
    toolNudge,
  );

  return result.messages;
}

/** Original unbounded buildMessages for providers with large/unknown context windows. */
function buildMessagesUnbounded(state: PipelineState, tools: McpToolDefinition[], systemPrompt: string): LlmMessage[] {
  const messages: LlmMessage[] = [{ role: "system", content: systemPrompt }];
  for (const msg of (state.chatHistory || [])) {
    if (msg.role === "user" || msg.role === "assistant") {
      messages.push({ role: msg.role, content: msg.content });
    }
  }
  for (const m of (state.agentScratchpad || [])) { messages.push(m); }

  // If first iteration (no scratchpad) and tools available, nudge model to use tools
  if ((!state.agentScratchpad || state.agentScratchpad.length === 0) && tools.length > 0) {
    const lastUser = messages.filter(m => m.role === "user").pop();
    if (lastUser && looksLikeCodeRequest(lastUser.content)) {
      messages.push({
        role: "system",
        content: "You MUST call a tool now. Start with list_directory path=\".\" to see the project structure, then read relevant files. Do NOT respond with text yet.",
      });
    }
  }

  return messages;
}

/**
 * Determine if user input explicitly requests code/file inspection.
 * STRICT matching — only trigger when user clearly wants to read/review code files.
 * Generic questions (e.g., "review this idea", "xem lại concept") should NOT trigger.
 */
function looksLikeCodeRequest(text: string): boolean {
  const lower = text.toLowerCase();

  // Must contain a code-related keyword AND a file/path-like reference or action verb
  const codeActionPatterns = [
    /\b(review|xem|đọc|kiểm tra|check|analyze|phân tích)\s+(code|file|source|module|function|class|component|endpoint)/,
    /\b(read|open|show|list)\s+(file|directory|folder|code)/,
    /\b(code|file|source)\s+(review|check|quality|standard)/,
    /\bsource\s*code\b/,
    /\b(src|backend|extension|module)\//,   // explicit path reference
    /\.\w{1,5}\b.*\b(review|check|xem|đọc)/, // file extension + action
    /\b(review|check|xem)\b.*\.\w{1,5}$/,    // action + file extension at end
  ];

  return codeActionPatterns.some(p => p.test(lower));
}

/**
 * Extract a shell command from user input when the user explicitly asks to execute it.
 * Returns the command string if detected, null otherwise.
 * Patterns: "thực hiện command ...", "run ...", "execute ...", "chạy ..."
 */
function extractExplicitShellCommand(text: string): string | null {
  const patterns = [
    // Vietnamese: "thực hiện command ..."
    /(?:thực hiện|chạy|thực thi|execute|run)\s+(?:command|cmd|lệnh)?\s*(.+)/i,
    // Direct command prefixes: curl, npm, git, python, node, etc.
    /^(curl\s+.+)/im,
    /^(npm\s+.+)/im,
    /^(git\s+.+)/im,
    /^(python[3]?\s+.+)/im,
    /^(node\s+.+)/im,
    /^(java\s+.+)/im,
    /^(docker\s+.+)/im,
    /^(pip\s+.+)/im,
    /^(cargo\s+.+)/im,
    /^(make\s+.+)/im,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1] && m[1].trim().length > 3) {
      return m[1].trim();
    }
  }
  return null;
}

export function createFetchToolsNode(toolRegistry: ToolRegistry | null) {
  return async (_state: PipelineState) => {
    let mcpTools: McpToolDefinition[] = [];
    if (toolRegistry) {
      try { mcpTools = await toolRegistry.getTools(); }
      catch (err) { console.debug(`[chat-graph-nodes] getTools failed (non-fatal): ${(err as Error).message}`); mcpTools = []; }
    }
    const allTools = [...VSCODE_TOOL_DEFINITIONS, ...mcpTools];
    debugLog(`[graph] fetch_tools: ${allTools.length} total tools: ${allTools.map(t => t.name).join(', ')}`);
    return { parallelResults: { toolsJson: JSON.stringify(allTools) }, lastUpdatedAt: new Date().toISOString() };
  };
}

export function createAgentStepNode(
  llmProvider: LlmProvider | undefined, streamHandler: StreamHandler,
  getSystemPrompt: (state: PipelineState) => string,
  getAgentConfig?: () => ActiveAgentConfig | null,
) {
  return async (state: PipelineState) => {
    if (!llmProvider) {
      return {
        agentOutputs: [{ nodeId: "chat", content: "No LLM configured.", timestamp: new Date().toISOString() }],
        pipelineStatus: "completed" as const, toolCalls: null, lastUpdatedAt: new Date().toISOString(),
        diagnosticsContext: "",
      };
    }
    const sysPrompt = getSystemPrompt(state);
    const streamId = state.currentStreamId || `stream-chat-${Date.now()}`;
    let tools: McpToolDefinition[] = [];
    try { tools = JSON.parse(state.parallelResults?.toolsJson || "[]"); }
    catch (err) {
      console.debug(`[chat-graph-nodes] toolsJson parse failed (non-fatal): ${(err as Error).message}`);
      tools = [];
    }

    // SA4E-186/204: Filter tools based on active agent config
    const agentConfig = getAgentConfig?.() ?? null;
    if (agentConfig) {
      tools = filterTools(tools, agentConfig.toolPatterns);
    }
    // No agentConfig → allow all tools (default chat mode is unrestricted)

    // SA4E-186: Resolve model override for both tool and streaming paths
    const llmOptions = agentConfig?.model ? { model: agentConfig.model } : undefined;

    if (llmProvider.chatWithTools && tools.length > 0) {
      // KSA-290: Pass all available tools to LLM (large models handle 50+ tools fine).
      // For small models (context < 32k), limit to 15 most important tools.
      const contextWindow = state.maxContextTokens || 0;
      const toolLimit = contextWindow > 0 && contextWindow < 32000 ? 15 : tools.length;
      return await agentStepWithTools(state, llmProvider, streamHandler, streamId, tools.slice(0, toolLimit), sysPrompt, llmOptions);
    }
    return await agentStepStreaming(state, llmProvider, streamHandler, streamId, sysPrompt, tools, llmOptions);
  };
}

async function agentStepWithTools(
  state: PipelineState, llm: LlmProvider, sh: StreamHandler,
  streamId: string, tools: McpToolDefinition[], sysPrompt: string,
  llmOptions?: { model?: string }
) {
  try {
    const messages = buildMessages(state, tools, sysPrompt);

    // Log LLM request
    debugLog(`[LLM-REQ] iteration=${state.agentIterations || 0}, messages=${messages.length}, tools=${tools.length}${llmOptions?.model ? `, model=${llmOptions.model}` : ""}`);
    for (const m of messages) {
      const preview = m.content.slice(0, 150).replace(/\n/g, " ");
      debugLog(`  [${m.role}] ${preview}${m.content.length > 150 ? "..." : ""}`);
      if ((m as any).toolCalls) { debugLog(`  [assistant.toolCalls] ${JSON.stringify((m as any).toolCalls.map((tc: any) => tc.name))}`); }
    }

    const chatOptions = { maxTokens: 8192, ...(llmOptions?.model ? { model: llmOptions.model } : {}) };
    const llmPromise = llm.chatWithTools!(messages, tools, chatOptions);
    const timeoutPromise = new Promise<never>((_, rej) => { const t = setTimeout(() => rej(new Error("LLM timeout")), LLM_CALL_TIMEOUT_MS); if (t.unref) t.unref(); });
    const response = await Promise.race([llmPromise, timeoutPromise]);

    // Log LLM response
    if (response.type === "text") {
      debugLog(`[LLM-RES] type=text, length=${(response.text || "").length}`);
      debugLog(`  preview: ${(response.text || "").slice(0, 200).replace(/\n/g, " ")}`);

      // Small-model fallback: if user explicitly asked to run a command but model refused,
      // extract the command and force a tool call instead of returning refusal text.
      const lastUserMsg = (state.chatHistory || []).filter(m => m.role === "user").pop();
      if (lastUserMsg && (!state.agentScratchpad || state.agentScratchpad.length === 0)) {
        const extractedCmd = extractExplicitShellCommand(lastUserMsg.content);
        if (extractedCmd && tools.some(t => t.name === "execute_shell")) {
          debugLog(`[LLM-FALLBACK] Model refused tool call but user wants shell: "${extractedCmd.slice(0, 80)}"`);
          const syntheticCall = { id: `fallback-${Date.now()}`, name: "execute_shell", arguments: { command: extractedCmd } };
          const tcJson = JSON.stringify([{ type: "tool_use", id: syntheticCall.id, name: syntheticCall.name, input: syntheticCall.arguments }]);
          return { toolCalls: [syntheticCall], parallelResults: { lastToolCallsJson: tcJson }, lastUpdatedAt: new Date().toISOString(), diagnosticsContext: "" };
        }
      }

      sh.emitStatus("chat", "active", streamId);
      sh.emitToken("chat", response.text || "", streamId);
      sh.emitComplete("chat", 0, streamId);
      // NOTE: Do NOT set working=false here — verify may loop back. Engine handler sets it on graph completion.
      return { agentOutputs: [{ nodeId: "chat", content: response.text || "", timestamp: new Date().toISOString() }], pipelineStatus: "completed" as const, toolCalls: null, lastUpdatedAt: new Date().toISOString(), diagnosticsContext: "" };
    }
    debugLog(`[LLM-RES] type=tool_use, calls=${(response.toolCalls || []).map(tc => `${tc.name}(${JSON.stringify(tc.arguments).slice(0, 50)})`).join(", ")}`);
    const tcJson = JSON.stringify((response.toolCalls || []).map(tc => ({ type: "tool_use", id: tc.id, name: tc.name, input: tc.arguments })));
    return { toolCalls: response.toolCalls || null, parallelResults: { lastToolCallsJson: tcJson }, lastUpdatedAt: new Date().toISOString(), diagnosticsContext: "" };
  } catch (error) {
    const errMsg = (error as Error).message;
    debugLog(`[LLM-ERR] ${errMsg}`);
    sh.emitError("chat", errMsg, streamId);
    // Return a terminal error output so verify_response sees agentOutputs and routes to __end__
    // instead of looping back to agent_step infinitely when LLM server is down.
    const errorContent = `⚠️ LLM Error: ${errMsg}`;
    return {
      agentOutputs: [{ nodeId: "chat", content: errorContent, timestamp: new Date().toISOString() }],
      errors: [{ nodeId: "chat", code: "LLM_ERROR", message: errMsg, timestamp: new Date().toISOString(), recoverable: false }],
      pipelineStatus: "failed" as const,
      toolCalls: null,
      lastUpdatedAt: new Date().toISOString(),
      diagnosticsContext: "",
    };
  }
}

async function agentStepStreaming(
  state: PipelineState, llm: LlmProvider, sh: StreamHandler,
  streamId: string, sysPrompt: string, tools: McpToolDefinition[],
  llmOptions?: { model?: string }
) {
  sh.emitStatus("chat", "active", streamId);
  try {
    const messages = buildMessages(state, tools, sysPrompt);
    const chatOptions = { maxTokens: 8192, ...(llmOptions?.model ? { model: llmOptions.model } : {}) };
    let full = "";
    for await (const token of llm.chatStream(messages, chatOptions)) { full += token; sh.emitToken("chat", token, streamId); }
    sh.emitComplete("chat", 0, streamId);
    return { agentOutputs: [{ nodeId: "chat", content: full, timestamp: new Date().toISOString() }], pipelineStatus: "completed" as const, toolCalls: null, lastUpdatedAt: new Date().toISOString(), diagnosticsContext: "" };
  } catch (error) {
    const errMsg = (error as Error).message;
    sh.emitError("chat", errMsg, streamId);
    const errorContent = `⚠️ LLM Error: ${errMsg}`;
    return {
      agentOutputs: [{ nodeId: "chat", content: errorContent, timestamp: new Date().toISOString() }],
      errors: [{ nodeId: "chat", code: "LLM_ERROR", message: errMsg, timestamp: new Date().toISOString(), recoverable: false }],
      pipelineStatus: "failed" as const,
      toolCalls: null,
      lastUpdatedAt: new Date().toISOString(),
      diagnosticsContext: "",
    };
  }
}

export function createExecuteToolsNode(
  mcpBridge: McpBridge | undefined, sh: StreamHandler, hookEngine: HookEngine | undefined, wsRoot: string, approvalGate?: ToolApprovalGate,
  getAgentConfig?: () => ActiveAgentConfig | null,
  diagnosticsFeed?: DiagnosticsFeedService,
  commandPatternMatcher?: CommandPatternMatcher,
  diffTracker?: IDiffTracker
) {
  return async (state: PipelineState) => {
    const streamId = state.currentStreamId || `stream-chat-${Date.now()}`;
    const calls = state.toolCalls || [];
    const results: Array<SingleToolResult> = [];
    sh.emitComplete("chat", 0, streamId);

    // SA4E-186: Get active agent config for tool enforcement
    const agentConfig = getAgentConfig?.() ?? null;

    // SA4E-204: Parallel tool execution with feature toggle and max parallelism config
    const parallelEnabled = process.env.CHAT_PARALLEL_ENABLED !== 'false';
    const maxParallelism = parseInt(process.env.CHAT_MAX_PARALLELISM || '5', 10);
    if (parallelEnabled) {
      debugLog(`[execute_tools] SA4E-204 parallel batch dispatched: ${calls.length} calls, maxParallelism=${maxParallelism}`);
      const resultsArray = await Promise.all(
        calls.map(async (call) => {
          if (agentConfig && !isToolAllowed(call.name, agentConfig.toolPatterns)) {
            const agentId = agentConfig.agentId;
            const patterns = agentConfig.toolPatterns || [];
            const blockedMsg = buildToolBlockedMessage(call.name, agentId, patterns);
            return { toolCallId: call.id, name: call.name, content: blockedMsg };
          }
          return executeSingleTool(call, mcpBridge, sh, streamId, hookEngine, wsRoot, approvalGate, diagnosticsFeed, commandPatternMatcher, diffTracker);
        })
      );
      results.push(...resultsArray);
    } else {
      // Sequential fallback for backward compatibility
      for (const call of calls) {
        if (agentConfig && !isToolAllowed(call.name, agentConfig.toolPatterns)) {
          const agentId = agentConfig.agentId;
          const patterns = agentConfig.toolPatterns || [];
          const blockedMsg = buildToolBlockedMessage(call.name, agentId, patterns);
          results.push({ toolCallId: call.id, name: call.name, content: blockedMsg });
          continue;
        }
        const r = await executeSingleTool(call, mcpBridge, sh, streamId, hookEngine, wsRoot, approvalGate, diagnosticsFeed, commandPatternMatcher, diffTracker);
        results.push(r);
      }
    }

    const newEntries: LlmMessage[] = [
      { role: "assistant", content: "", toolCalls: calls.map(c => ({ id: c.id, name: c.name, arguments: c.arguments })) } as any,
    ];
    // Dynamic tool result sizing based on context budget
    const contextBudget = state.maxContextTokens || 0;
    const currentUsage = estimateMessagesTokens(state.agentScratchpad || []);
    const { dirLimit, fileLimit } = getDynamicToolResultLimits(contextBudget, currentUsage);

    for (const r of results) {
      let content = r.content;
      const isFileContent = r.name === "read_file";
      const limit = isFileContent ? fileLimit : dirLimit;
      if (content.length > limit) {
        content = content.slice(0, limit) + `\n\n[... truncated at ${limit} chars, ${r.content.length} total ...]`;
      }
      newEntries.push({ role: "tool", content, toolCallId: r.toolCallId, toolName: r.name });
    }

    // SA4E-187: conditional steering captured during successful file read/write
    const capturedSteering = results.flatMap(r => r.newSteeringRules ?? []);

    // Accumulate scratchpad (reducer now replaces, so we must append here)
    const scratchpad: LlmMessage[] = [...(state.agentScratchpad || []), ...newEntries];

    return {
      toolResults: results, agentScratchpad: scratchpad, toolCalls: null,
      agentIterations: (state.agentIterations || 0) + 1,
      ...(capturedSteering.length > 0 ? { activeSteeringRules: capturedSteering } : {}),
      currentStreamId: `stream-chat-${Date.now()}`, lastUpdatedAt: new Date().toISOString(),
    };
  };
}

interface SingleToolResult {
  toolCallId: string;
  name: string;
  content: string;
  newSteeringRules?: ActiveSteeringRule[];
}

async function executeSingleTool(
  call: { id: string; name: string; arguments: Record<string, unknown> },
  mcpBridge: McpBridge | undefined, sh: StreamHandler, streamId: string,
  hookEngine: HookEngine | undefined, wsRoot: string, approvalGate?: ToolApprovalGate,
  diagnosticsFeed?: DiagnosticsFeedService,
  commandPatternMatcher?: CommandPatternMatcher,
  diffTracker?: IDiffTracker
): Promise<SingleToolResult> {
  const tcId = call.id || `tc-${Date.now()}`;

  if (hookEngine) {
    try {
      const pre = await hookEngine.firePreToolUse(call.name, call.arguments || {}, sh, streamId);
      if (pre.denied) return { toolCallId: call.id, name: call.name, content: `Denied by hook "${pre.hookName}"` };
    } catch (e) { debugError(`preToolUse hook error`, e as Error); }
  }

  // SA4E-183: Pre-read file content BEFORE tool execution for diff tracking
  let preContent: string | undefined;
  if (diffTracker && DIFF_TRACKED_TOOLS.has(call.name)) {
    preContent = await preReadFileForDiff(call, wsRoot);
  }

  // Pattern-based auto-approve for shell commands REMOVED for security (SA4E-204)
  // const isShellTool = call.name === "execute_shell" || call.name === "shell_execute" || call.name === "execute_pwsh";
  // const shellCommand = isShellTool ? (call.arguments?.command as string || "") : "";
  // const patternMatch = isShellTool && commandPatternMatcher ? commandPatternMatcher.matches(shellCommand) : null;
  // if (patternMatch) {
  //   debugLog(`[execute_tools] Auto-approved '${shellCommand}' via pattern '${patternMatch}'`);
  // }

  // SA4E-85: Signal dangerous tool to webview and AWAIT approval before execution
  const needsApproval = requiresApproval(call.name);
  sh.emitDirect({ type: "chat:toolCall", toolCall: { id: tcId, name: call.name, args: call.arguments, status: "running" }, requiresApproval: needsApproval } as any);

  if (needsApproval && approvalGate) {
    const result = await approvalGate.requestApproval(tcId);
    if (result.decision === 'reject') {
      // SA4E-85: Emit retry-available signal on timeout (not user_reject)
      const isTimeout = result.reason === 'timeout';
      const status = isTimeout ? 'timeout' : 'rejected';
      const msg = isTimeout ? 'Auto-rejected. Retry available.' : 'Tool execution denied by user.';
      sh.emitDirect({ type: "chat:toolCallUpdate", id: tcId, status, result: msg, duration: 0, retryable: isTimeout } as any);
      return { toolCallId: call.id, name: call.name, content: msg };
    }
  }

  const start = Date.now();

  try {
    let result: string;
    if (call.name === "stream_write_file" && (!call.arguments?.file_path && !call.arguments?.path)) {
      result = "Error: 'file_path' is required";
    } else if (isVscodeTool(call.name)) {
      result = await executeVscodeTool(call.name, call.arguments, wsRoot);
    } else if (mcpBridge) {
      result = await mcpBridge.callTool(call.name, call.arguments);
    } else {
      result = `Error: Tool '${call.name}' not available`;
    }
    const dur = Date.now() - start;
    sh.emitDirect({ type: "chat:toolCallUpdate", id: tcId, status: "completed", result: result.slice(0, 500), duration: dur } as any);
    if (hookEngine) {
      try {
        const hookResult = await hookEngine.firePostToolUse(call.name, call.arguments || {}, result, sh, streamId);
        // SA4E-185 OI-2: hookResult.injectedPrompts is intentionally NOT replayed into the loop.
        // Diagnostics feed is channel-authoritative (diagnosticsContext, single-writer node) to
        // guarantee consume-once (BR-7). If askAgent/other hooks later require prompt injection,
        // fold ONLY non-feed outputs here — feed summaries must never duplicate (dedupe rule, RC-2).
      } catch (hookErr) {
        // postToolUse hook failures are non-fatal but must be visible
        debugError(`[chat-graph-nodes] postToolUse hook error for '${call.name}'`, hookErr as Error);
      }
    }
    if (diagnosticsFeed) {
      diagnosticsFeed.markTouchedFromTool(call.name, call.arguments || {}); // BR-5 (handles write_file — DR-1)
    }
    // SA4E-183: Record file change in DiffTracker after successful tool execution
    if (diffTracker && DIFF_TRACKED_TOOLS.has(call.name) && !result.startsWith("Error:")) {
      recordToolChange(diffTracker, call, result, preContent, wsRoot);
    }
    // SA4E-187: fileMatch steering auto-load on successful read/write (postToolUse)
    let newSteeringRules: ActiveSteeringRule[] | undefined;
    try {
      const captured = await captureFileMatchSteering(call.name, call.arguments || {}, wsRoot);
      if (captured.length > 0) { newSteeringRules = captured; }
    } catch (steeringErr) {
      debugError(`[chat-graph-nodes] steering capture error for '${call.name}'`, steeringErr as Error);
    }
    return { toolCallId: call.id, name: call.name, content: result, ...(newSteeringRules ? { newSteeringRules } : {}) };
  } catch (error) {
    sh.emitDirect({ type: "chat:toolCallUpdate", id: tcId, status: "failed", result: (error as Error).message, duration: Date.now() - start } as any);
    return { toolCallId: call.id, name: call.name, content: `Error: ${(error as Error).message}` };
  }
}

// --- SA4E-183: DiffTracker helper functions ---

/** Pre-read file content before tool modifies it (OI-01: Option A) */
async function preReadFileForDiff(
  call: { name: string; arguments: Record<string, unknown> },
  wsRoot: string
): Promise<string | undefined> {
  const filePath = extractFilePath(call);
  if (!filePath) return undefined;
  // delete_file: capture content before deletion
  // write/append: capture content before overwrite
  try {
    const resolved = path.resolve(wsRoot, filePath);
    const normalizedRoot = path.resolve(wsRoot) + path.sep;
    if (!resolved.startsWith(normalizedRoot) && resolved !== path.resolve(wsRoot)) {
      throw new Error(`Path traversal detected: ${filePath}`);
    }
    const fullPath = vscode.Uri.file(resolved);
    const data = await vscode.workspace.fs.readFile(fullPath);
    const content = Buffer.from(data).toString('utf-8');
    // BR-09: Cap originalContent at 2MB
    return content.length > 2 * 1024 * 1024
      ? content.slice(0, 2 * 1024 * 1024)
      : content;
  } catch {
    // File doesn't exist yet (new file) — no original
    return undefined;
  }
}

/** Record a tracked tool change into DiffTracker */
function recordToolChange(
  diffTracker: IDiffTracker,
  call: { name: string; arguments: Record<string, unknown> },
  _result: string,
  preContent: string | undefined,
  wsRoot: string
): void {
  const filePath = extractFilePath(call);
  if (!filePath) return;

  const relativePath = filePath.startsWith(wsRoot)
    ? filePath.slice(wsRoot.length + 1)
    : filePath;

  const operation = determineOperation(call.name, preContent);
  const postContent = call.name === 'delete_file' ? '' : (call.arguments?.text as string ?? call.arguments?.content as string ?? '');
  const diffContent = computeUnifiedDiff(relativePath, preContent ?? '', postContent);
  const { linesAdded, linesRemoved } = countDiffLines(diffContent);

  diffTracker.recordChange({
    filePath: relativePath,
    operation,
    linesAdded,
    linesRemoved,
    diffContent,
    originalContent: preContent,
  });
}

/** Extract target file path from tool arguments */
function extractFilePath(call: { arguments: Record<string, unknown> }): string | undefined {
  return (call.arguments?.path ?? call.arguments?.file_path ?? call.arguments?.targetFile) as string | undefined;
}

/** Determine operation type from tool name + pre-content existence */
function determineOperation(
  toolName: string,
  preContent: string | undefined
): 'added' | 'modified' | 'deleted' {
  if (toolName === 'delete_file') return 'deleted';
  if (preContent === undefined) return 'added';
  return 'modified';
}

export function createSynthesizeNode(
  llm: LlmProvider | undefined, sh: StreamHandler,
  getSystemPrompt: (state: PipelineState) => string,
) {
  return async (state: PipelineState) => {
    const sysPrompt = getSystemPrompt(state);
    const streamId = state.currentStreamId || `stream-chat-${Date.now()}`;
    if (!llm) return { pipelineStatus: "completed" as const, lastUpdatedAt: new Date().toISOString() };
    try {
      const messages = buildMessages(state, [], sysPrompt);
      messages.push({ role: "user", content: "Provide your final answer now. Do not call any more tools." });
      sh.emitStatus("chat", "active", streamId);
      let full = "";
      if (llm.chatStream) { for await (const t of llm.chatStream(messages, { maxTokens: 8192 })) { full += t; sh.emitToken("chat", t, streamId); } }
      else if (llm.chatWithTools) { const r = await llm.chatWithTools(messages, [], { maxTokens: 8192 }); full = r.text || ""; sh.emitToken("chat", full, streamId); }
      sh.emitComplete("chat", 0, streamId);
      sh.emitDirect({ type: "chat:workingStatus", working: false });
      return { agentOutputs: [{ nodeId: "chat", content: full, timestamp: new Date().toISOString() }], pipelineStatus: "completed" as const, lastUpdatedAt: new Date().toISOString() };
    } catch (error) {
      sh.emitError("chat", (error as Error).message, streamId);
      sh.emitDirect({ type: "chat:workingStatus", working: false });
      return { pipelineStatus: "failed" as const, lastUpdatedAt: new Date().toISOString() };
    }
  };
}
