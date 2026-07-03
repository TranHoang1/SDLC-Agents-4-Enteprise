/**
 * drawio_export_png — Export .drawio file to PNG image.
 *
 * Priority order for rendering:
 * 1. draw.io CLI (drawio desktop app) — fastest, most accurate
 * 2. chrome-devtools-mcp (upstream MCP) — uses browser screenshot
 * 3. puppeteer MCP (upstream MCP) — headless browser
 *
 * If none available, tool is NOT published (hidden from tool list).
 *
 * Input: relative path to .drawio file
 * Output: relative path to exported .png file
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export const DRAWIO_EXPORT_PNG_DEFINITION = {
  name: 'drawio_export_png',
  description: 'Export a .drawio diagram file to PNG image. Returns the relative path to the exported PNG file.',
  inputSchema: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Relative path to .drawio file (relative to workspace root)',
      },
    },
    required: ['file_path'],
  },
};

/** Renderer type detected at runtime */
type RendererType = 'drawio-cli' | 'chrome-devtools-mcp' | 'puppeteer-mcp' | 'none';

/** Cached renderer detection result */
let cachedRenderer: RendererType | null = null;
let cachedDrawioCliPath: string | null = null;

/**
 * Detect which renderer is available (priority order).
 * Result is cached for the session.
 */
export function detectRenderer(orchestrationEngine?: any): RendererType {
  if (cachedRenderer !== null) return cachedRenderer;

  // Priority 1: draw.io CLI
  const cliPath = findDrawioCli();
  if (cliPath) {
    cachedDrawioCliPath = cliPath;
    cachedRenderer = 'drawio-cli';
    console.error(`[drawio-export] Renderer: draw.io CLI at ${cliPath}`);
    return cachedRenderer;
  }

  // Priority 2: chrome-devtools-mcp (check orchestration)
  if (orchestrationEngine && hasUpstreamServer(orchestrationEngine, 'chrome-devtools-mcp')) {
    cachedRenderer = 'chrome-devtools-mcp';
    console.error('[drawio-export] Renderer: chrome-devtools-mcp (upstream)');
    return cachedRenderer;
  }

  // Priority 3: puppeteer MCP
  if (orchestrationEngine && hasUpstreamServer(orchestrationEngine, 'puppeteer')) {
    cachedRenderer = 'puppeteer-mcp';
    console.error('[drawio-export] Renderer: puppeteer-mcp (upstream)');
    return cachedRenderer;
  }

  cachedRenderer = 'none';
  console.error('[drawio-export] No renderer available — tool will be hidden');
  return cachedRenderer;
}

/** Check if tool should be published (at least one renderer available) */
export function isExportPngAvailable(orchestrationEngine?: any): boolean {
  return detectRenderer(orchestrationEngine) !== 'none';
}

/** Reset cached renderer (for testing or when orchestration changes) */
export function resetRendererCache(): void {
  cachedRenderer = null;
  cachedDrawioCliPath = null;
}

/**
 * Handle the drawio_export_png tool call.
 * Returns JSON with relative path to PNG or error.
 */
export async function handleDrawioExportPng(
  args: Record<string, unknown>,
  workspace: string,
  orchestrationEngine?: any
): Promise<string> {
  const rawPath = args.file_path as string | undefined;
  if (!rawPath) return jsonError('file_path is required');

  // Resolve paths
  const filePath = path.isAbsolute(rawPath)
    ? rawPath
    : path.resolve(workspace, rawPath);

  if (!fs.existsSync(filePath)) return jsonError(`File not found: ${rawPath}`);
  if (!filePath.endsWith('.drawio')) return jsonError('File must have .drawio extension');

  // Output path: same directory, same name, .png extension
  const pngPath = filePath.replace(/\.drawio$/, '.png');
  const relativePngPath = path.relative(workspace, pngPath).replace(/\\/g, '/');

  const renderer = detectRenderer(orchestrationEngine);

  try {
    switch (renderer) {
      case 'drawio-cli':
        await exportWithCli(filePath, pngPath);
        break;
      case 'chrome-devtools-mcp':
        await exportWithChrome(filePath, pngPath, workspace, orchestrationEngine);
        break;
      case 'puppeteer-mcp':
        await exportWithPuppeteer(filePath, pngPath, workspace, orchestrationEngine);
        break;
      default:
        return jsonError('No renderer available. Install draw.io desktop or configure chrome-devtools-mcp.');
    }

    // Verify output exists
    if (!fs.existsSync(pngPath)) {
      return jsonError(`Export failed — PNG file was not created at ${relativePngPath}`);
    }

    const stats = fs.statSync(pngPath);
    return JSON.stringify({
      success: true,
      file_path: relativePngPath,
      size_bytes: stats.size,
      renderer: renderer,
    });
  } catch (e: any) {
    return jsonError(`Export failed: ${e.message ?? e}`);
  }
}

