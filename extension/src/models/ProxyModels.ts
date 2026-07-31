/**
 * ProxyModels — Data types for proxy configuration feature.
 * Pure interfaces/types — no logic, no side effects.
 */

/** Proxy operating mode */
export type ProxyMode = "none" | "system" | "manual";

/** Persisted proxy configuration (VS Code settings) */
export interface ProxyConfig {
  mode: ProxyMode;
  host: string;
  port: number;
  bypass: string;
}

/** Proxy credentials (SecretStorage — NEVER in settings JSON) */
export interface ProxyCredentials {
  username: string;
  password: string;
}

/** Full proxy state sent to webview for rendering */
export interface ProxyState {
  mode: ProxyMode;
  host: string;
  port: number;
  bypass: string;
  hasCredentials: boolean;
  username: string;
  detectedProxyUrl: string | null;
  detectedBypass: string | null;
}

/** Result of proxy connectivity test */
export interface ProxyTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
}

/** Input for test proxy connection (unsaved form values) */
export interface ProxyTestInput {
  mode: ProxyMode;
  host: string;
  port: number;
  username?: string;
  password?: string;
  testUrl?: string;
}
