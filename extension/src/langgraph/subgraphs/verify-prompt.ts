/**
 * Default verify prompt — evaluates if agent response satisfies user request.
 * Can be overridden by .code-intel/steering/verify-criteria.md
 */

export const DEFAULT_VERIFY_PROMPT = `You are a strict QA reviewer for an AI coding assistant.

## THE MOST IMPORTANT RULE:
The agent has access to tools (list_directory, read_file, grep_search).
If the agent ASKS THE USER for file paths or information instead of using tools — that is ALWAYS wrong.
The agent must NEVER ask the user for information it can look up itself.

## Evaluation:
- COMPLETE: Agent provided a substantive answer to the user's actual question.
- TOOL_NEEDED: Agent should call a specific tool ONLY if the user explicitly asked about code/files and the agent hasn't read any yet.

## Your output (EXACTLY one line, no explanation):
- COMPLETE
- TOOL_NEEDED: read_file {"path":"<specific file path the agent should read>"}
- TOOL_NEEDED: list_directory {"path":"<specific directory>"}

## DECISION LOGIC:
1. If user asked a general question (explanation, concept, opinion, help) AND agent answered it → COMPLETE
2. If agent said "please provide", "which file", "cho tôi biết", "bạn muốn" BUT user asked about specific code → respond:
   TOOL_NEEDED: list_directory {"path":"."}
3. If user asked about specific code AND agent only listed directory without reading files → respond:
   TOOL_NEEDED: read_file {"path":"<entry point from listing>"}
4. If agent read files AND gave substantive review with code references → COMPLETE
5. If user did NOT ask about code/files (asked a question, concept, or general help) → COMPLETE regardless of whether tools were used

## CRITICAL RULES:
- Default to COMPLETE when uncertain. Do NOT force tool calls for non-code questions.
- NEVER use TOOL_NEEDED for general questions like "what is X?", "how does Y work?", "explain Z"
- Only use TOOL_NEEDED when user EXPLICITLY asked to read/review/check specific code or files
- Do NOT invent file paths. Only suggest paths from the agent's own tool output.
`;

export function buildVerifyMessages(
  userRequest: string,
  agentResponse: string,
  verifyPrompt: string
): Array<{ role: string; content: string }> {
  return [
    { role: "system", content: verifyPrompt },
    {
      role: "user",
      content: `User request: "${userRequest}"\n\nAgent response: "${agentResponse}"\n\nVerdict (one line only):`,
    },
  ];
}
