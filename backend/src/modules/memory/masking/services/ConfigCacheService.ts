import { MaskingConfig, AllowlistRule } from '../models/MaskingTypes.js';

/**
 * In-memory cache for masking configuration with TTL-based invalidation.
 */
export class ConfigCacheService {
  private configCache: MaskingConfig[] | null = null;
  private allowlistCache: AllowlistRule[] | null = null;
  private configLoadedAt = 0;
  private allowlistLoadedAt = 0;
  private readonly TTL = 60_000;

  private configLoader: (() => MaskingConfig[]) | null = null;
  private allowlistLoader: (() => AllowlistRule[]) | null = null;

  setLoaders(
    configLoader: () => MaskingConfig[],
    allowlistLoader: () => AllowlistRule[]
  ): void {
    this.configLoader = configLoader;
    this.allowlistLoader = allowlistLoader;
  }

  getConfig(): MaskingConfig[] {
    const now = Date.now();
    if (!this.configCache || (now - this.configLoadedAt) > this.TTL) {
      this.configCache = this.configLoader?.() ?? [];
      this.configLoadedAt = now;
    }
    return this.configCache;
  }

  getAllowlist(): AllowlistRule[] {
    const now = Date.now();
    if (!this.allowlistCache || (now - this.allowlistLoadedAt) > this.TTL) {
      this.allowlistCache = this.allowlistLoader?.() ?? [];
      this.allowlistLoadedAt = now;
    }
    return this.allowlistCache;
  }

  invalidateConfig(): void { this.configCache = null; }
  invalidateAllowlist(): void { this.allowlistCache = null; }
  invalidateAll(): void { this.configCache = null; this.allowlistCache = null; }
}
