/**
 * SA4E-119 Feature Flags — ECC Feature Parity
 *
 * Controls incremental rollout of 12 ECC features.
 * Flags can be overridden via environment variables (SA4E_FF_*) or config file.
 *
 * Reference: TDD Section 10.1 — Deployment Considerations / Feature Flags
 */

/** Feature flag configuration for SA4E-119 ECC features */
export interface SA4E119FeatureFlags {
  /** Enable confidence scoring + instinct re-ranking (Knowledge Enhancement) */
  confidenceScoring: boolean;
  /** Enable GateGuard command blocking (Security and Safety) */
  gateguard: boolean;
  /** Enable AgentShield config scanning (Security and Safety) */
  agentshield: boolean;
  /** Enable skill pack system (Developer Productivity) */
  skillPacks: boolean;
  /** Enable model tier routing — requires multi-model config (Context Management) */
  modelTiering: boolean;
  /** Enable post-phase context compaction (Context Management) */
  contextCompaction: boolean;
  /** Enable auto-extraction of patterns on ticket completion (Knowledge Enhancement) */
  patternExtraction: boolean;
  /** Enable multi-voice council decisions — experimental (Quality Assurance) */
  council: boolean;
  /** Enable GAN-style adversarial review — experimental (Quality Assurance) */
  adversarialReview: boolean;
}

/** Default flag values per TDD Section 10.1 */
export const SA4E_119_FLAG_DEFAULTS: Readonly<SA4E119FeatureFlags> = {
  confidenceScoring: true,
  gateguard: true,
  agentshield: true,
  skillPacks: true,
  modelTiering: false,       // Requires multi-model config
  contextCompaction: true,
  patternExtraction: true,
  council: false,            // Experimental
  adversarialReview: false,  // Experimental
};

/** Environment variable mapping for runtime override */
const ENV_MAPPING: Record<keyof SA4E119FeatureFlags, string> = {
  confidenceScoring: 'SA4E_FF_CONFIDENCE_SCORING',
  gateguard: 'SA4E_FF_GATEGUARD',
  agentshield: 'SA4E_FF_AGENTSHIELD',
  skillPacks: 'SA4E_FF_SKILL_PACKS',
  modelTiering: 'SA4E_FF_MODEL_TIERING',
  contextCompaction: 'SA4E_FF_CONTEXT_COMPACTION',
  patternExtraction: 'SA4E_FF_PATTERN_EXTRACTION',
  council: 'SA4E_FF_COUNCIL',
  adversarialReview: 'SA4E_FF_ADVERSARIAL_REVIEW',
};

/**
 * Parse a boolean env var. Accepts "true"/"1"/"yes" as truthy, "false"/"0"/"no" as falsy.
 * Returns undefined if env var is not set.
 */
function parseBoolEnv(value: string | undefined): boolean | undefined {
  if (value === undefined || value === '') return undefined;
  const lower = value.toLowerCase().trim();
  if (['true', '1', 'yes'].includes(lower)) return true;
  if (['false', '0', 'no'].includes(lower)) return false;
  return undefined;
}

/**
 * Load SA4E-119 feature flags.
 * Priority: env vars > overrides param > defaults.
 *
 * @param overrides Optional partial overrides (e.g., from config file)
 * @returns Resolved feature flag values
 */
export function loadSA4E119Flags(
  overrides?: Partial<SA4E119FeatureFlags>
): SA4E119FeatureFlags {
  const flags = { ...SA4E_119_FLAG_DEFAULTS };

  // Apply config-level overrides
  if (overrides) {
    for (const key of Object.keys(overrides) as Array<keyof SA4E119FeatureFlags>) {
      if (overrides[key] !== undefined) {
        flags[key] = overrides[key]!;
      }
    }
  }

  // Apply environment variable overrides (highest priority)
  for (const [key, envVar] of Object.entries(ENV_MAPPING)) {
    const envValue = parseBoolEnv(process.env[envVar]);
    if (envValue !== undefined) {
      flags[key as keyof SA4E119FeatureFlags] = envValue;
    }
  }

  return flags;
}

/**
 * Check if a specific SA4E-119 feature is enabled.
 * Convenience wrapper for single-flag checks in module initialization.
 *
 * @param flag The feature flag key to check
 * @param overrides Optional partial overrides
 * @returns Whether the feature is enabled
 */
export function isFeatureEnabled(
  flag: keyof SA4E119FeatureFlags,
  overrides?: Partial<SA4E119FeatureFlags>
): boolean {
  const flags = loadSA4E119Flags(overrides);
  return flags[flag];
}
