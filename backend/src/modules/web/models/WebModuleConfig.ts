/**
 * Configuration interface for WebModule.
 * All values have sensible defaults, overridable via environment variables.
 */

export interface WebModuleConfig {
  searxngUrl: string;
  rateLimitRpm: number;
  timeoutMs: number;
  maxResponseKb: number;
  maxDownloadMb: number;
  maxBrowserContexts: number;
  blockedExtensions: string[];
  ssrfBlocklist: string[];
  userAgent: string;
  workspace: string;
}

export function loadWebConfig(workspace: string): WebModuleConfig {
  return {
    searxngUrl: process.env.WEB_SEARXNG_URL || 'http://localhost:8080',
    rateLimitRpm: parseInt(process.env.WEB_RATE_LIMIT_RPM || '10', 10),
    timeoutMs: parseInt(process.env.WEB_TIMEOUT_MS || '30000', 10),
    maxResponseKb: parseInt(process.env.WEB_MAX_RESPONSE_KB || '100', 10),
    maxDownloadMb: parseInt(process.env.WEB_MAX_DOWNLOAD_MB || '50', 10),
    maxBrowserContexts: parseInt(process.env.WEB_MAX_BROWSER_CONTEXTS || '3', 10),
    blockedExtensions: ['.exe', '.bat', '.cmd', '.ps1', '.sh', '.msi', '.scr'],
    ssrfBlocklist: [
      '127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12',
      '192.168.0.0/16', '169.254.0.0/16', '::1/128', 'fc00::/7',
    ],
    userAgent: process.env.WEB_USER_AGENT || 'Kiro-WebModule/1.0',
    workspace,
  };
}
