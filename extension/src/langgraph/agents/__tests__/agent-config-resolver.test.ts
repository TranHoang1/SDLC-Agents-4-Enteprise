/**
 * SA4E-186 — Unit Tests: AgentConfigResolver (UT-09 to UT-17).
 * Tests agent selection, config resolution, and fallback behavior.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { AgentConfigResolver } from "../agent-config-resolver";
import type { AgentMeta } from "../../../chat/types/messages";

vi.mock("fs");

const WORKSPACE_ROOT = "/workspace";

const mockAgent: AgentMeta = {
  id: "dev-agent",
  name: "DEV Agent",
  description: "Developer implementation agent",
  tools: ["read_file", "write_file", "mem_*"],
  model: "claude-sonnet-4-20250514",
  mcpServers: [],
  autoApprove: [],
  filePath: "/workspace/.code-intel/agents/dev-agent.md",
};

const agentFileContent = `---
name: dev-agent
description: Developer implementation agent
tools: ['read_file', 'write_file', 'mem_*']
model: claude-sonnet-4-20250514
---

You are the DEV agent. You implement code based on TDD specifications.

## Responsibilities
- Write clean, tested code
- Follow SOLID principles
`;

describe("AgentConfigResolver", () => {
  let resolver: AgentConfigResolver;
  let findAgentMeta: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    findAgentMeta = vi.fn();
    resolver = new AgentConfigResolver(WORKSPACE_ROOT, findAgentMeta);
  });

  // UT-09: selectAgent(null) returns fallback
  it("selectAgent(null) clears config and returns fallback", () => {
    const result = resolver.selectAgent(null);
    expect(result.agentId).toBeNull();
    expect(result.agentName).toBe("All Agents (Default)");
    expect(resolver.getActiveConfig()).toBeNull();
  });

  // UT-10: selectAgent with unknown ID returns fallback
  it("selectAgent with unknown ID returns fallback", () => {
    findAgentMeta.mockReturnValue(undefined);
    const result = resolver.selectAgent("unknown-agent");
    expect(result.agentId).toBeNull();
    expect(result.agentName).toBe("All Agents (Default)");
    expect(resolver.getActiveConfig()).toBeNull();
  });

  // UT-11: selectAgent with valid ID resolves config
  it("selectAgent with valid ID resolves config correctly", () => {
    findAgentMeta.mockReturnValue(mockAgent);
    vi.mocked(fs.readFileSync).mockReturnValue(agentFileContent);

    const result = resolver.selectAgent("dev-agent");

    expect(result.agentId).toBe("dev-agent");
    expect(result.agentName).toBe("DEV Agent");

    const config = resolver.getActiveConfig();
    expect(config).not.toBeNull();
    expect(config!.agentId).toBe("dev-agent");
    expect(config!.agentName).toBe("DEV Agent");
    expect(config!.model).toBe("claude-sonnet-4-20250514");
    expect(config!.toolPatterns).toEqual(["read_file", "write_file", "mem_*"]);
    expect(config!.systemPromptBody).toContain("You are the DEV agent");
    expect(config!.systemPromptBody).not.toContain("---");
    expect(config!.resolvedAt).toBeGreaterThan(0);
  });

  // UT-12: strips frontmatter from agent body
  it("strips frontmatter from agent file body", () => {
    findAgentMeta.mockReturnValue(mockAgent);
    vi.mocked(fs.readFileSync).mockReturnValue(agentFileContent);

    resolver.selectAgent("dev-agent");
    const config = resolver.getActiveConfig();

    expect(config!.systemPromptBody).not.toContain("name: dev-agent");
    expect(config!.systemPromptBody).toContain("You are the DEV agent");
  });

  // UT-13: empty tools array → undefined (unrestricted)
  it("normalizes empty tools array to undefined (unrestricted)", () => {
    const agentNoTools: AgentMeta = {
      ...mockAgent,
      tools: [],
    };
    findAgentMeta.mockReturnValue(agentNoTools);
    vi.mocked(fs.readFileSync).mockReturnValue(agentFileContent);

    resolver.selectAgent("dev-agent");
    const config = resolver.getActiveConfig();

    expect(config!.toolPatterns).toBeUndefined();
  });

  // UT-14: model undefined when not specified
  it("sets model to undefined when agent has no model field", () => {
    const agentNoModel: AgentMeta = {
      ...mockAgent,
      model: undefined,
    };
    findAgentMeta.mockReturnValue(agentNoModel);
    vi.mocked(fs.readFileSync).mockReturnValue(agentFileContent);

    resolver.selectAgent("dev-agent");
    const config = resolver.getActiveConfig();

    expect(config!.model).toBeUndefined();
  });

  // UT-15: clear() resets config to null
  it("clear() resets active config to null", () => {
    findAgentMeta.mockReturnValue(mockAgent);
    vi.mocked(fs.readFileSync).mockReturnValue(agentFileContent);

    resolver.selectAgent("dev-agent");
    expect(resolver.getActiveConfig()).not.toBeNull();

    resolver.clear();
    expect(resolver.getActiveConfig()).toBeNull();
  });

  // UT-16: handles file read errors gracefully
  it("returns empty body when file cannot be read", () => {
    findAgentMeta.mockReturnValue(mockAgent);
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT: no such file or directory");
    });

    const result = resolver.selectAgent("dev-agent");
    const config = resolver.getActiveConfig();

    expect(result.agentId).toBe("dev-agent");
    expect(config!.systemPromptBody).toBe("");
  });

  // UT-17: subsequent selectAgent overwrites previous config
  it("subsequent selectAgent replaces previous config", () => {
    const otherAgent: AgentMeta = {
      ...mockAgent,
      id: "qa-agent",
      name: "QA Agent",
      tools: ["read_file"],
    };

    findAgentMeta.mockReturnValueOnce(mockAgent);
    vi.mocked(fs.readFileSync).mockReturnValueOnce(agentFileContent);
    resolver.selectAgent("dev-agent");

    findAgentMeta.mockReturnValueOnce(otherAgent);
    vi.mocked(fs.readFileSync).mockReturnValueOnce(
      "---\nname: qa-agent\n---\nQA instructions"
    );
    resolver.selectAgent("qa-agent");

    const config = resolver.getActiveConfig();
    expect(config!.agentId).toBe("qa-agent");
    expect(config!.agentName).toBe("QA Agent");
    expect(config!.systemPromptBody).toBe("QA instructions");
  });
});
