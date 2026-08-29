/**
 * SA4E-6 — Pure helpers for translating ResourceLimits into Docker HostConfig.
 * Kept side-effect free so it is trivially unit-testable (FSD TC builders).
 */

import type Docker from 'dockerode';
import type { ResourceLimits } from '../models.js';
import type { SandboxHardening } from './hardening.js';

/** Parse a size string like '512m', '1g', '1024k', '1073741824' → bytes. */
export function parseSize(value: string | number): number {
  if (typeof value === 'number') return Math.floor(value);
  const s = String(value).trim().toLowerCase();
  const m = /^(\d+(?:\.\d+)?)\s*(b|k|kb|m|mb|g|gb)?$/.exec(s);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const unit = m[2] || 'b';
  const mult: Record<string, number> = { b: 1, k: 1024, kb: 1024, m: 1024 ** 2, mb: 1024 ** 2, g: 1024 ** 3, gb: 1024 ** 3 };
  return Math.floor(n * (mult[unit] ?? 1));
}

/** Convert a CPU core count ('1.0') into Docker CpuQuota (in microseconds). */
export function cpuToQuota(cpu: string | number): number {
  const cores = typeof cpu === 'number' ? cpu : parseFloat(cpu);
  if (!isFinite(cores) || cores <= 0) return 100000;
  return Math.floor(cores * 100000);
}

export interface HostConfigInput {
  resources: ResourceLimits;
  networkEnabled: boolean;
  binds: string[];
  hardening: SandboxHardening;
}

export function buildHostConfig(input: HostConfigInput): Docker.HostConfig {
  const { resources, networkEnabled, binds, hardening } = input;
  const hostConfig: Docker.HostConfig = {
    Memory: parseSize(resources.memory) || undefined,
    MemorySwap: parseSize(resources.memory) || 0, // Set to Memory limit to disable swap effectively on some Docker Desktop versions

    CpuQuota: cpuToQuota(resources.cpu),
    PidsLimit: resources.pidsLimit,
    NetworkMode: networkEnabled ? 'bridge' : 'none',
    Binds: binds,
    CapDrop: hardening.CapDrop,
    CapAdd: hardening.CapAdd,
    SecurityOpt: hardening.SecurityOpt,
    Privileged: hardening.Privileged,
    ReadonlyRootfs: hardening.ReadonlyRootfs,
  };
  if (hardening.Tmpfs && Object.keys(hardening.Tmpfs).length) {
    hostConfig.Tmpfs = hardening.Tmpfs;
  }
  const disk = parseSize(resources.disk);
  if (disk > 0) {
    hostConfig.StorageOpt = { size: String(disk) };
  }
  return hostConfig;
}
