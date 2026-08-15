/**
 * SA4E-110 - Server configuration interface and defaults.
 * Defines timeouts, rate limits, and health check parameters.
 */

/** Full configuration for the Atlassian child server */
export interface ServerConfig {
  /** Request timeout in milliseconds */
  timeouts: { default: number; upload: number };
  /** Rate limiter settings */
  rateLimiter: { maxTokens: number; refillIntervalMs: number };
  /** Health check interval */
  healthCheck: { intervalMs: number; timeoutMs: number };
  /** Server metadata */
  server: { name: string; version: string };
}

/** Default configuration values */
export const DEFAULT_CONFIG: ServerConfig = {
  timeouts: { default: 30000, upload: 120000 },
  rateLimiter: { maxTokens: 100, refillIntervalMs: 60000 },
  healthCheck: { intervalMs: 30000, timeoutMs: 5000 },
  server: { name: 'atlassian-mcp-server', version: '1.0.0' },
};

/**
 * Create server config merging defaults with overrides.
 * @param overrides Partial config to merge
 * @returns Complete ServerConfig
 */
export function createConfig(overrides?: Partial<ServerConfig>): ServerConfig {
  if (!overrides) return DEFAULT_CONFIG;
  return {
    timeouts: { ...DEFAULT_CONFIG.timeouts, ...overrides.timeouts },
    rateLimiter: { ...DEFAULT_CONFIG.rateLimiter, ...overrides.rateLimiter },
    healthCheck: { ...DEFAULT_CONFIG.healthCheck, ...overrides.healthCheck },
    server: { ...DEFAULT_CONFIG.server, ...overrides.server },
  };
}