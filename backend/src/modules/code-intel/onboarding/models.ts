/**
 * SA4E-166 — Onboarding Models & Zod Schemas.
 * Defines data contracts for codebase onboarding generation:
 * input validation, result types, and module metadata.
 */

import { z } from 'zod';

// --- Zod Schemas ---

/** Schema for onboarding_generate input */
export const OnboardingInputSchema = z.object({
  force: z.boolean().optional().default(false),
});

export type OnboardingInput = z.infer<typeof OnboardingInputSchema>;

// --- Interfaces ---

/** Result of onboarding generation */
export interface OnboardingResult {
  /** Generated ONBOARDING.md content */
  content: string;
  /** Whether the result came from cache */
  cached: boolean;
  /** ISO timestamp of generation */
  generatedAt: string;
}

/** Metadata for a discovered module/directory */
export interface ModuleInfo {
  /** Module/directory name */
  name: string;
  /** Relative path from workspace root */
  path: string;
  /** Brief description derived from analysis */
  description: string;
  /** Key exported symbols (classes, functions) */
  exports: string[];
}

/** Parsed package.json metadata relevant for onboarding */
export interface PackageMetadata {
  name: string;
  description: string;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

/** Cache state for change detection (BR-1102) */
export interface CacheState {
  /** Hash of file list at generation time */
  fileListHash: string;
  /** Total file count at generation time */
  fileCount: number;
  /** ISO timestamp of last generation */
  generatedAt: string;
}

/** Interface for the onboarding service (DIP) */
export interface IOnboardingService {
  /** Generate onboarding document for workspace */
  generate(force?: boolean): Promise<OnboardingResult>;
}
