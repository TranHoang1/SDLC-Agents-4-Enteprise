# Release Notes (RLN)

## SDLC Agents 4 Enterprise — SA4E-6: Sandbox Execution (MCP Server Bridge)

---

## Version

- **Version:** 1.0 (initial)
- **Ticket:** SA4E-6
- **Type:** Story (Highest priority)
- **Parent Epic:** SA4E-5 — DeerFlow Bridge Integration (Option C - Hybrid Architecture)

---

## Summary

Introduces the Sandbox Execution module into the Backend MCP Server, enabling AI agents to run
real code (bash commands, package installation, compilation, test suites) inside isolated
execution environments instead of only generating documents.

---

## What's New

### 5 MCP Tools

| Tool | Purpose |
|------|---------|
| `sandbox_session` | Create / list / destroy persistent execution sessions. |
| `sandbox_exec` | Execute a bash command in a session. |
| `sandbox_run` | Run a code file with a specific runtime (node/python/tsx/java/sh). |
| `sandbox_install` | Install packages (npm/pip/apt) in a session. |
| `sandbox_test` | Run test suites (vitest/jest/pytest/gradle/mocha) with structured results. |

### Execution Modes

- **Local** — direct host execution via `child_process` (no isolation; fast).
- **Docker** — isolated containers via `dockerode` (default on Linux). Resources limited
  (memory 512m, cpu 1.0, disk 1g, pids 100).

### Lifecycle & Safety

- Session TTL (default 1800s) with background `Reaper` (60s interval).
- Orphan container recovery on startup; graceful shutdown on SIGTERM/SIGINT.
- Mount exclusion list protects `.env`, keys, and credentials (BR-08).

---

## New Dependency

- `dockerode` (Node.js Docker SDK).

---

## New Environment Variable

- `SANDBOX_FULL_ISOLATION` — when `true`, forces Docker mode and enables full-isolation tests
  (TC-04/09/18) on non-Linux hosts.

---

## Known Limitation

Full container isolation (outbound network block via `NetworkMode: none`, OOM kill via cgroup
memory limits, strict pid limits) is **verified only on a native Linux Docker Engine**. Docker
Desktop for Windows/macOS (WSL2/LinuxKit VM) does not reliably enforce these constraints at the
container level — an infrastructure limitation, not a code defect. On such hosts the module
defaults to **Local mode**; run isolation verification on Linux CI.

---

## Test Result

- **4 passed / 3 skipped / 0 failed** (verdict: PASS)
- Skipped (environment-gated): TC-04 (npm install), TC-09 (OOM kill), TC-18 (network isolation).