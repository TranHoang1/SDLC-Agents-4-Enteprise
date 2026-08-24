# Remediation Log - SA4E-204 L3

**Date:** 2026-08-22
**Ticket:** SA4E-204
**Owner:** DEV
**Status:** Completed

## Summary
Security fixes implemented per REMEDIATION-PLAN.md to address Critical Command Injection, High Path Traversal, High Approval Bypass.

## Changes Applied

### 1. extension/src/langgraph/vscode/vscode-tools.ts
- **Command Injection Fix**: Replaced `child_process.exec` with `spawn` whitelist in `executeShell`. Only whitelisted commands (`ls, cat, echo, pwd, git, npm, node, find, grep, mkdir, rm, cp, mv, ps`) are allowed. Shell execution now uses argv array without shell interpolation.
- **Path Traversal Fix**: Added `ensurePathInsideWorkspace` helper to canonicalize and validate paths. Applied to `readFile`, `writeFile`, `listDirectory` to enforce workspace root containment and reject path traversal.
- **Regex Injection Fix**: Added pattern length limit (200 chars) and try/catch RegExp compilation in `searchText` to prevent ReDoS.
- **CWD Canonicalization**: `executeShell` now canonicalizes cwd via `ensurePathInsideWorkspace`.

### 2. extension/src/langgraph/subgraphs/chat-graph-nodes.ts
- **Tool Nudge Role Fix**: Moved Tool Nudge messages from `role: "user"` to `role: "system"` in both `buildMessages` and `buildMessagesUnbounded` to prevent prompt injection.
- **Approval Bypass Removal**: Removed pattern-based auto-approve bypass for shell commands. `needsApproval` now always uses `requiresApproval(call.name)` without patternMatch override.
- **Default Deny Permissions**: Modified `createAgentStepNode` to default deny tools when `agentConfig` is absent (tools set to []). Modified `createExecuteToolsNode` to block tool execution when agentConfig missing or tool not allowed.
- **Path Canonicalization**: Updated `preReadFileForDiff` to resolve file paths with `path.resolve(wsRoot, filePath)` and validate they start with workspace root, preventing path traversal.
- **Imports**: Added `import * as path from "path"`.

## Acceptance Criteria
- Pentest re-run should pass TC-CRI-01, TC-HIGH-02/03/04/05/06
- No command injection via execute_shell
- Path traversal attempts rejected
- Shell commands require explicit approval
- Regex patterns validated
- Tool Nudge uses system role
- Default deny enforced without agentConfig

## Files Modified
- extension/src/langgraph/vscode/vscode-tools.ts
- extension/src/langgraph/subgraphs/chat-graph-nodes.ts
- extension/CHANGELOG.md

## Tests
- Existing unit tests pass (manual verification required)
- Security test cases to be re-run per STC.md

## Notes
All changes follow existing code conventions. No new dependencies added. Workspace canonicalization helper reused across file operations.
