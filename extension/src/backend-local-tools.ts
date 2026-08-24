/**
 * Local tool execution layer for RemoteBackendClient.
 * Handles tools that execute locally (stream_write_file, embed_image, pega_*).
 *
 * Base64 proxy logic has been extracted to services/Base64ProxyService.ts
 * following SRP — this file only handles local tool execution + definitions.
 *
 * OCP: Tool handlers registered in LOCAL_TOOL_REGISTRY — adding a new local
 * tool does NOT require editing executeLocalTool().
 */
import * as fs from "fs";
import * as path from "path";

let vscode: any;
try { vscode = require('vscode'); } catch {}

/** Type for a local tool handler function. */
type LocalToolHandler = (args: Record<string, unknown>) => unknown;

/** Definition shape for a local tool (injected into tools/list). */
export interface LocalToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Hidden tools are executable + discoverable via find_tools but omitted from tools/list. */
  hidden?: boolean;
}

/** A registry entry couples a handler with its definition. */
interface LocalToolEntry {
  handler: LocalToolHandler;
  definition: LocalToolDefinition;
}

/**
 * Registry of local tool handlers — OCP compliant.
 * To add a new local tool: call registerLocalTool(name, handler, definition).
 */
const LOCAL_TOOL_REGISTRY: Map<string, LocalToolEntry> = new Map([
  ["stream_write_file", { handler: handleStreamWriteFile, definition: streamWriteFileDefinition() }],
  ["embed_image", { handler: handleEmbedImage, definition: embedImageDefinition() }],
]);

/**
 * Register a new local tool handler + definition (OCP: no switch/case needed).
 */
export function registerLocalTool(
  name: string,
  handler: LocalToolHandler,
  definition: LocalToolDefinition,
): void {
  LOCAL_TOOL_REGISTRY.set(name, { handler, definition });
}

/** Whether a tool name is handled locally (no backend forwarding). */
export function isLocalTool(name: string): boolean {
  return LOCAL_TOOL_REGISTRY.has(name);
}

export async function executeLocalTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const entry = LOCAL_TOOL_REGISTRY.get(name);
  if (entry) return entry.handler(args);
  return { isError: true, content: [{ type: "text", text: `Local tool '${name}' not implemented.` }] };
}

/** Tool definitions for local tools, injected into tools/list responses. */
export function getLocalToolDefinitions(): LocalToolDefinition[] {
  return [...LOCAL_TOOL_REGISTRY.values()].map((e) => e.definition);
}

/**
 * Visible tool definitions for tools/list — excludes hidden tools.
 * Hidden tools stay discoverable via find_tools and callable via
 * execute_dynamic_tool, but do not clutter the LLM tool list.
 */
export function getVisibleLocalToolDefinitions(): LocalToolDefinition[] {
  return getLocalToolDefinitions().filter((d) => !d.hidden);
}

// --- Local tool implementations ---

function streamWriteFileDefinition(): LocalToolDefinition {
  return {
    name: "stream_write_file",
    description: "Write or append content to a local workspace file (creates parent dirs). Path can be relative to workspace root.",
    inputSchema: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "Target file path" },
        content: { type: "string", description: "Content to write" },
        mode: { type: "string", enum: ["write", "append"], default: "write" },
      },
      required: ["file_path", "content"],
    },
  };
}

function embedImageDefinition(): LocalToolDefinition {
  return {
    name: "embed_image",
    description: "Replace local image refs in markdown with base64 data URIs.",
    inputSchema: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "Path to source markdown file" },
        output_path: { type: "string", description: "Output path (default: <name>-embedded.md)" },
      },
      required: ["file_path"],
    },
  };
}

