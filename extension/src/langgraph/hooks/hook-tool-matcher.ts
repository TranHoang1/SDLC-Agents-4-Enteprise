/**
 * Hook Tool Matcher — extracted from HookEngine
 * Tool category classification and matching logic for hook system.
 */

import type { HookDefinition } from "./hook-loader";

const TOOL_CATEGORIES: Record<string, string> = {
  readFile: "read", read_file: "read", read_code: "read", read_files: "read",
  grep_search: "read", file_search: "read", list_directory: "read",
  get_diagnostics: "read", get_process_output: "read",
  fs_write: "write", str_replace: "write", fs_append: "write",
  delete_file: "write", stream_write_file: "write",
  write_file: "write",            // ← SA4E-185 OI-1: primary VS Code write tool
  execute_pwsh: "shell", control_pwsh_process: "shell",
  execute_shell: "shell",
  web_search: "web", fetch_url: "web",
};

const MAX_REGEX_PATTERN_LENGTH = 128;
const MAX_GLOB_PATTERN_LENGTH = 256;
const MAX_GLOB_PATH_LENGTH = 4096;

export function classifyTool(toolName: string): string {
  return TOOL_CATEGORIES[toolName] || "other";
}

export function getMatchingToolHooks(
  hooks: HookDefinition[],
  eventType: "preToolUse" | "postToolUse",
  toolName: string,
  category: string
): HookDefinition[] {
  return hooks.filter(h => {
    if (h.when.type !== eventType) return false;
    return matchesToolType(h, toolName, category);
  });
}

function safeCompile(pattern: string): RegExp | null {
  if (pattern.length === 0 || pattern.length > MAX_REGEX_PATTERN_LENGTH) return null;
  if (/(\.\*){2,}|(\[\^\/\]\*){2,}|\+[^)]*\+|(\*|\+|\?)\s*(\*|\+|\?)/.test(pattern)) return null;
  try { return new RegExp(`^(?:${pattern})$`); }
  catch { return null; }
}

function matchesToolType(hook: HookDefinition, toolName: string, category: string): boolean {
  const toolTypes = hook.when.toolTypes;
  if (!toolTypes || toolTypes.length === 0) return true;
  return toolTypes.some(pattern => {
    if (pattern === "*") return true;
    if (pattern === category) return true;
    if (pattern === toolName) return true;
    const compiled = safeCompile(pattern);
    if (!compiled) return false;
    try { return compiled.test(toolName); }
    catch { return false; }
  });
}

export function extractFilePath(toolName: string, args: Record<string, unknown>): string | null {
  if (args.path && typeof args.path === "string") return args.path;
  if (args.file_path && typeof args.file_path === "string") return args.file_path;
  if (args.targetFile && typeof args.targetFile === "string") return args.targetFile;
  if (toolName === "str_replace" && args.path) return args.path as string;
  return null;
}

export function matchGlob(pattern: string, filePath: string): boolean {
  if (pattern.length === 0 || pattern.length > MAX_GLOB_PATTERN_LENGTH) return false;
  const normalizedPath = filePath.replace(/\\/g, "/");
  if (normalizedPath.length > MAX_GLOB_PATH_LENGTH) return false;
  const collapsed = pattern.replace(/\*\*+/g, "**");
  const regex = collapsed
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/(?:\u0000)+/g, ".*");
  try { return new RegExp(`^${regex}$`).test(normalizedPath); }
  catch { return false; }
}
