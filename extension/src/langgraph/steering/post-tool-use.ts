/**
 * PostToolUse steering capture --- SA4E-187
 * After a successful read_file/write_file, evaluate fileMatch rules and return
 * newly-loaded ones (dedupe per workspace session). Failures are non-fatal.
 */

import { loadFileMatchRules, matchFileMatchRules } from "./steering-loader";
import { markFileMatchLoaded, toActiveSteeringRules } from "./session-store";
import { extractFilePath } from "../hooks/hook-tool-matcher";
import type { ActiveSteeringRule } from "./frontmatter";
import { debugLog } from "../../debug-logger";

const STEERING_TRIGGER_TOOLS: Set<string> = new Set(["read_file", "write_file"]);

export async function captureFileMatchSteering(
  toolName: string,
  args: Record<string, unknown>,
  workspaceRoot: string
): Promise<ActiveSteeringRule[]> {
  if (!STEERING_TRIGGER_TOOLS.has(toolName) || !workspaceRoot) return [];
  const filePath = extractFilePath(toolName, args);
  if (!filePath) return [];

  try {
    const rules = await loadFileMatchRules(workspaceRoot);
    const matched = matchFileMatchRules(rules, filePath);
    const fresh = matched.filter(r => markFileMatchLoaded(workspaceRoot, r.filePath));
    if (fresh.length > 0) {
      debugLog(`[steering] fileMatch captured ${fresh.length} rule(s) for '${filePath}'`);
    }
    return toActiveSteeringRules(fresh);
  } catch (err) {
    console.debug(`[steering] fileMatch evaluation failed (non-fatal): ${(err as Error).message}`);
    return [];
  }
}
