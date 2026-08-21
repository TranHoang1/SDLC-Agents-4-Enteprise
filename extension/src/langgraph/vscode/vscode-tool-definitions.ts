/**
 * VS Code tool definitions — schema declarations for IDE-native tools.
 * Extracted from vscode-tools.ts.
 */
import type { McpToolDefinition } from "./tool-registry";

export const VSCODE_TOOL_DEFINITIONS: McpToolDefinition[] = [
  {
    name: "read_file",
    description: "Read the content of a file. Returns the full text content.",
    inputSchema: { type: "object", properties: { path: { type: "string", description: "File path relative to workspace root" }, start_line: { type: "number", description: "Optional start line (1-indexed)" }, end_line: { type: "number", description: "Optional end line (1-indexed)" } }, required: ["path"] },
  },
  {
    name: "list_directory",
    description: "List files and directories at the given path. Returns max 30 entries per page. Use offset to paginate.",
    inputSchema: { type: "object", properties: { path: { type: "string", description: "Directory path relative to workspace root" }, recursive: { type: "boolean", description: "Whether to list recursively (default false, max depth 2)" }, limit: { type: "number", description: "Max entries per page (default 30)" }, offset: { type: "number", description: "Skip first N entries (default 0, for pagination)" } }, required: ["path"] },
  },
  {
    name: "search_text",
    description: "Search for text pattern in files. Returns matching lines with file paths and line numbers.",
    inputSchema: { type: "object", properties: { pattern: { type: "string", description: "Text or regex pattern" }, include: { type: "string", description: "Glob pattern for files (e.g. '**/*.ts')" }, max_results: { type: "number", description: "Maximum results (default 20)" } }, required: ["pattern"] },
  },
  {
    name: "write_file",
    description: "Write content to a file. Creates if not exists, overwrites if it does.",
    inputSchema: { type: "object", properties: { path: { type: "string", description: "File path relative to workspace root" }, content: { type: "string", description: "Content to write" } }, required: ["path", "content"] },
  },
  {
    name: "get_diagnostics",
    description: "Get compile errors, warnings, and lint issues for a file or workspace.",
    inputSchema: { type: "object", properties: { path: { type: "string", description: "File path (optional — omit for all)" } } },
  },
  {
    name: "get_open_files",
    description: "Get the list of currently open files in the editor.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "web_search",
    description: "Search the web using SearXNG/DuckDuckGo. Returns structured results with title, URL, and snippet.",
    inputSchema: { type: "object", properties: { query: { type: "string", description: "Search query" }, num_results: { type: "number", description: "Max results 1-10 (default 5)" }, category: { type: "string", description: "Search category (default: general)" }, language: { type: "string", description: "Language code (default: en)" } }, required: ["query"] },
  },
  {
    name: "fetch_url",
    description: "Fetch and extract text content from a web URL. Strips HTML, returns plain text.",
    inputSchema: { type: "object", properties: { url: { type: "string", description: "URL to fetch (http/https)" }, mode: { type: "string", description: "full (default) or truncated" }, max_length: { type: "number", description: "Max chars to return (default 50000)" } }, required: ["url"] },
  },
  {
    name: "execute_shell",
    description: "Execute a shell command in the workspace. Returns stdout on success. Use for build, test, git, package manager, and other CLI operations. Requires user approval before execution.",
    inputSchema: { type: "object", properties: { command: { type: "string", description: "Shell command to execute (e.g. 'npm test', 'git status', 'ls -la')" }, cwd: { type: "string", description: "Working directory (optional, defaults to workspace root)" }, timeout: { type: "number", description: "Timeout in milliseconds (optional, default 120000)" } }, required: ["command"] },
  },
];

const VSCODE_TOOL_NAMES = new Set(VSCODE_TOOL_DEFINITIONS.map(t => t.name));

export function isVscodeTool(name: string): boolean {
  return VSCODE_TOOL_NAMES.has(name);
}
