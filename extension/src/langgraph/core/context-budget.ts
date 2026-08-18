/**
 * Context Budget — Dynamic token budgeting for LLM context windows.
 * Estimates token usage and prunes messages to fit within budget.
 */

import type { LlmMessage } from "./llm-provider";
import type { McpToolDefinition } from "../vscode/tool-registry";
import { debugLog } from "../../debug-logger";

/** Approximate tokens from text. ~3.5 chars per token for code/mixed content. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.5);
}

/** Estimate tokens for an array of messages. */
export function estimateMessagesTokens(messages: LlmMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    total += estimateTokens(msg.content);
    total += 4; // overhead per message (role, separators)
  }
  return total;
}



/**
 * Build messages that fit within the context budget.
 * Priority (highest to lowest):
 *   1. System prompt (always included)
 *   2. Chat history (newest messages prioritized)
 *   3. Agent scratchpad (newest tool call/result pairs prioritized)
 *   4. Tool nudge (optional, lowest priority)
 */

interface ContextBudgetResult {
  messages: LlmMessage[];
  totalTokens: number;
  budgetUsedPercent: number;
  scratchpadPruned: boolean;
}

export function buildBudgetAwareMessages(
  systemPrompt: string,
  chatHistory: Array<{ role: string; content: string }>,
  scratchpad: LlmMessage[],
  tools: McpToolDefinition[],
  contextBudget: number,
  toolNudge?: LlmMessage
): ContextBudgetResult {
  const RESERVE_FOR_OUTPUT = 2000;

  const systemTokens = estimateTokens(systemPrompt);
  const toolSchemaTokens = tools.length > 0 ? estimateTokens(JSON.stringify(tools)) : 0;
  const reservedTokens = systemTokens + toolSchemaTokens + RESERVE_FOR_OUTPUT;

  let availableBudget = contextBudget - reservedTokens;
  if (availableBudget < 500) { availableBudget = 500; }

  const messages: LlmMessage[] = [{ role: "system", content: systemPrompt }];
  let usedTokens = systemTokens;

  // Step 1: Include chat history (newest first if over budget)
  const historyMessages: LlmMessage[] = [];
  for (const msg of chatHistory) {
    if (msg.role === "user" || msg.role === "assistant") {
      historyMessages.push({ role: msg.role as "user" | "assistant", content: msg.content });
    }
  }

  let historyTokens = estimateMessagesTokens(historyMessages);
  let includedHistory = historyMessages;

  if (historyTokens > availableBudget * 0.4) {
    includedHistory = [];
    let histBudget = Math.floor(availableBudget * 0.4);
    for (let i = historyMessages.length - 1; i >= 0; i--) {
      const msgTokens = estimateTokens(historyMessages[i].content) + 4;
      if (histBudget - msgTokens < 0) break;
      includedHistory.unshift(historyMessages[i]);
      histBudget -= msgTokens;
    }
    historyTokens = estimateMessagesTokens(includedHistory);
  }

  messages.push(...includedHistory);
  usedTokens += historyTokens;
  availableBudget -= historyTokens;

  // Step 2: Include scratchpad with pruning
  let scratchpadPruned = false;
  let includedScratchpad: LlmMessage[] = scratchpad;
  let scratchpadTokens = estimateMessagesTokens(scratchpad);

  if (scratchpadTokens > availableBudget) {
    scratchpadPruned = true;
    includedScratchpad = pruneScratchpad(scratchpad, availableBudget);
    scratchpadTokens = estimateMessagesTokens(includedScratchpad);
  }

  messages.push(...includedScratchpad);
  usedTokens += scratchpadTokens;
  availableBudget -= scratchpadTokens;

  // Step 3: Tool nudge (only if budget remains)
  if (toolNudge && availableBudget > 100) {
    messages.push(toolNudge);
    usedTokens += estimateTokens(toolNudge.content) + 4;
  }

  const totalTokens = usedTokens + toolSchemaTokens + RESERVE_FOR_OUTPUT;
  const budgetUsedPercent = Math.round((totalTokens / contextBudget) * 100);

  debugLog(`[context-budget] budget=${contextBudget}, used=${totalTokens} (${budgetUsedPercent}%), history=${includedHistory.length}msg, scratchpad=${includedScratchpad.length}msg, pruned=${scratchpadPruned}`);

  return { messages, totalTokens, budgetUsedPercent, scratchpadPruned };
}

/**
 * Prune scratchpad to fit within token budget.
 * Strategy: Keep newest entries, summarize older ones.
 */
