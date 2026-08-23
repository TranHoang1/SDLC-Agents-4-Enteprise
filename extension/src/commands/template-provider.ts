/**
 * SA4E-193 — TemplateProvider (C2): single source of truth for per-type
 * generation assets (TDD §3.1).
 *
 * - getLlmPrompt(type): the ONLY accessor for *_LLM_PROMPT constants (D-6)
 * - getFallbackScaffold(type, confirmedName, description): deterministic
 *   offline scaffold. Accepts the USER-CONFIRMED name so fallback content can
 *   never diverge from filename/folder identity (D-5). The agent scaffold
 *   returns BODY ONLY — canonical frontmatter is prepended by the gate/handler
 *   exactly once (D-1 root-cause fix).
 * - getTemplateSpec(type): best-effort read of config-templates/*.template
 *   spec text (OI-08 pending decision; failure is non-fatal).
 */

import * as fs from "fs";
import * as path from "path";
import { ConfigType } from "./validation-gate";
import { serializeHookCanonical } from "./hook-gate";
import {
  AGENT_LLM_PROMPT,
  HOOK_LLM_PROMPT,
  SKILL_LLM_PROMPT,
  STEERING_LLM_PROMPT,
} from "./llm-prompts";

const TEMPLATE_SPEC_FILES: Record<ConfigType, string> = {
  agent: "agent.md.template",
  hook: "hook.json.template",
  steering: "steering.md.template",
  skill: "skill.md.template",
};

/** Single accessor for LLM system prompts (resolves D-6 drift risk). */
export function getLlmPrompt(type: ConfigType): string {
  switch (type) {
    case "agent":
      return AGENT_LLM_PROMPT;
    case "hook":
      return HOOK_LLM_PROMPT;
    case "steering":
      return STEERING_LLM_PROMPT;
    case "skill":
      return SKILL_LLM_PROMPT;
  }
}

/**
 * Deterministic fallback scaffold (FR-COMMON-02). `confirmedName` is the
 * user-confirmed kebab-case name — NEVER re-derived from description (D-5).
 */
export function getFallbackScaffold(
  type: ConfigType,
  confirmedName: string,
  description: string
): string {
  switch (type) {
    case "agent":
      return agentScaffold(confirmedName, description);
    case "hook":
      return hookScaffold(confirmedName, description);
    case "steering":
      return steeringScaffold(confirmedName, description);
    case "skill":
      return skillScaffold(confirmedName, description);
  }
}

/** Agent fallback BODY ONLY — no frontmatter; gate prepends the canonical block once (D-1). */
function agentScaffold(name: string, description: string): string {
  return (
    `You are the ${name} agent.\n\n**Description:** ${description}\n\n` +
    "**Role:**\n- [Define the agent's primary role]\n- [Define key responsibilities]\n\n" +
    "**Constraints:**\n- [List constraints]\n"
  );
}

/** Hook fallback object serialized canonically (2-space indent, no empty action fields — D-7). */
function hookScaffold(name: string, description: string): string {
  const hook = {
    enabled: true,
    name: name,
    description: description,
    version: "1",
    when: { type: "promptSubmit" },
    then: { type: "askAgent", prompt: `[Instructions for ${name} based on: ${description}]` },
  };
  return serializeHookCanonical(hook);
}

/** Steering fallback with frontmatter + rule slots; title uses confirmedName (D-5). */
function steeringScaffold(name: string, description: string): string {
  return (
    `---\ninclusion: auto\ndescription: ${description}\n---\n\n# ${name}\n\n${description}\n\n` +
    "## Rules\n\n1. [Define rule 1]\n2. [Define rule 2]\n"
  );
}

/** Skill fallback SKILL.md; frontmatter name == confirmed folder name (D-5/AF-33). */
function skillScaffold(name: string, description: string): string {
  return (
    `---\nname: ${name}\ndescription: ${description}\n---\n\n## When to Use\n\n${description}\n\n` +
    "## Workflow\n\n1. [Step 1]\n2. [Step 2]\n"
  );
}

/** Best-effort spec-text reader for config-templates/*.template (non-fatal on miss). */
export function getTemplateSpec(type: ConfigType): string | undefined {
  try {
    const specPath = path.join(__dirname, "config-templates", TEMPLATE_SPEC_FILES[type]);
    return fs.readFileSync(specPath, "utf-8");
  } catch (err) {
    console.debug("[TemplateProvider] template spec unavailable:", (err as Error).message);
    return undefined;
  }
}
