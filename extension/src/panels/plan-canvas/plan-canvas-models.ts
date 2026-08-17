/**
 * Plan Canvas models — Data types for pipeline status visualization.
 * SA4E-132: Separates data models from processing logic (SRP).
 */

/** Possible statuses for a pipeline phase. */
export type PhaseStatus = "done" | "in_progress" | "not_started" | "needs_revision" | "blocked";

/** Single phase entry from STATUS.json. */
export interface PhaseEntry {
  status: PhaseStatus;
  file?: string;
  version?: number;
  completedAt?: string;
  startedAt?: string;
  iterations?: number;
  maxIterations?: number;
}

/** Parsed STATUS.json structure. */
export interface PipelineStatus {
  ticket: string;
  currentPhase: string;
  phases: Record<string, PhaseEntry>;
  lastUpdated?: string;
}

/** Color mapping for phase statuses (BR-801). */
export const STATUS_COLORS: Record<PhaseStatus, string> = {
  done: "#4CAF50",
  in_progress: "#FFC107",
  blocked: "#F44336",
  not_started: "#9E9E9E",
  needs_revision: "#FF9800",
};

/** Emoji icons for each phase. */
export const PHASE_ICONS: Record<string, string> = {
  requirements: "📋",
  specification: "📝",
  design: "🏗️",
  security_design_review: "🔒",
  test_planning: "🧪",
  devops_pipeline_setup: "⚙️",
  implementation: "💻",
  security_code_review: "🛡️",
  testing: "✅",
  pentest: "🔍",
  security_deploy_review: "🚀🔒",
  deployment: "🚀",
};

/** Human-readable display names for phases. */
export const PHASE_DISPLAY_NAMES: Record<string, string> = {
  requirements: "Requirements",
  specification: "Specification",
  design: "Design",
  security_design_review: "Security Design",
  test_planning: "Test Planning",
  devops_pipeline_setup: "DevOps Setup",
  implementation: "Implementation",
  security_code_review: "Security Review",
  testing: "Testing",
  pentest: "Pentest",
  security_deploy_review: "Deploy Review",
  deployment: "Deployment",
};
