# Remediation Plan - SA4E-204 L3
## Issues
Critical Command Injection, High Path Traversal, High Approval Bypass

## Tasks
1. Replace child_process.exec with spawn + whitelist in vscode-tools.ts:174-176
2. Enforce workspace root canonicalization for read_file/write_file/list_directory/preReadFileForDiff
3. Remove auto-approve bypass for shell commands in chat-graph-nodes.ts:334-343
4. Sanitize regex input and limit pattern length
5. Move Tool Nudge to system role
6. Default deny tool permissions without agentConfig

## Acceptance Criteria
Pentest re-run passes TC-CRI-01, TC-HIGH-02/03/04/05/06

## Owner
DEV
Due: 2026-08-23
