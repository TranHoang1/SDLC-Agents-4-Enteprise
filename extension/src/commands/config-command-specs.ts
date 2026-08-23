/**
 * SA4E-193 — Per-command specification table for the four create-config
 * commands. PURE DATA — no behaviour.
 *
 * User-visible strings (prompts, placeholders, validation messages via
 * nameExample, toast templates) are contractual per FSD §3.8 — do NOT edit.
 */

import * as path from "path";
import { ConfigType } from "./validation-gate";

export interface ConfigCommandSpec {
  readonly kind: ConfigType;
  readonly descriptionPrompt: string;
  readonly descriptionPlaceholder: string;
  readonly namePrompt: string;
  readonly nameExample: string;
  readonly namePrefix: string;
  /** Label used in "Failed to create {errorLabel}: ..." error toasts. */
  readonly errorLabel: string;
  /** BR-05 output path — built ONLY from workspace root + confirmed name. */
  readonly targetPath: (root: string, name: string) => string;
  readonly successMessage: (name: string) => string;
}

export const AGENT_SPEC: ConfigCommandSpec = {
  kind: "agent",
  descriptionPrompt: "Describe the agent you want to create",
  descriptionPlaceholder: "e.g., A documentation agent that generates API docs from code comments",
  namePrompt: "Agent name (kebab-case)",
  nameExample: "my-agent",
  namePrefix: "agent",
  errorLabel: "agent",
  targetPath: (root, name) => path.join(root, ".code-intel", "agents", `${name}.md`),
  successMessage: (name) => `✅ Agent "${name}" created at .code-intel/agents/${name}.md`,
};

export const HOOK_SPEC: ConfigCommandSpec = {
  kind: "hook",
  descriptionPrompt: "Describe the hook you want to create",
  descriptionPlaceholder: "e.g., Auto-validate XML when draw.io files are edited",
  namePrompt: "Hook name (kebab-case)",
  nameExample: "my-hook",
  namePrefix: "hook",
  errorLabel: "hook",
  targetPath: (root, name) => path.join(root, ".code-intel", "hooks", `${name}.json`),
  successMessage: (name) => `✅ Hook "${name}" created at .code-intel/hooks/${name}.json`,
};

export const STEERING_SPEC: ConfigCommandSpec = {
  kind: "steering",
  descriptionPrompt: "Describe the steering rule you want to create",
  descriptionPlaceholder: "e.g., Always use semantic versioning for git tags",
  namePrompt: "Rule name (kebab-case)",
  nameExample: "my-rule",
  namePrefix: "rule",
  errorLabel: "steering rule",
  targetPath: (root, name) => path.join(root, ".code-intel", "steering", `${name}.md`),
  successMessage: (name) => `✅ Steering rule "${name}" created at .code-intel/steering/${name}.md`,
};

export const SKILL_SPEC: ConfigCommandSpec = {
  kind: "skill",
  descriptionPrompt: "Describe the skill you want to create",
  descriptionPlaceholder: "e.g., A skill for reviewing code security vulnerabilities",
  namePrompt: "Skill name (kebab-case)",
  nameExample: "my-skill",
  namePrefix: "skill",
  errorLabel: "skill",
  targetPath: (root, name) => path.join(root, ".code-intel", "skills", name, "SKILL.md"),
  successMessage: (name) => `✅ Skill "${name}" created at .code-intel/skills/${name}/SKILL.md`,
};
