# Security Code Review Report - SA4E-204
## Target
extension/src/langgraph/subgraphs/chat-graph-nodes.ts + downstream vscode-tools.ts

## Overall Risk Rating
High
Critical: 1 | High: 3 | Medium: 4 | Low: 3

### Findings

#### [CRITICAL] Command Injection in executeShell
- Location: vscode-tools.ts:174-176
- Issue: child_process.exec(command) with unsanitized user input, no whitelist
- Risk: Remote code execution
- Remediation: Use spawn with argv array, whitelist commands, validate input

#### [HIGH] Path Traversal
- Location: vscode-tools.ts:31,48,124,135 ; chat-graph-nodes.ts:411
- Issue: File paths built without workspace containment check, .. accepted
- Remediation: Normalize path, enforce workspace root prefix, reject absolute paths

#### [HIGH] Tool Approval Bypass
- Location: chat-graph-nodes.ts:334-343
- Issue: Pattern matcher auto-approves shell commands, bypasses requiresApproval gate SA4E-85
- Remediation: Require explicit approval for all shell commands, remove auto-approve for dangerous tools

#### [MEDIUM] Regex Injection / ReDoS
- Location: vscode-tools.ts:104
- Issue: new RegExp(pattern) from user input
- Remediation: Use safe search or limit pattern length, escape user input

#### [MEDIUM] LLM Prompt Injection via Tool Nudge
- Location: chat-graph-nodes.ts:43-44,76-77
- Issue: System instruction injected as user role
- Remediation: Use proper system messages, avoid user role injection

#### [MEDIUM] Excessive Tool Permissions
- Location: chat-graph-nodes.ts:113-115,143-145
- Issue: VSCODE_TOOL_DEFINITIONS always merged, filtering only if agentConfig exists
- Remediation: Default deny, enforce agentConfig

#### [LOW] Debug logging leakage
- Location: Various
- Issue: LLM message previews logged
- Remediation: Redact sensitive content

## Recommendations
Address Critical and High findings before deployment. Re-review after remediation.
Created: 2026-08-22
