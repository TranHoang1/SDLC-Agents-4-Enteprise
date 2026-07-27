export type DeploymentMode = 'in-process' | 'worker-pool';

export interface PegaConfig {
  workerPoolSize: number;
  sandboxTimeoutMs: number;
  maxDecisionRows: number;
  deploymentMode: DeploymentMode;
  cacheTtlMs: number;
  cacheMaxEntries: number;
}

const DEFAULT_CONFIG: PegaConfig = {
  workerPoolSize: 2,
  sandboxTimeoutMs: 5000,
  maxDecisionRows: 10000,
  deploymentMode: 'in-process',
  cacheTtlMs: 300_000,
  cacheMaxEntries: 1000,
};

export class PegaConfigProvider {
  private config: PegaConfig;

  constructor(overrides?: Partial<PegaConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...overrides };
    this.loadFromEnv();
  }

  private loadFromEnv(): void {
    const env = process.env;
    if (env.PEGA_WORKER_POOL_SIZE) this.config.workerPoolSize = parseInt(env.PEGA_WORKER_POOL_SIZE, 10);
    if (env.PEGA_SANDBOX_TIMEOUT_MS) this.config.sandboxTimeoutMs = parseInt(env.PEGA_SANDBOX_TIMEOUT_MS, 10);
    if (env.PEGA_MAX_DECISION_ROWS) this.config.maxDecisionRows = parseInt(env.PEGA_MAX_DECISION_ROWS, 10);
    if (env.PEGA_DEPLOYMENT_MODE === 'worker-pool') this.config.deploymentMode = 'worker-pool';
    if (env.PEGA_CACHE_TTL_MS) this.config.cacheTtlMs = parseInt(env.PEGA_CACHE_TTL_MS, 10);
    if (env.PEGA_CACHE_MAX_ENTRIES) this.config.cacheMaxEntries = parseInt(env.PEGA_CACHE_MAX_ENTRIES, 10);
  }

  getConfig(): PegaConfig {
    return { ...this.config };
  }
}
