/**
 * InstinctConfigService — reads/writes instinct-specific configuration
 * from decay_config table. Provides typed access to all 9 instinct parameters.
 * SA4E-121: Instincts and Confidence Scoring System.
 */

import type { DatabaseAdapter } from '../../../database/adapters/DatabaseAdapter.js';
import { DialectHelper } from '../../../database/dialect/DialectHelper.js';

/** Typed instinct configuration with defaults. */
export interface InstinctConfig {
  instinct_initial_confidence: number;
  instinct_confidence_floor: number;
  instinct_confidence_ceiling: number;
  instinct_decay_rate: number;
  instinct_boost_factor: number;
  instinct_fail_factor: number;
  instinct_access_threshold_days: number;
  instinct_promotion_threshold: number;
  contradiction_similarity_threshold: number;
}

/** Default instinct configuration values. */
const DEFAULTS: InstinctConfig = {
  instinct_initial_confidence: 0.5,
  instinct_confidence_floor: 0.3,
  instinct_confidence_ceiling: 0.9,
  instinct_decay_rate: 0.08,
  instinct_boost_factor: 1.1,
  instinct_fail_factor: 0.9,
  instinct_access_threshold_days: 14,
  instinct_promotion_threshold: 3,
  contradiction_similarity_threshold: 0.85,
};

export class InstinctConfigService {
  private readonly adapter: DatabaseAdapter;
  private readonly dialect: DialectHelper;

  constructor(adapter: DatabaseAdapter) {
    this.adapter = adapter;
    this.dialect = new DialectHelper(adapter.getEngine());
  }

  /** Read all instinct config, applying defaults for missing keys. */
  async getInstinctConfig(): Promise<InstinctConfig> {
    const rows = await this.adapter.allAsync<{ key: string; value: string }>(
      `SELECT key, value FROM decay_config WHERE key LIKE 'instinct_%' OR key = 'contradiction_similarity_threshold'`,
    );
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    return this.parseConfig(map);
  }

  /** Update specific instinct config keys. Returns full config after update. */
  async setInstinctConfig(updates: Partial<InstinctConfig>): Promise<InstinctConfig> {
    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined) {
        await this.adapter.runAsync(
          `UPDATE decay_config SET value = ?, updated_at = ${this.dialect.now()} WHERE key = ?`,
          [String(val), key],
        );
      }
    }
    return this.getInstinctConfig();
  }

  /** Seed default instinct config rows (idempotent). */
  async seedDefaults(): Promise<void> {
    for (const [key, val] of Object.entries(DEFAULTS)) {
      await this.adapter.runAsync(
        `INSERT INTO decay_config (key, value, updated_at) VALUES (?, ?, ${this.dialect.now()}) ON CONFLICT (key) DO NOTHING`,
        [key, String(val)],
      );
    }
  }

  private parseConfig(map: Record<string, string>): InstinctConfig {
    return {
      instinct_initial_confidence: Number(map.instinct_initial_confidence ?? DEFAULTS.instinct_initial_confidence),
      instinct_confidence_floor: Number(map.instinct_confidence_floor ?? DEFAULTS.instinct_confidence_floor),
      instinct_confidence_ceiling: Number(map.instinct_confidence_ceiling ?? DEFAULTS.instinct_confidence_ceiling),
      instinct_decay_rate: Number(map.instinct_decay_rate ?? DEFAULTS.instinct_decay_rate),
      instinct_boost_factor: Number(map.instinct_boost_factor ?? DEFAULTS.instinct_boost_factor),
      instinct_fail_factor: Number(map.instinct_fail_factor ?? DEFAULTS.instinct_fail_factor),
      instinct_access_threshold_days: Number(map.instinct_access_threshold_days ?? DEFAULTS.instinct_access_threshold_days),
      instinct_promotion_threshold: Number(map.instinct_promotion_threshold ?? DEFAULTS.instinct_promotion_threshold),
      contradiction_similarity_threshold: Number(map.contradiction_similarity_threshold ?? DEFAULTS.contradiction_similarity_threshold),
    };
  }
}
