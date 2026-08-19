/**
 * SA4E-186 — Agent Config Resolver
 * Resolves runtime configuration from agent metadata for per-agent
 * prompt switching, tool filtering, and model routing.
 *
 * Single Responsibility: resolve and store the active agent config.
 * Dependency Inversion: receives findAgentMeta as injected function.
 */

import * as fs from "fs";
import type { AgentMeta } from "../../chat/types/messages";

/** Runtime configuration resolved from an agent's metadata and file body. */
export interface ActiveAgentConfig {
  /** Agent identifier */
  agentId: string;
  /** Display name */
  agentName: string;
  /** Agent markdown body (after frontmatter stripped) */
  systemPromptBody: string;
  /** Tool patterns — undefined = no restriction, [] = text-only */
  toolPatterns: string[] | undefined;
  /** LLM model identifier — undefined = use default */
  model: string | undefined;
  /** Timestamp when this config was resolved */
  resolvedAt: number;
}

/** Callback type for finding agent metadata by ID. */
export type FindAgentMetaFn = (agentId: string) => AgentMeta | undefined;

/**
 * Resolves and stores the active agent configuration.
 * One instance per engine — all graph nodes share the same resolver.
 */
export class AgentConfigResolver {
  private activeConfig: ActiveAgentConfig | null = null;

  constructor(
    private readonly workspaceRoot: string,
    private readonly findAgentMeta: FindAgentMetaFn
  ) {}

  /**
   * Select an agent by ID. Reads agent file, strips frontmatter,
   * and stores the resolved config. Pass null to deselect.
   *
   * @returns Confirmation payload for AGENT_SWITCHED message.
   */
  selectAgent(
    agentId: string | null
  ): { agentId: string | null; agentName: string } {
    if (agentId === null) {
      return this.clearAndReturnDefault();
    }

    const meta = this.findAgentMeta(agentId);
    if (!meta) {
      console.warn(
        `[AgentConfigResolver] Agent '${agentId}' not found in registry`
      );
      return this.clearAndReturnDefault();
    }

    const body = this.readAgentBody(meta.filePath);
    const toolPatterns = this.resolveToolPatterns(meta.tools);

    this.activeConfig = {
      agentId: meta.id,
      agentName: meta.name,
      systemPromptBody: body,
      toolPatterns,
      model: meta.model || undefined,
      resolvedAt: Date.now(),
    };

    return { agentId: meta.id, agentName: meta.name };
  }

  /** Get current active config. Returns null in fallback mode. */
  getActiveConfig(): ActiveAgentConfig | null {
    return this.activeConfig;
  }

  /** Clear active config — return to fallback (all agents) mode. */
  clear(): void {
    this.activeConfig = null;
  }

  /** Clear config and return fallback payload. */
  private clearAndReturnDefault(): {
    agentId: string | null;
    agentName: string;
  } {
    this.activeConfig = null;
    return { agentId: null, agentName: "All Agents (Default)" };
  }

  /**
   * Read agent file and extract body (everything after frontmatter).
   * Synchronous — agent files are small (<10KB), local disk.
   */
  private readAgentBody(filePath: string): string {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return content.replace(/^---[\s\S]*?---\r?\n?/, "").trim();
    } catch (err) {
      console.warn(
        `[AgentConfigResolver] Cannot read agent file: ${(err as Error).message}`
      );
      return "";
    }
  }

  /**
   * Normalize tool patterns from AgentMeta.tools array.
   * - Empty array with original frontmatter having no `tools` field → undefined (unrestricted)
   * - Explicit empty array in frontmatter → [] (text-only mode)
   * - Non-empty array → the patterns as-is
   *
   * Note: We use tools.length > 0 to detect explicit patterns.
   * The AgentMeta parser sets tools=[] both for "omitted" and "tools: []".
   * To differentiate, we treat empty array as text-only (per FSD spec).
   */
  private resolveToolPatterns(tools: string[]): string[] | undefined {
    if (tools.length > 0) return tools;
    return undefined;
  }
}
