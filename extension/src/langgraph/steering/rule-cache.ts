/**
 * Steering rule cache --- SA4E-187
 * Per-workspaceRoot cache (F-05: never a bare singleton) with TTL throttle
 * and mtime-snapshot validation so edited/added steering files invalidate.
 */

import * as vscode from "vscode";
import * as path from "path";
import type { SteeringRule } from "./frontmatter";

const RULE_CACHE_TTL_MS = 1500;

export interface ScannedRules {
  rules: SteeringRule[];
  snapshot: Map<string, number>;
}

interface CacheEntry extends ScannedRules {
  checkedAt: number;
}

const ruleCache = new Map<string, CacheEntry>();
const inflightLoads = new Map<string, Promise<SteeringRule[]>>();

export async function getCachedRules(
  workspaceRoot: string,
  target: "kiro" | "langgraph",
  steeringDir: string,
  forceReload: boolean,
  loadFresh: () => Promise<ScannedRules>
): Promise<SteeringRule[]> {
  const key = `${workspaceRoot}::${target}`;
  if (!forceReload) {
    const cached = ruleCache.get(key);
    if (cached && Date.now() - cached.checkedAt < RULE_CACHE_TTL_MS) return cached.rules;
    if (cached) {
      const unchanged = await snapshotUnchanged(steeringDir, cached.snapshot);
      if (unchanged) { cached.checkedAt = Date.now(); return cached.rules; }
    }
  }

  const inflight = inflightLoads.get(key);
  if (inflight && !forceReload) return inflight;

  const pending = (async () => {
    const scanned = await loadFresh();
    ruleCache.set(key, { ...scanned, checkedAt: Date.now() });
    return scanned.rules;
  })().finally(() => { inflightLoads.delete(key); });

  inflightLoads.set(key, pending);
  return pending;
}

async function snapshotUnchanged(steeringDir: string, baseline: Map<string, number>): Promise<boolean> {
  try {
    const current = await snapshotSteeringTree(steeringDir);
    if (current.size !== baseline.size) return false;
    for (const [rel, mtime] of baseline) {
      if (current.get(rel) !== mtime) return false;
    }
    return true;
  } catch {
    return true;
  }
}

export async function snapshotSteeringTree(steeringDir: string): Promise<Map<string, number>> {
  const snapshot = new Map<string, number>();
  await walkForSnapshot(steeringDir, steeringDir, snapshot);
  return snapshot;
}

async function walkForSnapshot(dir: string, rootDir: string, snapshot: Map<string, number>): Promise<void> {
  const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dir));
  for (const [name, type] of entries) {
    const full = path.join(dir, name);
    const rel = path.relative(rootDir, full).replace(/\\/g, "/");
    if (type === vscode.FileType.Directory) {
      await recordMtime(snapshot, rel, full);
      await walkForSnapshot(full, rootDir, snapshot);
    } else if (name.endsWith(".md")) {
      await recordMtime(snapshot, rel, full);
    }
  }
}

async function recordMtime(snapshot: Map<string, number>, rel: string, full: string): Promise<void> {
  try {
    const st = await vscode.workspace.fs.stat(vscode.Uri.file(full));
    if (st && typeof st.mtime === "number") { snapshot.set(rel, st.mtime); }
  } catch { /* unreadable entry --- skip */ }
}

export function clearRuleCache(workspaceRoot?: string): void {
  if (!workspaceRoot) { ruleCache.clear(); return; }
  for (const key of ruleCache.keys()) {
    if (key.startsWith(`${workspaceRoot}::`)) ruleCache.delete(key);
  }
}