function handleStreamWriteFile(args: Record<string, unknown>): any {
  const rawPath = (args.file_path ?? args.path) as string;
  const content = args.content as string;
  const mode = (args.mode as string) || "write";
  if (!rawPath || typeof content !== "string") {
    return { isError: true, content: [{ type: "text", text: "'file_path' and 'content' required." }] };
  }
  let workspaceRoot: string | undefined;
  try {
    workspaceRoot = vscode?.workspace?.workspaceFolders?.[0]?.uri?.fsPath;
  } catch {}
  workspaceRoot = workspaceRoot ?? process.cwd();
  let resolvedPath: string;
  if (path.isAbsolute(rawPath)) {
    resolvedPath = path.resolve(rawPath);
  } else {
    resolvedPath = path.resolve(workspaceRoot, rawPath);
  }
  if (workspaceRoot) {
    const normalizedRoot = path.normalize(workspaceRoot + path.sep);
    const normalizedPath = path.normalize(resolvedPath);
    if (!normalizedPath.startsWith(normalizedRoot)) {
      return { isError: true, content: [{ type: "text", text: `Path rejected: ${rawPath} is outside workspace.` }] };
    }
  }
  try {
    ensureDir(path.dirname(resolvedPath));
    if (mode === "append") {
      fs.appendFileSync(resolvedPath, content, "utf-8");
      return { isError: false, content: [{ type: "text", text: `Appended to: ${resolvedPath}` }] };
    }
    fs.writeFileSync(resolvedPath, content, "utf-8");
    return { isError: false, content: [{ type: "text", text: `Wrote file: ${resolvedPath}` }] };
  } catch (err: any) {
    return { isError: true, content: [{ type: "text", text: `Failed to write ${resolvedPath}: ${err.message}` }] };
  }
}

/** MIME types by image extension for data-URI embedding. */
const IMAGE_MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp",
};

/** Matches markdown image references: ![alt](path "optional title"). */
const MD_IMAGE_RE = /!\[([^\]]*)\]\(\s*([^)\s]+)(\s+"[^"]*")?\s*\)/g;

function handleEmbedImage(args: Record<string, unknown>): any {
  const filePath = (args.file_path ?? args.path) as string;
  if (!filePath || typeof filePath !== "string") {
    return { isError: true, content: [{ type: "text", text: "Invalid arguments: 'file_path' required." }] };
  }
  const outputPath = (args.output_path as string) || defaultEmbeddedPath(filePath);
  try {
    const { output, embedded, skipped } = embedMarkdownImages(
      fs.readFileSync(filePath, "utf-8"), path.dirname(filePath)
    );
    fs.writeFileSync(outputPath, output, "utf-8");
    return { isError: false, content: [{ type: "text", text: `Embedded ${embedded} image(s), skipped ${skipped} → ${outputPath}` }] };
  } catch (err: any) {
    return { isError: true, content: [{ type: "text", text: `Failed: ${err.message}` }] };
  }
}

function defaultEmbeddedPath(filePath: string): string {
  const ext = path.extname(filePath);
  return filePath.slice(0, filePath.length - ext.length) + "-embedded" + (ext || ".md");
}

function embedMarkdownImages(markdown: string, baseDir: string): { output: string; embedded: number; skipped: number } {
  let embedded = 0, skipped = 0;
  const output = markdown.replace(MD_IMAGE_RE, (match, alt, src, title) => {
    if (/^(https?:|data:)/i.test(src)) { skipped++; return match; }
    const dataUri = imageToDataUri(path.resolve(baseDir, decodeURI(src)));
    if (!dataUri) { skipped++; return match; }
    embedded++;
    return `![${alt}](${dataUri}${title || ""})`;
  });
  return { output, embedded, skipped };
}

function imageToDataUri(imagePath: string): string | null {
  try {
    const mime = IMAGE_MIME[path.extname(imagePath).toLowerCase()] || "application/octet-stream";
    return `data:${mime};base64,${fs.readFileSync(imagePath).toString("base64")}`;
  } catch (err) {
    console.debug("[backend-local-tools] imageToDataUri failed for " + imagePath + ": " + (err as Error).message);
    return null;
  }
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
