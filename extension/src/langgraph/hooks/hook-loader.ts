/**
 * HookLoader --- KSA-242
 * Reads .code-intel/hooks/*.json and *.kiro.hook files at runtime,
 * parses hook definitions, and provides trigger methods for LangGraph nodes.
 */

import * as vscode from "vscode";
import * as path from "path";
import { validateHookSchema, filterHooksByType, filterPreToolUseHooks, filterFileHooks } from "./hook-filters";
export type { HookValidationError } from "./hook-filters";
export { validateHookSchema, filterHooksByType, filterPreToolUseHooks, filterFileHooks } from "./hook-filters";

export interface HookDefinition {
  name: string;
  version: string;
  description?: string;
  enabled: boolean;
  when: HookTrigger;
  then: HookAction;
  filePath: string;
}

export interface HookTrigger {
  type: "promptSubmit" | "agentStop" | "preToolUse" | "postToolUse"
    | "fileEdited" | "fileCreated" | "fileDeleted" | "userTriggered"
    | "preTaskExecution" | "postTaskExecution";
  patterns?: string[];
  toolTypes?: string[];
}

export interface HookAction {
  type: "askAgent" | "runCommand";
  prompt?: string;
  command?: string;
}

/** Cached hooks keyed by workspaceRoot (per-workspace isolation, no cross-workspace leakage) */
const hookCache = new Map<string, HookDefinition[]>();
const loadingHooks = new Map<string, Promise<HookDefinition[]>>();
let hookOutputChannel: vscode.OutputChannel | undefined;

function getHookOutputChannel(): vscode.OutputChannel {
  if (!hookOutputChannel) { hookOutputChannel = vscode.window.createOutputChannel("SDLC Agents Hooks"); }
  return hookOutputChannel;
}

/**
 * Load all hook definitions from .code-intel/hooks/ directory.
 * Validates schema; invalid hooks are skipped with logged errors.
 * Results are cached per workspaceRoot; concurrent loads for the same root are single-flight.
 */
export async function loadHooks(workspaceRoot: string, forceReload = false): Promise<HookDefinition[]> {
  if (!forceReload) {
    const cached = hookCache.get(workspaceRoot);
    if (cached) return cached;
  }
  const inflight = loadingHooks.get(workspaceRoot);
  if (inflight) return inflight;
  const pending = readHooksFromDir(path.join(workspaceRoot, ".code-intel", "hooks"))
    .then(hooks => {
      hookCache.set(workspaceRoot, hooks);
      return hooks;
    })
    .finally(() => { loadingHooks.delete(workspaceRoot); });
  loadingHooks.set(workspaceRoot, pending);
  return pending;
}

async function readHooksFromDir(hooksDir: string): Promise<HookDefinition[]> {
  const hooks: HookDefinition[] = [];
  const channel = getHookOutputChannel();
  try {
    const dirUri = vscode.Uri.file(hooksDir);
    const entries = await vscode.workspace.fs.readDirectory(dirUri);
    for (const [name, type] of entries) {
      if (type !== vscode.FileType.File) continue;
      if (!name.endsWith(".json") && !name.endsWith(".kiro.hook")) continue;
      try {
        const filePath = path.join(hooksDir, name);
        const uri = vscode.Uri.file(filePath);
        const bytes = await vscode.workspace.fs.readFile(uri);
        const content = Buffer.from(bytes).toString("utf-8");
        const parsed = JSON.parse(content);
        const validationErrors = validateHookSchema(parsed, name);
        if (validationErrors.length > 0) {
          for (const err of validationErrors) {
            channel.appendLine(`[WARN] ${err.file}: ${err.field} --- ${err.message}`);
          }
          continue;
        }
        const hook: HookDefinition = {
          name: parsed.name, version: parsed.version, description: parsed.description,
          enabled: parsed.enabled !== false, when: parsed.when, then: parsed.then,
          filePath: `.code-intel/hooks/${name}`,
        };
        if (hook.enabled) { hooks.push(hook); }
      } catch (err) {
        channel.appendLine(`[ERROR] Failed to parse ${name}: ${(err as Error).message}`);
      }
    }
  } catch {
    // Directory not found — non-fatal, skip silently
  }
  channel.appendLine(`[INFO] Loaded ${hooks.length} valid hooks from .code-intel/hooks/`);
  return hooks;
}

export function clearHookCache(): void { hookCache.clear(); }
