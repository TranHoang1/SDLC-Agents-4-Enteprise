/**
 * MCP server config injection — handles migration from legacy scripts,
 * downloads MCP servers from GitHub Release, and injects config.
 */
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { MCP_VARIANTS } from "./config";
import { debugError } from "./debug-logger";
import { resolveConfig, writeDefaultOrchestrationConfig, writeMcpConfig, downloadVariant } from "./mcp-config-builder";

/** Migrate legacy scripts folder and report what was cleaned up. */
export function migrateLegacyScripts(root: string): { removed: boolean } {
  let removed = false;
  const scriptsDir = path.join(root, ".analysis", "code-intelligence", "scripts");
  if (fs.existsSync(scriptsDir)) { fs.rmSync(scriptsDir, { recursive: true, force: true }); removed = true; }
  return { removed };
}

/** Show picker for MCP variant and inject config into .kiro/settings/mcp.json. */
export async function injectMcpConfig(root: string): Promise<string | null> {
  const variantPicks = MCP_VARIANTS.map(v => ({ label: v.label, description: v.description, variant: v }));
  const selected = await vscode.window.showQuickPick(variantPicks, {
    placeHolder: "Step 1/2: Choose Code Intelligence MCP server variant"
  });
  if (!selected) { return null; }
  const variant = selected.variant;
  if (variant.delivery === "download") {
    const ok = await downloadVariant(variant, root);
    if (!ok) { return null; }
  }
  const ollamaEnv = await promptOllamaSetup();
  const resolvedConfig = resolveConfig(variant, ollamaEnv, root);
  writeMcpConfig(root, resolvedConfig);
  writeDefaultOrchestrationConfig(root);
  return variant.id;
}

/** Check if MCP code-intelligence config exists in workspace. */
export function hasMcpConfig(workspaceRoot: string): boolean {
  const mcpConfigPath = path.join(workspaceRoot, ".kiro", "settings", "mcp.json");
  if (!fs.existsSync(mcpConfigPath)) { return false; }
  try {
    const config = JSON.parse(fs.readFileSync(mcpConfigPath, "utf-8"));
    return !!config?.mcpServers?.["code-intelligence"];
  } catch { return false; }
}

/** Write HTTP Streamable MCP config for the remote backend. */
export function writeBundledMcpConfig(workspaceRoot: string, port: number): void {
  const serverConfig = { url: `http://127.0.0.1:${port}/mcp`, transportType: "httpStream", disabled: false };
  writeMcpConfig(workspaceRoot, serverConfig);
}

/** Remove the bundled code-intelligence entry from .kiro/settings/mcp.json. */
export function removeBundledMcpConfig(workspaceRoot: string): void {
  const mcpConfigPath = path.join(workspaceRoot, ".kiro", "settings", "mcp.json");
  if (!fs.existsSync(mcpConfigPath)) { return; }
  try {
    const config = JSON.parse(fs.readFileSync(mcpConfigPath, "utf-8"));
    if (config?.mcpServers?.["code-intelligence"]) {
      delete config.mcpServers["code-intelligence"];
      if (Object.keys(config.mcpServers).length === 0) { delete config.mcpServers; }
      fs.writeFileSync(mcpConfigPath, JSON.stringify(config, null, 2));
    }
  } catch (err) { debugError("[McpInjector] Failed to remove bundled mcp config", err as Error); }
}

async function promptOllamaSetup(): Promise<Record<string, string>> {
  const enableOllama = await vscode.window.showQuickPick(
    [
      { label: "No — FTS5 keyword search only (fast, zero setup)", value: false },
      { label: "Yes — Enable semantic search with Ollama", value: true }
    ],
    { placeHolder: "Step 2/2: Enable Ollama semantic search?" }
  );
  if (!enableOllama || !enableOllama.value) { return {}; }
  const url = await vscode.window.showInputBox({
    prompt: "Ollama server URL", value: "http://localhost:11434", placeHolder: "http://localhost:11434"
  });
  if (!url) { return {}; }
  const model = await pickOllamaModel(url);
  if (!model) { return {}; }
  return { OLLAMA_URL: url, OLLAMA_MODEL: model };
}

async function pickOllamaModel(ollamaUrl: string): Promise<string | null> {
  try {
    const response = await fetch(`${ollamaUrl}/api/tags`);
    if (!response.ok) {
      vscode.window.showErrorMessage(`Cannot reach Ollama at ${ollamaUrl} (HTTP ${response.status})`);
      return null;
    }
    const data = await response.json() as { models?: { name: string }[] };
    const models = (data.models || []).map(m => m.name);
    if (models.length === 0) {
      vscode.window.showWarningMessage("No models found. Run: ollama pull nomic-embed-text");
      return "nomic-embed-text";
    }
    const picks = models.map(m => ({ label: m, description: m.includes("embed") ? "⭐ embedding model" : "" }));
    const selected = await vscode.window.showQuickPick(picks, { placeHolder: "Choose embedding model" });
    return selected?.label || null;
  } catch (err) {
    vscode.window.showErrorMessage(`Cannot connect to Ollama: ${err}`);
    const manual = await vscode.window.showInputBox({ prompt: "Ollama model name (manual)", value: "nomic-embed-text" });
    return manual ?? null;
  }
}
