# Release Notes - SA4E-204

## Header
- Release version: 1.33.1
- Release date: 2026-08-22
- Jira ticket: SA4E-204
- Autonomy Level: L3

## What's New
- Parallel tool execution in Chat Graph `execute_tools` node for independent tool calls
- Reduced response latency by executing independent tools concurrently with configurable max parallelism
- Feature toggle `chat.parallel.enabled` and `chat.parallel.max_concurrency` for controlled rollout
- Result aggregation preserves order and error markers

## Technical Changes
- New modules: `ToolDispatchScheduler`, `ResultAggregator`, `ParallelExecutor`
- Refactored `execute_tools` node to support concurrent dispatch via p-limit
- No database schema changes
- Configuration changes: feature flags added for parallel mode

## Security Fixes
All fixes implemented per REMEDIATION-LOG.md:
- Command Injection Fix: `child_process.exec` replaced with `spawn` whitelist in `executeShell`. Whitelisted commands only, argv array without shell interpolation
- Path Traversal Fix: `ensurePathInsideWorkspace` helper added, applied to `readFile`, `writeFile`, `listDirectory`, `preReadFileForDiff`
- Regex Injection Fix: Pattern length limit 200 chars, try/catch RegExp compilation in `searchText`
- Approval Bypass Removal: Removed pattern-based auto-approve bypass for shell commands, `needsApproval` now always uses `requiresApproval`
- Tool Nudge Role Fix: Moved Tool Nudge messages from `role: "user"` to `role: "system"` to prevent prompt injection
- Default Deny Permissions: `createAgentStepNode` and `createExecuteToolsNode` default deny tools when `agentConfig` absent

## Known Issues & Limitations
- Parallel execution assumes tools are stateless and safe to run concurrently
- Increased resource usage possible with high max concurrency; monitor metrics

## Dependencies
- Parent epic SA4E-181 Chat Module
- Requires Chat Graph Runtime operational
- No external system changes

## Migration Notes
- No data migration required
- Backward compatible: sequential execution fallback when feature flag disabled
- Extension upgrade path: uninstall 1.33.0, install 1.33.1 VSIX
