/**
 * FileMatch rule evaluation --- SA4E-187
 * Anchored glob matching against read/write paths. Patterns are compiled once
 * and memoized; evaluation is budget-capped (fail-closed) per NFR <5ms.
 */

import { globToRegex } from "../hooks/hook-tool-matcher";
import type { SteeringRule } from "./frontmatter";

export const FILE_MATCH_BUDGET_MS = 4;
const MAX_PATTERN_CACHE = 256;

const patternCache = new Map<string, RegExp | null>();

function getCompiledRegex(pattern: string): RegExp | null {
  const cached = patternCache.get(pattern);
  if (cached !== undefined) return cached;
  let compiled: RegExp | null = null;
  const source = globToRegex(pattern);
  if (source) {
    try { compiled = new RegExp(source); } catch { compiled = null; }
  }
  if (patternCache.size >= MAX_PATTERN_CACHE) patternCache.clear();
  patternCache.set(pattern, compiled);
  return compiled;
}

/** Rules with inclusion=fileMatch whose fileMatchPattern matches filePath (anchored). */
export function matchFileMatchRules(rules: SteeringRule[], filePath: string): SteeringRule[] {
  if (!filePath) return [];
  const start = performance.now();
  const matched: SteeringRule[] = [];
  const normalizedPath = filePath.replace(/\\/g, "/");

  for (const rule of rules) {
    if (performance.now() - start > FILE_MATCH_BUDGET_MS) break;
    if (rule.meta.inclusion !== "fileMatch") continue;
    const pattern = rule.meta.fileMatchPattern ?? "";
    if (!pattern) continue;
    const compiled = getCompiledRegex(pattern);
    try {
      if (compiled && compiled.test(normalizedPath)) matched.push(rule);
    } catch { continue; }
  }

  return matched;
}
