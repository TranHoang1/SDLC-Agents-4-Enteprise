# Deployment Guide (DPG)

## SDLC Agents 4 Enterprise — SA4E-6: Sandbox Execution (MCP Server Bridge)

---

## 1. Overview

SA4E-6 adds the Sandbox Execution module to the Backend MCP Server. It exposes 5 MCP tools
(`sandbox_session`, `sandbox_exec`, `sandbox_run`, `sandbox_install`, `sandbox_test`) so DEV/QA
agents can run bash commands, install packages, compile code, and run test suites in isolated
execution environments (Local or Docker).

---

## 2. Prerequisites

| Requirement | Version / Notes |
|-------------|-----------------|
| Node.js | ≥ 18.14 (recommend ≥ 20) |
| Docker Engine | **Linux**: native Docker Engine (full isolation) |
| Docker Desktop | Windows/macOS dev only — see §4 known limitation |
| npm dependency | `dockerode` (Node.js Docker SDK) |

---

## 3. Configuration (`config.sandbox`)

All sandbox settings are loaded via `backend/src/config/SandboxConfig.ts` (zod schema) under
`config.sandbox`. Do **not** hardcode these values in executor code.

| Key | Default | Meaning |
|-----|---------|---------|
| `defaultMode` | `docker` (Linux) / `local` (non-Linux) | Default execution mode. Resolved by `resolveDefaultSandboxMode()`. |
| `fallbackToLocal` | `true` | Fall back to Local when Docker unavailable. |
| `maxSessions` | `5` | Max concurrent sessions. |
| `defaultTtl` | `1800` | Session TTL (seconds of inactivity). |
| `defaultImage` | `node:20` | Docker base image for new sessions. |
| `reaperIntervalMs` | `60000` | Reaper cleanup interval. |
| `maxOutputBytes` | `1048576` | Max output bytes per stdout/stderr stream. |
| `commandTimeoutDefault` | `300` | Default command timeout (s). |
| `commandTimeoutMax` | `600` | Max allowed command timeout (s). |
| `mountExcludePatterns` | `[.env, .env.*, *.pem, *.key, *.p12, .git/credentials, .ssh/, .aws/, .docker/config.json, ...]` | Files never bind-mounted (BR-08). |
| `defaultResources` | memory `512m`, cpu `1.0`, disk `1g`, pidsLimit `100` | Per-container resource limits (BR-01..BR-04). |
| `dockerSocket` | (optional) | Docker socket path. |

---

## 4. Environment-Dependent Default Mode

`resolveDefaultSandboxMode()` resolves the default mode at runtime:

- **Linux host** → `docker`
- **Non-Linux host** (Windows/macOS) → `local`, **unless** `SANDBOX_FULL_ISOLATION=true` is set (then `docker`)

```sh
# Environment variable
SANDBOX_FULL_ISOLATION=true   # force docker mode + enable full-isolation tests
```

---

## 5. Running (Local Dev)

```sh
cd backend
npm install              # install dockerode + deps
npm run build            # compile TypeScript
npm run dev              # start backend (uses local default mode on Windows)
```

---

## 6. Running (Production — Linux Docker Engine)

```sh
export SANDBOX_FULL_ISOLATION=true
export SANDBOX_DEFAULT_MODE=docker
npm run build
npm start
```

On native Linux, `NetworkMode: 'none'`, cgroup memory (`Memory` + `MemorySwap`), and pid limits
are enforced by the kernel — full isolation applies (BR-01, BR-07, BR-12).

---

## 7. Running Tests

```sh
cd backend
npm test tests/integration/sandbox.it.test.ts
```

- Default: 4 passed + 3 skipped (isolation cases skipped on non-Linux).
- On Linux CI (or `SANDBOX_FULL_ISOLATION=true`): all 7 run, including TC-04/09/18.

---

## 8. Security Notes (BR-01 .. BR-12)

- Default network isolation: `NetworkMode: none` (BR-07).
- Containers are non-privileged, all capabilities dropped except minimal set, `no-new-privileges`, default seccomp, read-only rootfs + tmpfs (BR-12).
- Reuses existing `SecurityModule` (SA4E-167 GateGuard) for hardening — no re-implementation.
- Mount exclusion list protects `.env`, keys, credentials (BR-08).

---

## 9. Known Limitation (Important)

Full isolation guarantees (network block, OOM kill, memory/pid limits) are **only enforced on a
native Linux Docker Engine**. Docker Desktop for Windows/macOS runs containers inside a WSL2/LinuxKit
VM that ignores `NetworkMode: none` at the network layer and does not reliably enforce cgroup
memory limits at the container level (confirmed via `docker inspect`). This is an infrastructure
limitation, not a code defect. On such hosts, use `local` mode (the default) for the dev loop and
run isolation verification on Linux CI.