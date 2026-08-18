/**
 * Resolve backend URL from VS Code settings.
 * Default value provided by package.json contributes.configuration.
 * No hardcoded fallback — single source of truth is package.json default.
 */
import * as vscode from "vscode";

/** Compile-time fallback — matches package.json configuration default. */
const DEFAULT_BACKEND_URL = "http://127.0.0.1:48721";

/**
 * Get configured backend URL from kiroSdlc.backend.url setting.
 * Uses VS Code setting default defined in package.json.
 * @returns Backend URL string with trailing slash stripped (never empty)
 */
export function getBackendUrl(): string {
  const config = vscode.workspace.getConfiguration("kiroSdlc");
  const url = config.get<string>("backend.url");
  if (!url) {
    // package.json should always provide default — safety net only
    return DEFAULT_BACKEND_URL;
  }
  return url.replace(/\/$/, "");
}
