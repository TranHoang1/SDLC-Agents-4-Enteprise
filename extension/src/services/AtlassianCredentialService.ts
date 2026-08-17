/**
 * SA4E-110 — AtlassianCredentialService.
 * Manages Atlassian credentials via SecretStorage, provides IPC handler
 * for child server getCredentials requests, and tests connectivity.
 */

import * as vscode from "vscode";
import { SECRET_KEYS } from "../models";
import type { CredentialResponse } from "./AtlassianTypes";

/** Atlassian connection configuration */
export interface AtlassianConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  connectionType: "cloud" | "server";
}

/** Result of a connection test */
export interface AtlassianTestResult {
  success: boolean;
  message: string;
}

/**
 * Reads/writes Atlassian credentials from VS Code SecretStorage,
 * tests connectivity, and responds to IPC credential requests.
 */
export class AtlassianCredentialService {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  /** Persist Atlassian config to SecretStorage after URL validation. */
  async saveConfig(config: AtlassianConfig): Promise<void> {
    this.validateUrl(config.baseUrl);
    await this.secrets.store(SECRET_KEYS.atlassianBaseUrl, config.baseUrl);
    await this.secrets.store(SECRET_KEYS.atlassianEmail, config.email);
    await this.secrets.store(SECRET_KEYS.atlassianToken, config.apiToken);
    await this.storeConnectionType(config.connectionType);
  }

  /** Read Atlassian config from SecretStorage. Returns null if incomplete. */
  async getConfig(): Promise<AtlassianConfig | null> {
    const baseUrl = await this.secrets.get(SECRET_KEYS.atlassianBaseUrl);
    const email = await this.secrets.get(SECRET_KEYS.atlassianEmail);
    const apiToken = await this.secrets.get(SECRET_KEYS.atlassianToken);
    if (!baseUrl || !email || !apiToken) { return null; }
    const connectionType = await this.readConnectionType();
    return { baseUrl, email, apiToken, connectionType };
  }

  /** Test connection by calling GET /rest/api/2/myself with Basic auth. */
  async testConnection(): Promise<AtlassianTestResult> {
    const config = await this.getConfig();
    if (!config) {
      return { success: false, message: "No credentials configured." };
    }
    return this.performMyselfRequest(config);
  }

  /** Build IPC credential response for a child server request. */
  async handleCredentialRequest(requestId: string): Promise<CredentialResponse> {
    const config = await this.getConfig();
    if (!config) {
      throw new Error("Atlassian credentials not configured in extension.");
    }
    return {
      type: "credentials",
      requestId,
      timestamp: Date.now(),
      credentials: {
        email: config.email,
        apiToken: config.apiToken,
        baseUrl: config.baseUrl,
      },
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private validateUrl(url: string): void {
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("URL must use http or https protocol.");
      }
    } catch {
      throw new Error("Invalid Jira Base URL format.");
    }
  }

  private async storeConnectionType(type: "cloud" | "server"): Promise<void> {
    const config = vscode.workspace.getConfiguration("kiroSdlc");
    await config.update("atlassianConnectionType", type, vscode.ConfigurationTarget.Global);
  }

  private async readConnectionType(): Promise<"cloud" | "server"> {
    const config = vscode.workspace.getConfiguration("kiroSdlc");
    const val = config.get<string>("atlassianConnectionType", "cloud");
    return val === "server" ? "server" : "cloud";
  }

  private async performMyselfRequest(config: AtlassianConfig): Promise<AtlassianTestResult> {
    const url = `${config.baseUrl.replace(/\/+$/, "")}/rest/api/2/myself`;
    const token = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Basic ${token}`, Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return this.interpretResponse(res);
    } catch (err: any) {
      return { success: false, message: `Connection failed: ${err.message}` };
    }
  }

  private async interpretResponse(res: Response): Promise<AtlassianTestResult> {
    if (res.ok) {
      const data = await res.json() as { displayName?: string };
      const name = data.displayName || "Unknown User";
      return { success: true, message: `Connected as ${name}` };
    }
    if (res.status === 401) {
      return { success: false, message: "Authentication failed (401). Check email/token." };
    }
    return { success: false, message: `HTTP ${res.status}: ${res.statusText}` };
  }
}