function pruneScratchpad(scratchpad: LlmMessage[], budget: number): LlmMessage[] {
  if (scratchpad.length === 0) return [];

  const result: LlmMessage[] = [];
  let usedTokens = 0;

  // Keep newest entries that fit (iterate from end)
  for (let i = scratchpad.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokens(scratchpad[i].content) + 4;
    if (usedTokens + msgTokens > budget) break;
    result.unshift(scratchpad[i]);
    usedTokens += msgTokens;
  }

  // If nothing fits, keep last 2 entries truncated
  if (result.length === 0 && scratchpad.length > 0) {
    const lastEntries = scratchpad.slice(-2);
    const maxCharsPerEntry = Math.floor((budget * 3.5) / 2);
    for (const entry of lastEntries) {
      const truncated = entry.content.length > maxCharsPerEntry
        ? entry.content.slice(0, maxCharsPerEntry) + "\n[... truncated for context budget ...]"
        : entry.content;
      result.push({ ...entry, content: truncated });
    }
  }

  // Prepend summary of skipped entries
  const skippedCount = scratchpad.length - result.length;
  if (skippedCount > 0) {
    const summaryParts: string[] = [];
    for (let i = 0; i < skippedCount; i++) {
      const msg = scratchpad[i];
      if (msg.role === "tool" && msg.toolName) {
        const preview = msg.content.slice(0, 80).replace(/\n/g, " ");
        summaryParts.push(`${msg.toolName}: ${preview}...`);
      }
    }
    if (summaryParts.length > 0) {
      const summary: LlmMessage = {
        role: "user",
        content: `[Context budget: ${skippedCount} earlier tool results summarized]\n${summaryParts.join("\n")}`,
      };
      result.unshift(summary);
    }
  }

  return result;
}

/**
 * Calculate dynamic max chars for tool results based on remaining budget.
 */
export function getDynamicToolResultLimits(
  contextBudget: number,
  currentUsageTokens: number
): { dirLimit: number; fileLimit: number } {
  if (contextBudget <= 0) {
    return { dirLimit: 4000, fileLimit: 50000 };
  }

  const remainingTokens = contextBudget - currentUsageTokens;
  const remainingChars = Math.max(2000, remainingTokens * 3.5);

  const dirLimit = Math.min(8000, Math.max(2000, Math.floor(remainingChars * 0.25)));
  const fileLimit = Math.min(80000, Math.max(4000, Math.floor(remainingChars * 0.60)));

  return { dirLimit, fileLimit };
}

/**
 * SA4E-174: Auto-compact detection.
 * When context usage >= 95%, returns a compact signal with conversation summary.
 * The caller (chat engine) should create a new session with the summary.
 */
export interface AutoCompactResult {
  shouldCompact: boolean;
  usagePercent: number;
  summary?: string;
}

/**
 * Check if context is nearing exhaustion and needs auto-compaction.
 * @param contextBudget Total context window in tokens
 * @param systemPromptTokens Estimated system prompt tokens
 * @param chatHistory Full chat history
 * @param scratchpad Current agent scratchpad
 * @returns AutoCompactResult with shouldCompact flag and optional summary
 */
export function checkAutoCompact(
  contextBudget: number,
  systemPromptTokens: number,
  chatHistory: Array<{ role: string; content: string }>,
  scratchpad: LlmMessage[]
): AutoCompactResult {
  if (contextBudget <= 0) {
    return { shouldCompact: false, usagePercent: 0 };
  }

  const historyTokens = chatHistory.reduce(
    (sum, m) => sum + estimateTokens(m.content) + 4, 0
  );
  const scratchpadTokens = estimateMessagesTokens(scratchpad);
  const totalUsed = systemPromptTokens + historyTokens + scratchpadTokens;
  const usagePercent = Math.round((totalUsed / contextBudget) * 100);

  if (usagePercent >= 95) {
    debugLog(`[context-budget] AUTO-COMPACT triggered: ${usagePercent}% usage (${totalUsed}/${contextBudget})`);
    const summary = buildConversationSummary(chatHistory, scratchpad);
    return { shouldCompact: true, usagePercent, summary };
  }

  if (usagePercent >= 85) {
    debugLog(`[context-budget] WARNING: ${usagePercent}% context usage`);
  }

  return { shouldCompact: false, usagePercent };
}

/**
 * Build a condensed summary of the conversation for session handoff.
 * Extracts: user intent, tools used, key findings, current task state.
 */
function buildConversationSummary(
  chatHistory: Array<{ role: string; content: string }>,
  scratchpad: LlmMessage[]
): string {
  const parts: string[] = [];

  // Extract user messages (last 3 for context)
  const userMessages = chatHistory.filter(m => m.role === "user");
  const recentUser = userMessages.slice(-3);
  if (recentUser.length > 0) {
    parts.push("## User Intent");
    for (const m of recentUser) {
      parts.push(`- ${m.content.slice(0, 200)}`);
    }
  }

  // Extract tool calls from scratchpad
  const toolCalls = scratchpad.filter(m => m.role === "tool" && m.toolName);
  if (toolCalls.length > 0) {
    parts.push("\n## Tools Used");
    const uniqueTools = [...new Set(toolCalls.map(m => m.toolName))];
    parts.push(uniqueTools.join(", "));
  }

  // Extract last assistant response
  const lastAssistant = chatHistory.filter(m => m.role === "assistant").pop();
  if (lastAssistant) {
    parts.push("\n## Last Response (truncated)");
    parts.push(lastAssistant.content.slice(0, 500));
  }

  return parts.join("\n");
}
