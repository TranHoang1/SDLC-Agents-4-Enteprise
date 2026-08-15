/**
 * SA4E-108 — Project Type Detection Models & Zod Schemas.
 * Defines KB entry structure, detection results, and indexing config.
 */
import { z } from 'zod';

/** Signal: file pattern + confidence weight for detection */
export const SignalSchema = z.object({
  file: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

/** Full project type configuration (stored in KB) */
export const ProjectTypeConfigSchema = z.object({
  type_id: z.string().min(1),
  display_name: z.string().min(1),
  signals: z.array(SignalSchema).min(1).max(20),
  source_roots: z.array(z.string()).min(1),
  test_roots: z.array(z.string()).optional().default([]),
  exclude_patterns: z.array(z.string()).min(1),
  extensions: z.array(z.string()).min(1),
  mono_repo_signals: z.array(z.string()).optional().default([]),
  priority: z.number().optional().default(0),
  auto_discovered: z.boolean().optional().default(false),
});

export type ProjectTypeConfig = z.infer<typeof ProjectTypeConfigSchema>;
export type Signal = z.infer<typeof SignalSchema>;

/** Result of project type detection */
export interface DetectionResult {
  project_type: string;
  build_tool: string;
  confidence: number;
  detected_files: string[];
  source_roots: string[];
  test_roots: string[];
  exclude_patterns: string[];
  extensions: string[];
  is_mono_repo: boolean;
  sub_projects?: SubProject[];
}

/** Sub-project within a mono-repo */
export interface SubProject {
  path: string;
  type: string;
  source_roots: string[];
}

/** Config passed to async-file-scanner */
export interface IndexingConfig {
  sourceRoots: string[];
  excludePatterns: string[];
  includeExtensions: string[];
  testRoots: string[];
  scanOrder: 'source_first' | 'default';
}

/** Scored match during detection */
export interface ScoredMatch {
  config: ProjectTypeConfig;
  score: number;
  matchedFiles: string[];
}

/** Fallback detection result constant */
export const FALLBACK_TYPE = 'fallback';
