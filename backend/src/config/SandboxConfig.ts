import { z } from 'zod';

/**
 * SA4E-6 — Sandbox module configuration schema.
 * Loaded as `config.sandbox` from the unified backend config (see config/index.ts).
 * All values have safe defaults; do NOT hardcode these in executor code — read from here.
 */

export const DEFAULT_MOUNT_EXCLUDE_PATTERNS: string[] = [
  '.env',
  '.env.*',
  '*.pem',
  '*.key',
  '*.p12',
  '.git/credentials',
  '.ssh/',
  '.aws/',
  '.docker/config.json',
  'node_modules/.cache/*/secrets*',
];

export const DEFAULT_SANDBOX_RESOURCES = {
  memory: '512m',
  cpu: '1.0',
  disk: '1g',
  pidsLimit: 100,
} as const;

/**
 * Resolve the default sandbox execution mode for the current host at runtime.
 *
 * Full container isolation (cgroup memory/pid limits + `NetworkMode: 'none'`
 * enforcement) is only reliable on a native Linux Docker Engine. Docker Desktop for
 * Windows/macOS runs containers inside a WSL2/LinuxKit VM that ignores
 * `NetworkMode: 'none'` at the network layer and enforces memory limits at the VM
 * kernel layer, so those isolation guarantees do not hold there.
 *
 * Resolution rule (read `process.platform` + env var at runtime — do NOT hardcode):
 *   - Linux host                    → `docker`
 *   - Non-Linux host (Win/macOS)    → `local`, UNLESS `SANDBOX_FULL_ISOLATION=true`
 *                                     is set (then `docker`)
 *
 * This is invoked lazily via zod's function-default, so the platform/env are read at
 * parse time rather than import time.
 */
export function resolveDefaultSandboxMode(): 'docker' | 'local' {
  const fullIsolation =
    process.env.SANDBOX_FULL_ISOLATION === 'true' || process.platform === 'linux';
  return fullIsolation ? 'docker' : 'local';
}

export const SandboxConfigSchema = z.object({
  defaultMode: z.enum(['docker', 'local']).default(resolveDefaultSandboxMode),
  fallbackToLocal: z.boolean().default(true),
  maxSessions: z.number().int().positive().default(5),
  defaultTtl: z.number().int().positive().default(1800),
  defaultImage: z.string().default('node:20'),
  reaperIntervalMs: z.number().int().positive().default(60000),
  maxOutputBytes: z.number().int().positive().default(1048576),
  commandTimeoutDefault: z.number().int().positive().default(300),
  commandTimeoutMax: z.number().int().positive().default(600),
  mountExcludePatterns: z.array(z.string()).default(DEFAULT_MOUNT_EXCLUDE_PATTERNS),
  defaultResources: z
    .object({
      memory: z.string().default('512m'),
      cpu: z.string().default('1.0'),
      disk: z.string().default('1g'),
      pidsLimit: z.number().int().positive().default(100),
    })
    .default(DEFAULT_SANDBOX_RESOURCES),
  dockerSocket: z.string().optional(),
});

export type SandboxConfig = z.infer<typeof SandboxConfigSchema>;
