/**
 * Steering session store --- SA4E-187
 * Session-scoped state keyed by workspaceRoot (F-05: no context-free singleton):
 *  - loadedFileMatchRules: dedupe set so a fileMatch rule loads once per session
 *  - activeManualRules: manual rules activated by command, active for the session
 */

import type { ActiveSteeringRule, SteeringRule } from "./frontmatter";

const loadedFileMatchRules = new Map<string, Set<string>>();
const activeManualRules = new Map<string, Map<string, SteeringRule>>();

/** Marks a fileMatch rule as loaded for this workspace. Returns false if already loaded. */
export function markFileMatchLoaded(workspaceRoot: string, ruleId: string): boolean {
  const seen = loadedFileMatchRules.get(workspaceRoot) ?? new Set<string>();
  if (seen.has(ruleId)) return false;
  seen.add(ruleId);
  loadedFileMatchRules.set(workspaceRoot, seen);
  return true;
}

export function isFileMatchLoaded(workspaceRoot: string, ruleId: string): boolean {
  return loadedFileMatchRules.get(workspaceRoot)?.has(ruleId) ?? false;
}

/** Activates manual rules. Returns how many were newly activated. */
export function activateManualRules(workspaceRoot: string, rules: SteeringRule[]): number {
  let activated = activeManualRules.get(workspaceRoot) ?? new Map<string, SteeringRule>();
  if (!activeManualRules.has(workspaceRoot)) { activeManualRules.set(workspaceRoot, activated); }
  let newly = 0;
  for (const rule of rules) {
    if (activated.has(rule.filePath)) continue;
    activated.set(rule.filePath, rule);
    newly++;
  }
  return newly;
}

export function getActiveManualRules(workspaceRoot: string): SteeringRule[] {
  return [...(activeManualRules.get(workspaceRoot)?.values() ?? [])];
}

export function clearWorkspaceSession(workspaceRoot?: string): void {
  if (!workspaceRoot) { loadedFileMatchRules.clear(); activeManualRules.clear(); return; }
  loadedFileMatchRules.delete(workspaceRoot);
  activeManualRules.delete(workspaceRoot);
}

export function toActiveSteeringRules(rules: SteeringRule[]): ActiveSteeringRule[] {
  return rules.map(r => ({ id: r.filePath, title: r.meta.title || r.filePath, content: r.content }));
}

export function fromActiveSteeringRules(active: ActiveSteeringRule[] | undefined): SteeringRule[] {
  if (!active || active.length === 0) return [];
  return active.map(r => ({
    filePath: r.id,
    meta: { targets: "all", inclusion: "fileMatch" as const, title: r.title },
    content: r.content,
  }));
}