// ─── Renderer Implementations ────────────────────────────────────────────────

/** Priority 1: Export using draw.io CLI */
async function exportWithCli(inputPath: string, outputPath: string): Promise<void> {
  if (!cachedDrawioCliPath) throw new Error('draw.io CLI path not cached');

  const cmd = `"${cachedDrawioCliPath}" --export --format png --border 10 --output "${outputPath}" "${inputPath}"`;
  execSync(cmd, { timeout: 30000, stdio: 'pipe' });
}

/** Priority 2: Export using chrome-devtools-mcp */
async function exportWithChrome(
  inputPath: string,
  outputPath: string,
  _workspace: string,
  orchestrationEngine: any
): Promise<void> {
  const xml = fs.readFileSync(inputPath, 'utf-8');
  const encoded = Buffer.from(xml).toString('base64');
  const viewerUrl = `https://viewer.diagrams.net/?lightbox=1&nav=0#R${encoded}`;

  // Navigate to viewer
  await orchestrationEngine.executeUpstreamTool('chrome-devtools-mcp', 'navigate_page', {
    type: 'url',
    url: viewerUrl,
    timeout: 15000,
  });

  // Wait for diagram to render
  await sleep(3000);

  // Take screenshot and save to file
  await orchestrationEngine.executeUpstreamTool('chrome-devtools-mcp', 'take_screenshot', {
    format: 'png',
    fullPage: true,
    filePath: outputPath,
  });
}

/** Priority 3: Export using puppeteer MCP */
async function exportWithPuppeteer(
  inputPath: string,
  outputPath: string,
  _workspace: string,
  orchestrationEngine: any
): Promise<void> {
  const xml = fs.readFileSync(inputPath, 'utf-8');
  const encoded = Buffer.from(xml).toString('base64');
  const viewerUrl = `https://viewer.diagrams.net/?lightbox=1&nav=0#R${encoded}`;

  await orchestrationEngine.executeUpstreamTool('puppeteer', 'navigate', {
    url: viewerUrl,
  });

  await sleep(3000);

  await orchestrationEngine.executeUpstreamTool('puppeteer', 'screenshot', {
    path: outputPath,
    fullPage: true,
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Find draw.io CLI executable on the system */
function findDrawioCli(): string | null {
  const candidates: string[] = [];

  if (process.platform === 'win32') {
    candidates.push(
      'C:\\Program Files\\draw.io\\draw.io.exe',
      `${process.env.LOCALAPPDATA || ''}\\Programs\\draw.io\\draw.io.exe`,
      `${process.env.PROGRAMFILES || ''}\\draw.io\\draw.io.exe`,
    );
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/draw.io.app/Contents/MacOS/draw.io',
      '/usr/local/bin/drawio',
      `${process.env.HOME || ''}/Applications/draw.io.app/Contents/MacOS/draw.io`,
    );
  } else {
    // Linux
    candidates.push(
      '/usr/bin/drawio',
      '/usr/local/bin/drawio',
      '/snap/bin/drawio',
      `${process.env.HOME || ''}/.local/bin/drawio`,
    );
  }

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Try PATH lookup
  try {
    const which = process.platform === 'win32' ? 'where drawio 2>nul' : 'which drawio';
    const result = execSync(which, { timeout: 5000, stdio: 'pipe' }).toString().trim();
    if (result && fs.existsSync(result.split('\n')[0])) {
      return result.split('\n')[0];
    }
  } catch { /* not in PATH */ }

  return null;
}

/** Check if an upstream MCP server exists in orchestration */
function hasUpstreamServer(orchestrationEngine: any, serverName: string): boolean {
  try {
    const status = orchestrationEngine.getStatus?.();
    if (!status?.servers) return false;
    return status.servers.some((s: any) =>
      s.name?.toLowerCase().includes(serverName.toLowerCase()) && s.state === 'ACTIVE'
    );
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function jsonError(msg: string): string {
  return JSON.stringify({ success: false, error: msg });
}
